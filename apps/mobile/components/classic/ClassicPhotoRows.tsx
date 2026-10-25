import React, { useEffect, useRef, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

// Classic White photo grid, as on the website (.gallery-justified in src/app/gallery-refinements.css): rows that fill
// the width, each photo keeping its own shape, 4px gaps, no card edge. On a phone that is usually two portrait
// photos side by side or one landscape photo across the whole width. The last row is not stretched.
// Given the screen's scroll position, only rows within a few screens of it draw their photos; the rest keep their
// size as plain tinted blocks, so big galleries don't hold hundreds of images in memory.

const GAP = 4;
// Rows this many screens above / below the visible area still draw their photos
const KEEP_ABOVE = 1.5;
const KEEP_BELOW = 2.5;

type Item = { id: string; width?: number; height?: number };

/** Width / height of a photo; photos without a size get a portrait guess so the row still fills */
function aspectOf(item: Item) {
  return item.width && item.height ? item.width / item.height : 0.75;
}

type Row<T> = { items: { item: T; idx: number; ratio: number }[]; height: number };

/**
 * Splits the photos into rows about `target` tall: photos are added while the row would still be taller than the
 * target, then the row ends where its height is closest to the target.
 */
function buildRows<T extends Item>(items: T[], width: number, target: number): Row<T>[] {
  const rows: Row<T>[] = [];
  let current: Row<T>['items'] = [];
  let ratioSum = 0;
  const heightFor = (sum: number, count: number) => (width - GAP * (count - 1)) / sum;

  items.forEach((item, idx) => {
    const ratio = aspectOf(item);
    if (current.length > 0) {
      const without = heightFor(ratioSum, current.length);
      const withIt = heightFor(ratioSum + ratio, current.length + 1);
      // Close the row before this photo when the row is already short enough and adding it would be further off
      if (without <= target * 1.4 && Math.abs(Math.log(withIt / target)) > Math.abs(Math.log(without / target))) {
        rows.push({ items: current, height: without });
        current = [];
        ratioSum = 0;
      }
    }
    current.push({ item, idx, ratio });
    ratioSum += ratio;
  });
  if (current.length > 0) {
    // The last row keeps the target height instead of stretching a lone photo to the full width
    rows.push({ items: current, height: Math.min(target, heightFor(ratioSum, current.length)) });
  }
  return rows;
}

export function ClassicPhotoRows<T extends Item>({
  items,
  renderTile,
  scrollY,
  viewportHeight,
}: {
  items: T[];
  /** Draws one photo filling a box of the given size */
  renderTile: (item: T, idx: number, size: { width: number; height: number }) => React.ReactNode;
  /** The screen's scroll position (a rough value is enough); without it every row draws its photos */
  scrollY?: number;
  viewportHeight?: number;
}) {
  const [width, setWidth] = useState(0);
  // Where the grid starts in the scrolled content: its position on screen plus the scroll position, measured again
  // at every scroll step, so it stays right after an album switch or a jump (a value from first layout goes stale)
  const [contentTop, setContentTop] = useState<number | null>(null);
  const gridRef = useRef<View>(null);
  const scrollYRef = useRef(scrollY ?? 0);
  scrollYRef.current = scrollY ?? 0;
  const measure = () => {
    gridRef.current?.measureInWindow((_x, y) => {
      const next = Math.round(y + scrollYRef.current);
      setContentTop((prev) => (prev === next ? prev : next));
    });
  };
  useEffect(measure, [scrollY, items.length]);
  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.floor(e.nativeEvent.layout.width);
    if (next !== width) setWidth(next);
    measure();
  };
  // Rows a little taller than half the width: two portrait photos, or one landscape, per row
  const rows = width ? buildRows(items, width, Math.round(width * 0.62)) : [];

  const windowing = scrollY !== undefined && !!viewportHeight;
  const screen = viewportHeight || 0;
  // Until the grid has been placed, only the first few screens of it draw photos
  const keepFrom = contentTop === null ? 0 : (scrollY ?? 0) - contentTop - screen * KEEP_ABOVE;
  const keepTo = contentTop === null ? screen * (KEEP_ABOVE + KEEP_BELOW) : (scrollY ?? 0) - contentTop + screen * (1 + KEEP_BELOW);
  let rowTop = 0;

  return (
    <View ref={gridRef} onLayout={onLayout} style={{ width: '100%', gap: GAP }}>
      {rows.map((row) => {
        const top = rowTop;
        rowTop += row.height + GAP;
        const drawn = !windowing || (top + row.height >= keepFrom && top <= keepTo);
        return (
          <View key={row.items[0].item.id} style={{ flexDirection: 'row', gap: GAP, height: row.height }}>
            {row.items.map(({ item, idx, ratio }) => (
              <View key={item.id} style={{ width: ratio * row.height, height: row.height, overflow: 'hidden', backgroundColor: drawn ? undefined : 'rgba(139,154,110,0.12)' }}>
                {drawn && renderTile(item, idx, { width: ratio * row.height, height: row.height })}
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}
