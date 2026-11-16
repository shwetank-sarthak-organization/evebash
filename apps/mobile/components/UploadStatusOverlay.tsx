import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useFocusEffect, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  FadeOutDown,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { IconSymbol, type IconSymbolName } from './ui/icon-symbol';
import { appTabBarMetrics } from './navigation/appTabs';
import { MidnightColors } from '../constants/theme';
import { FontFamily, FontSize } from '../constants/typography';
import { Radius, Spacing } from '../constants/layout';
import { useAppTheme } from '../context/ThemeContext';
import { appAlert } from '../lib/feedback';
import { haptic } from '../lib/haptics';
import { formatStorageSize } from '../lib/planLimits';
import { getOriginalMediaUrl, getSmallThumbnail } from '../lib/imageUrl';
import {
  cancelUploadItem,
  clearFinishedUploads,
  isUploadCancellable,
  isUploadSaved,
  retryUploadItem,
  subscribeToUploadQueue,
  uploadErrorMessage,
  WAITING_FOR_CONNECTION,
  type UploadQueueItem,
} from '../lib/uploadQueue';

type Kind = 'uploading' | 'offline' | 'preparing' | 'failed' | 'finishing' | 'done';
type Summary = { kind: Kind | null; failed: UploadQueueItem[]; title: string; subtitle: string; percent: number; key: string };

const STILL_UPLOADING = new Set<UploadQueueItem['status']>(['pending', 'uploading', 'uploaded_pending_metadata', 'upload_needs_reconciliation']);

/** "1 photo", "3 videos", "12 files" (photos and videos together, as on the website) */
const countLabel = (items: UploadQueueItem[]) => {
  const n = items.length;
  if (items.every(item => item.mediaType === 'photo')) return `${n} ${n === 1 ? 'photo' : 'photos'}`;
  if (items.every(item => item.mediaType === 'video')) return `${n} ${n === 1 ? 'video' : 'videos'}`;
  return `${n} files`;
};

// The queue's progress runs 0-90 while a file uploads (the rest is the save); a saved file counts as fully uploaded
const uploadedFraction = (item: UploadQueueItem) =>
  item.status === 'processing' || item.status === 'completed' ? 1 : Math.min(1, (item.progress || 0) / 90);

// One big file (a long video) shows its size; whole MB so the line doesn't flicker on every tick
const BIG_FILE_BYTES = 20 * 1024 * 1024;
const wholeMB = (bytes: number) => formatStorageSize(Math.round(bytes / (1024 * 1024)) * 1024 * 1024);

/** What the upload status says about the queue: every file in it, across galleries and sets */
function summarize(items: UploadQueueItem[]): Summary {
  const failed = items.filter(item => item.status === 'failed');
  const live = items.filter(item => item.status !== 'failed');
  const toUpload = live.filter(item => STILL_UPLOADING.has(item.status));
  const uploaded = live.filter(item => item.status === 'processing' || item.status === 'completed');
  const videosPreparing = live.filter(item => item.mediaType === 'video' && item.status === 'processing');
  const inFlight = toUpload.find(item => item.status !== 'pending');

  const bySize = live.length > 0 && live.every(item => item.fileSize > 0);
  const totalBytes = live.reduce((sum, item) => sum + item.fileSize, 0);
  const doneBytes = live.reduce((sum, item) => sum + item.fileSize * uploadedFraction(item), 0);
  const fraction = bySize
    ? doneBytes / totalBytes
    : live.length ? live.reduce((sum, item) => sum + uploadedFraction(item), 0) / live.length : 0;
  // Never 100% while something is still going
  const percent = Math.min(99, Math.floor(fraction * 100));

  let kind: Kind | null = null;
  if (toUpload.length) kind = !inFlight && toUpload.some(item => item.error === WAITING_FOR_CONNECTION) ? 'offline' : 'uploading';
  else if (videosPreparing.length) kind = 'preparing';
  else if (failed.length) kind = 'failed';
  else if (live.some(item => item.status === 'processing')) kind = 'finishing';
  else if (live.length) kind = 'done';

  let title = '';
  let subtitle = '';
  switch (kind) {
    case 'uploading':
      title = `Uploading ${countLabel(live)}`;
      subtitle = inFlight?.retryCount
        ? `Slow connection, trying again · ${percent}%`
        : live.length === 1
          ? live[0].fileSize >= BIG_FILE_BYTES ? `${wholeMB(doneBytes)} of ${wholeMB(totalBytes)} · ${percent}%` : `${percent}%`
          : `${uploaded.length} of ${live.length} uploaded · ${percent}%`;
      break;
    case 'offline':
      title = 'Waiting for connection';
      subtitle = `${uploaded.length} of ${live.length} uploaded. The rest carry on when you're back online.`;
      break;
    case 'preparing':
      title = `Getting ${countLabel(videosPreparing)} ready`;
      subtitle = `Uploaded. ${videosPreparing.length === 1 ? "It'll" : "They'll"} appear in the gallery when ready.`;
      break;
    case 'failed':
      title = `${countLabel(failed)} didn't upload`;
      subtitle = uploaded.length ? `${uploaded.length} of ${items.length} uploaded` : '';
      break;
    case 'finishing':
      title = `${countLabel(uploaded)} uploaded`;
      subtitle = 'Finishing up. You can keep using the app.';
      break;
    case 'done':
      title = `${countLabel(live)} uploaded`;
      subtitle = 'Added to the gallery';
      break;
  }

  return { kind, failed, title, subtitle, percent, key: `${items.map(item => item.id).join(',')}:${failed.length}` };
}

const showWhyItFailed = (failed: UploadQueueItem[]) => {
  const shown = failed.slice(0, 5).map(item => `${item.fileName}: ${uploadErrorMessage(item.error)}`);
  if (failed.length > shown.length) shown.push(`...and ${failed.length - shown.length} more`);
  appAlert("Why it didn't upload", shown.join('\n\n'));
};

const cancelOne = async (item: UploadQueueItem) => {
  if (!(await cancelUploadItem(item.id))) {
    appAlert("Couldn't cancel", "It's already in the gallery and couldn't be deleted. Delete it from there.");
  }
};

/** × on one file: one already in the gallery is deleted, so that asks first (as on the website) */
const cancelRow = (item: UploadQueueItem) => {
  haptic('tap');
  if (!isUploadSaved(item)) {
    void cancelOne(item);
    return;
  }
  appAlert('Cancel this upload?', "It's already uploaded, so it will be deleted from the gallery.", [
    { text: 'Keep it', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => { void cancelOne(item); } },
  ]);
};

/** Files "Cancel all" stops or deletes: everything not finished, as on the website */
const openUploads = (items: UploadQueueItem[]) =>
  items.filter(item => item.status !== 'failed' && item.status !== 'completed' && isUploadCancellable(item));

const cancelAll = (items: UploadQueueItem[]) => {
  const open = openUploads(items);
  const saved = open.filter(isUploadSaved).length;
  appAlert(
    open.length === 1 ? 'Cancel this upload?' : `Cancel all ${open.length} uploads?`,
    saved
      ? `${saved === 1 ? '1 file is' : `${saved} files are`} already uploaded and will be deleted from the gallery.`
      : "Files that haven't finished uploading won't be sent.",
    [
      { text: 'Keep uploading', style: 'cancel' },
      {
        text: 'Cancel uploads',
        style: 'destructive',
        onPress: () => { void (async () => { for (const item of open) await cancelOne(item); })(); },
      },
    ],
  );
};

const retryFailed = async (failed: UploadQueueItem[]) => {
  haptic('tap');
  for (const item of failed) await retryUploadItem(item.id);
};

type Tone = 'muted' | 'gold' | 'success' | 'danger';

/** One file's line in the list: what it's doing, a size or percent, and how full its bar is */
function rowStatus(item: UploadQueueItem): { label: string; meta: string; tone: Tone; bar: number; faded?: boolean } {
  const size = item.fileSize <= 0 ? '' : item.fileSize >= BIG_FILE_BYTES ? wholeMB(item.fileSize) : formatStorageSize(item.fileSize);
  switch (item.status) {
    case 'failed':
      return { label: "Didn't upload", meta: '', tone: 'danger', bar: 100 };
    case 'uploading': {
      const percent = Math.min(99, Math.round(uploadedFraction(item) * 100));
      return { label: item.retryCount ? 'Trying again' : 'Uploading', meta: `${percent}%`, tone: 'gold', bar: percent };
    }
    case 'uploaded_pending_metadata':
      return { label: 'Finishing', meta: size, tone: 'muted', bar: 100 };
    case 'processing':
      return { label: 'Getting ready', meta: size, tone: 'muted', bar: 100, faded: true };
    case 'completed':
      return { label: 'Uploaded', meta: size, tone: 'success', bar: 100 };
    case 'upload_needs_reconciliation':
      return { label: 'Checking', meta: size, tone: 'muted', bar: 0 };
    default:
      return { label: item.error === WAITING_FOR_CONNECTION ? 'Waiting for connection' : 'Waiting', meta: size, tone: 'muted', bar: 0 };
  }
}

// ── Where it sits ───────────────────────────────────────────────────────────
// Hidden on the login screens and on every events/... page (guest pages keep their theme's own look), unless
// the screen asks for it with useUploadStatusPlacement; above the tab bar on tab pages; near the bottom elsewhere.
const HIDDEN_ROUTES = new Set(['index', 'login', 'forgot-password', '+not-found', 'events']);

let screenPlacement: { id: number; bottom: number } | null = null;
let nextPlacementId = 1;
const placementListeners = new Set<() => void>();
const subscribePlacement = (listener: () => void) => {
  placementListeners.add(listener);
  return () => { placementListeners.delete(listener); };
};
const getPlacement = () => screenPlacement;
const setPlacement = (next: typeof screenPlacement) => {
  screenPlacement = next;
  placementListeners.forEach(listener => listener());
};

/**
 * Shows the upload status on a screen that hides it by default (events/...) while that screen is focused, sitting
 * `bottom` points from the bottom (above the screen's own bottom bar). null leaves it hidden.
 */
export function useUploadStatusPlacement(bottom: number | null) {
  useFocusEffect(useCallback(() => {
    if (bottom === null) return;
    const id = nextPlacementId++;
    setPlacement({ id, bottom });
    // The next screen may have set its own already (focus can run before the old screen's blur)
    return () => { if (screenPlacement?.id === id) setPlacement(null); };
  }, [bottom]));
}

// Remembered for this app session: minimized or not, and where the floating button was dragged to
let minimizedPref = false;
let fabSpot: { side: 'left' | 'right'; top: number } | null = null;

/**
 * The upload status over the whole app (todo #42, design from issue #273): a card with a progress ring, or, when
 * minimized, a round floating button with the same ring that can be dragged to either side. Mounted once in
 * app/_layout.tsx.
 */
export function UploadStatusOverlay() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const screen = useSyncExternalStore(subscribePlacement, getPlacement);
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const wash = useMemo(() => getWashes(colors, isDark), [colors, isDark]);
  const [items, setItems] = useState<UploadQueueItem[]>([]);
  const [minimized, setMinimized] = useState(minimizedPref);
  // Hide only lasts until the queue changes (new files, or a file fails)
  const [hiddenFor, setHiddenFor] = useState<string | null>(null);

  useEffect(() => subscribeToUploadQueue(setItems), []);

  const summary = useMemo(() => summarize(items), [items]);

  // Finished everywhere: say so briefly, then clear (the gallery screen clears at once and shows its own toast)
  useEffect(() => {
    if (summary.kind !== 'done') return;
    const timer = setTimeout(() => { void clearFinishedUploads(); }, 2500);
    return () => clearTimeout(timer);
  }, [summary.kind, summary.key]);

  const route = segments[0] as string | undefined;
  const bottom = screen
    ? screen.bottom
    : !route || HIDDEN_ROUTES.has(route)
      ? null
      : route === '(tabs)' ? appTabBarMetrics(insets.bottom).height + Spacing.md : insets.bottom + Spacing.lg;

  const { kind } = summary;
  if (!kind || bottom === null || hiddenFor === summary.key) return null;

  const look: Record<Kind, { icon: IconSymbolName; color: string; wash: string }> = {
    uploading: { icon: 'icloud.and.arrow.up.fill', color: colors.gold, wash: wash.gold },
    offline: { icon: 'wifi.slash', color: colors.warning, wash: wash.warning },
    preparing: { icon: 'clock.fill', color: colors.gold, wash: wash.gold },
    failed: { icon: 'exclamationmark.triangle.fill', color: colors.dangerSoft, wash: wash.danger },
    finishing: { icon: 'checkmark', color: colors.success, wash: wash.success },
    done: { icon: 'checkmark', color: colors.success, wash: wash.success },
  };
  const ring = {
    value: kind === 'finishing' || kind === 'done' || kind === 'failed' ? 100 : summary.percent,
    indeterminate: kind === 'preparing',
    color: kind === 'failed' ? colors.dangerSoft : kind === 'finishing' || kind === 'done' ? colors.success : kind === 'offline' ? colors.warning : colors.goldFill,
    trackColor: colors.tint(isDark ? 0.1 : 0.08),
    dimmed: kind === 'offline',
  };

  const minimize = (value: boolean) => {
    haptic('select');
    minimizedPref = value;
    setMinimized(value);
  };

  if (minimized) {
    return (
      <FloatingButton
        summary={summary}
        bottom={bottom}
        ring={ring}
        icon={look[kind]}
        styles={styles}
        colors={colors}
        onOpen={() => minimize(false)}
      />
    );
  }

  const { failed } = summary;
  const toneColor: Record<Tone, string> = { muted: colors.slate400, gold: colors.gold, success: colors.success, danger: colors.dangerSoft };

  const iconButton = (name: IconSymbolName, a11y: string, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: wash.neutral }, pressed && styles.pressed]}
    >
      <IconSymbol name={name} size={14} color={colors.slate300} />
    </Pressable>
  );

  const textButton = (label: string, a11y: string, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.button, { backgroundColor: wash.danger }, pressed && styles.pressed]}
    >
      <Text style={[styles.buttonText, { color: colors.dangerSoft }]}>{label}</Text>
    </Pressable>
  );

  const running = kind === 'uploading' || kind === 'offline' || kind === 'preparing';
  // × once nothing is running: clears the files that failed, otherwise just hides
  const close = kind === 'failed'
    ? { a11y: 'Dismiss failed uploads', onPress: () => { void clearFinishedUploads(); } }
    : { a11y: 'Hide upload status', onPress: () => setHiddenFor(summary.key) };

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOutDown.duration(180)}
      accessibilityLiveRegion="polite"
      style={[styles.card, { bottom }]}
    >
      <View style={styles.header}>
        <ProgressRing size={RING_SIZE} {...ring}>
          <IconSymbol name={look[kind].icon} size={14} color={look[kind].color} />
        </ProgressRing>
        <View style={styles.texts}>
          <Text style={styles.title} numberOfLines={1}>{summary.title}</Text>
          {!!summary.subtitle && <Text style={styles.subtitle} numberOfLines={2}>{summary.subtitle}</Text>}
        </View>
        {running && openUploads(items).length > 0 && textButton('Cancel all', 'Cancel all uploads', () => cancelAll(items))}
        {kind === 'failed' && textButton('Retry all', 'Retry all failed uploads', () => { void retryFailed(failed); })}
        {iconButton('chevron.down', 'Minimize upload status', () => minimize(true))}
        {!running && iconButton('xmark', close.a11y, close.onPress)}
      </View>
      {/* One row per file, as on the website: a thumbnail, what it's doing, its own bar, and × to cancel it */}
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={items.length > 4}>
        {items.map(item => {
          const row = rowStatus(item);
          return (
            <View key={item.id} style={styles.fileRow}>
              <UploadThumb item={item} styles={styles} colors={colors} />
              <View style={styles.fileMain}>
                <View style={styles.fileLine}>
                  {item.status === 'failed' ? (
                    <Pressable onPress={() => showWhyItFailed([item])} hitSlop={8} accessibilityRole="button" accessibilityLabel="Didn't upload. See why" style={styles.fileLabelWrap}>
                      <Text style={[styles.fileLabel, { color: colors.dangerSoft }]} numberOfLines={1}>{row.label} · See why</Text>
                    </Pressable>
                  ) : (
                    <Text style={[styles.fileLabel, styles.fileLabelWrap]} numberOfLines={1}>{row.label}</Text>
                  )}
                  {!!row.meta && <Text style={[styles.fileMeta, row.tone === 'gold' && { color: colors.gold }]}>{row.meta}</Text>}
                </View>
                <View style={styles.fileTrack}>
                  <View style={[styles.fileFill, { width: `${row.bar}%`, backgroundColor: row.tone === 'muted' ? colors.goldFill : toneColor[row.tone], opacity: row.faded ? 0.5 : 1 }]} />
                </View>
              </View>
              {item.status === 'failed' && (
                <Pressable
                  onPress={() => { haptic('tap'); void retryUploadItem(item.id); }}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Retry this upload"
                  style={({ pressed }) => [styles.smallButton, { backgroundColor: wash.danger }, pressed && styles.pressed]}
                >
                  <Text style={[styles.smallButtonText, { color: colors.dangerSoft }]}>Retry</Text>
                </Pressable>
              )}
              {item.status === 'completed' ? (
                <View style={styles.rowIcon}><IconSymbol name="checkmark" size={14} color={colors.success} /></View>
              ) : isUploadCancellable(item) ? (
                <Pressable
                  onPress={() => cancelRow(item)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={item.status === 'failed' ? 'Remove from the list' : isUploadSaved(item) ? 'Cancel and delete this upload' : 'Cancel this upload'}
                  style={({ pressed }) => [styles.rowIcon, { backgroundColor: wash.neutral }, pressed && styles.pressed]}
                >
                  <IconSymbol name="xmark" size={11} color={colors.slate300} />
                </Pressable>
              ) : (
                <View style={styles.rowIcon} />
              )}
            </View>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}

/** The photo itself: the copy on the phone while it uploads, then a small copy from the server; an icon for videos */
function UploadThumb({ item, styles, colors }: { item: UploadQueueItem; styles: ReturnType<typeof getStyles>; colors: typeof MidnightColors }) {
  const uri = item.mediaType !== 'photo'
    ? null
    : isUploadSaved(item) ? getSmallThumbnail(getOriginalMediaUrl(item.storageKey!)) : item.fileUri;
  const [broken, setBroken] = useState<string | null>(null);
  if (!uri || broken === uri) {
    return (
      <View style={styles.thumb}>
        <IconSymbol name={item.mediaType === 'video' ? 'video.fill' : 'photo'} size={16} color={colors.gold} />
      </View>
    );
  }
  return (
    <ExpoImage
      source={{ uri }}
      recyclingKey={item.id}
      contentFit="cover"
      transition={150}
      onError={() => setBroken(uri)}
      style={styles.thumb}
      accessibilityIgnoresInvertColors
    />
  );
}

type RingProps = { value: number; indeterminate: boolean; color: string; trackColor: string; dimmed: boolean };

/** The round floating button: the same ring, a percent or the state icon inside, dragged to either side */
function FloatingButton({ summary, bottom, ring, icon, styles, colors, onOpen }: {
  summary: Summary;
  bottom: number;
  ring: RingProps;
  icon: { icon: IconSymbolName; color: string };
  styles: ReturnType<typeof getStyles>;
  colors: typeof MidnightColors;
  onOpen: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const leftX = Spacing.lg;
  const rightX = width - FAB_SIZE - Spacing.lg;
  const minTop = insets.top + Spacing.sm;
  // Never over the tab bar or the screen's own bottom bar
  const maxTop = Math.max(minTop, height - bottom - FAB_SIZE);
  const clampTop = (top: number) => Math.min(maxTop, Math.max(minTop, top));

  const x = useSharedValue(fabSpot?.side === 'left' ? leftX : rightX);
  const y = useSharedValue(clampTop(fabSpot?.top ?? maxTop));
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // A new page (other bottom bar) or a turned phone: keep the side, stay inside the allowed area
  useEffect(() => {
    x.value = withTiming(fabSpot?.side === 'left' ? leftX : rightX, { duration: 200 });
    y.value = withTiming(Math.min(maxTop, Math.max(minTop, fabSpot?.top ?? maxTop)), { duration: 200 });
  }, [leftX, rightX, minTop, maxTop, x, y]);

  const saveSpot = (side: 'left' | 'right', top: number) => { fabSpot = { side, top }; };

  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = x.value;
      startY.value = y.value;
    })
    .onUpdate(event => {
      x.value = startX.value + event.translationX;
      y.value = Math.min(maxTop, Math.max(minTop, startY.value + event.translationY));
    })
    .onEnd(() => {
      const side = x.value + FAB_SIZE / 2 < width / 2 ? 'left' : 'right';
      x.value = withSpring(side === 'left' ? leftX : rightX, { damping: 18 });
      runOnJS(saveSpot)(side, y.value);
    });
  const tap = Gesture.Tap().onEnd(() => { runOnJS(onOpen)(); });
  const gesture = Gesture.Race(pan, tap);

  const position = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }] }));
  const { kind, failed } = summary;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.fabSpot, position]}>
        <Animated.View
          entering={ZoomIn.duration(180)}
          exiting={ZoomOut.duration(150)}
          accessible
          accessibilityRole="button"
          accessibilityLabel={[summary.title, summary.subtitle].filter(Boolean).join('. ')}
          accessibilityHint="Shows the upload details"
          accessibilityActions={[{ name: 'activate' }]}
          onAccessibilityAction={onOpen}
          style={styles.fab}
        >
          <ProgressRing size={FAB_RING_SIZE} {...ring}>
            {kind === 'uploading'
              ? <Text style={styles.fabPercent}>{summary.percent}%</Text>
              : <IconSymbol name={icon.icon} size={18} color={icon.color} />}
          </ProgressRing>
          {failed.length > 0 && kind !== 'failed' && (
            <View style={[styles.badge, { backgroundColor: colors.dangerStrong }]}>
              <Text style={styles.badgeText}>{failed.length}</Text>
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** A ring that fills to `value` (0-100), or a turning arc while videos are being prepared (a still ring with Reduce Motion) */
function ProgressRing({ size, value, indeterminate, color, trackColor, dimmed, children }: RingProps & {
  size: number;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const radius = (size - RING_STROKE) / 2;
  const length = 2 * Math.PI * radius;
  const progress = useSharedValue(value);
  const spin = useSharedValue(0);

  useEffect(() => {
    progress.value = reduceMotion ? value : withTiming(value, { duration: 400, easing: Easing.out(Easing.cubic) });
  }, [value, reduceMotion, progress]);

  useEffect(() => {
    if (!indeterminate || reduceMotion) return;
    spin.value = 0;
    spin.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.linear }), -1, false);
    return () => {
      cancelAnimation(spin);
      spin.value = 0;
    };
  }, [indeterminate, reduceMotion, spin]);

  const arc = useAnimatedProps(() => ({
    strokeDashoffset: indeterminate ? (reduceMotion ? 0 : length * 0.72) : length * (1 - progress.value / 100),
  }));
  const turning = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));

  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="progressbar"
      accessibilityValue={indeterminate ? undefined : { min: 0, max: 100, now: value }}
    >
      <Animated.View style={[StyleSheet.absoluteFill, turning]}>
        {/* Starts at 12 o'clock */}
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={RING_STROKE} fill="none" />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={`${length} ${length}`}
            fill="none"
            opacity={dimmed || (indeterminate && reduceMotion) ? 0.5 : 1}
            animatedProps={arc}
          />
        </Svg>
      </Animated.View>
      {children}
    </View>
  );
}

const RING_SIZE = 36;
const ROW_HEIGHT = 52;
const THUMB_SIZE = 36;
const RING_STROKE = 3.5;
const FAB_SIZE = 56;
const FAB_RING_SIZE = 46;
const ICON_BUTTON_SIZE = 32;

// Soft fills behind buttons and icons: the same hue as the icon, pale on dark, deeper on light (todo #1)
const getWashes = (c: typeof MidnightColors, isDark: boolean) => ({
  neutral: c.tint(isDark ? 0.08 : 0.06),
  gold: isDark ? 'rgba(202, 156, 104, 0.14)' : 'rgba(165, 118, 54, 0.1)',
  warning: isDark ? 'rgba(251, 191, 36, 0.14)' : 'rgba(146, 64, 14, 0.1)',
  danger: isDark ? 'rgba(248, 113, 113, 0.14)' : 'rgba(185, 28, 28, 0.08)',
  success: isDark ? 'rgba(34, 197, 94, 0.14)' : 'rgba(22, 101, 52, 0.1)',
});

const getStyles = (c: typeof MidnightColors, isDark: boolean) => {
  const raised = {
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: isDark ? 0.35 : 0.15,
    shadowRadius: 12,
    elevation: 6,
  };
  return StyleSheet.create({
    card: {
      ...raised,
      position: 'absolute',
      left: Spacing.lg,
      right: Spacing.lg,
      borderRadius: Radius.lg,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.md,
      paddingLeft: Spacing.md,
      paddingRight: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    list: {
      maxHeight: ROW_HEIGHT * 4.5,
    },
    listContent: {
      paddingVertical: Spacing.xs,
    },
    fileRow: {
      height: ROW_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingLeft: Spacing.md,
      paddingRight: Spacing.sm,
    },
    thumb: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: Radius.sm,
      backgroundColor: c.tint(isDark ? 0.08 : 0.06),
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    fileMain: {
      flex: 1,
      gap: 6,
      marginLeft: Spacing.xs,
    },
    fileLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    fileLabelWrap: {
      flex: 1,
    },
    fileLabel: {
      color: c.white,
      fontSize: FontSize.small,
      fontFamily: FontFamily.medium,
    },
    fileMeta: {
      color: c.slate400,
      fontSize: FontSize.footnote,
      fontFamily: FontFamily.regular,
      fontVariant: ['tabular-nums'],
    },
    fileTrack: {
      height: 3,
      borderRadius: 2,
      overflow: 'hidden',
      backgroundColor: c.tint(isDark ? 0.1 : 0.08),
    },
    fileFill: {
      height: '100%',
      borderRadius: 2,
    },
    rowIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    smallButton: {
      minHeight: 24,
      paddingHorizontal: Spacing.sm,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    smallButtonText: {
      fontSize: FontSize.footnote,
      fontFamily: FontFamily.semiBold,
    },
    texts: {
      flex: 1,
      gap: 2,
      marginLeft: Spacing.xs,
    },
    title: {
      color: c.white,
      fontSize: FontSize.body2,
      fontFamily: FontFamily.semiBold,
    },
    subtitle: {
      color: c.slate400,
      fontSize: FontSize.footnote,
      lineHeight: 16,
      fontFamily: FontFamily.regular,
      fontVariant: ['tabular-nums'],
    },
    iconButton: {
      width: ICON_BUTTON_SIZE,
      height: ICON_BUTTON_SIZE,
      borderRadius: ICON_BUTTON_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    button: {
      minHeight: ICON_BUTTON_SIZE,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: {
      color: c.slate300,
      fontSize: FontSize.small,
      fontFamily: FontFamily.semiBold,
    },
    pressed: {
      opacity: 0.7,
    },
    fabSpot: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: FAB_SIZE,
      height: FAB_SIZE,
    },
    fab: {
      ...raised,
      width: FAB_SIZE,
      height: FAB_SIZE,
      borderRadius: FAB_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fabPercent: {
      color: c.white,
      fontSize: FontSize.caption,
      fontFamily: FontFamily.bold,
      fontVariant: ['tabular-nums'],
    },
    badge: {
      position: 'absolute',
      top: -2,
      right: -2,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: FontSize.micro,
      fontFamily: FontFamily.bold,
    },
  });
};
