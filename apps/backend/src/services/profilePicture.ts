import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

// Profile pictures (issue #322): the app and the website send the picture to POST /api/media/upload and the backend
// stores it itself under profiles/<user id>/, so no storage upload link is handed out for them (issue #318). The app
// has always called that route (apps/mobile/lib/storage.ts uploadProfileImage) but it was lost in the move to Railway.
// The new link is saved on the profile here and the previous picture's file is deleted, so old pictures don't pile up
// in storage. (The app and website still save the same link on the profile afterwards, which changes nothing.)

export class ProfilePictureError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export type ProfilePictureDependencies = {
  upload: (key: string, bytes: Buffer) => Promise<string>;
  /** The profile's current picture link, or null */
  load: (userId: string) => Promise<string | null>;
  /** Saves the new link on the profile */
  commit: (userId: string, url: string) => Promise<void>;
  /** Deletes a file this save stored (when the profile could not be updated) */
  remove: (key: string) => Promise<unknown>;
  /** Deletes the previous picture's file, only if it is one of ours in this user's folder and not `keep` */
  removePrevious: (previousUrl: string, keep: string) => Promise<unknown>;
};

// Profile pictures are shown small (avatars, the profile header); 512 px stays sharp on phones and loads fast
const MAX_SIDE = 512;
const QUALITY = 80;
// About 7 MB of picture as base64 (the backend reads JSON up to 10 MB)
const MAX_ENCODED_LENGTH = 9_500_000;

/** Off switch: PROFILE_PICTURE_ROUTE=false makes /api/media/upload answer "Route not found." again */
export function isProfilePictureRouteOn() {
  return process.env.PROFILE_PICTURE_ROUTE?.trim().toLowerCase() !== 'false';
}

// User input never determines the bucket, the file's path (beyond the signed-in user's id) or a remote URL to fetch.
export async function saveProfilePicture(body: Record<string, unknown>, userId: string, deps: ProfilePictureDependencies) {
  if (body.scope !== undefined && body.scope !== 'profile') throw new ProfilePictureError(400, 'Only profile pictures can be uploaded here');
  if (!/^[A-Za-z0-9-]{1,64}$/.test(userId)) throw new ProfilePictureError(400, 'Unknown user');

  const data = typeof body.base64 === 'string' ? body.base64 : '';
  // The app sends plain base64; the website a data: link
  const encoded = data.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '');
  if (!encoded.length || encoded.length > MAX_ENCODED_LENGTH || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new ProfilePictureError(400, 'Send the picture as a JPEG, PNG or WebP image of 7 MB at most');
  }

  let picture: Buffer;
  try {
    const decoder = sharp(Buffer.from(encoded, 'base64'), { limitInputPixels: 50_000_000, failOn: 'error' });
    const metadata = await decoder.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format || '') || !metadata.width || !metadata.height) throw new Error('Not a picture');
    // Upright, at most 512 px, saved as JPEG without the camera's metadata (location and such)
    picture = await decoder.rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: QUALITY, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new ProfilePictureError(400, 'The picture could not be read');
  }

  const previous = await deps.load(userId);
  // A new name each time, so no cache keeps showing the previous picture
  const key = `profiles/${userId}/${Date.now()}-${randomUUID()}.jpg`;
  const url = await deps.upload(key, picture);
  try {
    await deps.commit(userId, url);
  } catch (error) {
    await deps.remove(key).catch(() => undefined);
    throw error;
  }
  // The replaced picture's file; a failure here must never fail a save that worked
  if (previous) await deps.removePrevious(previous, key).catch(() => undefined);
  return { success: true, url, publicId: key, storageKey: key };
}
