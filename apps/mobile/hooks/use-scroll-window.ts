import { useCallback, useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent, View } from 'react-native';

// Lets a long photo grid draw its photos only near the screen, so big galleries don't hold hundreds of images in
// memory (issue #185). Used by the Classic White rows, the masonry columns and the host grid. Given the screen's
// scroll position (a rough value is enough) and its height, it finds where the grid starts in the scrolled content
// and says whether a box at a given spot in the grid is within a few screens of the visible area.

// Boxes this many screens above / below the visible area still count as near
const KEEP_ABOVE = 1.5;
const KEEP_BELOW = 2.5;

export function useScrollWindow(scrollY: number | undefined, viewportHeight: number | undefined, remeasureKey?: unknown) {
  // Goes on the grid's outer view, with `onLayout`
  const ref = useRef<View>(null);
  const [width, setWidth] = useState(0);
  // Where the grid starts in the scrolled content: its position on screen plus the scroll position, measured again
  // at every scroll step, so it stays right after an album switch or a jump (a value from first layout goes stale)
  const [contentTop, setContentTop] = useState<number | null>(null);
  const scrollYRef = useRef(scrollY ?? 0);
  scrollYRef.current = scrollY ?? 0;
  const measure = useCallback(() => {
    ref.current?.measureInWindow((_x, y) => {
      const next = Math.round(y + scrollYRef.current);
      setContentTop((prev) => (prev === next ? prev : next));
    });
  }, []);
  useEffect(measure, [measure, scrollY, remeasureKey]);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const next = Math.floor(e.nativeEvent.layout.width);
    setWidth((prev) => (prev === next ? prev : next));
    measure();
  }, [measure]);

  // Without a scroll position every box counts as near
  const windowing = scrollY !== undefined && !!viewportHeight;
  const screen = viewportHeight || 0;
  // Until the grid has been placed, only the first few screens of it count as near
  const keepFrom = contentTop === null ? 0 : (scrollY ?? 0) - contentTop - screen * KEEP_ABOVE;
  const keepTo = contentTop === null ? screen * (KEEP_ABOVE + KEEP_BELOW) : (scrollY ?? 0) - contentTop + screen * (1 + KEEP_BELOW);
  /** Whether a box `top` px below the grid's start and `height` px tall is near the visible area */
  const isNear = (top: number, height: number) => !windowing || (top + height >= keepFrom && top <= keepTo);

  return { ref, onLayout, width, windowing, isNear };
}
