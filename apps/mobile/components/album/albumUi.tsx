import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { AlbumPageStatus, AlbumStatus } from '../../lib/albumApi';
import { Fonts, MidnightColors } from '../../constants/theme';
import { useAppTheme } from '../../context/ThemeContext';

type Look = { label: string; color: string; background: string; border: string };

// Status colours: pale tints on the dark look, deeper shades of the same colours on the light one (todo #1)
const pageStatusLooks = (c: typeof MidnightColors, isDark: boolean): Record<AlbumPageStatus, Look> => ({
  draft: { label: 'Not sent', color: c.slate300, background: c.tint(0.06), border: c.tint(0.15) },
  pending: { label: 'Waiting for review', color: isDark ? '#E8C9A0' : c.gold, background: 'rgba(202,156,104,0.1)', border: 'rgba(202,156,104,0.4)' },
  approved: { label: 'Approved', color: isDark ? '#A7F3D0' : c.success, background: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.4)' },
  changes_requested: { label: 'Changes requested', color: isDark ? '#FECDD3' : c.danger, background: 'rgba(251,113,133,0.1)', border: 'rgba(251,113,133,0.4)' },
});

/** The album screens' colours and shared styles for the current look */
export function useAlbumLook() {
  const { colors, isDark } = useAppTheme();
  return useMemo(() => ({
    colors,
    isDark,
    albumStyles: getAlbumStyles(colors, isDark),
    styles: getStyles(colors, isDark),
    pageStatus: pageStatusLooks(colors, isDark),
  }), [colors, isDark]);
}

const ALBUM_STATUS: Record<AlbumStatus, AlbumPageStatus> = {
  draft: 'draft',
  in_review: 'pending',
  changes_requested: 'changes_requested',
  approved: 'approved',
};
const ALBUM_LABEL: Record<AlbumStatus, string> = {
  draft: 'Draft',
  in_review: 'In review',
  changes_requested: 'Changes requested',
  approved: 'Approved for print',
};

function Chip({ label, look }: { label: string; look: Look }) {
  const { styles } = useAlbumLook();
  return (
    <View style={[styles.chip, { backgroundColor: look.background, borderColor: look.border }]}>
      <Text style={[styles.chipText, { color: look.color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function PageStatusChip({ status }: { status: AlbumPageStatus }) {
  const { pageStatus } = useAlbumLook();
  return <Chip label={pageStatus[status].label} look={pageStatus[status]} />;
}

export function AlbumStatusChip({ status }: { status: AlbumStatus }) {
  const { pageStatus } = useAlbumLook();
  return <Chip label={ALBUM_LABEL[status]} look={pageStatus[ALBUM_STATUS[status]]} />;
}

export function ProgressBar({ value, total }: { value: number; total: number }) {
  const { colors, styles } = useAlbumLook();
  const percent = total > 0 ? (value / total) * 100 : 0;
  return (
    <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: value }}>
      <View style={[styles.fill, { width: `${percent}%`, backgroundColor: percent === 100 ? '#34D399' : colors.goldFill }]} />
    </View>
  );
}

export function AlbumButton({ label, icon, onPress, kind = 'secondary', disabled, busy, style }: {
  label: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, styles } = useAlbumLook();
  const color = kind === 'primary' ? colors.onAccent : kind === 'success' || kind === 'danger' ? '#FFFFFF' : kind === 'ghost' ? colors.slate300 : colors.text;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      style={[styles.button, styles[kind], (disabled || busy) && { opacity: 0.5 }, style]}
    >
      {busy ? <ActivityIndicator size="small" color={color} /> : icon ? <MaterialIcons name={icon} size={18} color={kind === 'secondary' ? colors.gold : color} /> : null}
      <Text style={[styles.buttonText, { color }, kind === 'ghost' && styles.ghostText]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

const getAlbumStyles = (c: typeof MidnightColors, isDark: boolean) => StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.tint(0.1),
    backgroundColor: isDark ? c.surface : c.card,
    overflow: 'hidden',
  },
  heading: { color: c.text, fontSize: 20, fontFamily: Fonts.outfit.extraBold },
  serifTitle: { color: c.text, fontSize: 22, fontFamily: Fonts.playfair.bold },
  body: { color: c.slate400, fontSize: 13, fontFamily: Fonts.outfit.semiBold, lineHeight: 19 },
  small: { color: c.slate600, fontSize: 12, fontFamily: Fonts.outfit.semiBold },
  eyebrow: { color: c.slate600, fontSize: 10, fontFamily: Fonts.outfit.extraBold, letterSpacing: 1.6, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: c.tint(0.15),
    backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : c.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: c.text,
    fontSize: 15,
    fontFamily: Fonts.outfit.semiBold,
  },
});

const getStyles = (c: typeof MidnightColors, isDark: boolean) => StyleSheet.create({
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, alignSelf: 'flex-start' },
  chipText: { fontSize: 9, fontFamily: Fonts.outfit.extraBold, letterSpacing: 1.1, textTransform: 'uppercase' },
  track: { height: 6, borderRadius: 3, backgroundColor: c.tint(0.1), overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: '#34D399' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  primary: { backgroundColor: c.goldFill },
  secondary: { borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.15)' : c.border },
  success: { backgroundColor: '#10B981' },
  danger: { backgroundColor: c.dangerStrong },
  ghost: { paddingHorizontal: 10, paddingVertical: 8 },
  buttonText: { fontSize: 13, fontFamily: Fonts.outfit.extraBold, letterSpacing: 0.6, textTransform: 'uppercase' },
  ghostText: { textTransform: 'none', letterSpacing: 0, fontFamily: Fonts.outfit.bold },
});
