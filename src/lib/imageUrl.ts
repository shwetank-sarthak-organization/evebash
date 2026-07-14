/**
 * Image URL Resolution utility
 *
 * Maps media URLs to pre-generated thumbnail or preview webp files
 * stored on Backblaze B2 and delivered via Cloudflare CDN caching.
 */

const MEDIA_DOMAIN = process.env.NEXT_PUBLIC_MEDIA_DOMAIN || 'media.evebash.com';

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
 * Returns a Cloudflare-resized version of a media URL for use in image grids
 * and thumbnails. Falls back to the original URL if:
 *  - No transform options are provided
 *  - The URL is not hosted on our media domain (e.g. external profile pics)
 *  - The URL points to a video file
 *
 * @param src   The original full URL (e.g. https://media.evebash.com/events/…/photo.jpg)
 * @param opts  Transform options (width, quality, format, …)
 * @returns     A CF Image Resizing URL, or the original src unchanged
 */
export function getImageUrl(src: string | null | undefined, opts: ImageTransformOptions = {}): string {
    if (!src) return '';

    // Don't transform videos
    const isVideo = /\.(mp4|mov|avi|webm|mkv|m4v)(\?.*)?$/i.test(src);
    if (isVideo) return src;

    // Only transform URLs on our own media domain
    const mediaDomainPattern = new RegExp(`^https?://${MEDIA_DOMAIN.replace('.', '\\.')}/`, 'i');
    if (!mediaDomainPattern.test(src)) return src;

    // Map to pre-generated static files on Backblaze B2 based on size requested
    const [baseSrc, queryString] = src.split("?");
    const query = queryString ? `?${queryString}` : "";

    // If it is already a pre-resized WebP file, return it directly to avoid appending double extensions
    if (baseSrc.endsWith("-preview.webp") || baseSrc.endsWith("-thumbnail.webp")) {
        return src;
    }

    const width = opts.width || 0;
    if (width > 0 && width <= 200) {
        return `${baseSrc}-thumbnail.webp${query}`;
    } else if (width > 200 && width <= 500) {
        return `${baseSrc}-thumbnail.webp${query}`;
    } else if (width > 500 && width <= 1600) {
        return `${baseSrc}-preview.webp${query}`;
    }
    return `${baseSrc}-preview.webp${query}`;
}

/** Convenience preset: grid thumbnail (500px wide, webp, 75% quality) */
export function getGridThumbnail(src: string | null | undefined): string {
    return getImageUrl(src, { width: 500, quality: 75, format: 'webp' });
}

/** Convenience preset: small square avatar/preview (200px wide) */
export function getSmallThumbnail(src: string | null | undefined): string {
    return getImageUrl(src, { width: 200, quality: 70, format: 'webp' });
}
