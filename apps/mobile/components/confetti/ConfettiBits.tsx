import React, { useId } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { CONFETTI_COLORS, CONFETTI_TEAR_PATH, type ConfettiSpeck } from '../../../../shared/themes/confettiCircle';

// Small pieces the Confetti Circle screens share (website: the matching parts of src/app/confetti-circle.css).

/** Paint specks in a box `width` wide; each speck's place and size are shares of the box (shared/themes/confettiCircle.ts) */
export function ConfettiSpecks({ specks, width, style }: { specks: readonly ConfettiSpeck[]; width: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {specks.map((speck, index) => {
        const size = (speck.size / 100) * width;
        return (
          <View
            key={index}
            style={{
              position: 'absolute',
              left: `${speck.left}%`,
              top: `${speck.top}%`,
              width: size,
              height: size,
              marginLeft: -size / 2,
              marginTop: -size / 2,
              borderRadius: size / 2,
              opacity: speck.opacity,
              backgroundColor: speck.pink ? CONFETTI_COLORS.specksPink : CONFETTI_COLORS.specksOrange,
            }}
          />
        );
      })}
    </View>
  );
}

/** The torn-paper edge at the bottom of the cover, in the page's paper colour */
export function ConfettiTear({ height, color = CONFETTI_COLORS.paper }: { height: number; color?: string }) {
  return (
    <Svg pointerEvents="none" width="100%" height={height} viewBox="0 0 1440 48" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, right: 0, bottom: -1 }}>
      <Path d={CONFETTI_TEAR_PATH} fill={color} />
    </Svg>
  );
}

/** Bebas Neue's capitals are about this wide per letter, as a share of the font size; used to keep a line inside its box */
const CAPITAL_WIDTH = 0.42;

/** The font size at which `text` fits `maxWidth`, at most `size` */
export function fittedCapitalsSize(text: string, size: number, maxWidth: number): number {
  const estimate = text.length * CAPITAL_WIDTH * size;
  return estimate > maxWidth ? Math.floor((size * maxWidth) / estimate) : size;
}

/** One line of capitals filled pink to orange (or orange to pink with `reverse`), like the website's names */
export function ConfettiGradientLine({ text, size, width, fontFamily, reverse = false }: {
  text: string;
  size: number;
  /** The line's box; the text is centred in it */
  width: number;
  fontFamily: string;
  reverse?: boolean;
}) {
  const id = `confetti-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const fontSize = fittedCapitalsSize(text, size, width);
  const height = Math.round(fontSize * 0.92);
  const stops = reverse
    ? [[0, CONFETTI_COLORS.orange], [0.75, CONFETTI_COLORS.pink], [1, CONFETTI_COLORS.pink]] as const
    : [[0, CONFETTI_COLORS.pink], [0.3, CONFETTI_COLORS.pink], [1, CONFETTI_COLORS.orange]] as const;
  return (
    <Svg width={width} height={height} accessible={false}>
      <Defs>
        <SvgLinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          {stops.map(([offset, color]) => <Stop key={offset} offset={offset} stopColor={color} />)}
        </SvgLinearGradient>
      </Defs>
      <SvgText
        x={width / 2}
        y={Math.round(fontSize * 0.86)}
        textAnchor="middle"
        fontFamily={fontFamily}
        fontSize={fontSize}
        letterSpacing={fontSize * 0.01}
        fill={`url(#${id})`}
      >
        {text.toUpperCase()}
      </SvgText>
    </Svg>
  );
}
