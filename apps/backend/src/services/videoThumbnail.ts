import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

export class ThumbnailError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export type ThumbnailMedia = {
  id: string; event_id: string; storage_key: string; url: string;
  thumbnail_url: string | null; media_type?: string; resource_type?: string; status?: string;
};
export type ThumbnailDependencies = {
  load: (id: string) => Promise<ThumbnailMedia | null>;
  canEdit: (media: ThumbnailMedia, userId: string) => Promise<boolean>;
  upload: (key: string, bytes: Buffer) => Promise<string>;
  commit: (media: ThumbnailMedia, url: string) => Promise<boolean>;
  remove: (key: string) => Promise<unknown>;
};

// User input never determines the bucket, destination path, or remote URL to fetch.
export async function saveVideoThumbnail(userId: string, body: Record<string, unknown>, deps: ThumbnailDependencies) {
  // Supabase may return numeric primary keys even when the client model declares a string.
  const id = typeof body.photoId === 'string' ? body.photoId.trim()
    : typeof body.photoId === 'number' && Number.isSafeInteger(body.photoId) && body.photoId > 0
      ? String(body.photoId) : '';
  if (!id || id.length > 200) throw new ThumbnailError(400, 'A valid video ID is required');
  const media = await deps.load(id);
  if (!media) throw new ThumbnailError(404, 'Video not found');
  if (!await deps.canEdit(media, userId)) throw new ThumbnailError(403, 'You cannot change this video thumbnail');
  if (media.media_type !== 'video' && media.resource_type !== 'video') throw new ThumbnailError(400, 'This action is only available for videos');
  if (media.status !== 'processed' || !media.storage_key) throw new ThumbnailError(409, 'Wait for video processing to finish, then try again');
  if (body.previousThumbnailUrl !== media.thumbnail_url) throw new ThumbnailError(409, 'The thumbnail changed. Refresh the gallery and try again');

  const data = typeof body.image === 'string' ? body.image : '';
  const encoded = data.replace(/^data:image\/jpeg;base64,/, '');
  if (!data.startsWith('data:image/jpeg;base64,') || !encoded.length || encoded.length > 2_800_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new ThumbnailError(400, 'Choose a valid video frame (JPEG, maximum 2 MB)');
  }
  const input = Buffer.from(encoded, 'base64');
  if (input.length > 2 * 1024 * 1024) throw new ThumbnailError(413, 'The thumbnail is too large');
  let image: Buffer;
  try {
    const decoder = sharp(input, { limitInputPixels: 16_000_000, failOn: 'error' });
    const metadata = await decoder.metadata();
    if (metadata.format !== 'jpeg' || !metadata.width || !metadata.height) throw new Error('Invalid JPEG');
    image = await decoder.rotate().resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  } catch {
    throw new ThumbnailError(400, 'The selected frame could not be read. Choose another frame');
  }
  // Versioned keys avoid stale CDN/device caches and allow compare-and-swap updates.
  const key = `${media.storage_key}-hls/custom-thumbnail-${randomUUID()}.jpg`;
  const thumbnailUrl = await deps.upload(key, image);
  try {
    if (!await deps.commit(media, thumbnailUrl)) throw new ThumbnailError(409, 'The video changed. Refresh the gallery and try again');
  } catch (error) {
    await deps.remove(key).catch(() => undefined);
    throw error;
  }
  // Only delete our own replaced custom file; retain the automatic poster.
  const previous = media.thumbnail_url;
  if (previous) {
    try {
      const old = new URL(previous), current = new URL(thumbnailUrl);
      const oldKey = decodeURIComponent(old.pathname.slice(1));
      if (old.origin === current.origin && oldKey.startsWith(`${media.storage_key}-hls/custom-thumbnail-`) && oldKey.endsWith('.jpg')) {
        await deps.remove(oldKey).catch(() => undefined);
      }
    } catch { /* A legacy URL must never cause the successful save to fail. */ }
  }
  return { success: true, photoId: media.id, thumbnailUrl };
}
