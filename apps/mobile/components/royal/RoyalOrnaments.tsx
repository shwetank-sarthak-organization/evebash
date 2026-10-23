import React, { useState } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText, Use } from 'react-native-svg';

// Gold ornaments for the Royal Emerald gallery, the same drawings as the website (src/components/royal/RoyalOrnaments.tsx).
// Each <Svg> is its own native view, so every ornament carries the defs it uses. The app's SVG library has no
// lighting filters, so the website's raised-metal look is a dark copy of each shape drawn just below it.

type StopDef = [offset: number, color: string];

const stops = (list: StopDef[]) => list.map(([offset, color]) => <Stop key={offset} offset={offset} stopColor={color} />);

const SCREEN_GOLD: StopDef[] = [[0, '#fff2c6'], [0.18, '#d9b062'], [0.34, '#8c6220'], [0.5, '#f3d68f'], [0.68, '#b98a3a'], [0.84, '#e9c979'], [1, '#7a5418']];
const FRAME_GOLD: StopDef[] = [[0, '#fff2c6'], [0.25, '#c99a46'], [0.45, '#f3d68f'], [0.65, '#9b6f27'], [0.85, '#e6c574'], [1, '#7a5418']];
const BAND_GOLD: StopDef[] = [[0, '#f6e1a2'], [0.3, '#b8883a'], [0.5, '#fff0bf'], [0.72, '#a87a2a'], [1, '#e2bf72']];
const CREST_GOLD: StopDef[] = [[0, '#fff2c6'], [0.3, '#c99a46'], [0.55, '#f3d68f'], [0.8, '#9b6f27'], [1, '#e6c574']];

export const ROYAL_GOLD = '#ca9c69';
export const ROYAL_GOLD_LIGHT = '#e6c574';
export const ROYAL_EMERALD = '#02231c';

const MIRROR_DIAGONAL = 'matrix(0 1 1 0 0 0)';
const SHADOW = { fill: '#000', stroke: '#000', opacity: 0.5 };

/** The shape twice: a dark copy just below and to the right, then the gold one */
function Raised({ href, fill, transform, dx = 1.2, dy = 2 }: { href: string; fill: string; transform?: string; dx?: number; dy?: number }) {
  return (
    <>
      <G transform={`translate(${dx} ${dy})`} opacity={SHADOW.opacity}>
        <Use href={href} fill={SHADOW.fill} stroke={SHADOW.stroke} transform={transform} />
      </G>
      <Use href={href} fill={fill} stroke={fill} transform={transform} />
    </>
  );
}

const Leaf = () => <Path id="re-leaf" d="M0 0 C5 -7 15 -8 23 -2 C18 -2 14 0 12 2 C9 3 4 3 0 0 Z" />;

const Fleur = () => (
  <G id="re-fleur">
    <Path d="M0 -17 C5 -10 5.5 -3 0 4 C-5.5 -3 -5 -10 0 -17 Z" />
    <Path d="M1.5 3 C3 -6 12 -10 15 -3 C17 2 12 5 9.5 2 C12 1.5 12 -3 9 -3 C5.5 -3 3.5 0 3 5 Z" />
    <Path d="M-1.5 3 C-3 -6 -12 -10 -15 -3 C-17 2 -12 5 -9.5 2 C-12 1.5 -12 -3 -9 -3 C-5.5 -3 -3.5 0 -3 5 Z" />
    <Rect x={-7} y={4} width={14} height={3.2} rx={1.2} />
    <Path d="M-4.5 7.5 C-3.5 12 -1.2 14 0 17 C1.2 14 3.5 12 4.5 7.5 Z" />
  </G>
);

// ---------- Screen corner (the four gold corners of the hero) ----------

const SCREEN_BEADS = Array.from({ length: 12 }, (_, i) => 44 + i * 9);
const SCREEN_LEAVES: [number, number, number, number][] = [
  [56, 37, -28, 1], [104, 31, -8, 0.9], [84, 62, 165, 0.75], [126, 46, 32, 0.7], [158, 41, -35, 0.55],
  [68, 30, -160, 0.7], [112, 52, 70, 0.75], [138, 32, -170, 0.6], [70, 50, 120, 0.6],
];

const ScreenArm = () => (
  <G id="re-screen-arm" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 12 H176" fill="none" strokeWidth={5} />
    <Path d="M36 23 H148" fill="none" strokeWidth={1.5} />
    {SCREEN_BEADS.map((x) => <Circle key={x} cx={x} cy={17.6} r={1.8} stroke="none" />)}
    <Path d="M176 12 C190 12 197 22 191 29 C185 35 176 29 181 23" fill="none" strokeWidth={4} />
    <Circle cx={183.5} cy={25.5} r={2.2} stroke="none" />
    <Use href="#re-leaf" transform="translate(189 33) rotate(100) scale(.55)" stroke="none" />
    <Path d="M44 44 C58 30 82 27 98 35 C115 43 113 63 98 63 C87 63 85 50 95 49" fill="none" strokeWidth={5} />
    <Path d="M60 41 C64 53 76 58 84 52" fill="none" strokeWidth={2.4} />
    <Circle cx={85} cy={51} r={2} stroke="none" />
    <Circle cx={94.5} cy={52.5} r={2.6} stroke="none" />
    <Path d="M98 35 C117 27 141 29 151 40 C159 49 150 59 142 54 C136 50 140 43 145 45" fill="none" strokeWidth={3.8} />
    <Circle cx={144} cy={48.5} r={1.9} stroke="none" />
    <Path d="M151 40 C158 34 166 32 173 34" fill="none" strokeWidth={2.4} />
    <Circle cx={174} cy={34.5} r={2} stroke="none" />
    {SCREEN_LEAVES.map(([x, y, rotate, scale]) => (
      <Use key={`${x}-${y}`} href="#re-leaf" stroke="none" transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`} />
    ))}
  </G>
);

const ScreenCornerShape = () => (
  <G id="re-screen-corner">
    <Use href="#re-screen-arm" />
    <Use href="#re-screen-arm" transform={MIRROR_DIAGONAL} />
    <Path d="M22 22 L36 36" fill="none" strokeWidth={2.2} />
    <Path d="M13 2 L24 13 L13 24 L2 13 Z" stroke="none" />
    <Use href="#re-fleur" transform="translate(44 44) rotate(-45) scale(1.45)" stroke="none" />
  </G>
);

type Flip = 'none' | 'x' | 'y' | 'xy';
const flipTransform = (flip: Flip) =>
  flip === 'x' ? [{ scaleX: -1 }] : flip === 'y' ? [{ scaleY: -1 }] : flip === 'xy' ? [{ scaleX: -1 }, { scaleY: -1 }] : [];

/** Ornate L-shaped corner, drawn for the top left; `flip` turns it for the other three. */
export function RoyalScreenCorner({ size, flip = 'none', style }: { size: number; flip?: Flip; style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[{ width: size, height: size, transform: flipTransform(flip) }, style]}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Defs>
          <LinearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="200" y2="200">{stops(SCREEN_GOLD)}</LinearGradient>
          <Leaf />
          <Fleur />
          <ScreenArm />
          <ScreenCornerShape />
        </Defs>
        <Raised href="#re-screen-corner" fill="url(#g)" dx={1.4} dy={2.4} />
        <Circle cx={13} cy={13} r={3.4} fill="#3a2709" />
      </Svg>
    </View>
  );
}

// ---------- Filigree photo frame ----------

const FrameArm = () => (
  <G id="re-frame-arm" strokeLinecap="round">
    <Path d="M46 20 C60 9 76 10 85 20 C91 27 84 35 78 30 C74 27 77 22 81 24" fill="none" strokeWidth={3} />
    <Circle cx={80} cy={27} r={1.8} stroke="none" />
    <Path d="M46 36 C54 33 60 34 64 38" fill="none" strokeWidth={2} />
    <Circle cx={65} cy={39} r={1.7} stroke="none" />
    <Use href="#re-leaf" transform="translate(52 27) rotate(-8) scale(.62)" stroke="none" />
  </G>
);

const FrameCornerShape = () => (
  <G id="re-frame-corner">
    <Use href="#re-frame-arm" />
    <Use href="#re-frame-arm" transform={MIRROR_DIAGONAL} />
    <Rect x={8} y={8} width={38} height={38} rx={4} stroke="none" />
  </G>
);

/** The rosette inside each frame corner block: drawn on top of the gold, so it isn't shadowed */
const FrameRosette = () => (
  <>
    <Rect x={11.5} y={11.5} width={31} height={31} rx={2.5} fill="#241804" stroke="url(#g)" strokeWidth={1.4} />
    <Circle cx={27} cy={27} r={13} fill="none" stroke="url(#g)" strokeWidth={1.2} />
    <G fill="url(#g)" stroke="#4a3410" strokeWidth={0.8}>
      <Ellipse cx={27} cy={18} rx={3.2} ry={6} />
      <Ellipse cx={27} cy={36} rx={3.2} ry={6} />
      <Ellipse cx={18} cy={27} rx={6} ry={3.2} />
      <Ellipse cx={36} cy={27} rx={6} ry={3.2} />
      <Ellipse cx={20.5} cy={20.5} rx={2.6} ry={5} transform="rotate(-45 20.5 20.5)" />
      <Ellipse cx={33.5} cy={33.5} rx={2.6} ry={5} transform="rotate(-45 33.5 33.5)" />
      <Ellipse cx={33.5} cy={20.5} rx={2.6} ry={5} transform="rotate(45 33.5 20.5)" />
      <Ellipse cx={20.5} cy={33.5} rx={2.6} ry={5} transform="rotate(45 20.5 33.5)" />
      <Circle cx={27} cy={27} r={4.6} />
    </G>
    <Circle cx={27} cy={27} r={2} fill="#3a2709" />
  </>
);

function FrameCorner({ size, flip }: { size: number; flip: Flip }) {
  return (
    <View pointerEvents="none" style={{ width: size, height: size, transform: flipTransform(flip) }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="100">{stops(FRAME_GOLD)}</LinearGradient>
          <Leaf />
          <FrameArm />
          <FrameCornerShape />
        </Defs>
        <Raised href="#re-frame-corner" fill="url(#g)" />
        <FrameRosette />
      </Svg>
    </View>
  );
}

const CrestShape = () => (
  <G id="re-crest" strokeLinecap="round">
    <Path d="M33 26 C26 16 14 14 8 20 C3 25 8 32 13 29 C16 27 14 23 11 24" fill="none" strokeWidth={2.4} />
    <Path d="M59 26 C66 16 78 14 84 20 C89 25 84 32 79 29 C76 27 78 23 81 24" fill="none" strokeWidth={2.4} />
    <Use href="#re-leaf" transform="translate(30 24) rotate(200) scale(.6)" stroke="none" />
    <Use href="#re-leaf" transform="translate(62 24) rotate(-20) scale(.6) scale(-1 1) rotate(180)" stroke="none" />
    <Ellipse cx={46} cy={22} rx={12} ry={15} stroke="none" />
  </G>
);

function FrameCrest({ rotate }: { rotate: number }) {
  return (
    <View pointerEvents="none" style={{ width: 92, height: 46, transform: [{ rotate: `${rotate}deg` }] }}>
      <Svg width={92} height={46} viewBox="0 0 92 46">
        <Defs>
          <LinearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="92" y2="46">{stops(CREST_GOLD)}</LinearGradient>
          <Leaf />
          <Fleur />
          <CrestShape />
        </Defs>
        <Raised href="#re-crest" fill="url(#g)" />
        <Ellipse cx={46} cy={22} rx={8} ry={10.5} fill="#3a2709" stroke="url(#g)" strokeWidth={1.3} />
        <Use href="#re-fleur" transform="translate(46 22.5) scale(.42)" fill="url(#g)" />
      </Svg>
    </View>
  );
}

const LACE = 30;
const LACE_TILE = 28;

const LaceTile = () => (
  <G id="re-lace-tile">
    <Path d="M0 2.6 H28 M0 27.4 H28" fill="none" strokeWidth={2.2} />
    <Path d="M0 15 C7 5.5 21 5.5 28 15 C21 24.5 7 24.5 0 15 Z" fill="none" strokeWidth={1.8} />
    <G stroke="none">
      <Circle cx={14} cy={15} r={2.4} />
      <Ellipse cx={14} cy={10.6} rx={1.2} ry={2} />
      <Ellipse cx={14} cy={19.4} rx={1.2} ry={2} />
      <Ellipse cx={9.6} cy={15} rx={2} ry={1.2} />
      <Ellipse cx={18.4} cy={15} rx={2} ry={1.2} />
      <Circle cx={0} cy={7.4} r={1.7} />
      <Circle cx={28} cy={7.4} r={1.7} />
      <Circle cx={0} cy={22.6} r={1.7} />
      <Circle cx={28} cy={22.6} r={1.7} />
    </G>
  </G>
);

/** The lace bands along the four sides, as repeated tiles (the website tiles an SVG pattern) */
function LaceBands({ width, height }: { width: number; height: number }) {
  const along = (length: number) => Array.from({ length: Math.ceil(length / LACE_TILE) }, (_, i) => i * LACE_TILE);
  return (
    <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
      <Defs>
        <LinearGradient id="band" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="30">{stops(BAND_GOLD)}</LinearGradient>
        <LaceTile />
      </Defs>
      <G fill="url(#band)" stroke="url(#band)">
        {along(width).map((x) => (
          <React.Fragment key={`h${x}`}>
            <Use href="#re-lace-tile" transform={`translate(${x} 0)`} />
            <Use href="#re-lace-tile" transform={`translate(${x} ${height - LACE})`} />
          </React.Fragment>
        ))}
        {along(height).map((y) => (
          <React.Fragment key={`v${y}`}>
            {/* rotate(90) turns the tile down the side; its band then runs from x -30 to 0 */}
            <Use href="#re-lace-tile" transform={`translate(${LACE} ${y}) rotate(90)`} />
            <Use href="#re-lace-tile" transform={`translate(${width} ${y}) rotate(90)`} />
          </React.Fragment>
        ))}
      </G>
    </Svg>
  );
}

/** Rectangular filigree frame, always portrait 4:5 like the website. The photo goes in `children`. */
export function RoyalFiligreeFrame({ children, width }: { children: React.ReactNode; width: number }) {
  const height = Math.round(width * 1.25);
  const corner = Math.min(100, Math.round(width * 0.27));
  const cornerOffset = -Math.round(corner * 0.16);
  return (
    <View style={{ width, height, padding: LACE, backgroundColor: '#2b1d07', borderRadius: 3, shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 26, shadowOffset: { width: 0, height: 18 }, elevation: 18 }}>
      <LaceBands width={width} height={height} />
      {/* Gold moulding around the photo */}
      <View style={{ flex: 1, padding: 5, backgroundColor: '#b88a3e', borderWidth: 1, borderColor: '#3a2708' }}>
        <View style={{ flex: 1, overflow: 'hidden', backgroundColor: '#021a15' }}>{children}</View>
      </View>
      <View style={{ position: 'absolute', top: -9, left: (width - 92) / 2 }}><FrameCrest rotate={0} /></View>
      <View style={{ position: 'absolute', bottom: -9, left: (width - 92) / 2, transform: [{ scaleY: -1 }] }}><FrameCrest rotate={0} /></View>
      <View style={{ position: 'absolute', left: -32, top: (height - 46) / 2 }}><FrameCrest rotate={-90} /></View>
      <View style={{ position: 'absolute', right: -32, top: (height - 46) / 2 }}><FrameCrest rotate={90} /></View>
      <View style={{ position: 'absolute', top: cornerOffset, left: cornerOffset }}><FrameCorner size={corner} flip="none" /></View>
      <View style={{ position: 'absolute', top: cornerOffset, right: cornerOffset }}><FrameCorner size={corner} flip="x" /></View>
      <View style={{ position: 'absolute', bottom: cornerOffset, left: cornerOffset }}><FrameCorner size={corner} flip="y" /></View>
      <View style={{ position: 'absolute', bottom: cornerOffset, right: cornerOffset }}><FrameCorner size={corner} flip="xy" /></View>
    </View>
  );
}

// ---------- Ivory title card with a torn paper edge ----------

/** Small repeatable wobble, so the torn edge looks the same every time */
function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return value / 2147483647;
  };
}

function tornEdgePath(width: number, height: number, inset = 3) {
  const random = seeded(11);
  const step = 7;
  const jitter = () => (random() - 0.5) * 4.2;
  const points: string[] = [];
  const left = inset, top = inset, right = width - inset, bottom = height - inset;
  for (let x = left; x < right; x += step) points.push(`${x.toFixed(1)} ${(top + jitter()).toFixed(1)}`);
  for (let y = top; y < bottom; y += step) points.push(`${(right + jitter()).toFixed(1)} ${y.toFixed(1)}`);
  for (let x = right; x > left; x -= step) points.push(`${x.toFixed(1)} ${(bottom + jitter()).toFixed(1)}`);
  for (let y = bottom; y > top; y -= step) points.push(`${(left + jitter()).toFixed(1)} ${y.toFixed(1)}`);
  return `M${points.join(' L')} Z`;
}

/** Ivory handmade-paper card. It sizes to its content; the paper is drawn once its size is known. */
export function RoyalPaperCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (!size || Math.abs(size.width - width) > 1 || Math.abs(size.height - height) > 1) setSize({ width, height });
  };
  const edge = size ? tornEdgePath(size.width, size.height) : null;
  return (
    <View onLayout={onLayout} style={style}>
      {size && edge && (
        <Svg width={size.width} height={size.height + 14} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
          <Defs>
            <RadialGradient id="paper" cx="45%" cy="40%" r="75%">{stops([[0, '#fffefa'], [0.62, '#faf5e8'], [1, '#efe4ca']])}</RadialGradient>
          </Defs>
          {/* Soft shadow under the card */}
          <G opacity={0.35}><Path d={edge} fill="#000" transform="translate(0 10)" /></G>
          <G opacity={0.3}><Path d={edge} fill="#000" transform="translate(0 3)" /></G>
          <Path d={edge} fill="url(#paper)" />
          {/* Double gold rule inside the edge */}
          <Rect x={18} y={18} width={size.width - 36} height={size.height - 36} fill="none" stroke="#c9a46a" strokeOpacity={0.5} strokeWidth={1} />
          <Rect x={22} y={22} width={size.width - 44} height={size.height - 44} fill="none" stroke="#c9a46a" strokeOpacity={0.25} strokeWidth={1} />
        </Svg>
      )}
      {children}
    </View>
  );
}

/** Small rule with a diamond, under the names on the title card */
export function RoyalFlourish({ width = 120 }: { width?: number }) {
  return (
    <Svg width={width} height={width * (16 / 120)} viewBox="0 0 120 16">
      <Path d="M2 8 H50 M70 8 H118" stroke="#c9a46a" strokeWidth={1} />
      <Path d="M60 2 L66 8 L60 14 L54 8 Z" fill="#c9a46a" />
      <Circle cx={46} cy={8} r={1.6} fill="#c9a46a" />
      <Circle cx={74} cy={8} r={1.6} fill="#c9a46a" />
    </Svg>
  );
}

// ---------- Wax seal ----------

/** A slightly uneven circle, like poured wax */
function waxBlobPath(cx: number, cy: number, r: number) {
  const points: string[] = [];
  for (let i = 0; i < 72; i++) {
    const angle = (i / 72) * Math.PI * 2;
    const wobble = 1 + 0.045 * Math.sin(angle * 3 + 0.6) + 0.03 * Math.sin(angle * 7 + 1.9) + 0.018 * Math.sin(angle * 13);
    points.push(`${(cx + Math.cos(angle) * r * wobble).toFixed(2)} ${(cy + Math.sin(angle) * r * wobble).toFixed(2)}`);
  }
  return `M${points.join(' L')} Z`;
}

const WAX_BLOB = waxBlobPath(70, 70, 55);

/** Gold wax seal stamped with the couple's initials, or a fleur-de-lis when there are none */
export function RoyalWaxSeal({ initials, size = 120, fonts }: { initials?: [string, string] | null; size?: number; fonts: { display: string; serifItalic: string } }) {
  const engraving = (dx: number, dy: number, color: string, opacity: number) =>
    initials ? (
      // Each letter placed on its own and centred: spans inside one text drift off centre on Android
      <G fill={color} fillOpacity={opacity}>
        <SvgText x={49 + dx} y={81 + dy} fontSize={30} fontFamily={fonts.display} textAnchor="middle">{initials[0]}</SvgText>
        <SvgText x={70 + dx} y={79 + dy} fontSize={19} fontFamily={fonts.serifItalic} textAnchor="middle">&amp;</SvgText>
        <SvgText x={91 + dx} y={81 + dy} fontSize={30} fontFamily={fonts.display} textAnchor="middle">{initials[1]}</SvgText>
      </G>
    ) : (
      <Use href="#re-fleur" transform={`translate(${70 + dx} ${70 + dy}) scale(1.05)`} fill={color} fillOpacity={opacity} />
    );

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={initials ? `Seal with the initials ${initials[0]} and ${initials[1]}` : 'Wax seal'}
      style={{ width: size, height: size, transform: [{ rotate: '-6deg' }] }}
    >
      <Svg width={size} height={size} viewBox="0 0 140 140">
        <Defs>
          <RadialGradient id="wax" cx="38%" cy="34%" r="75%">{stops([[0, '#fff0bf'], [0.3, '#e2b866'], [0.65, '#b4842f'], [1, '#6e4a14']])}</RadialGradient>
          <RadialGradient id="waxInner" cx="40%" cy="36%" r="70%">{stops([[0, '#f7dc98'], [0.55, '#c7963f'], [1, '#8d6421']])}</RadialGradient>
          <Fleur />
        </Defs>
        <G opacity={0.45}><Path d={WAX_BLOB} fill="#000" transform="translate(2 5)" /></G>
        <Path d={WAX_BLOB} fill="url(#wax)" />
        <Circle cx={70} cy={70} r={41} fill="url(#waxInner)" />
        <Circle cx={70} cy={70} r={41} fill="none" stroke="#5e3f0f" strokeOpacity={0.55} strokeWidth={2} />
        <Circle cx={70.8} cy={71} r={42.2} fill="none" stroke="#fff3c8" strokeOpacity={0.55} strokeWidth={1} />
        <Circle cx={70} cy={70} r={35} fill="none" stroke="#7a5418" strokeOpacity={0.75} strokeWidth={2.2} strokeLinecap="round" strokeDasharray="0.1 5.5" />
        {engraving(1, 1, '#fff1c4', 0.7)}
        {engraving(0, 0, '#6a4712', 1)}
      </Svg>
    </View>
  );
}

// ---------- Gallery section: crest, title rules, plaque corners ----------

const CrestSide = () => (
  <G id="re-crest-side" strokeLinecap="round">
    <Path d="M76 56 C62 64 44 62 40 50 C36 38 50 30 57 39 C61 45 55 50 51 46" fill="none" strokeWidth={3} />
    <Circle cx={51} cy={46} r={2} stroke="none" />
    <Path d="M77 36 C65 30 57 20 61 12 C64 6 72 9 70 15" fill="none" strokeWidth={2.4} />
    <Circle cx={70} cy={15} r={1.8} stroke="none" />
    <Path d="M98 86 C86 82 70 82 56 86 C48 88 42 84 46 80" fill="none" strokeWidth={2.2} />
    <G stroke="none">
      <Use href="#re-leaf" transform="translate(62 50) rotate(200) scale(.7)" />
      <Use href="#re-leaf" transform="translate(66 27) rotate(-130) scale(.6)" />
      <Use href="#re-leaf" transform="translate(72 84) rotate(175) scale(.55)" />
      <Use href="#re-leaf" transform="translate(42 61) rotate(140) scale(.5)" />
    </G>
  </G>
);

const CrestBody = () => (
  <G id="re-crest-body">
    <Use href="#re-crest-side" />
    <Use href="#re-crest-side" transform="matrix(-1 0 0 1 200 0)" />
    <Path d="M84 18 L82 6 L91 12 L100 2 L109 12 L118 6 L116 18 Z" stroke="none" />
    <Rect x={84} y={18} width={32} height={5} rx={1.5} stroke="none" />
    <Circle cx={82} cy={6} r={2.2} stroke="none" />
    <Circle cx={100} cy={2.5} r={2.4} stroke="none" />
    <Circle cx={118} cy={6} r={2.2} stroke="none" />
    <Path d="M78 26 H122 V50 C122 66 110 76 100 82 C90 76 78 66 78 50 Z" stroke="none" />
  </G>
);

/** Crowned shield with the couple's initials (or a fleur-de-lis) between gold scrolls, above the gallery title */
export function RoyalCrest({ initials, width = 200, fonts }: { initials?: [string, string] | null; width?: number; fonts: { display: string; serifItalic: string } }) {
  const height = width * (92 / 200);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={initials ? `Crest with the initials ${initials[0]} and ${initials[1]}` : 'Crest'}
      style={{ width, height, alignSelf: 'center' }}
    >
      <Svg width={width} height={height} viewBox="0 0 200 92">
        <Defs>
          <LinearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="200" y2="92">{stops(CREST_GOLD)}</LinearGradient>
          <Leaf />
          <Fleur />
          <CrestSide />
          <CrestBody />
        </Defs>
        <Raised href="#re-crest-body" fill="url(#g)" />
        <Path d="M82.5 30 H117.5 V50 C117.5 63.5 108 72 100 77 C92 72 82.5 63.5 82.5 50 Z" fill="#0a2a22" stroke="url(#g)" strokeWidth={1.2} />
        <Circle cx={100} cy={20.5} r={1.5} fill="#3a2709" />
        {initials ? (
          <G fill="url(#g)">
            <SvgText x={89} y={60} textAnchor="middle" fontSize={16} fontFamily={fonts.display}>{initials[0]}</SvgText>
            <SvgText x={100} y={59} textAnchor="middle" fontSize={11} fontFamily={fonts.serifItalic}>&amp;</SvgText>
            <SvgText x={111} y={60} textAnchor="middle" fontSize={16} fontFamily={fonts.display}>{initials[1]}</SvgText>
          </G>
        ) : (
          <Use href="#re-fleur" transform="translate(100 52) scale(.62)" fill="url(#g)" />
        )}
      </Svg>
    </View>
  );
}

/** Gold line fading in towards the title, ending in two small diamonds. Drawn for the left side; `flip` for the right. */
export function RoyalTitleRule({ width, flip = false }: { width?: number; flip?: boolean }) {
  return (
    <View pointerEvents="none" style={{ width: width ?? '100%', height: 14, transform: flip ? [{ scaleX: -1 }] : [] }}>
      <Svg width="100%" height={14} viewBox="0 0 240 14" preserveAspectRatio="xMaxYMid meet">
        <Defs>
          <LinearGradient id="fade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="206" y2="0">
            <Stop offset={0} stopColor={ROYAL_GOLD} stopOpacity={0} />
            <Stop offset={1} stopColor={ROYAL_GOLD_LIGHT} />
          </LinearGradient>
        </Defs>
        <Path d="M0 7 H206" stroke="url(#fade)" strokeWidth={1.2} />
        <G fill="none" stroke={ROYAL_GOLD_LIGHT} strokeWidth={1.2}>
          <Path d="M211 7 L215.5 2.5 L220 7 L215.5 11.5 Z" />
          <Path d="M222 7 L226.5 2.5 L231 7 L226.5 11.5 Z" />
        </G>
        <Circle cx={236} cy={7} r={1.4} fill={ROYAL_GOLD_LIGHT} />
      </Svg>
    </View>
  );
}

const PlaqueCurl = () => (
  <G id="re-plaque-curl" strokeLinecap="round">
    <Path d="M9 0 C16 -8 28 -9 33 -3 C37 2 31 7 27 3" fill="none" strokeWidth={2} />
    <Circle cx={27} cy={3} r={1.6} stroke="none" />
    <Use href="#re-leaf" transform="translate(18 -5) rotate(-15) scale(.42)" stroke="none" />
  </G>
);

const PlaqueCornerShape = () => (
  <G id="re-plaque-corner">
    <Use href="#re-plaque-curl" />
    <Use href="#re-plaque-curl" transform={MIRROR_DIAGONAL} />
    <Path d="M0 -7.5 L7.5 0 L0 7.5 L-7.5 0 Z" stroke="none" />
  </G>
);

/** One corner of the welcome plaque (top left as drawn; `flip` for the others) */
export function RoyalPlaqueCorner({ size = 44, flip = 'none' }: { size?: number; flip?: Flip }) {
  return (
    <View pointerEvents="none" style={{ width: size, height: size, transform: flipTransform(flip) }}>
      <Svg width={size} height={size} viewBox="-14 -14 56 56">
        <Defs>
          <LinearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="100">{stops(FRAME_GOLD)}</LinearGradient>
          <Leaf />
          <PlaqueCurl />
          <PlaqueCornerShape />
        </Defs>
        <Raised href="#re-plaque-corner" fill="url(#g)" dx={0.8} dy={1.4} />
        <Circle cx={0} cy={0} r={2} fill="#3a2709" />
      </Svg>
    </View>
  );
}

/** Small gold crown for the footer (the website uses the same outline icon) */
export function RoyalCrown({ size = 26, color = ROYAL_GOLD }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
      <Path d="M5 21h14" />
    </Svg>
  );
}
