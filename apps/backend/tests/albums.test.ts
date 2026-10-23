import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import express from 'express';
import type { Request } from 'express';
import type { User } from '@supabase/supabase-js';
import sharp from 'sharp';
import { createAlbumRouter, type AlbumRouterDeps } from '../src/routes/albums.js';
import type { AlbumFiles } from '../src/albums/files.js';
import { makeAlbumPageImages } from '../src/albums/images.js';
import type { AlbumRepository, AlbumRow, CommentRow, EventPhoto, PageRow, RoundRow, VersionRow } from '../src/albums/repository.js';
import type { ExpoPush } from '../src/routes/notifications.js';

const DESIGNER = 'designer-1';
const COUPLE = 'couple-1';
const STRANGER = 'stranger-1';
const EVENT = 'evt-root';

/** In-memory stand-in for the Supabase repository, mirroring the SQL functions and triggers. */
function createFakeRepo() {
  const albums = new Map<string, AlbumRow>();
  const pages = new Map<string, PageRow>();
  const versions: VersionRow[] = [];
  const comments = new Map<string, CommentRow>();
  const rounds = new Map<string, RoundRow[]>();
  const deleted: { id: number; storageKey: string }[] = [];
  let nextDeleted = 1;
  const photos = new Map<string, EventPhoto>([
    ['photo-fav', { id: 'photo-fav', eventId: 'evt-sub', thumbnailUrl: 'https://m/fav-t.webp', previewUrl: 'https://m/fav-p.webp' }],
    ['photo-other', { id: 'photo-other', eventId: 'evt-other', thumbnailUrl: 'https://m/o.webp', previewUrl: 'https://m/o.webp' }],
  ]);
  const roots: Record<string, string> = { [EVENT]: EVENT, 'evt-sub': EVENT, 'evt-other': 'evt-other' };
  const pushTokens: Record<string, string> = { [DESIGNER]: 'token-designer', [COUPLE]: 'token-couple' };
  const now = () => new Date().toISOString();
  const queue = (key: string) => deleted.push({ id: nextDeleted++, storageKey: key });
  const fail = (message: string) => { throw { message }; };
  const removeVersion = (v: VersionRow) => { versions.splice(versions.indexOf(v), 1); queue(v.previewKey); queue(v.thumbnailKey); };
  const removeComment = (id: string) => {
    const c = comments.get(id);
    if (!c) return;
    comments.delete(id);
    if (c.voiceKey) queue(c.voiceKey);
    [...comments.values()].filter((r) => r.parentId === id).forEach((r) => removeComment(r.id));
  };
  const removePage = (id: string) => {
    pages.delete(id);
    versions.filter((v) => v.pageId === id).forEach(removeVersion);
    [...comments.values()].filter((c) => c.pageId === id).forEach((c) => removeComment(c.id));
  };

  const repo: AlbumRepository = {
    async rootEventId(eventId) { return roots[eventId] ?? null; },
    async listAlbums(eventId) { return [...albums.values()].filter((a) => a.eventId === eventId); },
    async getAlbum(id) { const a = albums.get(id); return a ? { ...a } : null; },
    async createAlbum({ eventId, title, createdBy }) {
      const row: AlbumRow = { id: randomUUID(), eventId, title, currentRound: 0, createdBy, approvedBy: null, approvedAt: null, createdAt: now(), updatedAt: now() };
      albums.set(row.id, row);
      return { ...row };
    },
    async updateAlbum(id, patch) { Object.assign(albums.get(id)!, patch); },
    async deleteAlbum(id) {
      albums.delete(id);
      [...pages.values()].filter((p) => p.albumId === id).forEach((p) => removePage(p.id));
    },
    async listPages(albumIds) { return [...pages.values()].filter((p) => albumIds.includes(p.albumId)).sort((a, b) => a.position - b.position).map((p) => ({ ...p })); },
    async updatePage(id, patch) { Object.assign(pages.get(id)!, patch); },
    async deletePage(id) { removePage(id); },
    async listVersions(pageIds) { return versions.filter((v) => pageIds.includes(v.pageId)).sort((a, b) => a.version - b.version).map((v) => ({ ...v })); },
    async listComments(pageIds) { return [...comments.values()].filter((c) => pageIds.includes(c.pageId)).map((c) => ({ ...c })); },
    async getComment(id) { const c = comments.get(id); return c ? { ...c } : null; },
    async createComment(input) {
      const row: CommentRow = { ...input, id: randomUUID(), voiceKey: null, voiceSeconds: null, voiceBytes: 0, status: 'open', resolvedBy: null, resolvedAt: null, createdAt: now() };
      comments.set(row.id, row);
      return { ...row };
    },
    async updateComment(id, patch) {
      const c = comments.get(id)!;
      if (patch.voiceKey !== undefined && c.voiceKey && c.voiceKey !== patch.voiceKey) queue(c.voiceKey);
      Object.assign(c, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)));
    },
    async deleteComment(id) { removeComment(id); },
    async sendDrafts(pageIds, authorId, sentAt) {
      let n = 0;
      for (const c of comments.values()) if (pageIds.includes(c.pageId) && c.authorId === authorId && !c.sentAt) { c.sentAt = sentAt; n++; }
      return n;
    },
    async listRounds(albumId) { return [...(rounds.get(albumId) ?? [])]; },
    async addPage(albumId, layout, image, userId, maxPages) {
      const album = albums.get(albumId) ?? fail('album_not_found');
      if (album.approvedAt) fail('album_approved');
      const own = [...pages.values()].filter((p) => p.albumId === albumId);
      if (own.length >= maxPages) fail('album_page_limit');
      const id = randomUUID();
      pages.set(id, { id, albumId, position: Math.max(0, ...own.map((p) => p.position)) + 1, layout, approvedVersion: null, approvedBy: null, approvedAt: null });
      versions.push({ pageId: id, version: 1, round: 0, ...image, createdAt: now() });
      void userId;
      return id;
    },
    async addVersion(pageId, image) {
      const page = pages.get(pageId) ?? fail('album_page_not_found');
      if (albums.get(page.albumId)!.approvedAt) fail('album_approved');
      const latest = versions.filter((v) => v.pageId === pageId).sort((a, b) => b.version - a.version)[0];
      let version = (latest?.version ?? 0) + 1;
      if (latest && latest.round === 0) { removeVersion(latest); version = latest.version; }
      versions.push({ pageId, version, round: 0, ...image, createdAt: now() });
      return version;
    },
    async sendRound(albumId, userId) {
      const album = albums.get(albumId) ?? fail('album_not_found');
      const own = new Set([...pages.values()].filter((p) => p.albumId === albumId).map((p) => p.id));
      const unsent = versions.filter((v) => own.has(v.pageId) && v.round === 0);
      if (!unsent.length) fail('album_nothing_to_send');
      const round = album.currentRound + 1;
      unsent.forEach((v) => { v.round = round; });
      const updatedPages = unsent.filter((v) => v.version > 1).length;
      rounds.set(albumId, [...(rounds.get(albumId) ?? []), { number: round, sentBy: userId, sentAt: now(), pageCount: unsent.length, updatedPageCount: updatedPages }]);
      Object.assign(album, { currentRound: round, approvedAt: null, approvedBy: null });
      return { round, pages: unsent.length, updatedPages };
    },
    async reorder(albumId, pageIds) {
      const own = [...pages.values()].filter((p) => p.albumId === albumId);
      if (own.length !== pageIds.length || !own.every((p) => pageIds.includes(p.id))) fail('album_reorder_mismatch');
      pageIds.forEach((id, i) => { pages.get(id)!.position = i + 1; });
    },
    async listFavourites() { return [photos.get('photo-fav')!]; },
    async getPhotos(ids) { return ids.map((id) => photos.get(id)).filter((p): p is EventPhoto => Boolean(p)); },
    async profileNames(ids) { return new Map(ids.map((id) => [id, id === COUPLE ? 'Priya' : 'Studio'])); },
    async managerIds() { return [DESIGNER, COUPLE]; },
    async pushTokens(ids) { return ids.filter((id) => pushTokens[id]).map((id) => ({ profileId: id, token: pushTokens[id] })); },
    async listDeletedFiles(limit) { return deleted.slice(0, limit); },
    async removeDeletedFiles(ids) { for (const id of ids) deleted.splice(deleted.findIndex((d) => d.id === id), 1); },
  };
  return { repo, pages, versions, comments, deleted };
}

function createFakeFiles() {
  const stored = new Map<string, { body: Buffer; contentType: string }>();
  const files: AlbumFiles = {
    async put(key, body, contentType) { stored.set(key, { body, contentType }); },
    async delete(key) { stored.delete(key); return true; },
    url(key) { return `https://media.test/${key}`; },
  };
  return { files, stored };
}

async function startServer(overrides: Partial<AlbumRouterDeps> = {}) {
  const fake = createFakeRepo();
  const { files, stored } = createFakeFiles();
  const pushes: ExpoPush[] = [];
  let storage: 'ok' | 'full' = 'ok';
  const app = express();
  app.use(express.json());
  app.use('/albums', createAlbumRouter({
    repo: fake.repo,
    files,
    enabled: () => true,
    verifyUser: async (request: Request) => {
      const id = request.header('x-test-user');
      return id ? { user: { id } as User } : null;
    },
    canManage: async (user, eventId) => eventId === EVENT && user.id !== STRANGER,
    checkUpload: async () => storage === 'ok' ? { allowed: true } : { allowed: false, code: 'storage_full', error: 'This gallery is out of storage.' },
    sendPush: async (push) => { pushes.push(push); },
    ...overrides,
  }));
  const server = app.listen(0);
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/albums`;
  const call = async (user: string | null, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const isRaw = Buffer.isBuffer(body);
    const response = await fetch(base + path, {
      method,
      headers: { ...(user ? { 'x-test-user': user } : {}), ...(body !== undefined && !isRaw ? { 'content-type': 'application/json' } : {}), ...headers },
      body: body === undefined ? undefined : isRaw ? body as Buffer : JSON.stringify(body),
    });
    return { status: response.status, json: await response.json() as any };
  };
  return { ...fake, stored, pushes, call, setStorage: (s: 'ok' | 'full') => { storage = s; }, close: () => server.close() };
}

const jpeg = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 80 } } }).jpeg().toBuffer();
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

test('album proofing is off unless switched on', async () => {
  const s = await startServer({ enabled: () => false });
  try {
    const enabled = await s.call(null, 'GET', '/enabled');
    assert.equal(enabled.json.enabled, false);
    const list = await s.call(DESIGNER, 'GET', `/?eventId=${EVENT}`);
    assert.equal(list.status, 503);
    assert.equal(list.json.code, 'disabled');
  } finally { s.close(); }
});

test('only signed-in event managers can use albums', async () => {
  const s = await startServer();
  try {
    assert.equal((await s.call(null, 'GET', `/?eventId=${EVENT}`)).status, 401);
    assert.equal((await s.call(STRANGER, 'GET', `/?eventId=${EVENT}`)).status, 403);
    assert.equal((await s.call(STRANGER, 'POST', '/', { eventId: EVENT, title: 'Mine' })).status, 403);
    const created = await s.call(DESIGNER, 'POST', '/', { eventId: 'evt-sub', title: '  Wedding Album ' });
    assert.equal(created.status, 201);
    assert.equal(created.json.album.eventId, EVENT, 'a sub-gallery resolves to its main gallery');
    assert.equal(created.json.album.title, 'Wedding Album');
    assert.equal((await s.call(STRANGER, 'GET', `/${created.json.album.id}`)).status, 403);
    assert.equal((await s.call(DESIGNER, 'GET', `/${randomUUID()}`)).status, 404);
    assert.equal((await s.call(DESIGNER, 'POST', '/', { eventId: EVENT, title: '   ' })).status, 400);
  } finally { s.close(); }
});

test('a page upload keeps only a preview and a thumbnail, and detects spreads', async () => {
  const s = await startServer();
  try {
    const { json: { album } } = await s.call(DESIGNER, 'POST', '/', { eventId: EVENT, title: 'Wedding Album' });
    const spread = await s.call(DESIGNER, 'POST', `/${album.id}/pages?fileName=01.jpg`, await jpeg(3600, 1200), { 'content-type': 'image/jpeg' });
    assert.equal(spread.status, 201, JSON.stringify(spread.json));
    assert.equal(spread.json.page.layout, 'spread');
    assert.deepEqual([spread.json.page.width, spread.json.page.height], [3600, 1200]);
    const single = await s.call(DESIGNER, 'POST', `/${album.id}/pages?fileName=02.jpg`, await jpeg(1200, 1200), { 'content-type': 'image/jpeg' });
    assert.equal(single.json.page.layout, 'single');
    const forced = await s.call(DESIGNER, 'POST', `/${album.id}/pages?layout=single`, await jpeg(3600, 1200));
    assert.equal(forced.json.page.layout, 'single', 'the photographer can override the layout');

    // Only WebP previews and thumbnails are stored, never the JPEG original
    assert.equal(s.stored.size, 6);
    for (const [key, file] of s.stored) {
      assert.match(key, new RegExp(`^albums/${EVENT}/${album.id}/[0-9a-f-]+-(preview|thumbnail)\\.webp$`));
      assert.equal(file.contentType, 'image/webp');
    }
    const preview = [...s.stored.entries()].find(([key]) => key.endsWith('preview.webp'))![1];
    const meta = await sharp(preview.body).metadata();
    assert.deepEqual([meta.format, meta.width, meta.height], ['webp', 3000, 1000], 'a 3:1 spread previews at 3000x1000');

    const full = await s.call(DESIGNER, 'GET', `/${album.id}`);
    assert.deepEqual(full.json.album.pages.map((p: any) => [p.position, p.status, p.versions[0].fileName]), [[1, 'draft', '01.jpg'], [2, 'draft', '02.jpg'], [3, 'draft', null]]);
    assert.equal(full.json.album.status, 'draft');
    assert.equal(full.json.album.unsentCount, 3);
  } finally { s.close(); }
});

test('uploads that are not images, too large, or over the plan are refused', async () => {
  const s = await startServer();
  try {
    const { json: { album } } = await s.call(DESIGNER, 'POST', '/', { eventId: EVENT, title: 'Album' });
    const text = await s.call(DESIGNER, 'POST', `/${album.id}/pages`, Buffer.from('not an image at all'), { 'content-type': 'image/jpeg' });
    assert.equal(text.status, 415);
    const gif = await s.call(DESIGNER, 'POST', `/${album.id}/pages`, await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).gif().toBuffer());
    assert.equal(gif.status, 415);
    const huge = await s.call(DESIGNER, 'POST', `/${album.id}/pages`, Buffer.alloc(61 * 1024 * 1024));
    assert.equal(huge.status, 413);
    assert.equal(huge.json.code, 'file_too_large');
    s.setStorage('full');
    const full = await s.call(DESIGNER, 'POST', `/${album.id}/pages`, await jpeg(300, 100));
    assert.equal(full.status, 413);
    assert.equal(full.json.code, 'storage_full');
    assert.equal(s.stored.size, 0, 'nothing was stored');
  } finally { s.close(); }
});

test('review rounds: drafts, feedback, new versions and approval', async () => {
  const s = await startServer();
  try {
    const { json: { album } } = await s.call(DESIGNER, 'POST', '/', { eventId: EVENT, title: 'Wedding Album' });
    const p1 = (await s.call(DESIGNER, 'POST', `/${album.id}/pages`, await jpeg(900, 300))).json.page.id;
    const p2 = (await s.call(DESIGNER, 'POST', `/${album.id}/pages`, await jpeg(900, 300))).json.page.id;

    // Comments can't be approved before the page is sent
    assert.equal((await s.call(COUPLE, 'POST', `/${album.id}/pages/${p1}/approval`, {})).status, 409);

    // Round 1 tells the couple, not the sender
    const sent = await s.call(DESIGNER, 'POST', `/${album.id}/send`);
    assert.deepEqual(sent.json.round, { round: 1, pages: 2, updatedPages: 0 });
    assert.deepEqual(s.pushes.map((p) => [p.token, p.title, p.body]), [['token-couple', 'Album ready for review', 'Wedding Album: 2 pages to review']]);
    assert.equal(sent.json.album.status, 'in_review');
    assert.equal((await s.call(DESIGNER, 'POST', `/${album.id}/send`)).json.code, 'nothing_to_send');

    // The couple pins a request with a favourite as the replacement; it stays a draft only they see
    const pin = await s.call(COUPLE, 'POST', `/${album.id}/pages/${p1}/comments`, { kind: 'replace', pinX: 0.25, pinY: 0.5, body: 'Use our favourite here', replacementPhotoId: 'photo-fav' });
    assert.equal(pin.status, 201, JSON.stringify(pin.json));
    assert.equal(pin.json.comment.isDraft, true);
    assert.equal(pin.json.comment.replacementPhoto.id, 'photo-fav');
    assert.equal((await s.call(COUPLE, 'POST', `/${album.id}/pages/${p1}/comments`, { replacementPhotoId: 'photo-other' })).status, 400, 'photos from other events are refused');
    assert.equal((await s.call(COUPLE, 'POST', `/${album.id}/pages/${p1}/comments`, { pinX: 2 })).status, 400);
    const empty = await s.call(COUPLE, 'POST', `/${album.id}/pages/${p2}/comments`, {});
    let designerView = (await s.call(DESIGNER, 'GET', `/${album.id}`)).json.album;
    assert.equal(designerView.pages[0].comments.length, 0, "the photographer doesn't see drafts");
    assert.equal(designerView.pages[0].status, 'pending');

    // The couple approves page 2 and sends feedback: one push to the photographer
    await s.call(COUPLE, 'POST', `/${album.id}/pages/${p2}/approval`, {});
    s.pushes.length = 0;
    const feedback = await s.call(COUPLE, 'POST', `/${album.id}/feedback`);
    assert.equal(feedback.json.sent, 1, 'the empty draft was dropped, not sent');
    assert.equal(s.comments.has(empty.json.comment.id), false);
    assert.deepEqual(s.pushes.map((p) => [p.token, p.body]), [['token-designer', 'Priya: 1 page needs changes, 1 approved']]);
    designerView = (await s.call(DESIGNER, 'GET', `/${album.id}`)).json.album;
    assert.deepEqual(designerView.pages.map((p: any) => p.status), ['changes_requested', 'approved']);
    assert.equal(designerView.status, 'changes_requested');
    assert.equal(designerView.openRequestCount, 1);

    // Sent requests can't be edited, only replied to; the photographer replies and marks it done
    assert.equal((await s.call(COUPLE, 'PATCH', `/${album.id}/comments/${pin.json.comment.id}`, { body: 'changed' })).status, 400);
    const reply = await s.call(DESIGNER, 'POST', `/${album.id}/pages/${p1}/comments`, { parentId: pin.json.comment.id, body: 'Done, swapped it' });
    assert.equal(reply.json.comment.isDraft, false, 'replies are sent at once');
    const done = await s.call(DESIGNER, 'PATCH', `/${album.id}/comments/${pin.json.comment.id}`, { status: 'done' });
    assert.equal(done.json.comment.status, 'done');
    assert.equal(done.json.comment.resolvedByName, 'Studio');

    // Version 2 of page 1; a second upload before sending replaces it instead of stacking
    await s.call(DESIGNER, 'POST', `/${album.id}/pages/${p1}/versions`, await jpeg(900, 300));
    const again = await s.call(DESIGNER, 'POST', `/${album.id}/pages/${p1}/versions`, await jpeg(900, 300));
    assert.equal(again.json.version.version, 2);
    await settle();
    assert.equal(s.deleted.length, 0, 'the replaced draft version was deleted from storage');
    assert.equal(s.versions.filter((v) => v.pageId === p1).length, 2);
    s.pushes.length = 0;
    const round2 = await s.call(DESIGNER, 'POST', `/${album.id}/send`);
    assert.deepEqual(round2.json.round, { round: 2, pages: 1, updatedPages: 1 });
    assert.equal(s.pushes[0].body, 'Wedding Album: 1 updated page to review');
    let coupleView = round2.json.album;
    assert.deepEqual(coupleView.pages.map((p: any) => [p.sentVersion, p.status]), [[2, 'pending'], [1, 'approved']]);

    // The album can't be approved until every page is
    assert.equal((await s.call(COUPLE, 'POST', `/${album.id}/approve`)).json.code, 'not_ready');
    await s.call(COUPLE, 'POST', `/${album.id}/pages/${p1}/approval`, {});
    s.pushes.length = 0;
    coupleView = (await s.call(COUPLE, 'POST', `/${album.id}/approve`)).json.album;
    assert.equal(coupleView.status, 'approved');
    assert.equal(coupleView.approvedByName, 'Priya');
    assert.deepEqual(s.pushes.map((p) => [p.token, p.title]), [['token-designer', 'Album approved for print']]);

    // An approved album is locked until reopened
    assert.equal((await s.call(DESIGNER, 'POST', `/${album.id}/pages/${p1}/versions`, await jpeg(900, 300))).json.code, 'album_approved');
    assert.equal((await s.call(COUPLE, 'POST', `/${album.id}/pages/${p1}/comments`, { body: 'one more' })).json.code, 'album_approved');
    const reopened = await s.call(DESIGNER, 'POST', `/${album.id}/reopen`);
    assert.equal(reopened.json.album.status, 'in_review');
  } finally { s.close(); }
});

test('approving a page settles its open requests', async () => {
  const s = await startServer();
  try {
    const { json: { album } } = await s.call(DESIGNER, 'POST', '/', { eventId: EVENT, title: 'A' });
    const p1 = (await s.call(DESIGNER, 'POST', `/${album.id}/pages`, await jpeg(900, 300))).json.page.id;
    await s.call(DESIGNER, 'POST', `/${album.id}/send`);
    await s.call(COUPLE, 'POST', `/${album.id}/pages/${p1}/comments`, { kind: 'bigger', pinX: 0.5, pinY: 0.5 });
    await s.call(COUPLE, 'POST', `/${album.id}/feedback`);
    const approved = await s.call(COUPLE, 'POST', `/${album.id}/pages/${p1}/approval`, {});
    assert.equal(approved.json.album.pages[0].status, 'approved');
    assert.equal(approved.json.album.pages[0].comments[0].status, 'done');
    const undone = await s.call(COUPLE, 'POST', `/${album.id}/pages/${p1}/approval`, { approved: false });
    assert.equal(undone.json.album.pages[0].status, 'pending');
  } finally { s.close(); }
});

test('voice notes: stored as audio, replaceable, author only', async () => {
  const s = await startServer();
  try {
    const { json: { album } } = await s.call(DESIGNER, 'POST', '/', { eventId: EVENT, title: 'A' });
    const p1 = (await s.call(DESIGNER, 'POST', `/${album.id}/pages`, await jpeg(900, 300))).json.page.id;
    await s.call(DESIGNER, 'POST', `/${album.id}/send`);
    const { json: { comment } } = await s.call(COUPLE, 'POST', `/${album.id}/pages/${p1}/comments`, { kind: 'edit', pinX: 0.1, pinY: 0.9 });
    const audio = Buffer.alloc(2048, 7);
    assert.equal((await s.call(DESIGNER, 'PUT', `/${album.id}/comments/${comment.id}/voice?seconds=4`, audio, { 'content-type': 'audio/mp4' })).status, 403);
    assert.equal((await s.call(COUPLE, 'PUT', `/${album.id}/comments/${comment.id}/voice?seconds=4`, audio, { 'content-type': 'video/mp4' })).status, 415);
    assert.equal((await s.call(COUPLE, 'PUT', `/${album.id}/comments/${comment.id}/voice?seconds=600`, audio, { 'content-type': 'audio/mp4' })).status, 400);
    const first = await s.call(COUPLE, 'PUT', `/${album.id}/comments/${comment.id}/voice?seconds=4.24`, audio, { 'content-type': 'audio/webm;codecs=opus' });
    assert.equal(first.status, 200, JSON.stringify(first.json));
    assert.match(first.json.comment.voiceUrl, /\/voice\/[0-9a-f-]+\.webm$/);
    assert.equal(first.json.comment.voiceSeconds, 4.2);
    const second = await s.call(COUPLE, 'PUT', `/${album.id}/comments/${comment.id}/voice?seconds=3`, audio, { 'content-type': 'audio/mp4' });
    assert.match(second.json.comment.voiceUrl, /\.m4a$/);
    await settle();
    assert.deepEqual([...s.stored.keys()].filter((k) => k.includes('/voice/')).map((k) => k.split('.').pop()), ['m4a'], 'the replaced recording was deleted');
    assert.equal([...s.stored.values()].find((f) => f.contentType === 'audio/mp4')?.body.length, 2048);
  } finally { s.close(); }
});

test('deleting an album deletes its files', async () => {
  const s = await startServer();
  try {
    const { json: { album } } = await s.call(DESIGNER, 'POST', '/', { eventId: EVENT, title: 'A' });
    await s.call(DESIGNER, 'POST', `/${album.id}/pages`, await jpeg(900, 300));
    await s.call(DESIGNER, 'POST', `/${album.id}/pages`, await jpeg(300, 300));
    assert.equal(s.stored.size, 4);
    assert.equal((await s.call(STRANGER, 'DELETE', `/${album.id}`)).status, 403);
    assert.equal((await s.call(DESIGNER, 'DELETE', `/${album.id}`)).status, 200);
    await settle();
    assert.equal(s.stored.size, 0);
    assert.equal((await s.call(DESIGNER, 'GET', `/?eventId=${EVENT}`)).json.albums.length, 0);
  } finally { s.close(); }
});

test('pages can be reordered, relaid out and removed', async () => {
  const s = await startServer();
  try {
    const { json: { album } } = await s.call(DESIGNER, 'POST', '/', { eventId: EVENT, title: 'A' });
    const ids = [];
    for (let i = 0; i < 3; i++) ids.push((await s.call(DESIGNER, 'POST', `/${album.id}/pages`, await jpeg(900, 300))).json.page.id);
    const reordered = await s.call(DESIGNER, 'PUT', `/${album.id}/order`, { pageIds: [ids[2], ids[0], ids[1]] });
    assert.deepEqual(reordered.json.album.pages.map((p: any) => p.id), [ids[2], ids[0], ids[1]]);
    assert.equal((await s.call(DESIGNER, 'PUT', `/${album.id}/order`, { pageIds: [ids[0]] })).status, 400);
    const relaid = await s.call(DESIGNER, 'PATCH', `/${album.id}/pages/${ids[0]}`, { layout: 'single' });
    assert.equal(relaid.json.album.pages[1].layout, 'single');
    const removed = await s.call(DESIGNER, 'DELETE', `/${album.id}/pages/${ids[1]}`);
    assert.equal(removed.json.album.pages.length, 2);
  } finally { s.close(); }
});

test('preview processing handles CMYK, rotation and tiny files', async () => {
  const cmyk = await sharp({ create: { width: 1200, height: 400, channels: 3, background: '#3366aa' } }).toColourspace('cmyk').jpeg().toBuffer();
  const fromCmyk = await makeAlbumPageImages(cmyk);
  assert.equal((await sharp(fromCmyk.preview).metadata()).space, 'srgb');
  const rotated = await sharp({ create: { width: 400, height: 1200, channels: 3, background: '#fff' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const upright = await makeAlbumPageImages(rotated);
  assert.deepEqual([upright.width, upright.height], [1200, 400], 'EXIF rotation is applied');
  const tiny = await makeAlbumPageImages(await jpeg(300, 100));
  assert.equal((await sharp(tiny.preview).metadata()).width, 300, 'small designs are not enlarged');
});
