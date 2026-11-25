import type { EventBucket } from "./eventBucketS3.js";
import { extensionOf, mimeTypeForExtension } from "../vault/names.js";

// Issue #318: the upload links /get-upload-url and /mobile/get-upload-url hand out. Backblaze's own upload link
// (uploadUrl + authorizationToken) works for ANY file name in the whole bucket, so whoever gets one could replace any
// customer's photo. The one-file link (putUrl) is signed for exactly the storageKey the backend chose and its content
// type, for 2 hours. New website and app code uses putUrl; Backblaze's link stays for old app builds until
// UPLOAD_LEGACY_B2_TOKEN=false switches it off.

export const ONE_FILE_LINK_SECONDS = 2 * 60 * 60;

/** Off switch: ONE_FILE_UPLOAD_LINKS=false stops adding putUrl (uploads then use Backblaze's link, as before) */
export function isOneFileUploadLinkOn() {
  return process.env.ONE_FILE_UPLOAD_LINKS?.trim().toLowerCase() !== "false";
}

/** UPLOAD_LEGACY_B2_TOKEN=false stops handing out Backblaze's any-file link; app builds older than the putUrl change can't upload then */
export function isLegacyUploadTokenOn() {
  return process.env.UPLOAD_LEGACY_B2_TOKEN?.trim().toLowerCase() !== "false";
}

/** The type the one-file link is signed for: the client's when it is a picture or video type, else from the file name */
export function uploadContentType(declared: unknown, fileName: string, isVideo: boolean): string {
  const type = typeof declared === "string" ? declared.trim().toLowerCase() : "";
  if (/^(image|video)\/[a-z0-9.+-]{1,60}$/.test(type)) return type;
  return mimeTypeForExtension(extensionOf(fileName), isVideo);
}

export type OneFileUploadLink = { putUrl: string; putHeaders: Record<string, string> };

/** A link that stores exactly `storageKey` with `contentType`; null when the switch is off or the bucket can't sign */
export async function oneFileUploadLink(
  bucket: EventBucket | null,
  storageKey: string,
  contentType: string,
): Promise<OneFileUploadLink | null> {
  if (!isOneFileUploadLinkOn() || !bucket) return null;
  const putUrl = await bucket.signUpload(storageKey, contentType, "", ONE_FILE_LINK_SECONDS);
  // The uploader must send exactly this Content-Type, or storage refuses the upload
  return { putUrl, putHeaders: { "Content-Type": contentType } };
}
