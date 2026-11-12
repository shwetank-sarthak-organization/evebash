import type { ImageStyle } from 'react-native';
import { coverFocus, type CoverPosition } from '../../../shared/themes/coverFocus';

// The host's cover settings for the app's themed covers (Royal Emerald, Classic White, Sunlit Portrait), as on the
// website (src/lib/coverStyle.ts): expo-image keeps the focus point in view, and the zoom grows around it.

/** expo-image contentPosition for the focus point */
export function coverContentPosition(cover: CoverPosition) {
  const { x, y } = coverFocus(cover);
  return { left: `${x}%`, top: `${y}%` } as const;
}

/** The zoom, centred on the focus point (nothing for a Fit cover, which shows the whole photo). React Native zooms
 *  around the middle (a percent transformOrigin made expo-image draw nothing on iOS), so the photo is also shifted to
 *  keep the focus point where it was: pass the image's size once it's laid out. */
export function coverZoomStyle(cover: CoverPosition & { coverMode?: 'fit' | 'fill' | null }, size?: { width: number; height: number }): ImageStyle | null {
  if (cover.coverMode === 'fit') return null;
  const { x, y, zoom } = coverFocus(cover);
  if (!size || zoom === 1) return { transform: [{ scale: zoom }] };
  return {
    transform: [
      { translateX: size.width * (0.5 - x / 100) * (zoom - 1) },
      { translateY: size.height * (0.5 - y / 100) * (zoom - 1) },
      { scale: zoom },
    ],
  };
}
