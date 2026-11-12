import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, {
  Circle, ClipPath, Defs, G, LinearGradient, Path, Pattern, RadialGradient, Rect, Stop,
} from 'react-native-svg';
import { LinearGradient as ScreenFade } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MidnightColors } from '../../constants/theme';
import { haptic } from '../../lib/haptics';
import { EVEBASH_LOGO_BOUNDS, EVEBASH_LOGO_PATH } from '../EveBashLogo';
import { TAB_HEADER_GRADIENT, TAB_HEADER_HEIGHT } from '../ui/TabScreenHeader';
import { EVEBASH_NAME } from './logoPaths';

/**
 * App-open animation (todo #22): an instant camera clicks a photo of the EB logo, the photo becomes
 * the logo and "EveBash" appears below it. Design and preview: reports/app-open-animation/.
 *
 * Everything is laid out on a 280 x 520 artboard (the preview's phone frame). Sizes are multiplied by
 * `u` to fit the screen instead of scaling the artboard with a transform, which would stretch the
 * drawn shapes and blur them. The timeline is in preview seconds; DURATION_SCALE stretches it.
 */

const DURATION_SCALE = 1.3; // 1 = the speed of the approved preview; lower is faster
const START_DELAY_MS = 150; // let the first, heaviest frames draw before anything moves
const END = 4.3;
const CLICK_AT = 0.85;
const HOLD_MS = 400; // the finished logo stays this long before the app fades in
const SETTLE_MS = 600;
const WARM_OPACITY = 0.01; // too faint to see on the dark background, but the phone still draws it
const FADE_OUT_MS = 280;

const BG = MidnightColors.background;
const GOLD = MidnightColors.gold;
const CREAM = '#f3ead9';
const SHINE = '#fff3df';

const ART_W = 280;
const ART_H = 520;
const SLOT_Y = 262; // the camera's photo slot
const PHOTO = { left: 85, top: 128, width: 110, height: 134 };
const SWAP_AT = 2.15; // photo is fully out: stop clipping it at the slot

// Final lockup: EB 65 tall, "EveBash" 10 below, the pair centred on the artboard
const EB_H = 65;
const EB_W = (EB_H * EVEBASH_LOGO_BOUNDS.width) / EVEBASH_LOGO_BOUNDS.height;
const EB_SMALL = 28.86 / EB_H; // EB's size inside the photo before it grows
const NAME_GAP = 10;
const GROUP_TOP = ART_H / 2 - (EB_H + NAME_GAP + EVEBASH_NAME.height) / 2;
const PHOTO_CENTER_Y = PHOTO.top + 8 + 47; // centre of the picture area
const EB_FINAL_Y = GROUP_TOP + EB_H / 2 - PHOTO_CENTER_Y;

// Easing ids, so keyframes stay plain numbers the UI thread can read
const LIN = 0, QUAD_IN = 1, QUAD_OUT = 2, QUAD_IN_OUT = 3, CUBIC_IN = 4, CUBIC_OUT = 5,
  CUBIC_IN_OUT = 6, QUART_IN_OUT = 7, SINE_IN_OUT = 8, BACK_OUT_16 = 9, BACK_OUT_13 = 10;

function ease(id: number, p: number) {
  'worklet';
  switch (id) {
    case QUAD_IN: return p * p;
    case QUAD_OUT: return 1 - (1 - p) * (1 - p);
    case QUAD_IN_OUT: return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    case CUBIC_IN: return p * p * p;
    case CUBIC_OUT: return 1 - Math.pow(1 - p, 3);
    case CUBIC_IN_OUT: return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    case QUART_IN_OUT: return p < 0.5 ? 8 * p * p * p * p : 1 - Math.pow(-2 * p + 2, 4) / 2;
    case SINE_IN_OUT: return -(Math.cos(Math.PI * p) - 1) / 2;
    case BACK_OUT_16: return 1 + 2.6 * Math.pow(p - 1, 3) + 1.6 * Math.pow(p - 1, 2);
    case BACK_OUT_13: return 1 + 2.3 * Math.pow(p - 1, 3) + 1.3 * Math.pow(p - 1, 2);
    default: return p;
  }
}

/** [start, duration, to, easing] in preview seconds; keyframes of one value must not overlap */
type Key = readonly [number, number, number, number];

function track(t: number, from: number, keys: readonly Key[]) {
  'worklet';
  let v = from;
  for (let i = 0; i < keys.length; i++) {
    const [start, dur, to, easing] = keys[i];
    if (t <= start) return v;
    const p = dur <= 0 ? 1 : Math.min(1, (t - start) / dur);
    if (p < 1) return v + (to - v) * ease(easing, p);
    v = to;
  }
  return v;
}

const K = {
  camOpacity: [[0, 0.55, 1, CUBIC_OUT], [2.2, 0.45, 0, CUBIC_IN]],
  camY: [[0, 0.55, 0, BACK_OUT_16], [2.2, 0.45, 30, CUBIC_IN]],
  camScale: [[0, 0.55, 1, BACK_OUT_16], [2.2, 0.45, 0.9, CUBIC_IN]],
  camRotate: [[0, 0.55, 0, BACK_OUT_16]],
  camSquash: [[0.85, 0.06, 0.97, QUAD_OUT], [0.91, 0.06, 1, QUAD_IN]],
  camWhirr: [0, 1, 2, 3, 4, 5].map(i => [1.15 + i * 0.04, 0.04, i % 2 === 0 ? 1.3 : 0, SINE_IN_OUT] as const),
  button: [[0.85, 0.06, 5, QUAD_IN], [0.91, 0.06, 0, QUAD_IN]],
  bracketOpacity: [[0.35, 0.35, 0.9, CUBIC_OUT], [0.9, 0.15, 0, QUAD_OUT]],
  bracketScale: [[0.35, 0.35, 1, CUBIC_OUT]],
  ringRotate: [[0.35, 0.5, 80, CUBIC_IN_OUT]],
  lensZoom: [[0.4, 0.25, 1.06, SINE_IN_OUT], [0.65, 0.25, 1, SINE_IN_OUT]],
  blades: [[0.87, 0.07, 1, CUBIC_IN], [0.96, 0.2, 0, CUBIC_OUT]],
  burstOpacity: [[0.9, 0.06, 1, LIN], [0.96, 0.3, 0, CUBIC_OUT]],
  burstScale: [[0.9, 0.06, 6, LIN], [0.96, 0.3, 14, CUBIC_OUT]],
  glow: [[0.9, 0.05, 0.22, QUAD_OUT], [0.95, 0.25, 0, QUAD_OUT]],
  photoY: [
    [1.45, 0.3, 80, QUAD_IN_OUT],
    [1.85, 0.25, 134, CUBIC_OUT],
    [2.25, 0.6, ART_H / 2 - PHOTO_CENTER_Y, QUART_IN_OUT],
    [3.1, 0.5, EB_FINAL_Y, BACK_OUT_13],
  ],
  photoTilt: [[2.25, 0.3, -3, SINE_IN_OUT], [2.55, 0.3, 0, SINE_IN_OUT]],
  frameAlpha: [[2.85, 0.3, 0, QUAD_IN]],
  develop: [[1.5, 0.8, 1, LIN]],
  melt: [[2.85, 0.3, 1, QUAD_IN]],
  ebOpacity: [[1.55, 0.9, 1, QUAD_OUT]],
  ebSharpen: [[1.55, 0.9, 1, QUAD_OUT]],
  ebGrow: [[3.1, 0.5, 1, BACK_OUT_13]],
  shine: [[3.6, 0.6, 1, QUAD_IN_OUT]],
  nameIn: [[3.6, 0.7, 1, CUBIC_OUT]],
} satisfies Record<string, readonly Key[]>;

type T = { t: SharedValue<number>; u: number; s: Styles };

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/** EB in gold, with a soft light band that sweeps across inside the letters */
function EbMark({ t, u }: Pick<T, 't' | 'u'>) {
  const b = EVEBASH_LOGO_BOUNDS;
  const bandW = b.width * 0.5;
  const shine = useAnimatedProps(() => ({
    x: b.x - bandW + track(t.value, 0, K.shine) * (b.width + bandW),
  }));
  return (
    <Svg width={EB_W * u} height={EB_H * u} viewBox={`${b.x} ${b.y} ${b.width} ${b.height}`}>
      <Defs>
        <ClipPath id="introEbClip">
          <Path d={EVEBASH_LOGO_PATH} />
        </ClipPath>
        <LinearGradient id="introShine" x1="0" y1="0" x2="1" y2="0">
          <Stop offset={0} stopColor={SHINE} stopOpacity={0} />
          <Stop offset={0.5} stopColor={SHINE} stopOpacity={0.95} />
          <Stop offset={1} stopColor={SHINE} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path fill={GOLD} d={EVEBASH_LOGO_PATH} />
      <G clipPath="url(#introEbClip)">
        <AnimatedRect animatedProps={shine} y={b.y} width={bandW} height={b.height} fill="url(#introShine)" />
      </G>
    </Svg>
  );
}

/** The instant photo: cream frame, picture area, and the EB that develops on it */
function PhotoCard({ t, u, s }: T) {
  const frame = useAnimatedStyle(() => ({
    backgroundColor: `rgba(243,234,217,${track(t.value, 1, K.frameAlpha)})`,
  }));
  const picture = useAnimatedStyle(() => {
    const melt = track(t.value, 0, K.melt);
    return {
      backgroundColor: melt > 0
        ? interpolateColor(melt, [0, 1], ['#0e1216', BG])
        : interpolateColor(track(t.value, 0, K.develop), [0, 1], ['#4a443b', '#0e1216']),
    };
  });
  const eb = useAnimatedStyle(() => {
    const grow = track(t.value, EB_SMALL, K.ebGrow);
    const sharpen = 0.94 + 0.06 * track(t.value, 0, K.ebSharpen);
    const opacity = t.value === 0 ? WARM_OPACITY : track(t.value, 0, K.ebOpacity);
    return { opacity, transform: [{ scale: grow * sharpen }] };
  });
  return (
    <Animated.View style={[s.photo, frame]}>
      <Animated.View style={[s.picture, picture]}>
        <Animated.View style={[s.eb, eb]}>
          <EbMark t={t} u={u} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** One iris blade: a slice of the lens that slides in from outside to close the shutter */
function Blade({ t, index }: Pick<T, 't'> & { index: number }) {
  const a = (index * Math.PI) / 3;
  const s = 0.62;
  const props = useAnimatedProps(() => {
    const open = 1 - track(t.value, 0, K.blades);
    const ox = 30 * Math.cos(a) * open;
    const oy = 30 * Math.sin(a) * open;
    return {
      d: `M${ox} ${oy} L${ox + 40 * Math.cos(a - s)} ${oy + 40 * Math.sin(a - s)} ` +
        `L${ox + 40 * Math.cos(a + s)} ${oy + 40 * Math.sin(a + s)} Z`,
    };
  });
  return <AnimatedPath animatedProps={props} fill="#3a3228" stroke="rgba(202,156,104,0.55)" strokeWidth={0.8} />;
}

function Camera({ t, u, s }: T) {
  const body = useAnimatedStyle(() => ({
    opacity: Math.min(1, track(t.value, 0, K.camOpacity)),
    transform: [
      { translateX: track(t.value, 0, K.camWhirr) * u },
      { translateY: track(t.value, 40, K.camY) * u },
      { rotate: `${track(t.value, -6, K.camRotate)}deg` },
      { scale: track(t.value, 0.85, K.camScale) },
      { scaleY: track(t.value, 1, K.camSquash) },
    ],
  }));
  const button = useAnimatedStyle(() => ({ transform: [{ translateY: track(t.value, 0, K.button) * u }] }));
  const lens = useAnimatedStyle(() => ({ transform: [{ scale: track(t.value, 1, K.lensZoom) }] }));
  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${track(t.value, 0, K.ringRotate)}deg` }] }));
  return (
    <Animated.View style={[s.camera, body]}>
      <Animated.View style={[s.button, button]} />
      <Svg width={180 * u} height={130 * u} viewBox="0 0 180 130" style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="introGrip" width={6} height={6} patternUnits="userSpaceOnUse">
            <Rect width={6} height={6} fill="#1f262e" />
            <Rect width={3} height={6} fill="#262e37" />
          </Pattern>
        </Defs>
        <Rect x={2} y={10} width={176} height={116} rx={20} fill="#1f262e" stroke={GOLD} strokeWidth={2} />
        <Rect x={3} y={56} width={174} height={30} fill="url(#introGrip)" />
        <Rect x={16} y={22} width={28} height={18} rx={4} fill="rgba(243,234,217,0.15)" stroke="rgba(202,156,104,0.7)" strokeWidth={1.5} />
        <Rect x={52} y={24} width={18} height={13} rx={3} fill="none" stroke="rgba(202,156,104,0.7)" strokeWidth={1.5} />
        <Circle cx={160} cy={30} r={3} fill={GOLD} />
        <Rect x={30} y={110} width={120} height={4} rx={2} fill="#0b0f13" />
      </Svg>
      <Animated.View style={[s.lens, lens]}>
        <Svg width={84 * u} height={84 * u} viewBox="-42 -42 84 84" style={StyleSheet.absoluteFill}>
          <Circle r={40} fill="#0b0f13" stroke={GOLD} strokeWidth={3} />
        </Svg>
        <Animated.View style={[StyleSheet.absoluteFill, ring]}>
          <Svg width={84 * u} height={84 * u} viewBox="-42 -42 84 84">
            <Circle r={33} fill="none" stroke="rgba(202,156,104,0.5)" strokeWidth={2} strokeDasharray="5 4" />
          </Svg>
        </Animated.View>
        <Svg width={84 * u} height={84 * u} viewBox="-42 -42 84 84" style={StyleSheet.absoluteFill}>
          <Defs>
            <ClipPath id="introLensClip">
              <Circle r={25} />
            </ClipPath>
          </Defs>
          <Circle r={25} fill="#2a323b" />
          <Circle cx={-8} cy={-8} r={4.5} fill="rgba(255,255,255,0.3)" />
          <G clipPath="url(#introLensClip)">
            {[0, 1, 2, 3, 4, 5].map(i => <Blade key={i} t={t} index={i} />)}
          </G>
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

type AppIntroProps = {
  /** True once the first screen can show; the intro holds on the logo until then */
  ready: boolean;
  /** Called after the intro has faded out */
  onFinish: () => void;
  /** Called on the first frame, when the native splash can hide */
  onShown?: () => void;
  /** Called when the animation reaches the still logo (or is skipped): a good moment for heavy work */
  onPlayed?: () => void;
};

// Memoised: the root layout re-renders mid-animation (fonts finishing loading), and re-rendering every
// SVG here at that moment made the animation stall for a few frames
export default React.memo(AppIntro);

function AppIntro({ ready, onFinish, onShown, onPlayed }: AppIntroProps) {
  const { width, height } = useWindowDimensions();
  const u = Math.min(width / ART_W, height / ART_H);
  const insets = useSafeAreaInsets();
  const s = useMemo(() => makeStyles(u), [u]);
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);
  const fade = useSharedValue(1);
  const [played, setPlayed] = useState(false);
  const playedAt = useRef(0);

  useEffect(() => {
    if (reduceMotion) {
      t.value = END;
      setPlayed(true);
      return;
    }
    const ms = (sec: number) => START_DELAY_MS + sec * 1000 * DURATION_SCALE;
    t.value = withDelay(START_DELAY_MS, withTiming(END, { duration: ms(END) - START_DELAY_MS, easing: Easing.linear }));
    const click = setTimeout(() => haptic('tap'), ms(CLICK_AT));
    const done = setTimeout(() => setPlayed(true), ms(END));
    return () => {
      clearTimeout(click);
      clearTimeout(done);
    };
  }, [reduceMotion, t]);

  useEffect(() => {
    if (!played) return;
    playedAt.current = Date.now();
    onPlayed?.();
  }, [played, onPlayed]);

  useEffect(() => {
    if (!played || !ready) return;
    // The logo holds HOLD_MS in all, counting time already spent waiting for the app, and always
    // SETTLE_MS after the app is ready so its first screen finishes drawing before the fade
    const hold = Math.max(SETTLE_MS, HOLD_MS - (Date.now() - playedAt.current));
    fade.value = withDelay(hold, withTiming(0, { duration: FADE_OUT_MS, easing: Easing.out(Easing.quad) }));
    const timer = setTimeout(onFinish, hold + FADE_OUT_MS);
    return () => clearTimeout(timer);
  }, [played, ready, fade, onFinish]);

  // Tapping skips straight to the logo
  const skip = () => {
    t.value = END;
    setPlayed(true);
  };

  const overlay = useAnimatedStyle(() => ({ opacity: fade.value }));
  // Before anything moves (t = 0) both photo copies are drawn at WARM_OPACITY, fully out, so the phone
  // has drawn them once; drawing the photo the first time it slid out of the slot made the animation stall
  const clipped = useAnimatedStyle(() => ({
    opacity: t.value === 0 ? WARM_OPACITY : t.value < SWAP_AT ? 1 : 0,
    transform: [{ translateY: (t.value === 0 ? PHOTO.height : track(t.value, 0, K.photoY)) * u }],
  }));
  const free = useAnimatedStyle(() => ({
    opacity: t.value === 0 ? WARM_OPACITY : t.value < SWAP_AT ? 0 : 1,
    transform: [
      { translateY: track(t.value, 0, K.photoY) * u },
      { rotate: `${track(t.value, 0, K.photoTilt)}deg` },
    ],
  }));
  const brackets = useAnimatedStyle(() => ({
    opacity: track(t.value, 0, K.bracketOpacity),
    transform: [{ scale: track(t.value, 1.35, K.bracketScale) }],
  }));
  const burst = useAnimatedStyle(() => ({
    opacity: track(t.value, 0, K.burstOpacity),
    transform: [{ scale: track(t.value, 0.2, K.burstScale) }],
  }));
  const glow = useAnimatedStyle(() => ({ opacity: track(t.value, 0, K.glow) }));
  const name = useAnimatedStyle(() => {
    const p = track(t.value, 0, K.nameIn);
    return { opacity: p, transform: [{ translateY: 10 * (1 - p) * u }, { scaleX: 1.18 - 0.18 * p }] };
  });

  return (
    <Animated.View style={[s.overlay, overlay]} onLayout={onShown}>
      {/* Same top fade as the dashboard header, so the hand-off to the app doesn't jump */}
      <ScreenFade
        colors={TAB_HEADER_GRADIENT}
        style={[s.topFade, { height: insets.top + TAB_HEADER_HEIGHT }]}
        pointerEvents="none"
      />
      <Pressable
        style={s.center}
        onPress={skip}
        accessibilityRole="image"
        accessibilityLabel="EveBash"
      >
        <View style={s.artboard}>
          <Camera t={t} u={u} s={s} />
          {/* While the photo comes out, only the part past the slot shows */}
          <View style={s.slotClip}>
            <Animated.View style={[s.photoInSlot, clipped]}>
              <PhotoCard t={t} u={u} s={s} />
            </Animated.View>
          </View>
          <Animated.View style={[s.photoFree, free]}>
            <PhotoCard t={t} u={u} s={s} />
          </Animated.View>
          <Animated.View style={[s.name, name]}>
            <Svg
              width={EVEBASH_NAME.width * u}
              height={EVEBASH_NAME.height * u}
              viewBox={`0 0 ${EVEBASH_NAME.width} ${EVEBASH_NAME.height}`}
            >
              <Path fill={GOLD} d={EVEBASH_NAME.d} />
            </Svg>
          </Animated.View>
          <Animated.View style={[s.brackets, brackets]}>
            <View style={[s.corner, s.cornerTL]} />
            <View style={[s.corner, s.cornerTR]} />
            <View style={[s.corner, s.cornerBL]} />
            <View style={[s.corner, s.cornerBR]} />
          </Animated.View>
          <Animated.View style={[s.burst, burst]}>
            <Svg width={40 * u} height={40 * u} viewBox="-20 -20 40 40">
              <Defs>
                <RadialGradient id="introBurst" cx={0} cy={0} r={20} gradientUnits="userSpaceOnUse">
                  <Stop offset={0} stopColor="#fff7eb" stopOpacity={1} />
                  <Stop offset={0.3} stopColor="#f3dcb4" stopOpacity={0.7} />
                  <Stop offset={0.7} stopColor={GOLD} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle r={20} fill="url(#introBurst)" />
            </Svg>
          </Animated.View>
        </View>
        <Animated.View pointerEvents="none" style={[s.glow, glow]} />
      </Pressable>
    </Animated.View>
  );
}

/** Artboard sizes times u, the artboard-to-screen ratio */
function makeStyles(u: number) {
  return StyleSheet.create({
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: BG, zIndex: 1000, elevation: 1000 },
    topFade: { position: 'absolute', top: 0, left: 0, right: 0 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    artboard: { width: ART_W * u, height: ART_H * u },
    camera: { position: 'absolute', left: 50 * u, top: 150 * u, width: 180 * u, height: 130 * u },
    button: {
      position: 'absolute', left: 124 * u, top: 3 * u, width: 28 * u, height: 12 * u,
      borderRadius: 3 * u, backgroundColor: GOLD,
    },
    lens: { position: 'absolute', left: 48 * u, top: 28 * u, width: 84 * u, height: 84 * u },
    slotClip: {
      position: 'absolute', left: 0, top: SLOT_Y * u, width: ART_W * u, height: (ART_H - SLOT_Y) * u,
      overflow: 'hidden',
    },
    photoInSlot: { position: 'absolute', left: PHOTO.left * u, top: (PHOTO.top - SLOT_Y) * u },
    photoFree: { position: 'absolute', left: PHOTO.left * u, top: PHOTO.top * u },
    photo: { width: PHOTO.width * u, height: PHOTO.height * u, borderRadius: 4 * u, padding: 8 * u },
    picture: {
      width: 94 * u, height: 94 * u, borderRadius: 2 * u, alignItems: 'center', justifyContent: 'center',
    },
    eb: { width: EB_W * u, height: EB_H * u },
    name: {
      position: 'absolute',
      left: ((ART_W - EVEBASH_NAME.width) / 2) * u,
      top: (GROUP_TOP + EB_H + NAME_GAP) * u,
    },
    brackets: { position: 'absolute', left: 85 * u, top: 165 * u, width: 110 * u, height: 110 * u },
    corner: { position: 'absolute', width: 16 * u, height: 16 * u, borderColor: CREAM },
    cornerTL: { left: 0, top: 0, borderLeftWidth: 2 * u, borderTopWidth: 2 * u },
    cornerTR: { right: 0, top: 0, borderRightWidth: 2 * u, borderTopWidth: 2 * u },
    cornerBL: { left: 0, bottom: 0, borderLeftWidth: 2 * u, borderBottomWidth: 2 * u },
    cornerBR: { right: 0, bottom: 0, borderRightWidth: 2 * u, borderBottomWidth: 2 * u },
    burst: { position: 'absolute', left: 60 * u, top: 161 * u, width: 40 * u, height: 40 * u },
    glow: { ...StyleSheet.absoluteFillObject, backgroundColor: CREAM },
  });
}

type Styles = ReturnType<typeof makeStyles>;
