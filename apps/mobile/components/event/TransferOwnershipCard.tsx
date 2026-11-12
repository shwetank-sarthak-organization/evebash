import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MidnightColors } from '../../constants/theme';
import { useAppTheme } from '../../context/ThemeContext';
import { formatStorageSize } from '../../lib/planLimits';
import { eventTransfers, formatTransferExpiry, type EventTransferStatus } from '../../lib/eventTransfers';
import { BottomSheet, BottomSheetHeader } from '../ui/BottomSheet';
import { IconSymbol } from '../ui/icon-symbol';

/** Event > Permissions, under the visibility box; keyed by event. Shows nothing unless the backend says this user can transfer the event. */
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

  const close = () => {
    if (busy) return;
    setOpen(false); setError('');
  };

  const size = formatStorageSize(status.sizeBytes);
  const { pending } = status;
  const pendingName = pending ? pending.toName || pending.toEmail || 'the new owner' : '';

  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={pending ? `Transfer pending, waiting for ${pendingName}` : 'Transfer ownership'}
        onPress={() => setOpen(true)}
        style={[styles.box, pending && styles.boxPending]}
      >
        <View style={[styles.iconTile, pending && styles.iconTilePending]}>
          <IconSymbol name="arrow.left.arrow.right" size={18} color={pending ? colors.onAccent : colors.slate400} />
        </View>
        <View style={styles.boxText}>
          <Text style={styles.eyebrow}>OWNERSHIP</Text>
          <Text style={[styles.boxTitle, pending && styles.boxTitlePending]}>{pending ? 'Transfer pending' : 'Transfer ownership'}</Text>
          <Text style={styles.boxNote} numberOfLines={2}>{pending ? `Waiting for ${pendingName} to accept.` : 'Hand this event to another EveBash user.'}</Text>
        </View>
        <IconSymbol name="chevron.right" size={18} color={colors.slate400} />
      </TouchableOpacity>

      <BottomSheet visible={open} onClose={close}>
        <BottomSheetHeader title={pending ? 'Transfer pending' : 'Transfer ownership'} icon="arrow.left.arrow.right" onClose={close} />
        {pending ? (
          <View style={styles.body}>
            <Text style={styles.note}>
              Waiting for {pendingName}. Uploads to this event are paused until they accept or decline. The request expires on {formatTransferExpiry(pending.expiresAt)}.
              {!pending.receiverReady && " Their plan can't take this event yet, so they need to free up space or upgrade first."}
            </Text>
            {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => run(() => eventTransfers.cancelTransfer(pending.id))} style={[styles.dangerButton, busy && styles.disabled]}>
              {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.dangerText}>Cancel transfer</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.body}>
            <Text style={styles.note}>
              Hand this event to another EveBash user. It uses {size}. They have 7 days to accept, and need {size} free on their plan. When they accept, the event and its sub-galleries become theirs, and the space comes off your plan and counts on theirs. Uploads to the event pause until then.
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
            {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
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
      </BottomSheet>
    </>
  );
}

const getStyles = (c: typeof MidnightColors, isDark: boolean) => StyleSheet.create({
  // Same frame as EventVisibilityControl so the two boxes line up.
  box: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: c.border },
  boxPending: { borderColor: c.gold },
  iconTile: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: c.slate800 },
  iconTilePending: { backgroundColor: c.goldFill },
  boxText: { flex: 1, minWidth: 0 },
  eyebrow: { color: c.slate400, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  boxTitle: { marginTop: 1, color: c.text, fontSize: 14, fontWeight: '700' },
  boxTitlePending: { color: c.gold },
  boxNote: { marginTop: 2, color: c.slate400, fontSize: 12, lineHeight: 17 },
  body: { gap: 14 },
  note: { color: c.slate400, fontSize: 14, lineHeight: 21 },
  input: { paddingHorizontal: 14, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.background, color: c.text, fontSize: 15 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  switchLabel: { flex: 1, color: c.text, fontSize: 14 },
  primaryButton: { alignItems: 'center', justifyContent: 'center', minHeight: 50, borderRadius: 14, backgroundColor: c.goldFill },
  primaryText: { color: c.onAccent, fontSize: 15, fontWeight: '700' },
  dangerButton: { alignItems: 'center', justifyContent: 'center', minHeight: 50, borderRadius: 14, backgroundColor: c.danger },
  dangerText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  error: { color: isDark ? '#FB7185' : c.danger, fontSize: 13 },
});
