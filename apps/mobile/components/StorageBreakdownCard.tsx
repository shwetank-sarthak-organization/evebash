import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAppTheme } from '@/context/ThemeContext';
import { formatStorageSize, getUsagePercent } from '@/lib/planLimits';
import type { StorageBreakdown } from '@/lib/database';

const EVENT_COLOR = '#CA9C68';
const VAULT_COLOR = '#7FA38C';

interface StorageBreakdownCardProps {
  usage: StorageBreakdown | null;
  planBytes: number;
  planLabel: string;
}

// Events and EB Vault draw from the same plan storage, so both are shown against one limit.
export function StorageBreakdownCard({ usage, planBytes, planLabel }: StorageBreakdownCardProps) {
  const { colors } = useAppTheme();
  const loading = usage === null;
  const totals = usage ?? { events: 0, vault: 0, total: 0 };
  const unlimited = planBytes === Infinity;
  const percent = getUsagePercent(totals.total, planBytes);
  const overLimit = !unlimited && totals.total > planBytes;
  const remaining = unlimited ? Infinity : Math.max(planBytes - totals.total, 0);
  const eventShare = totals.total > 0 ? (totals.events / totals.total) * percent : 0;
  const vaultShare = totals.total > 0 ? (totals.vault / totals.total) * percent : 0;

  const [eventsOpen, setEventsOpen] = useState(false);
  const parts = usage?.eventParts;
  // Album designs only exist with album proofing, so that line shows up only once there are some.
  const eventParts = parts ? [
    { label: 'Photos', bytes: parts.photos, icon: 'photo' },
    { label: 'Videos', bytes: parts.videos, icon: 'video.fill' },
    { label: 'Voice notes', bytes: parts.voiceNotes, icon: 'mic.fill' },
    ...(parts.albumDesigns > 0 ? [{ label: 'Album designs', bytes: parts.albumDesigns, icon: 'book.fill' }] : []),
  ] : [];
  const canExpand = eventParts.length > 0;

  return (
    <View style={[styles.card, { borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.eyebrow, { color: colors.slate400 }]}>STORAGE</Text>
        <Text style={[styles.planText, { color: colors.slate400 }]}>{planLabel} plan</Text>
      </View>

      <Text style={[styles.total, { color: colors.text }]}>
        {loading ? '…' : formatStorageSize(totals.total)}
        <Text style={[styles.totalSuffix, { color: colors.slate400 }]}> of {unlimited ? 'Unlimited' : planLabel} used</Text>
      </Text>

      {!unlimited && (
        <View
          style={[styles.track, { backgroundColor: colors.slate800 }]}
          accessibilityRole="progressbar"
          accessibilityLabel="Storage used"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }}
        >
          <View style={{ width: `${eventShare}%`, backgroundColor: EVENT_COLOR }} />
          <View style={{ width: `${vaultShare}%`, backgroundColor: VAULT_COLOR }} />
        </View>
      )}

      <Pressable
        style={styles.row}
        disabled={!canExpand}
        onPress={() => setEventsOpen((open) => !open)}
        accessibilityRole={canExpand ? 'button' : undefined}
        accessibilityState={canExpand ? { expanded: eventsOpen } : undefined}
        hitSlop={6}
      >
        <View style={styles.rowLabel}>
          <View style={[styles.swatch, { backgroundColor: EVENT_COLOR }]} />
          <IconSymbol name="calendar" size={14} color={colors.slate400} />
          <Text style={[styles.rowText, { color: colors.text }]}>Event Storage</Text>
        </View>
        <View style={styles.rowLabel}>
          <Text style={[styles.rowValue, { color: colors.text }]}>{loading ? '…' : formatStorageSize(totals.events)}</Text>
          {canExpand && <IconSymbol name={eventsOpen ? 'chevron.up' : 'chevron.down'} size={16} color={colors.slate400} />}
        </View>
      </Pressable>

      {eventsOpen && canExpand && (
        <View style={[styles.parts, { borderColor: colors.border }]}>
          {eventParts.map((part) => (
            <View key={part.label} style={styles.row}>
              <View style={styles.rowLabel}>
                <IconSymbol name={part.icon as any} size={13} color={colors.slate400} />
                <Text style={[styles.partText, { color: colors.slate400 }]}>{part.label}</Text>
              </View>
              <Text style={[styles.partValue, { color: colors.text }]}>{formatStorageSize(part.bytes)}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.row}>
        <View style={styles.rowLabel}>
          <View style={[styles.swatch, { backgroundColor: VAULT_COLOR }]} />
          <IconSymbol name="lock.fill" size={14} color={colors.slate400} />
          <Text style={[styles.rowText, { color: colors.text }]}>Vault Storage</Text>
        </View>
        <Text style={[styles.rowValue, { color: colors.text }]}>{loading ? '…' : formatStorageSize(totals.vault)}</Text>
      </View>

      <Text style={[styles.note, { color: overLimit ? '#fca5a5' : colors.slate400 }]}>
        {overLimit
          ? "You're over your plan's storage. Existing files are safe, but new uploads are paused until you free up space or upgrade."
          : unlimited
            ? 'Events and EB Vault share your plan storage.'
            : `${formatStorageSize(remaining)} free · Events and EB Vault share your plan storage.`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  planText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  total: { fontSize: 20, fontFamily: 'Outfit_700Bold' },
  totalSuffix: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  track: { height: 10, borderRadius: 5, overflow: 'hidden', flexDirection: 'row' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  rowText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  rowValue: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  parts: { borderLeftWidth: 1, marginLeft: 4, paddingLeft: 14, gap: 8 },
  partText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  partValue: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  note: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 },
});
