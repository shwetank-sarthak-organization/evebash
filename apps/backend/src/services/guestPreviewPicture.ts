import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

// The picture of the app's guest home on the Design tab's Guest Home Preview (todo #31). The app takes it while a host
// has Preview Guest Theme open and sends it here; it is kept in events.guest_preview_picture
// (supabase/migrations/20261112120000_guest_preview_picture.sql) so the website can show the app too. Each save
// replaces the previous file.

export class GuestPreviewPictureError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** What events.guest_preview_picture holds (the website and app read it with shared/themes/guestPreviewPicture.ts) */
export type GuestPreviewPicture = { url: string; templateId: string | null; takenAt: string; width: number; height: number };

export type GuestPreviewPictureDependencies = {
  canManage: (eventId: string) => Promise<boolean>;
  /** The event's saved picture as stored, or null when there is no such event */
  load: (eventId: string) => Promise<{ picture: unknown } | null>;
  upload: (key: string, bytes: Buffer) => Promise<string>;
  /** Saves the picture only if the stored one is still `previous`; false when another save came first */
  commit: (eventId: string, previous: unknown, picture: GuestPreviewPicture) => Promise<boolean>;
  remove: (key: string) => Promise<unknown>;
  now?: () => Date;
};

// Wide enough for the preview's phone frame on any screen; the app sends about 585 px
const MAX_WIDTH = 720;
const MAX_HEIGHT = 1800;

const savedUrl = (picture: unknown) =>
  picture && typeof picture === 'object' && typeof (picture as { url?: unknown }).url === 'string' ? (picture as { url: string }).url : null;

// User input never determines the bucket, the file's path (beyond the checked event ID) or a remote URL to fetch.
export async function saveGuestPreviewPicture(body: Record<string, unknown>, deps: GuestPreviewPictureDependencies) {
  const eventId = typeof body.eventId === 'string' ? body.eventId.trim() : '';
  if (!eventId || eventId.length > 200 || !/^[A-Za-z0-9._-]+$/.test(eventId)) throw new GuestPreviewPictureError(400, 'A valid event ID is required');
  const templateId = body.templateId === null || body.templateId === undefined ? null
    : typeof body.templateId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(body.templateId) ? body.templateId : undefined;
  if (templateId === undefined) throw new GuestPreviewPictureError(400, 'A valid template ID is required');
  if (!await deps.canManage(eventId)) throw new GuestPreviewPictureError(403, "Only the event's managers can save its preview picture");
  const current = await deps.load(eventId);
  if (!current) throw new GuestPreviewPictureError(404, 'Event not found');

  const data = typeof body.image === 'string' ? body.image : '';
  const encoded = data.replace(/^data:image\/jpeg;base64,/, '');
  if (!data.startsWith('data:image/jpeg;base64,') || !encoded.length || encoded.length > 2_800_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new GuestPreviewPictureError(400, 'Send the picture as a JPEG of 2 MB at most');
  }
  let image: { data: Buffer; width: number; height: number };
  try {
    const decoder = sharp(Buffer.from(encoded, 'base64'), { limitInputPixels: 16_000_000, failOn: 'error' });
    const metadata = await decoder.metadata();
    if (metadata.format !== 'jpeg' || !metadata.width || !metadata.height) throw new Error('Invalid JPEG');
    const { data: resized, info } = await decoder.rotate()
      .resize({ width: MAX_WIDTH, height: MAX_HEIGHT, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    image = { data: resized, width: info.width, height: info.height };
  } catch {
    throw new GuestPreviewPictureError(400, 'The picture could not be read');
  }

  // A new name each time, so no cache keeps showing the previous picture
  const folder = `events/${eventId}/guest-preview/`;
  const key = `${folder}app-${randomUUID()}.jpg`;
  const url = await deps.upload(key, image.data);
  const picture: GuestPreviewPicture = {
    url,
    templateId,
    takenAt: (deps.now?.() ?? new Date()).toISOString(),
    width: image.width,
    height: image.height,
  };
  try {
    if (!await deps.commit(eventId, current.picture ?? null, picture)) {
      throw new GuestPreviewPictureError(409, 'Another picture was saved at the same time');
    }
  } catch (error) {
    await deps.remove(key).catch(() => undefined);
    throw error;
  }

  // The replaced picture, only if it is one of this event's preview files
  const previous = savedUrl(current.picture);
  if (previous) {
    try {
      const old = new URL(previous), saved = new URL(url);
      const oldKey = decodeURIComponent(old.pathname.slice(1));
      if (old.origin === saved.origin && oldKey.startsWith(folder) && oldKey.endsWith('.jpg') && oldKey !== key) {
        await deps.remove(oldKey).catch(() => undefined);
      }
    } catch { /* A malformed old link must never fail a save that worked */ }
  }
  return { success: true, picture };
}
