import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { MidnightColors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { haptic } from '@/lib/haptics';
import {
  REPORT_DUPLICATE,
  REPORT_NOTE_MAX,
  REPORT_REASONS,
  REPORT_TARGET_LABELS,
  REPORT_THANKS,
  reportErrorMessage,
  type ReportReason,
  type ReportTargetType,
} from '../../../shared/legal/contentReports';

export type ReportTarget = { targetType: ReportTargetType; targetId: string };

type Stage = 'checking' | 'signed-out' | 'form' | 'done';

/** Report a photo, video, comment, chat message, business or user. Shown while target is set. */
export function ReportSheet({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) {
  const [stage, setStage] = useState<Stage>('checking');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [doneMessage, setDoneMessage] = useState(REPORT_THANKS);

  useEffect(() => {
    if (!target) return;
    setStage('checking');
    setReason(null);
    setNote('');
    setError('');
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setStage(data.session ? 'form' : 'signed-out');
    });
    return () => { active = false; };
  }, [target]);

  const submit = async () => {
    if (!target || !reason || busy) return;
    setBusy(true);
    setError('');
    const { data, error: rpcError } = await supabase.rpc('file_content_report', {
      p_target_type: target.targetType,
      p_target_id: target.targetId,
      p_reason: reason,
      p_note: note.trim() || null,
      p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
    setBusy(false);
    if (rpcError) {
      haptic('error');
      setError(reportErrorMessage(rpcError));
      return;
    }
    haptic('success');
    setDoneMessage((data as { duplicate?: boolean } | null)?.duplicate ? REPORT_DUPLICATE : REPORT_THANKS);
    setStage('done');
  };

  const label = target ? REPORT_TARGET_LABELS[target.targetType] : '';

  return (
    <BottomSheet visible={!!target} onClose={onClose}>
      <Text style={styles.title} accessibilityRole="header">{stage === 'done' ? 'Report sent' : `Report ${label}`}</Text>
      {stage === 'checking' && <ActivityIndicator color={MidnightColors.gold} style={styles.spinner} />}
      {stage === 'signed-out' && (
        <>
          <Text style={styles.body}>Please log in to report this {label}. You can also email support@evebash.com.</Text>
          <TouchableOpacity onPress={onClose} style={styles.primaryButton} accessibilityRole="button">
            <Text style={styles.primaryText}>OK</Text>
          </TouchableOpacity>
        </>
      )}
      {stage === 'form' && (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
          <Text style={styles.body}>{"Reports are private. The person you report isn't told who reported them."}</Text>
          {REPORT_REASONS.map((option) => {
            const selected = reason === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                onPress={() => setReason(option.value)}
                style={[styles.reasonRow, selected && styles.reasonRowSelected]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.reasonText}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
          <TextInput
            value={note}
            onChangeText={setNote}
            maxLength={REPORT_NOTE_MAX}
            multiline
            placeholder="Anything else we should know? (optional)"
            placeholderTextColor={MidnightColors.slate600}
            style={styles.input}
          />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity
            onPress={submit}
            disabled={!reason || busy}
            style={[styles.dangerButton, (!reason || busy) && styles.disabled]}
            accessibilityRole="button"
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.dangerText}>Send report</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
      {stage === 'done' && (
        <>
          <Text style={styles.success}>{doneMessage}</Text>
          <TouchableOpacity onPress={onClose} style={styles.primaryButton} accessibilityRole="button">
            <Text style={styles.primaryText}>Done</Text>
          </TouchableOpacity>
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { color: MidnightColors.text, fontSize: 20, fontFamily: 'Outfit_700Bold', marginBottom: 8 },
  spinner: { marginVertical: 24 },
  body: { color: MidnightColors.slate400, fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular', marginBottom: 12 },
  form: { paddingBottom: 8 },
  reasonRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8,
    borderRadius: 14, borderWidth: 1, borderColor: MidnightColors.cardBorder, backgroundColor: MidnightColors.surface,
  },
  reasonRowSelected: { borderColor: MidnightColors.gold, backgroundColor: 'rgba(202, 156, 104, 0.1)' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: MidnightColors.slate600, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: MidnightColors.gold },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: MidnightColors.gold },
  reasonText: { flex: 1, color: MidnightColors.text, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  input: {
    minHeight: 72, marginTop: 4, borderWidth: 1, borderColor: MidnightColors.border, backgroundColor: MidnightColors.background,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: MidnightColors.text, fontSize: 14,
    fontFamily: 'Inter_400Regular', textAlignVertical: 'top',
  },
  error: { color: MidnightColors.dangerSoft, fontSize: 13, fontFamily: 'Inter_600SemiBold', marginTop: 10 },
  success: {
    color: MidnightColors.text, fontSize: 15, lineHeight: 22, fontFamily: 'Inter_600SemiBold', textAlign: 'center',
    padding: 16, borderRadius: 14, borderWidth: 1, borderColor: MidnightColors.border, backgroundColor: 'rgba(202, 156, 104, 0.1)',
  },
  dangerButton: { marginTop: 16, paddingVertical: 14, borderRadius: 14, backgroundColor: MidnightColors.dangerStrong, alignItems: 'center' },
  dangerText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  primaryButton: { marginTop: 16, paddingVertical: 14, borderRadius: 14, backgroundColor: MidnightColors.gold, alignItems: 'center' },
  primaryText: { color: MidnightColors.onAccent, fontSize: 15, fontFamily: 'Inter_700Bold' },
  disabled: { opacity: 0.5 },
});
