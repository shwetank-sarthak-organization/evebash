import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MidnightColors } from '../../constants/theme';
import { useAppTheme } from '../../context/ThemeContext';
import { formatStorageSize } from '../../lib/planLimits';
import { eventTransfers, formatTransferExpiry, type EventTransferStatus } from '../../lib/eventTransfers';

/** Event > Permissions; keyed by event. Shows nothing unless the backend says this user can transfer the event. */
export default function TransferOwnershipCard({ eventId }: { eventId: string }) {
  const { colors, isDark } = useAppTheme();
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [status, setStatus] = useState<EventTransferStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [keepAdmin, setKeepAdmin] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void eventTransfers.fetchEventTransfer(eventId).then(next => { if (active) setStatus(next); });
    return () => { active = false; };
  }, [eventId]);

  if (!status) return null;

  const run = async (work: () => ReturnType<typeof eventTransfers.cancelTransfer>) => {
    setBusy(true); setError('');
    const result = await work();
    if (result.ok) {
      setEmail('');
      setStatus(await eventTransfers.fetchEventTransfer(eventId));
    } else {
      setError(result.error);
    }
    setBusy(false);
  };

  const size = formatStorageSize(status.sizeBytes);
  const { pending } = status;

  return (
    <View style={styles.card}>
      {pending ? (
        <>
          <Text style={styles.title}>Transfer waiting for {pending.toName || pending.toEmail || 'the new owner'}</Text>
          <Text style={styles.note}>
            Uploads to this event are paused until they accept or decline. The request expires on {formatTransferExpiry(pending.expiresAt)}.
            {!pending.receiverReady && " Their plan can't take this event yet, so they need to free up space or upgrade first."}
          </Text>
          <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => run(() => eventTransfers.cancelTransfer(pending.id))} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>{busy ? 'Cancelling…' : 'Cancel transfer'}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)}>
            <Text style={styles.title}>Transfer ownership {open ? '▴' : '▾'}</Text>
            <Text style={styles.note}>Hand this event to another EveBash user. It uses {size}.</Text>
          </TouchableOpacity>
          {open && (
            <View style={styles.form}>
              <Text style={styles.note}>
                They have 7 days to accept, and need {size} free on their plan. When they accept, the event and its sub-galleries become theirs, and the space comes off your plan and counts on theirs. Uploads to the event pause until then.
              </Text>
              <TextInput
                accessibilityLabel="New owner's email"
                value={email}
                onChangeText={setEmail}
                placeholder="New owner's email"
                placeholderTextColor={colors.slate600}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                style={styles.input}
              />
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Keep the current owner on as an admin</Text>
                <Switch accessibilityLabel="Keep the current owner on as an admin" value={keepAdmin} onValueChange={setKeepAdmin} trackColor={{ true: colors.goldFill }} />
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={busy || !email.trim()}
                onPress={() => run(() => eventTransfers.startTransfer(eventId, email.trim(), keepAdmin))}
                style={[styles.primaryButton, (busy || !email.trim()) && styles.disabled]}
              >
                {busy ? <ActivityIndicator size="small" color={colors.onAccent} /> : <Text style={styles.primaryText}>Send transfer request</Text>}
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    </View>
  );
}

const getStyles = (c: typeof MidnightColors, isDark: boolean) => StyleSheet.create({
  card: { marginTop: 12, padding: 14, gap: 8, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  title: { color: c.text, fontSize: 14, fontWeight: '700' },
  note: { marginTop: 2, color: c.slate400, fontSize: 12, lineHeight: 18 },
  form: { gap: 10, marginTop: 4 },
  input: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.background, color: c.text, fontSize: 14 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  switchLabel: { flex: 1, color: c.text, fontSize: 13 },
  primaryButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: 22, backgroundColor: c.goldFill },
  primaryText: { color: c.onAccent, fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  secondaryButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, marginTop: 4, borderRadius: 22, borderWidth: 1, borderColor: c.border },
  secondaryText: { color: c.text, fontSize: 14, fontWeight: '700' },
  error: { color: isDark ? '#FB7185' : c.danger, fontSize: 12 },
});
