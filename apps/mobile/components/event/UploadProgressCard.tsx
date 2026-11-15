import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  FadeOutDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { IconSymbol, type IconSymbolName } from '../ui/icon-symbol';
import { MidnightColors } from '../../constants/theme';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius, Spacing } from '../../constants/layout';
import { useAppTheme } from '../../context/ThemeContext';
import { appAlert } from '../../lib/feedback';
import { haptic } from '../../lib/haptics';
import { formatStorageSize } from '../../lib/planLimits';
import {
  clearFinishedUploads,
  resetUploadQueue,
  retryUploadItem,
  uploadErrorMessage,
  WAITING_FOR_CONNECTION,
  type UploadQueueItem,
} from '../../lib/uploadQueue';

type Kind = 'uploading' | 'offline' | 'preparing' | 'failed' | 'finishing';

const STILL_UPLOADING = new Set<UploadQueueItem['status']>(['pending', 'uploading', 'uploaded_pending_metadata', 'upload_needs_reconciliation']);

/** "1 photo", "3 videos", "12 photos and videos" */
const countLabel = (items: UploadQueueItem[]) => {
  const n = items.length;
  if (items.every(item => item.mediaType === 'photo')) return `${n} ${n === 1 ? 'photo' : 'photos'}`;
  if (items.every(item => item.mediaType === 'video')) return `${n} ${n === 1 ? 'video' : 'videos'}`;
  return `${n} photos and videos`;
};

// The queue's progress runs 0-90 while a file uploads (the rest is the save); a saved file counts as fully uploaded
const uploadedFraction = (item: UploadQueueItem) =>
  item.status === 'processing' || item.status === 'completed' ? 1 : Math.min(1, (item.progress || 0) / 90);

// One big file (a long video) shows its size; whole MB so the line doesn't flicker on every tick
const BIG_FILE_BYTES = 20 * 1024 * 1024;
const wholeMB = (bytes: number) => formatStorageSize(Math.round(bytes / (1024 * 1024)) * 1024 * 1024);

const showWhyItFailed = (failed: UploadQueueItem[]) => {
  const shown = failed.slice(0, 5).map(item => `${item.fileName}: ${uploadErrorMessage(item.error)}`);
  if (failed.length > shown.length) shown.push(`...and ${failed.length - shown.length} more`);
  appAlert("Why it didn't upload", shown.join('\n\n'));
};

/**
 * The upload bar at the bottom of a gallery in the host view (issue #273): one plain line per state, an icon,
 * counts of every file in this gallery's queue (all sets, so a second set doesn't push it past the total) and
 * a bar weighted by file size. `items` are the queue items for the gallery on screen.
 */
export function UploadProgressCard({ items, bottom }: { items: UploadQueueItem[]; bottom: number }) {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const wash = useMemo(() => getWashes(colors, isDark), [colors, isDark]);
  // Hide only lasts until the queue changes (new files, or a file fails)
  const [hiddenFor, setHiddenFor] = useState<string | null>(null);

  const state = useMemo(() => {
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
        subtitle = `Uploaded. ${videosPreparing.length === 1 ? "It'll" : "They'll"} appear when ready, even if you leave.`;
        break;
      case 'failed':
        title = `${countLabel(failed)} didn't upload`;
        subtitle = uploaded.length ? `${uploaded.length} of ${items.length} uploaded` : '';
        break;
      case 'finishing':
        title = `${countLabel(uploaded)} uploaded`;
        subtitle = 'Finishing up. You can leave this screen.';
        break;
    }

    return { kind, failed, title, subtitle, percent, key: `${items.map(item => item.id).join(',')}:${failed.length}` };
  }, [items]);

  const { kind, failed, title, subtitle, percent, key } = state;
  if (!kind || hiddenFor === key) return null;

  const look: Record<Kind, { icon: IconSymbolName; color: string; wash: string }> = {
    uploading: { icon: 'icloud.and.arrow.up.fill', color: colors.gold, wash: wash.gold },
    offline: { icon: 'wifi.slash', color: colors.warning, wash: wash.warning },
    preparing: { icon: 'clock.fill', color: colors.gold, wash: wash.gold },
    failed: { icon: 'exclamationmark.triangle.fill', color: colors.dangerSoft, wash: wash.danger },
    finishing: { icon: 'checkmark.circle.fill', color: colors.success, wash: wash.success },
  };

  const cancelUploads = () => appAlert(
    'Cancel uploads?',
    "Files that haven't finished uploading won't be sent.",
    [
      { text: 'Keep uploading', style: 'cancel' },
      { text: 'Cancel uploads', style: 'destructive', onPress: () => { void resetUploadQueue(); } },
    ],
  );

  const retry = async () => {
    haptic('tap');
    for (const item of failed) await retryUploadItem(item.id);
  };

  const secondary = kind === 'uploading' || kind === 'offline'
    ? { label: 'Cancel', a11y: 'Cancel uploads', onPress: cancelUploads }
    : kind === 'failed'
      ? { label: 'Dismiss', a11y: 'Dismiss failed uploads', onPress: () => { void clearFinishedUploads(); } }
      : { label: 'Hide', a11y: 'Hide upload status', onPress: () => setHiddenFor(key) };

  const retryButton = (
    <Pressable
      onPress={retry}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel="Retry failed uploads"
      style={({ pressed }) => [styles.button, { backgroundColor: wash.danger }, pressed && styles.pressed]}
    >
      <Text style={[styles.buttonText, { color: colors.dangerSoft }]}>Retry</Text>
    </Pressable>
  );

  const whyLink = (label: string, a11y: string) => (
    <Pressable
      onPress={() => showWhyItFailed(failed)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.whyLink, pressed && styles.pressed]}
    >
      <Text style={styles.whyText} numberOfLines={1}>{label}</Text>
    </Pressable>
  );

  const secondaryButton = (
    <Pressable
      onPress={secondary.onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={secondary.a11y}
      style={({ pressed }) => [styles.button, { backgroundColor: wash.neutral }, pressed && styles.pressed]}
    >
      <Text style={styles.buttonText}>{secondary.label}</Text>
    </Pressable>
  );

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOutDown.duration(180)}
      accessibilityLiveRegion="polite"
      style={[styles.card, { bottom }]}
    >
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: look[kind].wash }]}>
          <IconSymbol name={look[kind].icon} size={18} color={look[kind].color} />
        </View>
        <View style={styles.texts}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {!!subtitle && <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>}
        </View>
        {kind !== 'failed' && secondaryButton}
      </View>
      {kind !== 'failed' && (
        <ProgressTrack
          value={kind === 'finishing' ? 100 : percent}
          indeterminate={kind === 'preparing'}
          color={kind === 'finishing' ? colors.success : colors.goldFill}
          dimmed={kind === 'offline'}
          styles={styles}
        />
      )}
      {/* Failed files get their own row with the reason and Retry, so the title and counts above stay readable */}
      {failed.length > 0 && (
        <View style={styles.failureRow}>
          {kind === 'failed'
            ? whyLink('See why', "See why they didn't upload")
            : whyLink(`${failed.length} didn't upload · See why`, `${countLabel(failed)} didn't upload. See why`)}
          <View style={styles.actions}>
            {kind === 'failed' && secondaryButton}
            {retryButton}
          </View>
        </View>
      )}
    </Animated.View>
  );
}

/** The bar: eases between values, or slides back and forth while videos are being prepared (still when Reduce Motion is on) */
function ProgressTrack({ value, indeterminate, color, dimmed, styles }: {
  value: number;
  indeterminate: boolean;
  color: string;
  dimmed: boolean;
  styles: ReturnType<typeof getStyles>;
}) {
  const reduceMotion = useReducedMotion();
  const width = useSharedValue(value);
  const slide = useSharedValue(0);

  useEffect(() => {
    width.value = reduceMotion ? value : withTiming(value, { duration: 400, easing: Easing.out(Easing.cubic) });
  }, [value, reduceMotion, width]);

  useEffect(() => {
    if (!indeterminate || reduceMotion) return;
    slide.value = 0;
    slide.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), -1, false);
    return () => cancelAnimation(slide);
  }, [indeterminate, reduceMotion, slide]);

  const fill = useAnimatedStyle(() => {
    if (!indeterminate) return { left: '0%', width: `${width.value}%`, opacity: dimmed ? 0.45 : 1 };
    if (reduceMotion) return { left: '0%', width: '100%', opacity: 0.5 };
    return { left: `${slide.value * 135 - 35}%`, width: '35%', opacity: 1 };
  });

  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityValue={indeterminate ? undefined : { min: 0, max: 100, now: value }}
    >
      <Animated.View style={[styles.fill, { backgroundColor: color }, fill]} />
    </View>
  );
}

const ICON_SIZE = 36;

// Soft fills behind the state icon and the buttons: the same hue as the icon, pale on dark, deeper on light (todo #1)
const getWashes = (c: typeof MidnightColors, isDark: boolean) => ({
  neutral: c.tint(isDark ? 0.08 : 0.06),
  gold: isDark ? 'rgba(202, 156, 104, 0.14)' : 'rgba(165, 118, 54, 0.1)',
  warning: isDark ? 'rgba(251, 191, 36, 0.14)' : 'rgba(146, 64, 14, 0.1)',
  danger: isDark ? 'rgba(248, 113, 113, 0.14)' : 'rgba(185, 28, 28, 0.08)',
  success: isDark ? 'rgba(34, 197, 94, 0.14)' : 'rgba(22, 101, 52, 0.1)',
});

const getStyles = (c: typeof MidnightColors, isDark: boolean) => StyleSheet.create({
  card: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 999,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: isDark ? 0.35 : 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconWrap: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    gap: 2,
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
  whyLink: {
    flexShrink: 1,
  },
  failureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    marginLeft: ICON_SIZE + Spacing.md,
  },
  whyText: {
    color: c.dangerSoft,
    fontSize: FontSize.footnote,
    lineHeight: 16,
    fontFamily: FontFamily.semiBold,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  button: {
    minHeight: 32,
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
  track: {
    height: 4,
    marginTop: Spacing.md,
    marginLeft: ICON_SIZE + Spacing.md,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: c.tint(isDark ? 0.1 : 0.08),
  },
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 2,
  },
});
