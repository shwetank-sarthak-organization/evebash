/**
 * expo-image-picker reports `asset.duration` in MILLISECONDS, but the backend
 * (and the web client) work in SECONDS — `qstash.ts` routes any video with
 * `duration > 600` to the GPU transcoder. Always convert before sending a
 * duration to the API.
 *
 * Returns 0 when the duration is unknown, which makes the backend fall back to
 * its file-size heuristic.
 */
export function toDurationSeconds(durationMs?: number | null): number {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs <= 0) {
    return 0;
  }
  return Math.round(durationMs / 10) / 100; // ms → s, 2 decimals
}
