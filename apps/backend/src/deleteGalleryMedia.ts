import { getCachedBackblazeAuth } from './backblaze.js';
import { getAdminClient } from './adminAuth.js';

// Resolve storage keys from the database only; callers cannot supply file paths.
export async function deleteGalleryMedia(db: ReturnType<typeof getAdminClient>, photoId: string, eventId: string) {
  const { data: photo, error } = await db.from('photos').select('id, storage_key').eq('id', photoId).eq('event_id', eventId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!photo) return false;
  if (!photo.storage_key) throw new Error('Media storage key is missing; deletion was stopped');
  const bucketId = process.env.B2_BUCKET_ID;
  if (!bucketId) throw new Error('B2_BUCKET_ID is not configured');
  const auth = await getCachedBackblazeAuth();
  const key = String(photo.storage_key);
  const targets = [
    { prefix: key, exact: true },
    { prefix: `${key}-thumbnail.webp`, exact: true },
    { prefix: `${key}-preview.webp`, exact: true },
    { prefix: `hls/${key}/`, exact: false },
    { prefix: `${key}-hls/`, exact: false },
  ];
  const b2 = async (method: string, body: object) => {
    const response = await fetch(`${auth.apiUrl}/b2api/v3/${method}`, {
      method: 'POST', headers: { Authorization: auth.authorizationToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error('Media storage deletion failed. Please retry.');
    return response.json();
  };
  for (const target of targets) {
    let startFileName: string | undefined;
    let startFileId: string | undefined;
    do {
      const batch = await b2('b2_list_file_versions', { bucketId, prefix: target.prefix, maxFileCount: 1000, startFileName, startFileId });
      for (const file of batch.files || []) {
        if (target.exact ? file.fileName !== target.prefix : !file.fileName.startsWith(target.prefix)) continue;
        await b2('b2_delete_file_version', { fileName: file.fileName, fileId: file.fileId });
      }
      startFileName = batch.nextFileName || undefined;
      startFileId = batch.nextFileId || undefined;
    } while (startFileName);
  }
  for (const [table, column] of [['faces', 'image_id'], ['likes', 'photo_id'], ['comments', 'photo_id']]) {
    const { error: relatedError } = await db.from(table).delete().eq(column, photoId);
    if (relatedError) throw new Error(relatedError.message);
  }
  const { error: deleteError } = await db.from('photos').delete().eq('id', photoId).eq('event_id', eventId);
  if (deleteError) throw new Error(deleteError.message);
  return true;
}
