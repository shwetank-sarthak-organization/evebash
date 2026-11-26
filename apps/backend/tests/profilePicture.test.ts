import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { isProfilePictureRouteOn, ProfilePictureError, saveProfilePicture } from '../src/services/profilePicture.js';
import { mediaRouter } from '../src/routes/media.js';

// Issue #322: profile pictures are stored by the backend itself under profiles/<user id>/, small, and the previous
// picture's file is deleted once the new one is saved on the profile

const userId = '72b367fb-20c1-4be5-b088-0be57bb85772';
const picture = (format: 'jpeg' | 'png' | 'gif', width = 40, height = 30) =>
  sharp({ create: { width, height, channels: 3, background: '#c0a060' } }).toFormat(format).toBuffer();

function deps(previous: string | null = null, options: { failCommit?: boolean } = {}) {
  const log = { uploads: [] as Array<{ key: string; bytes: Buffer }>, commits: [] as string[], removed: [] as string[], previousRemoved: [] as Array<[string, string]> };
  return {
    log,
    upload: async (key: string, bytes: Buffer) => { log.uploads.push({ key, bytes }); return `https://media.example.com/${key}`; },
    load: async () => previous,
    commit: async (_id: string, url: string) => { if (options.failCommit) throw new Error('database down'); log.commits.push(url); },
    remove: async (key: string) => { log.removed.push(key); },
    removePrevious: async (url: string, keep: string) => { log.previousRemoved.push([url, keep]); },
  };
}

afterEach(() => { delete process.env.PROFILE_PICTURE_ROUTE; });

test('the app (plain base64) and the website (data: link) both get a stored JPEG, saved on the profile', async () => {
  const d = deps();
  const fromApp = await saveProfilePicture({ scope: 'profile', base64: (await picture('jpeg')).toString('base64'), fileName: 'profile-x.jpg' }, userId, d);
  const fromWeb = await saveProfilePicture({ scope: 'profile', base64: `data:image/png;base64,${(await picture('png')).toString('base64')}` }, userId, d);
  for (const result of [fromApp, fromWeb]) {
    assert.match(result.storageKey, new RegExp(`^profiles/${userId}/\\d+-[0-9a-f-]{36}\\.jpg$`));
    assert.equal(result.publicId, result.storageKey);
    assert.equal(result.url, `https://media.example.com/${result.storageKey}`);
  }
  assert.notEqual(fromApp.storageKey, fromWeb.storageKey, 'a new name each time');
  assert.deepEqual(d.log.commits, [fromApp.url, fromWeb.url]);
  for (const upload of d.log.uploads) assert.equal((await sharp(upload.bytes).metadata()).format, 'jpeg');
});

test('pictures are made small: 512 px at most', async () => {
  const d = deps();
  await saveProfilePicture({ base64: (await picture('jpeg', 3000, 2000)).toString('base64') }, userId, d);
  const { width, height } = await sharp(d.log.uploads[0].bytes).metadata();
  assert.deepEqual([width, height], [512, 341]);
});

test('the previous picture is deleted after the new one is saved; none when there was no picture', async () => {
  const old = `https://media.example.com/profiles/${userId}/profile_pic.jpg`;
  const d = deps(old);
  const result = await saveProfilePicture({ base64: (await picture('jpeg')).toString('base64') }, userId, d);
  assert.deepEqual(d.log.previousRemoved, [[old, result.storageKey]]);
  const none = deps(null);
  await saveProfilePicture({ base64: (await picture('jpeg')).toString('base64') }, userId, none);
  assert.deepEqual(none.log.previousRemoved, []);
});

test('if the profile cannot be updated, the new file is removed and the old picture is kept', async () => {
  const d = deps(`https://media.example.com/profiles/${userId}/old.jpg`, { failCommit: true });
  await assert.rejects(saveProfilePicture({ base64: (await picture('jpeg')).toString('base64') }, userId, d), /database down/);
  assert.deepEqual(d.log.removed, [d.log.uploads[0].key]);
  assert.deepEqual(d.log.previousRemoved, []);
});

test('a failed delete of the old picture never fails the save', async () => {
  const d = { ...deps(`https://media.example.com/profiles/${userId}/old.jpg`), removePrevious: async () => { throw new Error('B2 down'); } };
  const result = await saveProfilePicture({ base64: (await picture('jpeg')).toString('base64') }, userId, d);
  assert.equal(result.success, true);
});

test('anything that is not a JPEG, PNG or WebP picture is refused, and nothing is stored', async () => {
  const d = deps();
  const refused = async (body: Record<string, unknown>, id = userId) =>
    assert.rejects(saveProfilePicture(body, id, d), (error: unknown) => error instanceof ProfilePictureError && error.status === 400);
  await refused({ scope: 'event', base64: (await picture('jpeg')).toString('base64') });
  await refused({ base64: '' });
  await refused({ base64: 'not base64!' });
  await refused({ base64: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64') });
  await refused({ base64: (await picture('gif')).toString('base64') });
  await refused({ base64: (await picture('jpeg')).toString('base64') }, '../events/x');
  assert.equal(d.log.uploads.length, 0);
  assert.equal(d.log.commits.length, 0);
});

test('POST /upload needs a login; the off switch hands it on (Route not found, as before)', async () => {
  const layer = (mediaRouter.stack as any[]).find((l) => l.route?.path === '/upload' && l.route.methods.post);
  assert.ok(layer, '/upload route exists');
  const run = () => new Promise<{ status: number; next: boolean }>((resolve) => {
    let status = 200;
    const req = { method: 'POST', path: '/upload', body: { scope: 'profile', base64: 'abc' }, header: () => '', get: () => '', headers: {} };
    const res = { status(code: number) { status = code; return res; }, json() { resolve({ status, next: false }); return res; } };
    layer.route.stack[0].handle(req, res, () => resolve({ status, next: true }));
  });
  assert.equal(isProfilePictureRouteOn(), true);
  assert.deepEqual(await run(), { status: 401, next: false });
  process.env.PROFILE_PICTURE_ROUTE = 'false';
  assert.deepEqual(await run(), { status: 200, next: true });
});
