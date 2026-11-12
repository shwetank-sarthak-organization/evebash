// Issue #134: deleting a folder in B2 (a video's streaming copy, hls/<storage_key>/) by listing file NAMES only
// removes the newest version of each file. When a file was written twice (the GPU worker hands a video to the
// 16-core worker after uploading the poster, Modal retries, re-processing), the older version becomes visible
// again and stays billed. With B2_DELETE_ALL_VERSIONS=true the delete lists file VERSIONS and removes every one.
// Off by default: the old name-only delete runs unchanged.

type B2Auth = { apiUrl: string; authorizationToken: string };
type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean;
  json(): Promise<any>;
}>;

export function isDeleteAllVersionsOn() {
  return process.env.B2_DELETE_ALL_VERSIONS?.trim().toLowerCase() === "true";
}

/**
 * Deletes every version (and hide marker) of every file under `prefix`. The prefix must end with "/" so a
 * folder like hls/a.mp4/ can never match a neighbour such as hls/a.mp4.old/.
 * Returns ok=false if a listing call failed (some files may be left; the caller can retry).
 */
export async function deleteAllB2Versions(
  auth: B2Auth,
  bucketId: string,
  prefix: string,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<{ ok: boolean; deleted: number; failed: number }> {
  if (!prefix || !prefix.endsWith("/")) throw new Error(`Refusing to delete B2 prefix without a trailing slash: "${prefix}"`);

  const post = (method: string, body: Record<string, unknown>) =>
    fetchImpl(`${auth.apiUrl}/b2api/v3/${method}`, {
      method: "POST",
      headers: { Authorization: auth.authorizationToken, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  let startFileName: string | undefined;
  let startFileId: string | undefined;
  let deleted = 0;
  let failed = 0;
  do {
    const listResponse = await post("b2_list_file_versions", {
      bucketId,
      prefix,
      maxFileCount: 1000,
      ...(startFileName ? { startFileName, startFileId } : {}),
    });
    if (!listResponse.ok) return { ok: false, deleted, failed };
    const listData = await listResponse.json();
    const files: Array<{ fileName?: string; fileId?: string }> = (listData.files || []).filter(
      (file: { fileName?: string; fileId?: string }) => file.fileId && file.fileName?.startsWith(prefix),
    );

    for (let i = 0; i < files.length; i += 10) {
      const results = await Promise.all(
        files.slice(i, i + 10).map((file) =>
          post("b2_delete_file_version", { fileName: file.fileName, fileId: file.fileId })
            .then((response) => response.ok)
            .catch(() => false),
        ),
      );
      deleted += results.filter(Boolean).length;
      failed += results.filter((ok) => !ok).length;
    }

    startFileName = listData.nextFileName || undefined;
    startFileId = listData.nextFileId || undefined;
  } while (startFileName);

  return { ok: failed === 0, deleted, failed };
}

// Issue #136: the same problem for single files (a photo or video original, its preview, thumbnail and grid image,
// profile pictures, album files, replaced video thumbnails): deleting only the newest version leaves an older one
// visible and billed when the file was written twice (a photo retry or rotate remade the preview). With
// B2_DELETE_ALL_FILE_VERSIONS=true every version of the exact file name is deleted. Its own flag, so turning it on
// is a separate step from B2_DELETE_ALL_VERSIONS. Off by default: the old newest-version delete runs unchanged.
export function isDeleteAllFileVersionsOn() {
  return process.env.B2_DELETE_ALL_FILE_VERSIONS?.trim().toLowerCase() === "true";
}

/**
 * Deletes every version (and hide marker) of exactly `key`; files whose names only start with `key` (for example
 * `<key>-preview.webp` next to `<key>`) are left alone. ok=false if a listing call or a delete failed.
 */
export async function deleteAllB2FileVersions(
  auth: B2Auth,
  bucketId: string,
  key: string,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<{ ok: boolean; deleted: number; failed: number }> {
  if (!key) throw new Error("Refusing to delete an empty B2 file name");

  const post = (method: string, body: Record<string, unknown>) =>
    fetchImpl(`${auth.apiUrl}/b2api/v3/${method}`, {
      method: "POST",
      headers: { Authorization: auth.authorizationToken, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  let startFileId: string | undefined;
  let deleted = 0;
  let failed = 0;
  while (true) {
    const listResponse = await post("b2_list_file_versions", {
      bucketId,
      prefix: key,
      startFileName: key,
      maxFileCount: 100,
      ...(startFileId ? { startFileId } : {}),
    });
    if (!listResponse.ok) return { ok: false, deleted, failed };
    const listData = await listResponse.json();
    const versions: Array<{ fileName?: string; fileId?: string }> = (listData.files || []).filter(
      (file: { fileName?: string; fileId?: string }) => file.fileName === key && file.fileId,
    );
    const results = await Promise.all(
      versions.map((file) =>
        post("b2_delete_file_version", { fileName: key, fileId: file.fileId })
          .then((response) => response.ok)
          .catch(() => false),
      ),
    );
    deleted += results.filter(Boolean).length;
    failed += results.filter((ok) => !ok).length;
    // Versions of one name come in a row; stop once the listing moves past it
    if (listData.nextFileName !== key || !listData.nextFileId) break;
    startFileId = listData.nextFileId;
  }
  return { ok: failed === 0, deleted, failed };
}
