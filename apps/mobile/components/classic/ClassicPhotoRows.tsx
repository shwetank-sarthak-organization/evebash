import React from 'react';
import { View } from 'react-native';
import { useScrollWindow } from '@/hooks/use-scroll-window';

// Classic White photo grid, as on the website (.gallery-justified in src/app/gallery-refinements.css): rows that fill
// the width, each photo keeping its own shape, 4px gaps, no card edge. On a phone that is usually two portrait
// photos side by side or one landscape photo across the whole width. The last row is not stretched.
// Given the screen's scroll position, only rows within a few screens of it draw their photos (hooks/use-scroll-window);
// the rest keep their size as plain tinted blocks, so big galleries don't hold hundreds of images in memory.

// Space between photos (Sunlit Portrait passes 8, as on its website)
const GAP = 4;

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
function buildRows<T extends Item>(items: T[], width: number, target: number, gap: number): Row<T>[] {
  const rows: Row<T>[] = [];
  let current: Row<T>['items'] = [];
  let ratioSum = 0;
  const heightFor = (sum: number, count: number) => (width - gap * (count - 1)) / sum;

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
  gap = GAP,
  tileRadius = 0,
  placeholderColor = 'rgba(139,154,110,0.12)',
}: {
  items: T[];
  /** Draws one photo filling a box of the given size */
  renderTile: (item: T, idx: number, size: { width: number; height: number }) => React.ReactNode;
  /** The screen's scroll position (a rough value is enough); without it every row draws its photos */
  scrollY?: number;
  viewportHeight?: number;
  gap?: number;
  /** Rounded photo corners (Sunlit Portrait: 6) */
  tileRadius?: number;
  /** Tint of rows far off screen, drawn without their photos */
  placeholderColor?: string;
}) {
  const { ref: gridRef, onLayout, width, isNear } = useScrollWindow(scrollY, viewportHeight, items.length);
  // Rows a little taller than half the width: two portrait photos, or one landscape, per row
  const rows = width ? buildRows(items, width, Math.round(width * 0.62), gap) : [];
  let rowTop = 0;

  return (
    <View ref={gridRef} onLayout={onLayout} style={{ width: '100%', gap }}>
      {rows.map((row) => {
        const top = rowTop;
        rowTop += row.height + gap;
        const drawn = isNear(top, row.height);
        return (
          <View key={row.items[0].item.id} style={{ flexDirection: 'row', gap, height: row.height }}>
            {row.items.map(({ item, idx, ratio }) => (
              <View key={item.id} style={{ width: ratio * row.height, height: row.height, overflow: 'hidden', borderRadius: tileRadius, backgroundColor: drawn ? undefined : placeholderColor }}>
                {drawn && renderTile(item, idx, { width: ratio * row.height, height: row.height })}
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}
