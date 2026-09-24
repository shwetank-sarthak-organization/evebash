import type { AdminActionResult, GalleryMedia } from './adminApi';

export type GalleryMediaType = 'images' | 'videos';
export const isGalleryVideo = (media: GalleryMedia) => media.media_type === 'video' || media.resource_type === 'video';

// Older deployments ignore mediaType. Scan their mixed pages so filtering still
// covers the entire gallery rather than just the currently displayed page.
export async function loadGalleryPage(
  fetchPage: (offset: number) => Promise<AdminActionResult>,
  mediaType: GalleryMediaType,
  page: number,
  isActive: () => boolean = () => true,
): Promise<{ media: GalleryMedia[]; hasMore: boolean }> {
  const size = 48;
  const start = page * size;
  const matches = (item: GalleryMedia) => isGalleryVideo(item) === (mediaType === 'videos');
  const read = async (offset: number) => {
    const result = await fetchPage(offset);
    if (!isActive()) throw new Error('Gallery request cancelled');
    if (!result.success) throw new Error(result.error || 'Unable to load gallery');
    return result;
  };
  let result = await read(start);
  if (result.appliedMediaType === mediaType) {
    return { media: (result.media || []).filter(matches), hasMore: !!result.hasMore };
  }
  if (start !== 0) result = await read(0);
  const matching: GalleryMedia[] = [];
  let offset = 0;
  while (true) {
    const batch = result.media || [];
    matching.push(...batch.filter(matches));
    if (matching.length > start + size || !result.hasMore) {
      return { media: matching.slice(start, start + size), hasMore: matching.length > start + size };
    }
    if (batch.length === 0) throw new Error('Unable to load the next gallery page. Please retry.');
    offset += batch.length;
    result = await read(offset);
  }
}
