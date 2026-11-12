/**
 * The grid image (issue #121): a 1000 px WebP saved next to a photo's preview and thumbnail as
 * "<storage_key>-grid.webp", which the website grid uses on big screens. Deletes and the orphan cleanup always know
 * about it (so these files are never left behind or swept); making one in the rotate tool waits for GRID_VARIANT=true.
 */
export const GRID_SUFFIX = "-grid.webp";
export const GRID_LONG_SIDE = 1000;
export const GRID_QUALITY = 75;

export function isGridVariantEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.GRID_VARIANT?.trim().toLowerCase() === "true";
}

export function gridKey(storageKey: string) {
  return `${storageKey}${GRID_SUFFIX}`;
}
