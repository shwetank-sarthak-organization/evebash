import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { saveGuestPreviewPicture, GuestPreviewPictureError, type GuestPreviewPictureDependencies } from '../src/services/guestPreviewPicture.js';

const NOW = new Date('2026-11-12T08:00:00.000Z');
const OLD_URL = 'https://media.example/events/wedding-fdd8/guest-preview/app-old.jpg';

async function input(width = 1170, height = 2532) {
  const bytes = await sharp({ create: { width, height, channels: 3, background: '#e0457b' } }).jpeg().toBuffer();
  return { eventId: 'wedding-fdd8', templateId: 'confetti', image: `data:image/jpeg;base64,${bytes.toString('base64')}` };
}
function fixture(overrides: Partial<GuestPreviewPictureDependencies> = {}, saved: unknown = null) {
  const uploaded: string[] = [], removed: string[] = [], committed: { previous: unknown; url: string }[] = [];
  const deps: GuestPreviewPictureDependencies = {
    canManage: async () => true,
    load: async () => ({ picture: saved }),
    upload: async (key, bytes) => { uploaded.push(key); assert.equal((await sharp(bytes).metadata()).format, 'jpeg'); return `https://media.example/${key}`; },
    commit: async (_eventId, previous, picture) => { committed.push({ previous, url: picture.url }); return true; },
    remove: async key => { removed.push(key); },
    now: () => NOW,
    ...overrides,
  };
  return { deps, uploaded, removed, committed };
}
async function rejectsStatus(action: Promise<unknown>, status: number) {
  await assert.rejects(action, error => error instanceof GuestPreviewPictureError && error.status === status);
}

test('rejects people who do not manage the event before reading the picture', async () => {
  const f = fixture({ canManage: async () => false });
  await rejectsStatus(saveGuestPreviewPicture(await input(), f.deps), 403);
  assert.equal(f.uploaded.length, 0);
});

test('rejects bad event and template IDs, and a missing event', async () => {
  for (const changes of [{ eventId: '' }, { eventId: '../other' }, { eventId: 'a/b' }, { templateId: 'x'.repeat(65) }, { templateId: 7 }]) {
    const f = fixture();
    await rejectsStatus(saveGuestPreviewPicture({ ...await input(), ...changes }, f.deps), 400);
    assert.equal(f.uploaded.length, 0);
  }
  const f = fixture({ load: async () => null });
  await rejectsStatus(saveGuestPreviewPicture(await input(), f.deps), 404);
  assert.equal(f.uploaded.length, 0);
});

test('rejects pictures that are not a readable JPEG without writing to storage', async () => {
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#000' } }).png().toBuffer();
  for (const image of ['https://internal.example/picture.jpg', 'data:image/jpeg;base64,bm90YW5pbWFnZQ==',
    `data:image/jpeg;base64,${png.toString('base64')}`, 'data:image/jpeg;base64,' + 'A'.repeat(2_800_001)]) {
    const f = fixture();
    await rejectsStatus(saveGuestPreviewPicture({ ...await input(), image }, f.deps), 400);
    assert.equal(f.uploaded.length, 0);
  }
});

test('saves a smaller JPEG under the event, with the template and time, the first time', async () => {
  const f = fixture();
  const result = await saveGuestPreviewPicture({ ...await input(), storageKey: 'attacker-supplied-key' }, f.deps);
  assert.match(result.picture.url, /^https:\/\/media\.example\/events\/wedding-fdd8\/guest-preview\/app-[a-f0-9-]+\.jpg$/);
  assert.equal(result.picture.width, 720);
  assert.equal(result.picture.height, Math.round(2532 * 720 / 1170));
  assert.equal(result.picture.templateId, 'confetti');
  assert.equal(result.picture.takenAt, NOW.toISOString());
  assert.deepEqual(f.committed, [{ previous: null, url: result.picture.url }]);
  assert.deepEqual(f.removed, []);
});

test('keeps a small picture its own size and allows no template', async () => {
  const f = fixture();
  const result = await saveGuestPreviewPicture({ ...await input(390, 844), templateId: null }, f.deps);
  assert.equal(result.picture.width, 390);
  assert.equal(result.picture.templateId, null);
});

test('deletes the picture it replaces, but nothing outside this event\'s preview folder', async () => {
  const saved = { url: OLD_URL, templateId: 'hero', takenAt: '2026-11-11T08:00:00.000Z', width: 585, height: 1266 };
  const f = fixture({}, saved);
  await saveGuestPreviewPicture(await input(), f.deps);
  assert.deepEqual(f.committed[0].previous, saved);
  assert.deepEqual(f.removed, ['events/wedding-fdd8/guest-preview/app-old.jpg']);

  for (const url of ['https://media.example/events/wedding-fdd8/photos/cover.jpg', 'https://media.example/events/other/guest-preview/app-x.jpg',
    'https://elsewhere.example/events/wedding-fdd8/guest-preview/app-x.jpg', 'not a url']) {
    const other = fixture({}, { ...saved, url });
    await saveGuestPreviewPicture(await input(), other.deps);
    assert.deepEqual(other.removed, []);
  }
});

test('removes its own upload when another save came first or the database fails', async () => {
  const lost = fixture({ commit: async () => false }, { url: OLD_URL });
  await rejectsStatus(saveGuestPreviewPicture(await input(), lost.deps), 409);
  assert.deepEqual(lost.removed, lost.uploaded);

  const failed = fixture({ commit: async () => { throw new Error('database unavailable'); } });
  await assert.rejects(saveGuestPreviewPicture(await input(), failed.deps), /database unavailable/);
  assert.deepEqual(failed.removed, failed.uploaded);
});
