import { VaultError } from "./errors.js";

/**
 * Cleans a user-supplied file or folder name for storage and display: strips control and
 * bidirectional-override characters and path separators, collapses whitespace, and caps the length.
 * Rejects names that are empty or only dots.
 */
export function sanitizeName(raw: unknown, kind: "file" | "folder"): string {
  const cleaned = String(raw ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/[\\/]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || /^\.+$/.test(cleaned)) {
    throw new VaultError("invalid_input", `Please enter a valid ${kind} name.`);
  }
  if (cleaned.length <= 255) return cleaned;
  const dot = kind === "file" ? cleaned.lastIndexOf(".") : -1;
  const ext = dot > 0 && cleaned.length - dot <= 20 ? cleaned.slice(dot) : "";
  return cleaned.slice(0, 255 - ext.length) + ext;
}

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0 || dot === filename.length - 1) return "";
  return filename.slice(dot + 1).toLowerCase().slice(0, 20);
}

/** MIME type as declared by the browser, reduced to a safe "type/subtype" or a generic fallback. */
export function sanitizeMimeType(raw: unknown): string {
  const value = String(raw ?? "").trim().toLowerCase().split(";")[0];
  return /^[a-z0-9][a-z0-9!#$&^_.+-]{0,63}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,127}$/.test(value)
    ? value
    : "application/octet-stream";
}

/**
 * Content-Disposition header value with an ASCII fallback and an RFC 5987 UTF-8 name, so names with
 * quotes, newlines or non-Latin characters cannot break or inject into the header.
 */
export function contentDisposition(mode: "inline" | "attachment", filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\;]/g, "_") || "download";
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${mode}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
  heic: "image/heic", heif: "image/heif", mp4: "video/mp4", mov: "video/quicktime", m4v: "video/x-m4v",
  webm: "video/webm", avi: "video/x-msvideo", mkv: "video/x-matroska", "3gp": "video/3gpp",
};

/**
 * Original file name of an event upload, from its storage key. Website/app keys look like
 * "events/{event}/{photos|videos}/{user}-{timestamp}-{uuid}-{name}"; anything else falls back to the last segment.
 */
export function eventMediaFilename(storageKey: string, isVideo: boolean, format: string | null): string {
  const base = storageKey.split("/").pop() || "";
  const match = base.match(/-\d{13}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i);
  let name = match?.[1] || base || (isVideo ? "video" : "photo");
  if (!extensionOf(name)) name = `${name}.${format?.toLowerCase() || (isVideo ? "mp4" : "jpg")}`;
  return sanitizeName(name, "file");
}

export function mimeTypeForExtension(extension: string, isVideo: boolean): string {
  return MIME_BY_EXTENSION[extension.toLowerCase()] ?? (isVideo ? "video/mp4" : "image/jpeg");
}
