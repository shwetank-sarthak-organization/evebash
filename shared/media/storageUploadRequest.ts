// How the website and the app send one file to storage with what /get-upload-url (or /mobile/get-upload-url) returned
// (issue #318). The backend's one-file link (putUrl) only accepts the storageKey and content type it was signed for, so
// it is used whenever it is there; Backblaze's own any-file link (uploadUrl + authorizationToken) is the fallback while
// the backend still hands it out.

export type StorageUploadLink = {
  storageKey: string;
  putUrl?: string;
  putHeaders?: Record<string, string>;
  uploadUrl?: string;
  authorizationToken?: string;
};

export type StorageUploadRequest = { url: string; method: "PUT" | "POST"; headers: Record<string, string> };

/** True when the reply holds a link we can upload with */
export function hasStorageUploadLink(link: Partial<StorageUploadLink> | null | undefined): boolean {
  return Boolean(link && (link.putUrl || (link.uploadUrl && link.authorizationToken)));
}

/** The request that uploads the file; `contentType` is only used for Backblaze's link (the one-file link names its own) */
export function storageUploadRequest(link: StorageUploadLink, contentType: string): StorageUploadRequest {
  if (link.putUrl) {
    return { url: link.putUrl, method: "PUT", headers: { ...(link.putHeaders || {}) } };
  }
  if (link.uploadUrl && link.authorizationToken) {
    return {
      url: link.uploadUrl,
      method: "POST",
      headers: {
        Authorization: link.authorizationToken,
        "Content-Type": contentType || "application/octet-stream",
        "X-Bz-File-Name": encodeURIComponent(link.storageKey),
        "X-Bz-Content-Sha1": "do_not_verify",
      },
    };
  }
  throw new Error("The server sent no upload link.");
}
