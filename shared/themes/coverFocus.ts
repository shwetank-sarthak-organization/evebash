// Website and app (one copy): what a gallery's cover position fields mean (issue #64). Every screen shows the cover
// filling its frame (object-fit: cover) with the same focus point kept in view and zoomed around it, so a tall phone
// frame and a wide computer frame show the same part of the photo.
// - coverOffsetX / coverOffset: the focus point's distance from the middle, in percent of the photo
//   (-50 = left / top edge, 0 = middle, 50 = right / bottom edge)
// - coverScale: the zoom, from 1 (the whole frame filled, nothing more) to 2.5

export const MIN_COVER_ZOOM = 1;
export const MAX_COVER_ZOOM = 2.5;

export interface CoverPosition {
  coverOffset?: number | null;
  coverOffsetX?: number | null;
  coverScale?: number | null;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
// Stored with one decimal: enough for a smooth drag, short in the database
const round = (value: number) => Math.round(value * 10) / 10;

export const clampCoverZoom = (zoom: number) => round(clamp(zoom, MIN_COVER_ZOOM, MAX_COVER_ZOOM));

/** The focus point in percent of the photo (0-100 from the left / top) and the zoom */
export function coverFocus(cover: CoverPosition): { x: number; y: number; zoom: number } {
  return {
    x: clamp(50 + Number(cover.coverOffsetX || 0), 0, 100),
    y: clamp(50 + Number(cover.coverOffset || 0), 0, 100),
    zoom: clampCoverZoom(Number(cover.coverScale || 1)),
  };
}

/** The fields to save for a focus point (0-100 from the left / top) */
export function focusToOffsets(x: number, y: number): { coverOffsetX: number; coverOffset: number } {
  return { coverOffsetX: round(clamp(x, 0, 100) - 50), coverOffset: round(clamp(y, 0, 100) - 50) };
}

/** Dragging the photo by dx, dy pixels inside a frame of this size: the photo follows the finger, so the focus point
 *  moves the other way. A drag across the whole frame moves the focus across the whole photo (less when zoomed in). */
export function dragCoverFocus(
  focus: { x: number; y: number },
  dx: number,
  dy: number,
  frame: { width: number; height: number },
  zoom: number,
): { x: number; y: number } {
  const width = Math.max(1, frame.width);
  const height = Math.max(1, frame.height);
  const z = Math.max(MIN_COVER_ZOOM, zoom);
  return {
    x: clamp(focus.x - (dx / width) * 100 / z, 0, 100),
    y: clamp(focus.y - (dy / height) * 100 / z, 0, 100),
  };
}
