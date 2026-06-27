/**
 * Image URL Resolution utility (Mobile)
 *
 * Mirrors src/lib/imageUrl.ts for use in the Expo mobile app.
 * Maps media URLs to pre-generated thumbnail or preview webp files
 * stored on Backblaze B2 and delivered via Cloudflare CDN caching.
 */

const MEDIA_DOMAIN = process.env.EXPO_PUBLIC_MEDIA_DOMAIN || 'media.evebash.com';

export interface ImageTransformOptions {
    /** Target width in pixels */
    width?: number;
    /** Quality 1–100 (default: 75) */
    quality?: number;
    /** Output format. Defaults to 'webp' for best compression */
    format?: 'webp' | 'jpeg' | 'png' | 'avif' | 'auto';
    /** How to fit the image when both width and height are specified */
    fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
    /** Target height in pixels */
    height?: number;
}

/**
 * Returns a Cloudflare-resized version of a media URL for use in grids.
 * Falls back to the original URL if:
 *  - No transform options provided
 *  - URL is not on our media domain
 *  - URL points to a video file
 */
export function getImageUrl(
    src: string | null | undefined, 
    opts: ImageTransformOptions = {}, 
    thumbnailUrl?: string | null
): string {
    if (!src) return '';

    // Don't transform videos
    const isVideo = /\.(mp4|mov|avi|webm|mkv|m4v)(\?.*)?$/i.test(src);
    if (isVideo) return src;

    // If thumbnailUrl is explicitly null or empty, it means the thumbnail is NOT generated yet.
    // In this case, we MUST fall back to the original source url to prevent broken images.
    if (thumbnailUrl === null || thumbnailUrl === '') {
        return src;
    }

    // Only transform URLs on our own media domain
    const mediaDomainPattern = new RegExp(`^https?://${MEDIA_DOMAIN.replace('.', '\\.')}/`, 'i');
    if (!mediaDomainPattern.test(src)) return src;

    // Map to pre-generated static files on Backblaze B2 based on size requested
    const width = opts.width || 0;
    if (width > 0 && width <= 200) {
        return thumbnailUrl || `${src}-thumbnail.webp`;
    } else if (width > 200 && width <= 450) {
        return thumbnailUrl || `${src}-thumbnail.webp`;
    } else if (width > 450 && width <= 1000) {
        return `${src}-preview.webp`;
    }

    return src;
}

/** Convenience preset: grid thumbnail (400px wide, webp, 75% quality) */
export function getGridThumbnail(src: string | null | undefined, thumbnailUrl?: string | null): string {
    return getImageUrl(src, { width: 400 }, thumbnailUrl);
}

/** Convenience preset: small square avatar/preview (200px wide) */
export function getSmallThumbnail(src: string | null | undefined, thumbnailUrl?: string | null): string {
    return getImageUrl(src, { width: 200 }, thumbnailUrl);
}
