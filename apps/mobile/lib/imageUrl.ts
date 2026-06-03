/**
 * Cloudflare Image Resizing utility (Mobile)
 *
 * Mirrors src/lib/imageUrl.ts for use in the Expo mobile app.
 * Transforms media URLs into Cloudflare Image Resizing URLs for fast,
 * cached grid thumbnails while keeping full-res URLs for the viewer.
 *
 * CF Image Resizing URL format:
 *   https://<domain>/cdn-cgi/image/<options>/<original-path>
 *
 * Docs: https://developers.cloudflare.com/images/transform-images/
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
export function getImageUrl(src: string | null | undefined, opts: ImageTransformOptions = {}): string {
    if (!src) return '';

    // Don't transform videos
    const isVideo = /\.(mp4|mov|avi|webm|mkv|m4v)(\?.*)?$/i.test(src);
    if (isVideo) return src;

    // Only transform URLs on our own media domain
    const mediaDomainPattern = new RegExp(`^https?://${MEDIA_DOMAIN.replace('.', '\\.')}/`, 'i');
    if (!mediaDomainPattern.test(src)) return src;

    // Nothing to transform
    if (!opts.width && !opts.height && !opts.format) return src;

    // Build options string
    const parts: string[] = [];
    if (opts.width)  parts.push(`width=${opts.width}`);
    if (opts.height) parts.push(`height=${opts.height}`);
    if (opts.fit)    parts.push(`fit=${opts.fit}`);
    parts.push(`quality=${opts.quality ?? 75}`);
    parts.push(`format=${opts.format ?? 'webp'}`);

    // Extract path after domain
    const withoutProtocol = src.replace(/^https?:\/\/[^/]+/, '');
    const imagePath = withoutProtocol.replace(/^\/+/, '');

    return `https://${MEDIA_DOMAIN}/cdn-cgi/image/${parts.join(',')}/${imagePath}`;
}

/** Convenience preset: grid thumbnail (400px wide, webp, 75% quality) */
export function getGridThumbnail(src: string | null | undefined): string {
    return getImageUrl(src, { width: 400, quality: 75, format: 'webp' });
}

/** Convenience preset: small square avatar/preview (200px wide) */
export function getSmallThumbnail(src: string | null | undefined): string {
    return getImageUrl(src, { width: 200, quality: 70, format: 'webp' });
}
