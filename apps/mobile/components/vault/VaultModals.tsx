import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { MidnightColors } from '@/constants/theme';
import { vaultApi, type VaultFolder } from '@/lib/vaultApi';

/** New folder and rename. onSubmit returns an error message to show, or null on success. */
export function NamePrompt({ title, initial, confirmLabel, onClose, onSubmit }: {
  title: string; initial: string; confirmLabel: string;
  onClose: () => void; onSubmit: (name: string) => Promise<string | null>;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!value.trim() || busy) return;
    setBusy(true);
    setError(await onSubmit(value.trim()));
    setBusy(false);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.dialogTitle} accessibilityRole="header">{title}</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            autoFocus
            maxLength={255}
            selectTextOnFocus
            onSubmitEditing={submit}
            returnKeyType="done"
            accessibilityLabel="Name"
            style={styles.input}
            placeholderTextColor={MidnightColors.slate600}
          />
          {error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
          <View style={styles.row}>
            <TouchableOpacity onPress={onClose} disabled={busy} style={styles.secondaryButton} accessibilityRole="button">
              <Text style={styles.secondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={submit} disabled={busy || !value.trim()} style={[styles.primaryButton, (busy || !value.trim()) && { opacity: 0.5 }]} accessibilityRole="button">
              {busy ? <ActivityIndicator color="#13191F" /> : <Text style={styles.primaryText}>{confirmLabel}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Folder picker for Move and Copy. Folders being moved (and anything inside them) can't be chosen. */
export function FolderPicker({ title, confirmLabel, excludeFolderIds, onClose, onPick }: {
  title: string; confirmLabel: string; excludeFolderIds: string[];
  onClose: () => void; onPick: (folderId: string | null) => Promise<string | null>;
}) {
  const [current, setCurrent] = useState<string | null>(null);
  const [listing, setListing] = useState<{ folderId: string | null; folders: VaultFolder[]; trail: { id: string; name: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    vaultApi.children(current)
      .then((result) => !cancelled && setListing({ folderId: current, folders: result.folders, trail: result.breadcrumbs }))
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [current]);

  const folders = listing && listing.folderId === current ? listing.folders : null;
  const trail = listing?.trail ?? [];
  const insideExcluded = trail.some((crumb) => excludeFolderIds.includes(crumb.id));
  const parentId = trail.length > 1 ? trail[trail.length - 2].id : null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.dialog, { maxHeight: '80%' }]}>
          <Text style={styles.dialogTitle} accessibilityRole="header" numberOfLines={2}>{title}</Text>
          <View style={styles.pathRow}>
            {current !== null && (
              <TouchableOpacity onPress={() => setCurrent(parentId)} accessibilityRole="button" accessibilityLabel="Up one folder" hitSlop={10}>
                <IconSymbol name="chevron.left" size={18} color={MidnightColors.gold} />
              </TouchableOpacity>
            )}
            <Text style={styles.pathText} numberOfLines={1}>{trail.length ? `My Files / ${trail.map((c) => c.name).join(' / ')}` : 'My Files'}</Text>
          </View>
          <ScrollView style={styles.folderList}>
            {folders === null ? (
              <ActivityIndicator color={MidnightColors.gold} style={{ margin: 16 }} />
            ) : folders.length === 0 ? (
              <Text style={styles.empty}>No folders here.</Text>
            ) : folders.map((folder) => {
              const blocked = excludeFolderIds.includes(folder.id);
              return (
                <TouchableOpacity key={folder.id} disabled={blocked} onPress={() => setCurrent(folder.id)} style={[styles.folderRow, blocked && { opacity: 0.4 }]} accessibilityRole="button">
                  <IconSymbol name="folder" size={18} color={MidnightColors.gold} />
                  <Text style={styles.folderName} numberOfLines={1}>{folder.name}</Text>
                  <IconSymbol name="chevron.right" size={16} color={MidnightColors.slate600} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.row}>
            <TouchableOpacity onPress={onClose} disabled={busy} style={styles.secondaryButton} accessibilityRole="button">
              <Text style={styles.secondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={busy || insideExcluded}
              onPress={async () => { setBusy(true); setError(await onPick(current)); setBusy(false); }}
              style={[styles.primaryButton, (busy || insideExcluded) && { opacity: 0.5 }]}
              accessibilityRole="button"
            >
              {busy ? <ActivityIndicator color="#13191F" /> : <Text style={styles.primaryText}>{confirmLabel} {current ? 'here' : 'to My Files'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export type SheetAction = { label: string; icon: string; destructive?: boolean; onPress: () => void };

/** Actions menu for a file, folder or the + button, using the app's bottom sheet. */
export function ActionSheet({ visible, title, actions, onClose }: { visible: boolean; title: string; actions: SheetAction[]; onClose: () => void }) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.sheetTitle} numberOfLines={1}>{title}</Text>
      {actions.map((action) => (
        <TouchableOpacity
          key={action.label}
          onPress={() => { onClose(); action.onPress(); }}
          style={styles.sheetRow}
          accessibilityRole="button"
        >
          <IconSymbol name={action.icon as any} size={20} color={action.destructive ? '#fca5a5' : MidnightColors.gold} />
          <Text style={[styles.sheetLabel, action.destructive && { color: '#fca5a5' }]}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 20 },
  dialog: { backgroundColor: '#141B22', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 18 },
  dialogTitle: { color: '#fff', fontSize: 18, fontFamily: 'Outfit_700Bold', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: '#0E1318', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, color: '#fff', fontSize: 15, fontFamily: 'Inter_400Regular' },
  error: { color: '#fca5a5', fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 10 },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  secondaryButton: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  secondaryText: { color: '#E2E8F0', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  primaryButton: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: MidnightColors.gold, minWidth: 90, alignItems: 'center' },
  primaryText: { color: '#13191F', fontSize: 14, fontFamily: 'Inter_700Bold' },
  pathRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  pathText: { flex: 1, color: MidnightColors.slate400, fontSize: 13, fontFamily: 'Inter_400Regular' },
  folderList: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, maxHeight: 320 },
  folderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 14 },
  folderName: { flex: 1, color: '#E2E8F0', fontSize: 14, fontFamily: 'Inter_400Regular' },
  empty: { color: MidnightColors.slate400, fontSize: 13, padding: 14, fontFamily: 'Inter_400Regular' },
  sheetTitle: { color: MidnightColors.slate400, fontSize: 13, fontFamily: 'Inter_600SemiBold', paddingHorizontal: 20, paddingBottom: 8 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  sheetLabel: { color: '#E2E8F0', fontSize: 15, fontFamily: 'Inter_400Regular' },
});
