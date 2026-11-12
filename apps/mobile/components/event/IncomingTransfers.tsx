import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MidnightColors } from '../../constants/theme';
import { useAppTheme } from '../../context/ThemeContext';
import { formatStorageSize } from '../../lib/planLimits';
import { eventTransfers, formatTransferExpiry, type IncomingTransfer } from '../../lib/eventTransfers';

/** Dashboard: events someone wants to hand to this user. Rechecked on coming back, for example after upgrading. */
export default function IncomingTransfers({ onAccepted }: { onAccepted: () => void }) {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [requests, setRequests] = useState<IncomingTransfer[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useFocusEffect(useCallback(() => {
    let active = true;
    void eventTransfers.fetchIncomingTransfers().then(next => { if (active) setRequests(next); });
    return () => { active = false; };
  }, []));

  if (requests.length === 0) return null;

  const decide = async (id: string, work: (id: string) => ReturnType<typeof eventTransfers.acceptTransfer>, accepted: boolean) => {
    setBusyId(id);
    setErrors(current => ({ ...current, [id]: '' }));
    const result = await work(id);
    if (result.ok) {
      if (accepted) onAccepted();
    } else {
      setErrors(current => ({ ...current, [id]: result.error }));
    }
    setRequests(await eventTransfers.fetchIncomingTransfers());
    setBusyId(null);
  };

  return (
    <View style={styles.list}>
      {requests.map(request => (
        <View key={request.id} style={styles.card}>
          <Text style={styles.title}>{request.fromName} wants to transfer “{request.eventTitle}” to you</Text>
          <Text style={styles.note}>
            This event needs {formatStorageSize(request.sizeBytes)}.
            {request.freeBytes !== null && ` You have ${formatStorageSize(request.freeBytes)} free.`}
            {request.keepOldOwnerAsAdmin && ' They stay on as an admin.'}
            {` Expires on ${formatTransferExpiry(request.expiresAt)}.`}
          </Text>
          {!request.canAccept && <Text style={styles.block}>{request.blockMessage}</Text>}
          {!!errors[request.id] && <Text accessibilityRole="alert" style={styles.error}>{errors[request.id]}</Text>}
          <View style={styles.buttons}>
            {request.canAccept ? (
              <TouchableOpacity accessibilityRole="button" disabled={busyId === request.id} onPress={() => decide(request.id, eventTransfers.acceptTransfer, true)} style={[styles.primaryButton, busyId === request.id && styles.disabled]}>
                <Text style={styles.primaryText}>Accept</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/(tabs)/pricing')} style={styles.primaryButton}>
                <Text style={styles.primaryText}>{request.block === 'plan_expired' ? 'Renew plan' : 'Upgrade plan'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity accessibilityRole="button" disabled={busyId === request.id} onPress={() => decide(request.id, eventTransfers.declineTransfer, false)} style={[styles.secondaryButton, busyId === request.id && styles.disabled]}>
              <Text style={styles.secondaryText}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

const getStyles = (colors: typeof MidnightColors, isDark: boolean) => StyleSheet.create({
  list: { gap: 12, paddingHorizontal: 16, paddingTop: 12 },
  card: { padding: 16, gap: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  note: { color: colors.slate400, fontSize: 13, lineHeight: 19 },
  block: { color: colors.warning, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  error: { color: isDark ? '#FB7185' : colors.danger, fontSize: 13 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 6 },
  primaryButton: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: 22, backgroundColor: colors.goldFill },
  primaryText: { color: colors.onAccent, fontSize: 14, fontWeight: '700' },
  secondaryButton: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border },
  secondaryText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.6 },
});
