import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { deleteAllB2Versions, isDeleteAllVersionsOn } from "../src/services/b2DeleteAllVersions.js";

const auth = { apiUrl: "https://b2.test", authorizationToken: "token" };

// A tiny in-memory B2: files are { fileName, fileId }, listed in name/id order, 2 per page
function fakeB2(files: Array<{ fileName: string; fileId: string }>, options: { failList?: boolean; failDeleteId?: string } = {}) {
  const store = [...files];
  const calls: string[] = [];
  const fetchImpl = async (url: string, init: { body: string }) => {
    const method = url.split("/").pop()!;
    const body = JSON.parse(init.body);
    calls.push(method);
    if (method === "b2_list_file_versions") {
      if (options.failList) return { ok: false, json: async () => ({}) };
      const matching = store
        .filter((f) => f.fileName.startsWith(body.prefix))
        .sort((a, b) => a.fileName.localeCompare(b.fileName) || a.fileId.localeCompare(b.fileId));
      const start = body.startFileName
        ? matching.findIndex((f) => f.fileName === body.startFileName && f.fileId === body.startFileId)
        : 0;
      const page = matching.slice(start, start + 2);
      const next = matching[start + 2];
      return { ok: true, json: async () => ({ files: page, nextFileName: next?.fileName ?? null, nextFileId: next?.fileId ?? null }) };
    }
    if (method === "b2_delete_file_version") {
      if (body.fileId === options.failDeleteId) return { ok: false, json: async () => ({}) };
      const index = store.findIndex((f) => f.fileId === body.fileId && f.fileName === body.fileName);
      if (index >= 0) store.splice(index, 1);
      return { ok: index >= 0, json: async () => ({}) };
    }
    throw new Error(`unexpected ${method}`);
  };
  return { store, calls, fetchImpl };
}

afterEach(() => {
  delete process.env.B2_DELETE_ALL_VERSIONS;
});

test("deletes every version under the prefix, across pages, and nothing outside it", async () => {
  const b2 = fakeB2([
    { fileName: "hls/v.mp4/poster.jpg", fileId: "p1" },
    { fileName: "hls/v.mp4/poster.jpg", fileId: "p2" }, // written twice (GPU handoff)
    { fileName: "hls/v.mp4/480p/seg_000.ts", fileId: "s1" },
    { fileName: "hls/v.mp4/480p/seg_000.ts", fileId: "s2" }, // Modal retry
    { fileName: "hls/v.mp4/master.m3u8", fileId: "m1" },
    { fileName: "hls/v.mp4.old/poster.jpg", fileId: "other" }, // neighbour folder: must stay
  ]);
  const result = await deleteAllB2Versions(auth, "bucket", "hls/v.mp4/", b2.fetchImpl);
  assert.deepEqual(result, { ok: true, deleted: 5, failed: 0 });
  assert.deepEqual(b2.store, [{ fileName: "hls/v.mp4.old/poster.jpg", fileId: "other" }]);
});

test("reports a failed listing so the caller can retry", async () => {
  const b2 = fakeB2([{ fileName: "hls/v.mp4/poster.jpg", fileId: "p1" }], { failList: true });
  assert.deepEqual(await deleteAllB2Versions(auth, "bucket", "hls/v.mp4/", b2.fetchImpl), { ok: false, deleted: 0, failed: 0 });
});

test("counts a failed delete and keeps going", async () => {
  const b2 = fakeB2(
    [
      { fileName: "hls/v.mp4/a", fileId: "1" },
      { fileName: "hls/v.mp4/b", fileId: "2" },
    ],
    { failDeleteId: "1" },
  );
  assert.deepEqual(await deleteAllB2Versions(auth, "bucket", "hls/v.mp4/", b2.fetchImpl), { ok: false, deleted: 1, failed: 1 });
});

test("refuses a prefix without a trailing slash", async () => {
  const b2 = fakeB2([]);
  await assert.rejects(deleteAllB2Versions(auth, "bucket", "hls/v.mp4", b2.fetchImpl), /trailing slash/);
  await assert.rejects(deleteAllB2Versions(auth, "bucket", "", b2.fetchImpl), /trailing slash/);
  assert.equal(b2.calls.length, 0);
});

test("the flag is off unless B2_DELETE_ALL_VERSIONS is true", () => {
  assert.equal(isDeleteAllVersionsOn(), false);
  process.env.B2_DELETE_ALL_VERSIONS = "TRUE ";
  assert.equal(isDeleteAllVersionsOn(), true);
  process.env.B2_DELETE_ALL_VERSIONS = "1";
  assert.equal(isDeleteAllVersionsOn(), false);
});
