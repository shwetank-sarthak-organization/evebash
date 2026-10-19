/**
 * Website links the app shares (gallery links, QR codes, business pages). They follow the build's backend:
 * staging builds point at the staging website, production builds at www.evebash.com.
 * EXPO_PUBLIC_WEB_BASE_URL overrides both.
 */
export function getWebBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_WEB_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  return (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').includes('staging') ? 'https://staging.evebash.com' : 'https://www.evebash.com';
}

export function getGalleryWebUrl(eventId: string): string {
  return `${getWebBaseUrl()}/events/${encodeURIComponent(eventId)}`;
}

export function getBusinessWebUrl(businessId: string): string {
  return `${getWebBaseUrl()}/eb-network/${encodeURIComponent(businessId)}`;
}

/**
 * Gallery id from a scanned QR code or pasted link: any evebash.com site, plus the old wedalbum.app links
 * already printed on QR codes. Returns null for anything else (e.g. a plain join code).
 */
export function galleryIdFromLink(text: string): string | null {
  const match = text.trim().match(/^https?:\/\/(?:[a-z0-9-]+\.)*(?:evebash\.com|wedalbum\.app)\/events\/([^/?#]+)/i);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}
