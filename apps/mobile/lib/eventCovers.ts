import { getImageUrl } from "./imageUrl";

export const EVENT_PLACEHOLDER_IMAGES = [
  "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=2071&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1465495910483-34a170a7bb00?q=80&w=2070&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1549413187-0521e7cebcba?q=80&w=2070&auto=format&fit=crop",
];

export const DEFAULT_EVENT_COVER_IMAGE = EVENT_PLACEHOLDER_IMAGES[0];

export function resolveEventCoverImage(coverImage?: string | null, mode: 'preview' | 'thumbnail' = 'preview') {
  const trimmedCover = coverImage?.trim();
  if (!trimmedCover) return DEFAULT_EVENT_COVER_IMAGE;
  const width = mode === 'preview' ? 900 : 400;
  return getImageUrl(trimmedCover, { width });
}

// Default cover per event category, shown when the host hasn't uploaded a cover.
// Bundled copies of the website's public/event-covers/ files (src/lib/eventCovers.ts).
// Categories not listed keep the generic event placeholder.
const CATEGORY_DEFAULT_COVERS: Record<string, number> = {
  wedding: require('@/assets/images/event-covers/wedding.webp'),
};

/** Empty covers and the stock photos saved on event creation both count as "no cover uploaded". */
export function isDefaultEventCover(coverImage?: string | null) {
  const trimmed = coverImage?.trim();
  return !trimmed || EVENT_PLACEHOLDER_IMAGES.includes(trimmed);
}

/**
 * Image source for an event cover: the category's bundled default when the host hasn't
 * uploaded a cover, otherwise the resolved cover URL (same as resolveEventCoverImage).
 */
export function getEventCoverSource(coverImage?: string | null, mode: 'preview' | 'thumbnail' = 'preview', category?: string | null) {
  const categoryCover = CATEGORY_DEFAULT_COVERS[category?.trim().toLowerCase() || ''];
  if (categoryCover && isDefaultEventCover(coverImage)) return categoryCover;
  return { uri: resolveEventCoverImage(coverImage, mode) };
}
