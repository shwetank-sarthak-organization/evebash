import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import express from 'express';
import type { Request } from 'express';
import { createVaultRouter } from '../src/routes/vault.js';
import { VaultError } from '../src/vault/errors.js';
import { contentDisposition, sanitizeName } from '../src/vault/names.js';
import { getPlanLifecycle } from '../src/vault/lifecycle.js';
import type { ReserveUploadInput, TrashEntry, VaultFolder, VaultItem, VaultRepository, VaultUpload } from '../src/vault/repository.js';
import type { VaultStorage } from '../src/vault/storage.js';

const GB = 1024 ** 3;
const MB = 1024 ** 2;
const ALICE = '00000000-0000-4000-8000-00000000000a';
const BOB = '00000000-0000-4000-8000-00000000000b';

type Owned<T> = T & { ownerId: string; deletedAt: string | null; trashRootId: string | null; objectKey?: string };

/** In-memory stand-in for the Supabase repository, mirroring the SQL functions' rules. */
function createFakeRepo() {
  const profiles = new Map<string, { role: string; planEndDate: string | null }>();
  const eventBytes = new Map<string, number>();
  const accounts = new Map<string, { usedBytes: number; reservedBytes: number }>();
  const folders = new Map<string, Owned<VaultFolder>>();
  const items = new Map<string, Owned<VaultItem>>();
  const uploads = new Map<string, VaultUpload & { ownerId: string }>();
  const deletableObjects: { id: string; bucket: string; objectKey: string }[] = [];
  let retained: Set<string> | null = null;
  const calls: { method: string; ownerId: string | null }[] = [];

  const account = (ownerId: string) => {
    if (!accounts.has(ownerId)) accounts.set(ownerId, { usedBytes: 0, reservedBytes: 0 });
    return accounts.get(ownerId)!;
  };
  const liveFolder = (ownerId: string, id: string | null) => id === null || (folders.get(id)?.ownerId === ownerId && !folders.get(id)?.deletedAt);
  const notFound = () => { throw { message: 'vault_not_found' }; };
  const now = () => new Date().toISOString();
  const strip = <T extends object>(row: Owned<T>): T => {
    const { ownerId: _o, deletedAt: _d, trashRootId: _t, objectKey: _k, ...rest } = row;
    return rest as T;
  };
  const log = (method: string, ownerId: string | null) => calls.push({ method, ownerId });

  const repo: VaultRepository = {
    async getProfile(ownerId) { return profiles.get(ownerId) ?? { role: 'free', planEndDate: null }; },
    async getEventStorageBytes(identifiers) { return eventBytes.get(identifiers[0]) ?? 0; },
    async getAccount(ownerId) { return { ...account(ownerId) }; },
    async getRetainedItemIds() { return retained ?? new Set(); },

    async reserveUpload(ownerId, input: ReserveUploadInput) {
      log('reserveUpload', ownerId);
      if (!liveFolder(ownerId, input.folderId)) notFound();
      const acct = account(ownerId);
      if (input.limitBytes !== null && acct.usedBytes + acct.reservedBytes + input.sizeBytes + input.otherUsedBytes > input.limitBytes) {
        throw { message: 'vault_quota_exceeded' };
      }
      acct.reservedBytes += input.sizeBytes;
      const id = randomUUID();
      uploads.set(id, {
        id, ownerId, folderId: input.folderId, filename: input.filename, mimeType: input.mimeType, sizeBytes: input.sizeBytes,
        bucket: input.bucket, objectKey: input.objectKey, uploadMode: input.uploadMode, multipartUploadId: null,
        status: 'pending', expiresAt: input.expiresAt.toISOString(),
      });
      return id;
    },
    async setMultipartUploadId(ownerId, uploadId, multipartUploadId) {
      const upload = uploads.get(uploadId);
      if (upload?.ownerId === ownerId) upload.multipartUploadId = multipartUploadId;
    },
    async getUpload(ownerId, uploadId) {
      const upload = uploads.get(uploadId);
      return upload && upload.ownerId === ownerId ? { ...upload } : null;
    },
    async completeUpload(ownerId, uploadId, actualSize) {
      const upload = uploads.get(uploadId);
      if (!upload || upload.ownerId !== ownerId || upload.status !== 'pending') notFound();
      const acct = account(ownerId);
      acct.reservedBytes -= upload!.sizeBytes;
      if (actualSize !== upload!.sizeBytes) {
        upload!.status = 'aborted';
        return { status: 'size_mismatch' };
      }
      acct.usedBytes += upload!.sizeBytes;
      upload!.status = 'completed';
      const id = randomUUID();
      items.set(id, {
        id, ownerId, folderId: upload!.folderId, filename: upload!.filename, extension: '', mimeType: upload!.mimeType,
        sizeBytes: upload!.sizeBytes, isStarred: false, createdAt: now(), updatedAt: now(), deletedAt: null, trashRootId: null,
        objectKey: upload!.objectKey,
      });
      return { status: 'ok', itemId: id };
    },
    async releaseUpload(ownerId, uploadId, status) {
      const upload = uploads.get(uploadId);
      if (!upload || upload.status !== 'pending' || (ownerId !== null && upload.ownerId !== ownerId)) return null;
      account(upload.ownerId).reservedBytes -= upload.sizeBytes;
      upload.status = status;
      return { ...upload };
    },

    async getFolder(ownerId, id) {
      const folder = folders.get(id);
      return folder && folder.ownerId === ownerId && !folder.deletedAt ? strip(folder) : null;
    },
    async getBreadcrumbs(ownerId, id) {
      const folder = folders.get(id);
      return folder && folder.ownerId === ownerId ? [{ id: folder.id, name: folder.name }] : [];
    },
    async listFolder(ownerId, folderId) {
      log('listFolder', ownerId);
      return {
        folders: [...folders.values()].filter((f) => f.ownerId === ownerId && !f.deletedAt && f.parentFolderId === folderId).map(strip),
        items: [...items.values()].filter((i) => i.ownerId === ownerId && !i.deletedAt && i.folderId === folderId).map(strip),
      };
    },
    async createFolder(ownerId, parentFolderId, name) {
      log('createFolder', ownerId);
      if (!liveFolder(ownerId, parentFolderId)) notFound();
      const id = randomUUID();
      const folder = { id, ownerId, name, parentFolderId, createdAt: now(), updatedAt: now(), deletedAt: null, trashRootId: null };
      folders.set(id, folder);
      return strip(folder);
    },
    async renameFolder(ownerId, id, name) {
      const folder = folders.get(id);
      if (!folder || folder.ownerId !== ownerId) notFound();
      folder!.name = name;
      return strip(folder!);
    },
    async moveFolder(ownerId, id, parentFolderId) {
      const folder = folders.get(id);
      if (!folder || folder.ownerId !== ownerId || !liveFolder(ownerId, parentFolderId)) notFound();
      for (let cursor = parentFolderId; cursor; cursor = folders.get(cursor)?.parentFolderId ?? null) {
        if (cursor === id) throw { message: 'vault_invalid_move' };
      }
      folder!.parentFolderId = parentFolderId;
    },

    async getItem(ownerId, id) {
      const item = items.get(id);
      return item && item.ownerId === ownerId && !item.deletedAt ? strip(item) : null;
    },
    async getItemObject(ownerId, id) {
      const item = items.get(id);
      return item && item.ownerId === ownerId && !item.deletedAt ? { item: strip(item), bucket: 'vault-test', objectKey: item.objectKey! } : null;
    },
    async updateItem(ownerId, id, patch) {
      const item = items.get(id);
      if (!item || item.ownerId !== ownerId || item.deletedAt) notFound();
      if (patch.folderId !== undefined && !liveFolder(ownerId, patch.folderId)) notFound();
      if (patch.filename !== undefined) item!.filename = patch.filename;
      if (patch.folderId !== undefined) item!.folderId = patch.folderId;
      if (patch.isStarred !== undefined) item!.isStarred = patch.isStarred;
      return strip(item!);
    },
    async copyItem(ownerId, id, folderId, limitBytes, otherUsedBytes) {
      const item = items.get(id);
      if (!item || item.ownerId !== ownerId || !liveFolder(ownerId, folderId)) notFound();
      const acct = account(ownerId);
      if (limitBytes !== null && acct.usedBytes + acct.reservedBytes + item!.sizeBytes + otherUsedBytes > limitBytes) {
        throw { message: 'vault_quota_exceeded' };
      }
      acct.usedBytes += item!.sizeBytes;
      const copyId = randomUUID();
      items.set(copyId, { ...item!, id: copyId, folderId });
      return copyId;
    },

    async trash(ownerId, kind, id) {
      log('trash', ownerId);
      const row = kind === 'file' ? items.get(id) : folders.get(id);
      if (!row || row.ownerId !== ownerId || row.deletedAt) notFound();
      row!.deletedAt = now();
      row!.trashRootId = id;
      if (kind === 'folder') {
        for (const item of items.values()) if (item.folderId === id && !item.deletedAt) { item.deletedAt = now(); item.trashRootId = id; }
      }
    },
    async restore(ownerId, kind, id) {
      log('restore', ownerId);
      const row = kind === 'file' ? items.get(id) : folders.get(id);
      if (!row || row.ownerId !== ownerId || row.trashRootId !== id) notFound();
      for (const r of [...items.values(), ...folders.values()]) if (r.trashRootId === id) { r.deletedAt = null; r.trashRootId = null; }
    },
    async purge(ownerId, rootId) {
      log('purge', ownerId);
      const group = [...items.values()].filter((i) => i.trashRootId === rootId);
      const groupFolders = [...folders.values()].filter((f) => f.trashRootId === rootId);
      const owner = group[0]?.ownerId ?? groupFolders[0]?.ownerId;
      if (!owner || owner !== ownerId) notFound();
      let freed = 0;
      for (const item of group) {
        items.delete(item.id);
        freed += item.sizeBytes;
        deletableObjects.push({ id: randomUUID(), bucket: 'vault-test', objectKey: item.objectKey! });
      }
      for (const folder of groupFolders) folders.delete(folder.id);
      account(ownerId).usedBytes -= freed;
      return freed;
    },
    async listTrash(ownerId) {
      const entries: TrashEntry[] = [];
      for (const item of items.values()) if (item.ownerId === ownerId && item.trashRootId === item.id) {
        entries.push({ kind: 'file', id: item.id, name: item.filename, sizeBytes: item.sizeBytes, mimeType: item.mimeType, deletedAt: item.deletedAt! });
      }
      for (const folder of folders.values()) if (folder.ownerId === ownerId && folder.trashRootId === folder.id) {
        entries.push({ kind: 'folder', id: folder.id, name: folder.name, sizeBytes: null, mimeType: null, deletedAt: folder.deletedAt! });
      }
      return entries;
    },

    async listRecent(ownerId) { return [...items.values()].filter((i) => i.ownerId === ownerId && !i.deletedAt).map(strip); },
    async listStarred(ownerId) { return [...items.values()].filter((i) => i.ownerId === ownerId && !i.deletedAt && i.isStarred).map(strip); },
    async search(ownerId, query) {
      return [...items.values()].filter((i) => i.ownerId === ownerId && !i.deletedAt && i.filename.toLowerCase().includes(query.toLowerCase())).map(strip);
    },

    async listExpiredUploads() { return []; },
    async purgeExpiredTrash() { return 0; },
    async listDeletableObjects() { return deletableObjects.splice(0); },
    async deleteObjectRow() {},
  };

  return { repo, profiles, eventBytes, accounts, items, folders, uploads, calls, setRetained: (ids: Set<string> | null) => { retained = ids; } };
}

function createFakeStorage() {
  const objects = new Map<string, number>();
  const deleted: string[] = [];
  const downloads: { key: string; contentDisposition: string; contentType: string }[] = [];
  const storage: VaultStorage = {
    bucket: 'vault-test',
    async signSingleUpload(key) { return `https://storage.test/put/${key}`; },
    async startMultipartUpload() { return 'mp-1'; },
    async signUploadPart(key, _id, part) { return `https://storage.test/part/${key}/${part}`; },
    async completeMultipartUpload() {},
    async abortMultipartUpload() {},
    async getObjectSize(key) { return objects.get(key) ?? null; },
    async deleteObject(key) { deleted.push(key); objects.delete(key); },
    async signDownload(key, options) { downloads.push({ key, ...options }); return `https://storage.test/get/${key}`; },
  };
  return { storage, objects, deleted, downloads };
}

async function startApp(options: { storage?: VaultStorage | null } = {}) {
  const fake = createFakeRepo();
  const store = createFakeStorage();
  const app = express();
  app.use(express.json());
  // The test "token" is just the user id; anything else is unauthenticated.
  const verifyUser = async (request: Request) => {
    const token = request.get('authorization')?.replace('Bearer ', '');
    return token === ALICE || token === BOB ? { user: { id: token } } : null;
  };
  app.use('/vault', createVaultRouter({ repo: fake.repo, storage: options.storage === undefined ? store.storage : options.storage, verifyUser }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/vault`;
  const call = async (method: string, path: string, user: string | null, body?: unknown) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() as any };
  };
  return { ...fake, ...store, call, close: () => server.close() };
}

/** Uploads a small file end to end and returns its item. */
async function uploadFile(app: Awaited<ReturnType<typeof startApp>>, user: string, filename: string, sizeBytes: number, folderId: string | null = null) {
  const start = await app.call('POST', '/uploads', user, { filename, sizeBytes, mimeType: 'application/pdf', folderId });
  assert.equal(start.status, 201, JSON.stringify(start.body));
  const upload = app.uploads.get(start.body.uploadId)!;
  app.objects.set(upload.objectKey, sizeBytes);
  const done = await app.call('POST', `/uploads/${start.body.uploadId}/complete`, user, {});
  assert.equal(done.status, 201, JSON.stringify(done.body));
  return done.body.item as VaultItem;
}

test('every Vault endpoint requires sign-in', async () => {
  const app = await startApp();
  const id = randomUUID();
  const endpoints: [string, string][] = [
    ['GET', '/usage'], ['GET', '/folders/root/children'], ['POST', '/folders'], ['POST', '/folders/paths'],
    ['PATCH', `/folders/${id}`], ['DELETE', `/folders/${id}`], ['POST', '/uploads'], ['POST', `/uploads/${id}/parts`],
    ['POST', `/uploads/${id}/complete`], ['POST', `/uploads/${id}/abort`], ['GET', `/items/${id}`], ['PATCH', `/items/${id}`],
    ['POST', `/items/${id}/copy`], ['DELETE', `/items/${id}`], ['GET', `/items/${id}/link`], ['GET', '/recent'], ['GET', '/starred'],
    ['GET', '/search?q=a'], ['GET', '/trash'], ['POST', '/trash/restore'], ['DELETE', `/trash/file/${id}`], ['DELETE', '/trash'],
  ];
  try {
    for (const [method, path] of endpoints) {
      const result = await app.call(method, path, null, method === 'GET' ? undefined : {});
      assert.equal(result.status, 401, `${method} ${path}`);
    }
    assert.equal(app.calls.length, 0, 'no data access before authentication');
  } finally {
    app.close();
  }
});

test('Vault is unavailable until it is enabled and configured', async () => {
  const app = await startApp({ storage: null });
  try {
    assert.equal((await app.call('GET', '/usage', ALICE)).status, 503);
  } finally {
    app.close();
  }
});

test('another user can never see or change your files and folders, even with the ids', async () => {
  const app = await startApp();
  try {
    app.profiles.set(ALICE, { role: 'premium', planEndDate: null });
    const folder = (await app.call('POST', '/folders', ALICE, { name: 'Private' })).body.folder;
    const item = await uploadFile(app, ALICE, 'tax-return.pdf', 1000, folder.id);
    await app.call('DELETE', `/items/${(await uploadFile(app, ALICE, 'old.pdf', 10)).id}`, ALICE);
    const trashed = app.items.get([...app.items.values()].find((i) => i.filename === 'old.pdf')!.id)!;
    const start = await app.call('POST', '/uploads', ALICE, { filename: 'big.bin', sizeBytes: 200 * MB, mimeType: 'application/octet-stream' });

    const attempts: [string, string, unknown?][] = [
      ['GET', `/folders/${folder.id}/children`],
      ['PATCH', `/folders/${folder.id}`, { name: 'Mine now' }],
      ['DELETE', `/folders/${folder.id}`],
      ['POST', '/folders', { name: 'Inside', parentFolderId: folder.id }],
      ['GET', `/items/${item.id}`],
      ['PATCH', `/items/${item.id}`, { filename: 'stolen.pdf' }],
      ['POST', `/items/${item.id}/copy`, {}],
      ['DELETE', `/items/${item.id}`],
      ['GET', `/items/${item.id}/link?mode=download`],
      ['POST', '/trash/restore', { kind: 'file', id: trashed.id }],
      ['DELETE', `/trash/file/${trashed.id}`],
      ['POST', `/uploads/${start.body.uploadId}/parts`, { partNumbers: [1] }],
      ['POST', `/uploads/${start.body.uploadId}/complete`, { parts: [{ partNumber: 1, etag: 'x' }] }],
      ['POST', '/uploads', { filename: 'plant.pdf', sizeBytes: 1, folderId: folder.id }],
    ];
    for (const [method, path, body] of attempts) {
      const result = await app.call(method, path, BOB, body ?? (method === 'GET' ? undefined : {}));
      assert.equal(result.status, 404, `${method} ${path} → ${result.status} ${JSON.stringify(result.body)}`);
    }
    // Bob's own listings never include Alice's files.
    for (const path of ['/folders/root/children', '/recent', '/starred', '/search?q=tax', '/trash']) {
      const result = await app.call('GET', path, BOB);
      assert.equal(JSON.stringify(result.body).includes('tax-return'), false, path);
      assert.equal(JSON.stringify(result.body).includes('old.pdf'), false, path);
    }
    // Aborting someone else's upload does nothing.
    await app.call('POST', `/uploads/${start.body.uploadId}/abort`, BOB);
    assert.equal(app.uploads.get(start.body.uploadId)!.status, 'pending');
    // Nothing of Alice's changed.
    assert.equal(app.items.get(item.id)!.filename, 'tax-return.pdf');
    assert.equal(app.items.get(item.id)!.deletedAt, null);
    assert.equal(app.folders.get(folder.id)!.name, 'Private');
  } finally {
    app.close();
  }
});

test('the owner always comes from the sign-in, never from the request body', async () => {
  const app = await startApp();
  try {
    app.profiles.set(ALICE, { role: 'premium', planEndDate: null });
    await app.call('POST', '/folders', BOB, { name: 'Sneaky', ownerId: ALICE, owner_id: ALICE });
    await app.call('POST', '/uploads', BOB, { filename: 'a.pdf', sizeBytes: 1, ownerId: ALICE });
    assert.ok(app.calls.length > 0);
    assert.ok(app.calls.every((call) => call.ownerId === BOB), JSON.stringify(app.calls));
  } finally {
    app.close();
  }
});

test('storage is shared with events and enforced on the server', async () => {
  const app = await startApp();
  try {
    // Free plan: 1 GB in total, 200 MB per file. 900 MB already used by events.
    app.eventBytes.set(ALICE, 900 * MB);
    const tooBigFile = await app.call('POST', '/uploads', ALICE, { filename: 'a.mov', sizeBytes: 201 * MB });
    assert.equal(tooBigFile.status, 413);
    assert.equal(tooBigFile.body.code, 'file_too_large');
    const overShared = await app.call('POST', '/uploads', ALICE, { filename: 'b.mov', sizeBytes: 150 * MB });
    assert.equal(overShared.status, 413);
    assert.equal(overShared.body.code, 'quota_exceeded');
    const fits = await app.call('POST', '/uploads', ALICE, { filename: 'c.mov', sizeBytes: 100 * MB });
    assert.equal(fits.status, 201);
    assert.equal(fits.body.mode, 'multipart');

    const usage = (await app.call('GET', '/usage', ALICE)).body;
    assert.equal(usage.limitBytes, GB);
    assert.equal(usage.usedBytes.events, 900 * MB);
    assert.equal(usage.reservedBytes, 100 * MB);
  } finally {
    app.close();
  }
});

test('simultaneous uploads cannot together go over the limit', async () => {
  const app = await startApp();
  try {
    // 1 GB free plan, nothing used: twenty 150 MB uploads at once -> only six fit.
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) =>
      app.call('POST', '/uploads', ALICE, { filename: `clip-${i}.mp4`, sizeBytes: 150 * MB, mimeType: 'video/mp4' })));
    const accepted = results.filter((result) => result.status === 201).length;
    assert.equal(accepted, 6);
    assert.ok(results.filter((r) => r.status !== 201).every((r) => r.body.code === 'quota_exceeded'));
    assert.equal(app.accounts.get(ALICE)!.reservedBytes, 900 * MB);
  } finally {
    app.close();
  }
});

test('the server checks the real uploaded size before counting a file', async () => {
  const app = await startApp();
  try {
    const start = await app.call('POST', '/uploads', ALICE, { filename: 'notes.txt', sizeBytes: 100, mimeType: 'text/plain' });
    const upload = app.uploads.get(start.body.uploadId)!;
    assert.equal((await app.call('POST', `/uploads/${upload.id}/complete`, ALICE, {})).status, 409, 'nothing uploaded yet');
    app.objects.set(upload.objectKey, 5000);
    const mismatch = await app.call('POST', `/uploads/${upload.id}/complete`, ALICE, {});
    assert.equal(mismatch.status, 422);
    assert.ok(app.deleted.includes(upload.objectKey), 'oversized object removed');
    assert.deepEqual(app.accounts.get(ALICE), { usedBytes: 0, reservedBytes: 0 });
  } finally {
    app.close();
  }
});

test('over the limit after a downgrade: files stay usable, new uploads are blocked', async () => {
  const app = await startApp();
  try {
    app.profiles.set(ALICE, { role: 'premium', planEndDate: null });
    const item = await uploadFile(app, ALICE, 'report.pdf', 50 * MB);
    app.profiles.set(ALICE, { role: 'free', planEndDate: null });
    app.eventBytes.set(ALICE, 2 * GB);

    const usage = (await app.call('GET', '/usage', ALICE)).body;
    assert.equal(usage.overLimit, true);
    assert.equal(usage.uploadsBlocked, 'storage_full');
    assert.equal((await app.call('POST', '/uploads', ALICE, { filename: 'x.pdf', sizeBytes: 1 })).body.code, 'quota_exceeded');
    assert.equal((await app.call('POST', `/items/${item.id}/copy`, ALICE, {})).body.code, 'quota_exceeded');

    assert.equal((await app.call('GET', '/folders/root/children', ALICE)).body.items.length, 1);
    assert.equal((await app.call('GET', `/items/${item.id}/link?mode=view`, ALICE)).status, 200);
    assert.equal((await app.call('PATCH', `/items/${item.id}`, ALICE, { filename: 'renamed.pdf' })).status, 200);
    assert.equal((await app.call('DELETE', `/items/${item.id}`, ALICE)).status, 200);
    assert.equal(app.items.get(item.id)!.deletedAt !== null, true, 'deleted to Trash, never removed automatically');
  } finally {
    app.close();
  }
});

test('expired paid plan: uploads paused, extra files flagged in grace and hidden afterwards', async () => {
  const app = await startApp();
  try {
    app.profiles.set(ALICE, { role: 'premium', planEndDate: null });
    const kept = await uploadFile(app, ALICE, 'kept.pdf', 10 * MB);
    const extra = await uploadFile(app, ALICE, 'extra.pdf', 10 * MB);
    app.setRetained(new Set([kept.id]));

    const daysAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    app.profiles.set(ALICE, { role: 'premium', planEndDate: daysAgo(3) });
    assert.equal((await app.call('POST', '/uploads', ALICE, { filename: 'new.pdf', sizeBytes: 1 })).body.code, 'plan_expired');
    const grace = (await app.call('GET', '/folders/root/children', ALICE)).body;
    assert.equal(grace.items.length, 2);
    assert.equal(grace.items.find((i: any) => i.id === extra.id).atRisk, true);
    assert.equal((await app.call('GET', `/items/${extra.id}/link`, ALICE)).status, 200, 'still downloadable during grace');

    app.profiles.set(ALICE, { role: 'premium', planEndDate: daysAgo(10) });
    const hidden = (await app.call('GET', '/folders/root/children', ALICE)).body;
    assert.deepEqual(hidden.items.map((i: any) => i.id), [kept.id]);
    assert.equal(hidden.hiddenCount, 1);
    const blocked = await app.call('GET', `/items/${extra.id}/link?mode=download`, ALICE);
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.code, 'plan_expired');
    assert.equal((await app.call('GET', `/items/${kept.id}/link`, ALICE)).status, 200);

    const usage = (await app.call('GET', '/usage', ALICE)).body;
    assert.equal(usage.plan.state, 'hidden');
    assert.ok(usage.plan.deletionOn);
  } finally {
    app.close();
  }
});

test('trash, restore and permanent delete', async () => {
  const app = await startApp();
  try {
    const folder = (await app.call('POST', '/folders', ALICE, { name: 'Trip' })).body.folder;
    const item = await uploadFile(app, ALICE, 'boarding-pass.pdf', 1000, folder.id);

    assert.equal((await app.call('DELETE', `/folders/${folder.id}`, ALICE)).status, 200);
    const trash = (await app.call('GET', '/trash', ALICE)).body;
    assert.equal(trash.retentionDays, 30);
    assert.deepEqual(trash.entries.map((e: any) => e.kind), ['folder'], 'only the deleted folder is listed, not its contents');
    assert.equal(app.accounts.get(ALICE)!.usedBytes, 1000, 'Trash still counts toward storage');

    assert.equal((await app.call('POST', '/trash/restore', ALICE, { kind: 'folder', id: folder.id })).status, 200);
    assert.equal(app.items.get(item.id)!.deletedAt, null);

    await app.call('DELETE', `/items/${item.id}`, ALICE);
    const purge = await app.call('DELETE', `/trash/file/${item.id}`, ALICE);
    assert.equal(purge.body.freedBytes, 1000);
    assert.equal(app.accounts.get(ALICE)!.usedBytes, 0);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(app.deleted.length, 1, 'stored file removed after permanent delete');
  } finally {
    app.close();
  }
});

test('folders cannot be moved into themselves or their own subfolders', async () => {
  const app = await startApp();
  try {
    const parent = (await app.call('POST', '/folders', ALICE, { name: 'Photos' })).body.folder;
    const child = (await app.call('POST', '/folders', ALICE, { name: 'Trip', parentFolderId: parent.id })).body.folder;
    for (const target of [parent.id, child.id]) {
      const result = await app.call('PATCH', `/folders/${parent.id}`, ALICE, { parentFolderId: target });
      assert.equal(result.status, 400);
      assert.equal(result.body.code, 'invalid_move');
    }
    assert.equal((await app.call('PATCH', `/folders/${child.id}`, ALICE, { parentFolderId: null })).status, 200);
  } finally {
    app.close();
  }
});

test('folder uploads create the folder tree once and reuse parents', async () => {
  const app = await startApp();
  try {
    const result = await app.call('POST', '/folders/paths', ALICE, { paths: ['Trip/Day 1', 'Trip', 'Trip/Day 2', 'Trip/Day 1'] });
    assert.equal(result.status, 201);
    assert.deepEqual(Object.keys(result.body.folders).sort(), ['Trip', 'Trip/Day 1', 'Trip/Day 2']);
    assert.equal(app.folders.get(result.body.folders['Trip/Day 2'])!.parentFolderId, result.body.folders.Trip);
  } finally {
    app.close();
  }
});

test('file names are cleaned for storage and download headers', async () => {
  assert.equal(sanitizeName('  ../../etc/passwd\n', 'file'), '..-..-etc-passwd');
  assert.equal(sanitizeName('report‮fdp.exe', 'file'), 'reportfdp.exe');
  assert.throws(() => sanitizeName('...', 'file'), VaultError);
  assert.throws(() => sanitizeName('   ', 'folder'), VaultError);
  assert.equal(sanitizeName(`${'a'.repeat(300)}.pdf`, 'file').length, 255);
  assert.ok(sanitizeName(`${'a'.repeat(300)}.pdf`, 'file').endsWith('.pdf'));

  const header = contentDisposition('attachment', 'Q3 "final";\r\nX-Evil: 1 रिपोर्ट.pdf');
  assert.equal(/[\r\n]/.test(header), false, 'no header injection');
  assert.match(header, /^attachment; filename="[\x20-\x7e]*"; filename\*=UTF-8''[A-Za-z0-9%!._~-]+$/);
  assert.equal(header.match(/filename="([^"]*)"/)![1].includes(';'), false);
  assert.ok(header.includes('%E0%A4%B0'), 'non-Latin name preserved in the UTF-8 form');

  const app = await startApp();
  try {
    const item = await uploadFile(app, ALICE, 'evil".html', 10);
    app.items.get(item.id)!.mimeType = 'text/html';
    await app.call('GET', `/items/${item.id}/link?mode=view`, ALICE);
    const signed = app.downloads.at(-1)!;
    assert.ok(signed.contentDisposition.startsWith('attachment'), 'HTML is never rendered inline');
    assert.equal(signed.contentType, 'application/octet-stream');
  } finally {
    app.close();
  }
});

test('plan lifecycle dates follow the agreed timeline', () => {
  const now = new Date('2026-11-04T12:00:00+05:30');
  const grace = getPlanLifecycle({ role: 'premium', planEndDate: '2026-11-01', now });
  assert.equal(grace.state, 'grace');
  assert.equal(getPlanLifecycle({ role: 'premium', planEndDate: '2026-11-01', now: new Date('2026-11-12T12:00:00+05:30') }).state, 'hidden');
  assert.equal(getPlanLifecycle({ role: 'premium', planEndDate: '2026-11-01', now: new Date('2026-12-03T12:00:00+05:30') }).state, 'deleting');
  assert.equal(getPlanLifecycle({ role: 'premium', planEndDate: '2026-11-30', now }).state, 'active');
  assert.equal(getPlanLifecycle({ role: 'free', planEndDate: '2020-01-01', now }).state, 'active', 'free plans never expire');
  assert.equal(getPlanLifecycle({ role: 'admin', now }).planBytes, null);
});
