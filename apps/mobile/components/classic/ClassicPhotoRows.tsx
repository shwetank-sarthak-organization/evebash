import React, { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

// Classic White photo grid, as on the website (.gallery-justified in src/app/gallery-refinements.css): rows that fill
// the width, each photo keeping its own shape, 4px gaps, no card edge. On a phone that is usually two portrait
// photos side by side or one landscape photo across the whole width. The last row is not stretched.

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
}: {
  items: T[];
  /** Draws one photo filling a box of the given size */
  renderTile: (item: T, idx: number, size: { width: number; height: number }) => React.ReactNode;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.floor(e.nativeEvent.layout.width);
    if (next !== width) setWidth(next);
  };
  // Rows a little taller than half the width: two portrait photos, or one landscape, per row
  const rows = width ? buildRows(items, width, Math.round(width * 0.62)) : [];

  return (
    <View onLayout={onLayout} style={{ width: '100%', gap: GAP }}>
      {rows.map((row) => (
        <View key={row.items[0].item.id} style={{ flexDirection: 'row', gap: GAP, height: row.height }}>
          {row.items.map(({ item, idx, ratio }) => (
            <View key={item.id} style={{ width: ratio * row.height, height: row.height, overflow: 'hidden' }}>
              {renderTile(item, idx, { width: ratio * row.height, height: row.height })}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
