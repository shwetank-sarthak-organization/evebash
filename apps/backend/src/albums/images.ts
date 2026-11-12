import sharp, { type Metadata } from "sharp";
import { ALBUM_IMAGE_FORMATS, albumConfig } from "./config.js";
import { AlbumError } from "./errors.js";

export type AlbumPageImages = {
  preview: Buffer;
  thumbnail: Buffer;
  /** Size of the uploaded design, upright */
  width: number;
  height: number;
};

/**
 * Turns an uploaded page design into the WebP preview and thumbnail we keep. No faces are indexed and the original
 * isn't kept. Print exports are often CMYK or Adobe RGB, so both are converted to sRGB for screens.
 */
export async function makeAlbumPageImages(input: string | Buffer): Promise<AlbumPageImages> {
  const open = () => sharp(input, { limitInputPixels: albumConfig.maxPagePixels, failOn: "error" });
  let metadata: Metadata;
  try {
    metadata = await open().metadata();
  } catch {
    throw new AlbumError("unsupported_file", "That file isn't an image we can read. Export the page as a JPEG and try again.");
  }
  if (!metadata.format || !ALBUM_IMAGE_FORMATS.has(metadata.format)) {
    throw new AlbumError("unsupported_file", "Upload pages as JPEG, PNG, WebP or TIFF. Export the page as a JPEG and try again.");
  }
  if (!metadata.width || !metadata.height) {
    throw new AlbumError("unsupported_file", "That image has no size. Export the page again and retry.");
  }
  if (metadata.width * metadata.height > albumConfig.maxPagePixels) {
    throw new AlbumError("file_too_large", "That page is too large. Export it at 300 dpi or less and try again.");
  }
  // EXIF orientations 5-8 are rotated by 90 degrees
  const sideways = (metadata.orientation ?? 1) >= 5;
  const width = sideways ? metadata.height : metadata.width;
  const height = sideways ? metadata.width : metadata.height;

  try {
    const { preview: p, thumbnail: t } = albumConfig;
    const preview = await open()
      .rotate()
      .resize({ width: p.width, height: p.height, fit: "inside", withoutEnlargement: true })
      .toColourspace("srgb")
      .webp({ quality: p.quality })
      .toBuffer();
    const thumbnail = await sharp(preview)
      .resize({ width: t.width, height: t.height, fit: "inside", withoutEnlargement: true })
      .webp({ quality: t.quality })
      .toBuffer();
    return { preview, thumbnail, width, height };
  } catch {
    throw new AlbumError("unsupported_file", "We couldn't read that image. Export the page as a JPEG and try again.");
  }
}

/** A design at least 1.5 times wider than tall shows two album pages. */
export function layoutFor(width: number, height: number) {
  return width >= height * albumConfig.spreadMinAspect ? "spread" : "single";
}

/** Runs at most `limit` tasks at a time; the rest wait in order. */
export function createLimiter(limit: number) {
  let running = 0;
  const waiting: (() => void)[] = [];
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (running >= limit) await new Promise<void>((resolve) => waiting.push(resolve));
    running += 1;
    try {
      return await task();
    } finally {
      running -= 1;
      waiting.shift()?.();
    }
  };
}
