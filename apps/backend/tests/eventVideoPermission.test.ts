import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { canPostEventVideo, isVideoUpload } from '../src/services/eventVideoPermission.js';

// Real guests columns (no email): a query on a missing column fails here as it does in Supabase
const guestColumns = ['id', 'user_id', 'phone', 'event_id', 'parent_event_id', 'status', 'can_admin', 'can_upload', 'can_comment'];
function assertColumn(table: string, key: string) {
  if (table === 'guests' && !guestColumns.includes(key)) throw new Error(`column guests.${key} does not exist`);
}
function database(tables: Record<string, Record<string, unknown>[]>) {
  return { from(table: string) {
    let rows = tables[table] || [];
    const query = {
      select() { return query; },
      eq(key: string, value: unknown) { assertColumn(table, key); rows = rows.filter(row => row[key] === value); return query; },
      in(key: string, values: unknown[]) { assertColumn(table, key); rows = rows.filter(row => values.includes(row[key])); return query; },
      limit(n: number) { rows = rows.slice(0, n); return query; },
      maybeSingle() { return Promise.resolve({ data: rows[0] || null, error: null }); },
      then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: rows, error: null }).then(resolve); },
    }; return query;
  } } as unknown as SupabaseClient;
}
const events = [{ id: 'root', created_by: 'owner' }, { id: 'child', created_by: 'creator', parent_id: 'root' }];
const user = (id: string, confirmed = true) => ({ id, email: `${id}@example.com`, email_confirmed_at: confirmed ? '2026-01-01' : null }) as User;
test('video detection cannot be bypassed by changing only resourceType to image', () => {
  for (const input of [{ resourceType: 'video' }, { contentType: 'video/mp4' }, { fileName: 'clip.MP4', resourceType: 'image' }, { storageKey: 'events/a/videos/file.jpg' }, { fileName: 'clip.wmv' }, { storageKey: 'clip.mov' }]) assert.equal(isVideoUpload(input), true);
  assert.equal(isVideoUpload({ resourceType: 'image', fileName: 'photo.jpg', storageKey: 'events/a/photos/photo.jpg' }), false);
});
test('only event owners and scoped event administrators may post videos', async () => {
  const db = database({ events, profiles: [{ id: 'delegate', role_type: 'primary', delegated_by: 'owner' }, { id: 'assigned', role_type: 'event' }], profile_assigned_events: [{ profile_id: 'assigned', event_id: 'root' }], guests: [
    { id: '1', user_id: 'admin', event_id: 'root', status: 'approved', can_admin: true },
    { id: '5', phone: 'legacyadmin@example.com', event_id: 'root', status: 'approved', can_admin: true },
    { id: '2', user_id: 'member', event_id: 'root', status: 'approved', can_admin: false, can_upload: true },
    { id: '3', user_id: 'pending', event_id: 'root', status: 'pending', can_admin: true },
    { id: '4', user_id: 'outsider', event_id: 'different', status: 'approved', can_admin: true },
  ] });
  for (const id of ['owner', 'creator', 'admin', 'legacyadmin', 'delegate', 'assigned']) assert.equal(await canPostEventVideo(db, user(id), 'child'), true, id);
  for (const id of ['member', 'pending', 'outsider', 'stranger']) assert.equal(await canPostEventVideo(db, user(id), 'child'), false, id);
  assert.equal(await canPostEventVideo(db, user('legacyadmin', false), 'child'), false, 'an unconfirmed email never matches an old row');
  assert.equal(await canPostEventVideo(db, user('owner'), 'missing'), false);
});

test('upload middleware blocks anonymous videos across web, chunked and mobile entry points', async () => {
  const { mediaRouter } = await import('../src/routes/media.js');
  const guard = mediaRouter.stack.find(layer => !layer.route)!.handle;
  for (const path of ['/get-upload-url', '/upload/chunk/initiate', '/save-photo', '/save-photo-batch', '/mobile/get-upload-url', '/mobile/save-photo-batch']) {
    const photo = { eventId: 'event', fileName: 'clip.mp4', resourceType: 'image' };
    const body = path.endsWith('batch') ? { photos: [photo] } : photo;
    const status = await new Promise<number>((resolve, reject) => {
      let code = 200;
      const req = { method: 'POST', path, body, get: () => '' };
      const res = { status(value: number) { code = value; return res; }, json() { resolve(code); } };
      guard(req as never, res as never, (error?: unknown) => error ? reject(error) : reject(new Error('Video bypassed guard')));
    });
    assert.equal(status, 401, path);
  }
});
