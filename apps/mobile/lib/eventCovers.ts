export const EVENT_PLACEHOLDER_IMAGES = [
  "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=2071&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1465495910483-34a170a7bb00?q=80&w=2070&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1549413187-0521e7cebcba?q=80&w=2070&auto=format&fit=crop",
];

export const DEFAULT_EVENT_COVER_IMAGE = EVENT_PLACEHOLDER_IMAGES[0];

export function resolveEventCoverImage(coverImage?: string | null) {
  const trimmedCover = coverImage?.trim();
  return trimmedCover || DEFAULT_EVENT_COVER_IMAGE;
}
