// Album proofing settings: the photographer uploads album page designs, the client reviews them.
const MB = 1024 * 1024;

/** Off until ALBUM_PROOFING=true, so it can be switched on (and off) on Railway without a deploy. */
export function isAlbumProofingEnabled() {
  return process.env.ALBUM_PROOFING?.trim().toLowerCase() === "true";
}

export const albumConfig = {
  maxAlbumsPerEvent: 10,
  maxPagesPerAlbum: 150,
  /** Largest page design accepted. Only its preview and thumbnail are stored. */
  maxPageBytes: 60 * MB,
  /** Decoding limit, well above a 12x36 in spread at 300 dpi (39 MP). */
  maxPagePixels: 250_000_000,
  /**
   * Previews fit in this box: a 3:1 spread becomes 3000x1000, a square page 2000x2000. The gallery's 1600 px would
   * leave a spread 533 px tall, too small to check faces and text.
   */
  preview: { width: 3000, height: 2000, quality: 80 },
  thumbnail: { width: 640, height: 640, quality: 70 },
  /** A design at least this much wider than tall is a spread (two album pages). */
  spreadMinAspect: 1.5,
  /** Page designs processed at the same time on this server; more wait their turn. */
  processingConcurrency: 2,
  maxVoiceBytes: 5 * MB,
  maxVoiceSeconds: 120,
  maxCommentLength: 2000,
  maxTitleLength: 80,
};

export const ALBUM_IMAGE_FORMATS = new Set(["jpeg", "png", "webp", "tiff"]);

/** Voice note types we accept, by the base content type, and the extension they are stored with. */
export const ALBUM_VOICE_TYPES: Record<string, string> = {
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};
