/**
 * Links saved for a photo after it is rotated (issue #123). Rotating rewrites the original, preview and thumbnail at
 * the same B2 paths, but media.evebash.com keeps copies of them in Cloudflare's cache (#120) and browsers keep them for
 * a year, so other viewers would keep seeing the photo unrotated. With ROTATE_VERSIONED_LINKS=true the saved links
 * get "?v=<time>", a new address no cache has seen. Off until then: links stay plain, as before.
 */
export function isRotateVersionedLinksEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.ROTATE_VERSIONED_LINKS?.trim().toLowerCase() === "true";
}

export type RotatedLinks = { url: string; thumbnailUrl: string; previewUrl: string };

/** The photo's links on the media domain, with "?v=<version>" when version is given. */
export function buildRotatedLinks(mediaDomain: string, storageKey: string, version: number | null): RotatedLinks {
  const query = version === null ? "" : `?v=${version}`;
  const base = `https://${mediaDomain}/${storageKey}`;
  return {
    url: `${base}${query}`,
    thumbnailUrl: `${base}-thumbnail.webp${query}`,
    previewUrl: `${base}-preview.webp${query}`,
  };
}

/**
 * Every link the photo's original could still be saved under: the plain link and the one saved before this rotation
 * (an earlier ?v=). Gallery covers and cover copies of the photo hold one of these.
 */
export function previousOriginalLinks(savedUrl: string | null | undefined, plainUrl: string) {
  return [...new Set([plainUrl, savedUrl].filter((value): value is string => Boolean(value)))];
}
