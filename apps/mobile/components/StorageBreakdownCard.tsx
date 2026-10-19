import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
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

  const rows = [
    { label: 'Event Storage', bytes: totals.events, color: EVENT_COLOR, icon: 'calendar' },
    { label: 'Vault Storage', bytes: totals.vault, color: VAULT_COLOR, icon: 'lock.fill' },
  ] as const;

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

      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <View style={styles.rowLabel}>
            <View style={[styles.swatch, { backgroundColor: row.color }]} />
            <IconSymbol name={row.icon as any} size={14} color={colors.slate400} />
            <Text style={[styles.rowText, { color: colors.text }]}>{row.label}</Text>
          </View>
          <Text style={[styles.rowValue, { color: colors.text }]}>{loading ? '…' : formatStorageSize(row.bytes)}</Text>
        </View>
      ))}

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
  note: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 },
});
