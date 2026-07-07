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
