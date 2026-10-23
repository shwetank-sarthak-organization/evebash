import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { AlbumPageStatus, AlbumStatus } from '../../lib/albumApi';
import { Fonts, MidnightColors } from '../../constants/theme';

const PAGE_STATUS: Record<AlbumPageStatus, { label: string; color: string; background: string; border: string }> = {
  draft: { label: 'Not sent', color: MidnightColors.slate300, background: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.15)' },
  pending: { label: 'Waiting for review', color: '#E8C9A0', background: 'rgba(202,156,104,0.1)', border: 'rgba(202,156,104,0.4)' },
  approved: { label: 'Approved', color: '#A7F3D0', background: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.4)' },
  changes_requested: { label: 'Changes requested', color: '#FECDD3', background: 'rgba(251,113,133,0.1)', border: 'rgba(251,113,133,0.4)' },
};

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

function Chip({ label, look }: { label: string; look: (typeof PAGE_STATUS)[AlbumPageStatus] }) {
  return (
    <View style={[styles.chip, { backgroundColor: look.background, borderColor: look.border }]}>
      <Text style={[styles.chipText, { color: look.color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export const PageStatusChip = ({ status }: { status: AlbumPageStatus }) => <Chip label={PAGE_STATUS[status].label} look={PAGE_STATUS[status]} />;
export const AlbumStatusChip = ({ status }: { status: AlbumStatus }) => <Chip label={ALBUM_LABEL[status]} look={PAGE_STATUS[ALBUM_STATUS[status]]} />;

export function ProgressBar({ value, total }: { value: number; total: number }) {
  const percent = total > 0 ? (value / total) * 100 : 0;
  return (
    <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: value }}>
      <View style={[styles.fill, { width: `${percent}%` }]} />
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
  const color = kind === 'primary' ? MidnightColors.onAccent : kind === 'success' || kind === 'danger' ? '#FFFFFF' : kind === 'ghost' ? MidnightColors.slate300 : MidnightColors.text;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      style={[styles.button, styles[kind], (disabled || busy) && { opacity: 0.5 }, style]}
    >
      {busy ? <ActivityIndicator size="small" color={color} /> : icon ? <MaterialIcons name={icon} size={18} color={kind === 'secondary' ? MidnightColors.gold : color} /> : null}
      <Text style={[styles.buttonText, { color }, kind === 'ghost' && styles.ghostText]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

export const albumStyles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: MidnightColors.surface,
    overflow: 'hidden',
  },
  heading: { color: MidnightColors.text, fontSize: 20, fontFamily: Fonts.outfit.extraBold },
  serifTitle: { color: MidnightColors.text, fontSize: 22, fontFamily: Fonts.playfair.bold },
  body: { color: MidnightColors.slate400, fontSize: 13, fontFamily: Fonts.outfit.semiBold, lineHeight: 19 },
  small: { color: MidnightColors.slate600, fontSize: 12, fontFamily: Fonts.outfit.semiBold },
  eyebrow: { color: MidnightColors.slate600, fontSize: 10, fontFamily: Fonts.outfit.extraBold, letterSpacing: 1.6, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: MidnightColors.text,
    fontSize: 15,
    fontFamily: Fonts.outfit.semiBold,
  },
});

const styles = StyleSheet.create({
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, alignSelf: 'flex-start' },
  chipText: { fontSize: 9, fontFamily: Fonts.outfit.extraBold, letterSpacing: 1.1, textTransform: 'uppercase' },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
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
  primary: { backgroundColor: MidnightColors.gold },
  secondary: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  success: { backgroundColor: '#10B981' },
  danger: { backgroundColor: MidnightColors.dangerStrong },
  ghost: { paddingHorizontal: 10, paddingVertical: 8 },
  buttonText: { fontSize: 13, fontFamily: Fonts.outfit.extraBold, letterSpacing: 0.6, textTransform: 'uppercase' },
  ghostText: { textTransform: 'none', letterSpacing: 0, fontFamily: Fonts.outfit.bold },
});
