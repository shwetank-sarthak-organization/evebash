// Website and app: a photo whose uploaded file never reached storage. The row exists, but the photo worker found no
// file ("NoSuchKey ... Key not found") and marked it failed, so there is no original, preview or thumbnail to show.
// Guests don't see these (the grid would show "Image unavailable"); the host does, marked as a failed upload.
const MISSING_FILE_ERROR = /NoSuchKey|Key not found|does not exist/i;

export function isMissingUploadedFile(media: { status?: string | null; thumbnailUrl?: string | null; processingError?: string | null }): boolean {
  return media.status === 'failed' && !media.thumbnailUrl && MISSING_FILE_ERROR.test(media.processingError || '');
}
