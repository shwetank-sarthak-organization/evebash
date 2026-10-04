import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { saveVideoThumbnail, ThumbnailError, type ThumbnailMedia, type ThumbnailDependencies } from '../src/services/videoThumbnail.js';

const sample: ThumbnailMedia = { id: 'video-1', event_id: 'event-1', storage_key: 'events/event-1/movie.mp4', url: 'https://media.example/hls/events/event-1/movie.mp4/master.m3u8', thumbnail_url: 'https://media.example/hls/events/event-1/movie.mp4/poster.jpg', media_type: 'video', status: 'processed' };
async function input() {
  const bytes = await sharp({ create: { width: 32, height: 16, channels: 3, background: '#007755' } }).jpeg().toBuffer();
  return { photoId: sample.id, previousThumbnailUrl: sample.thumbnail_url, image: `data:image/jpeg;base64,${bytes.toString('base64')}` };
}
function fixture(overrides: Partial<ThumbnailDependencies> = {}) {
  const uploaded: string[] = [], removed: string[] = [], committed: string[] = [];
  const deps: ThumbnailDependencies = {
    load: async () => ({ ...sample }), canEdit: async () => true,
    upload: async (key, bytes) => { uploaded.push(key); assert.equal((await sharp(bytes).metadata()).format, 'jpeg'); return `https://media.example/${key}`; },
    commit: async (_media, url) => { committed.push(url); return true; }, remove: async key => { removed.push(key); }, ...overrides,
  };
  return { deps, uploaded, removed, committed };
}
async function rejectsStatus(action: Promise<unknown>, status: number) {
  await assert.rejects(action, error => error instanceof ThumbnailError && error.status === status);
}
test('rejects unauthorized users before decoding or uploading a frame', async () => {
  const f = fixture({ canEdit: async () => false });
  await rejectsStatus(saveVideoThumbnail('stranger', await input(), f.deps), 403);
  assert.equal(f.uploaded.length, 0);
});
test('rejects missing media, photos, unfinished processing and stale client versions', async () => {
  for (const [changes, status] of [[null, 404], [{ media_type: 'photo' }, 400], [{ status: 'processing' }, 409], [{ thumbnail_url: 'new-url' }, 409]] as const) {
    const f = fixture({ load: async () => changes === null ? null : ({ ...sample, ...changes }) });
    await rejectsStatus(saveVideoThumbnail('owner', await input(), f.deps), status);
    assert.equal(f.uploaded.length, 0);
  }
});
test('rejects invalid and oversized frames without writing to storage', async () => {
  for (const image of ['https://internal.example/frame', 'data:image/jpeg;base64,bm90YW5pbWFnZQ==', 'data:image/jpeg;base64,' + 'A'.repeat(2_800_001)]) {
    const f = fixture();
    await rejectsStatus(saveVideoThumbnail('owner', { ...await input(), image }, f.deps), 400);
    assert.equal(f.uploaded.length, 0);
  }
});
test('saves a versioned JPEG and leaves the original video and automatic poster intact', async () => {
  const f = fixture();
  const result = await saveVideoThumbnail('owner', { ...await input(), storageKey: 'attacker-supplied-key' }, f.deps);
  assert.match(result.thumbnailUrl, /events\/event-1\/movie\.mp4-hls\/custom-thumbnail-[a-f0-9-]+\.jpg$/);
  assert.deepEqual(f.committed, [result.thumbnailUrl]);
  assert.deepEqual(f.removed, []);
});
test('cleans up a losing concurrent save without removing the previous thumbnail', async () => {
  const f = fixture({ commit: async () => false });
  await rejectsStatus(saveVideoThumbnail('owner', await input(), f.deps), 409);
  assert.deepEqual(f.removed, f.uploaded);
});
test('cleans up upload if the database fails', async () => {
  const f = fixture({ commit: async () => { throw new Error('database unavailable'); } });
  await assert.rejects(saveVideoThumbnail('owner', await input(), f.deps), /database unavailable/);
  assert.deepEqual(f.removed, f.uploaded);
});
test('replaces only a custom thumbnail belonging to this video', async () => {
  const key = `${sample.storage_key}-hls/custom-thumbnail-old.jpg`;
  const previous = `https://media.example/${key}`;
  const f = fixture({ load: async () => ({ ...sample, thumbnail_url: previous }) });
  await saveVideoThumbnail('owner', { ...await input(), previousThumbnailUrl: previous }, f.deps);
  assert.deepEqual(f.removed, [key]);
});
