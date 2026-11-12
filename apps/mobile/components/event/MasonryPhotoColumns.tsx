import React, { useRef, useState } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useScrollWindow } from '@/hooks/use-scroll-window';

// The guest masonry grid (Midnight Hero, Royal Emerald and most other themes): columns of photo tiles that draw
// their photos only near the screen, like the Classic White rows (issue #185). Every tile keeps its place, frame and
// size; a far tile is only told to leave its photo out, so it looks like a photo still loading. Each tile reports its
// own layout, since theme frames and captions make tile heights hard to predict.

type Entry<T> = { photo: T; idx: number };
type Box = { y: number; height: number };

export function MasonryPhotoColumns<T extends { id: string }>({
  columns,
  renderTile,
  scrollY,
  viewportHeight,
  style,
  columnStyle,
}: {
  columns: Entry<T>[][];
  /** Draws one tile: pass `onLayout` to its outer view, and leave the photo out when `drawn` is false */
  renderTile: (entry: Entry<T>, tile: { drawn: boolean; onLayout: (e: LayoutChangeEvent) => void }) => React.ReactNode;
  /** The screen's scroll position (a rough value is enough); without it every tile draws its photo */
  scrollY?: number;
  viewportHeight?: number;
  style?: StyleProp<ViewStyle>;
  columnStyle?: StyleProp<ViewStyle>;
}) {
  const count = columns.reduce((sum, column) => sum + column.length, 0);
  const { ref, onLayout, windowing, isNear } = useScrollWindow(scrollY, viewportHeight, count);
  // Each tile's top and height in its column, from its last layout (columns start at the top of the grid)
  const boxes = useRef(new Map<string, Box>());
  const [, setLayoutVersion] = useState(0);
  const redrawQueued = useRef(false);

  const record = (id: string, e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    const prev = boxes.current.get(id);
    if (prev && prev.y === y && prev.height === height) return;
    boxes.current.set(id, { y, height });
    // Tiles report one by one; draw again once per frame with all the new positions
    if (redrawQueued.current) return;
    redrawQueued.current = true;
    requestAnimationFrame(() => {
      redrawQueued.current = false;
      setLayoutVersion((v) => v + 1);
    });
  };

  return (
    <View ref={ref} onLayout={onLayout} style={style}>
      {columns.map((column, c) => (
        <View key={c} style={columnStyle}>
          {column.map((entry) => {
            const box = boxes.current.get(entry.photo.id);
            // A tile not laid out yet waits a frame for its position before loading its photo
            const drawn = box ? isNear(box.y, box.height) : !windowing;
            return (
              <React.Fragment key={entry.photo.id}>
                {renderTile(entry, { drawn, onLayout: (e) => record(entry.photo.id, e) })}
              </React.Fragment>
            );
          })}
        </View>
      ))}
    </View>
  );
}
