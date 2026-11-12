// Website and app (one copy): the picture of the app's guest home on the Design tab's Guest Home Preview (todos #29,
// #31). The app takes it while a host has Preview Guest Theme open and sends it to the backend
// (POST /api/media/guest-preview-picture), which keeps it in events.guest_preview_picture
// (supabase/migrations/20261112120000_guest_preview_picture.sql), so the website can show the app too.

export interface GuestPreviewPicture {
  url: string;
  /** The event's template when the picture was taken; a different one now means the picture is out of date */
  templateId: string | null;
  /** When it was taken (ISO time) */
  takenAt: string;
  width: number;
  height: number;
}

/** The saved picture, or null for none or anything not shaped like one */
export function readGuestPreviewPicture(value: unknown): GuestPreviewPicture | null {
  if (!value || typeof value !== 'object') return null;
  const picture = value as Record<string, unknown>;
  const { url, templateId, takenAt, width, height } = picture;
  if (typeof url !== 'string' || !/^https:\/\//.test(url)) return null;
  if (typeof takenAt !== 'string' || Number.isNaN(Date.parse(takenAt))) return null;
  if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) return null;
  return { url, templateId: typeof templateId === 'string' ? templateId : null, takenAt, width, height };
}

/** The theme was changed after the picture was taken */
export function isGuestPreviewPictureOutOfDate(picture: { templateId: string | null }, templateId: string | null | undefined) {
  return (picture.templateId ?? null) !== (templateId ?? null);
}
