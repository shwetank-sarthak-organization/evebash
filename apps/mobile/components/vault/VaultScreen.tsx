import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { MidnightColors } from '@/constants/theme';
import { appAlert, showToast } from '@/lib/feedback';
import { vaultApi, VaultApiError, type VaultFolder, type VaultItem, type VaultTrashEntry, type VaultUsage } from '@/lib/vaultApi';
import { canSaveToPhotos, fileIconName, formatBytes, formatDate, saveVaultFileToPhotos, shareVaultFile } from '@/lib/vaultFiles';
import type { VaultUploadSource } from '@/lib/vaultUpload';
import { ActionSheet, FolderPicker, NamePrompt, type SheetAction } from './VaultModals';
import { VaultPreview } from './VaultPreview';
import { UploadTray, useVaultUploads } from './VaultUploads';

type Section = 'files' | 'recent' | 'starred' | 'trash' | 'search';
type Row = { kind: 'folder'; folder: VaultFolder } | { kind: 'file'; item: VaultItem };
type Dialog =
  | { type: 'new-folder' }
  | { type: 'rename'; row: Row }
  | { type: 'move'; row: Row }
  | { type: 'copy'; item: VaultItem }
  | null;

const SECTIONS: { id: Exclude<Section, 'search'>; label: string }[] = [
  { id: 'files', label: 'My Files' },
  { id: 'recent', label: 'Recent' },
  { id: 'starred', label: 'Starred' },
  { id: 'trash', label: 'Trash' },
];

const VAULT_GREEN = '#7FA38C';
const errorText = (error: unknown) => (error instanceof VaultApiError ? error.message : 'Something went wrong. Please try again.');

export function VaultScreen() {
  const router = useRouter();
  const [section, setSection] = useState<Section>('files');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searchText, setSearchText] = useState('');
  const [usage, setUsage] = useState<(VaultUsage & { fetchedAt: number }) | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [trash, setTrash] = useState<VaultTrashEntry[] | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; name: string }[]>([]);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [loadError, setLoadError] = useState<VaultApiError | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [preview, setPreview] = useState<VaultItem | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [sheet, setSheet] = useState<{ title: string; actions: SheetAction[] } | null>(null);

  const refreshUsage = useCallback(() => {
    vaultApi.usage().then((result) => setUsage({ ...result, fetchedAt: Date.now() })).catch(() => null);
  }, []);
  const refresh = useCallback(() => {
    setReloadKey((key) => key + 1);
    refreshUsage();
  }, [refreshUsage]);

  useEffect(() => {
    refreshUsage();
  }, [refreshUsage]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (section === 'trash') {
          const result = await vaultApi.trash();
          if (!cancelled) setTrash(result.entries);
        } else {
          const result: { items: VaultItem[]; hiddenCount: number; folders?: VaultFolder[]; breadcrumbs?: { id: string; name: string }[] } =
            section === 'files' ? await vaultApi.children(folderId)
            : section === 'recent' ? await vaultApi.recent()
            : section === 'starred' ? await vaultApi.starred()
            : query ? await vaultApi.search(query) : { items: [], hiddenCount: 0 };
          if (cancelled) return;
          setRows([...(result.folders ?? []).map((folder): Row => ({ kind: 'folder', folder })), ...result.items.map((item): Row => ({ kind: 'file', item }))]);
          setBreadcrumbs(result.breadcrumbs ?? []);
          setHiddenCount(result.hiddenCount);
        }
        if (!cancelled) setLoadError(null);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof VaultApiError ? error : new VaultApiError(0, 'error', errorText(error)));
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [section, folderId, query, reloadKey]);

  const uploads = useVaultUploads(refresh);

  const goTo = (next: Section, nextFolder: string | null = null) => {
    setRows(null);
    setTrash(null);
    setSection(next);
    setFolderId(nextFolder);
  };

  const run = async (action: () => Promise<unknown>, success?: string): Promise<string | null> => {
    try {
      await action();
      if (success) showToast(success);
      refresh();
      return null;
    } catch (error) {
      return errorText(error);
    }
  };
  const runOrAlert = (action: () => Promise<unknown>, success?: string) => {
    void run(action, success).then((error) => error && appAlert('Something went wrong', error));
  };

  const uploadsBlockedMessage = usage?.uploadsBlocked === 'plan_expired'
    ? 'Uploads are paused because your plan has expired. Renew your plan to upload again.'
    : usage?.uploadsBlocked === 'storage_full' ? 'Your storage is full. Free up space or upgrade your plan to upload more.' : null;
  const uploadTarget = section === 'files' ? folderId : null;

  const startUpload = (sources: VaultUploadSource[]) => {
    if (sources.length === 0) return;
    if (uploadsBlockedMessage) return appAlert("Can't upload", uploadsBlockedMessage);
    uploads.upload(sources, uploadTarget);
    if (section !== 'files') goTo('files', null);
  };

  const sizeOf = (uri: string, reported?: number | null) => {
    if (reported && reported > 0) return reported;
    try {
      return new File(uri).size ?? 0;
    } catch {
      return 0;
    }
  };

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, quality: 1 });
    if (result.canceled) return;
    startUpload(result.assets.map((asset, index) => ({
      uri: asset.uri,
      name: asset.fileName || `${asset.type === 'video' ? 'video' : 'photo'}-${Date.now()}-${index}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
      mimeType: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
      sizeBytes: sizeOf(asset.uri, asset.fileSize),
    })));
  };

  const pickFiles = async () => {
    const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: '*/*' });
    if (result.canceled) return;
    startUpload(result.assets.map((asset) => ({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType || 'application/octet-stream',
      sizeBytes: sizeOf(asset.uri, asset.size),
    })));
  };

  const share = (item: VaultItem) => {
    showToast('Preparing file…', { type: 'info' });
    shareVaultFile(item).catch((error) => appAlert("Couldn't share", errorText(error)));
  };
  const saveToPhotos = (item: VaultItem) => {
    saveVaultFileToPhotos(item)
      .then(() => showToast('Saved to Photos'))
      .catch((error) => appAlert("Couldn't save", errorText(error)));
  };

  const confirmTrash = (row: Row) => {
    const name = row.kind === 'folder' ? row.folder.name : row.item.filename;
    runOrAlert(() => (row.kind === 'folder' ? vaultApi.trashFolder(row.folder.id) : vaultApi.trashItem(row.item.id)), `Moved “${name}” to Trash`);
  };

  const openRowActions = (row: Row) => {
    if (row.kind === 'folder') {
      setSheet({
        title: row.folder.name,
        actions: [
          { label: 'Open', icon: 'folder', onPress: () => goTo('files', row.folder.id) },
          { label: 'Rename', icon: 'pencil', onPress: () => setDialog({ type: 'rename', row }) },
          { label: 'Move', icon: 'arrow.right.square', onPress: () => setDialog({ type: 'move', row }) },
          { label: 'Move to Trash', icon: 'trash.fill', destructive: true, onPress: () => confirmTrash(row) },
        ],
      });
      return;
    }
    const item = row.item;
    setSheet({
      title: item.filename,
      actions: [
        { label: 'Preview', icon: 'eye.fill', onPress: () => setPreview(item) },
        ...(canSaveToPhotos(item) ? [{ label: 'Save to Photos', icon: 'square.and.arrow.down', onPress: () => saveToPhotos(item) }] : []),
        { label: 'Share or save to Files', icon: 'square.and.arrow.up', onPress: () => share(item) },
        { label: item.isStarred ? 'Remove star' : 'Star', icon: item.isStarred ? 'star' : 'star.fill', onPress: () => runOrAlert(() => vaultApi.updateItem(item.id, { isStarred: !item.isStarred })) },
        { label: 'Rename', icon: 'pencil', onPress: () => setDialog({ type: 'rename', row }) },
        { label: 'Move', icon: 'arrow.right.square', onPress: () => setDialog({ type: 'move', row }) },
        { label: 'Make a copy', icon: 'doc.on.doc.fill', onPress: () => setDialog({ type: 'copy', item }) },
        { label: 'Move to Trash', icon: 'trash.fill', destructive: true, onPress: () => confirmTrash(row) },
      ],
    });
  };

  const openNewSheet = () => setSheet({
    title: 'Add to EB Vault',
    actions: [
      { label: 'Upload photos & videos', icon: 'photo.fill', onPress: () => void pickMedia() },
      { label: 'Upload files', icon: 'arrow.up.doc.fill', onPress: () => void pickFiles() },
      { label: 'New folder', icon: 'folder.badge.plus', onPress: () => setDialog({ type: 'new-folder' }) },
    ],
  });

  const openTrashActions = (entry: VaultTrashEntry) => setSheet({
    title: entry.name,
    actions: [
      { label: 'Restore', icon: 'arrow.uturn.backward', onPress: () => runOrAlert(() => vaultApi.restore(entry.kind, entry.id), `Restored “${entry.name}”`) },
      {
        label: 'Delete forever', icon: 'trash.fill', destructive: true, onPress: () => appAlert(
          'Delete forever?',
          `“${entry.name}”${entry.kind === 'folder' ? ' and everything in it' : ''} will be permanently deleted. This can't be undone.`,
          [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete forever', style: 'destructive', onPress: () => runOrAlert(() => vaultApi.deleteForever(entry.kind, entry.id), 'Deleted forever') }],
        ),
      },
    ],
  });

  const back = () => {
    if (section === 'files' && folderId) {
      const parent = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2].id : null;
      return goTo('files', parent);
    }
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/profile');
  };

  const heading = section === 'files'
    ? (breadcrumbs.at(-1)?.name ?? 'My Files')
    : section === 'search' ? `Results for “${query}”`
    : SECTIONS.find((entry) => entry.id === section)!.label;

  const percent = usage?.limitBytes ? Math.min(100, (usage.usedBytes.total / usage.limitBytes) * 100) : 0;

  if (loadError?.code === 'disabled') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <Header onBack={back} />
        <EmptyState icon="externaldrive.fill" title="EB Vault is coming soon" text="Your personal storage isn't available yet. Check back soon." />
      </SafeAreaView>
    );
  }

  const listHeader = (
    <View>
      {usage && (
        <View style={styles.storageCard}>
          <Text style={styles.storageText}>
            {formatBytes(usage.usedBytes.total)} of {usage.limitBytes === null ? 'Unlimited' : formatBytes(usage.limitBytes)} used
          </Text>
          {usage.limitBytes !== null && (
            <View style={styles.storageTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }}>
              <View style={{ width: `${usage.usedBytes.total ? (usage.usedBytes.events / usage.usedBytes.total) * percent : 0}%`, backgroundColor: MidnightColors.gold }} />
              <View style={{ width: `${usage.usedBytes.total ? (usage.usedBytes.vault / usage.usedBytes.total) * percent : 0}%`, backgroundColor: VAULT_GREEN }} />
            </View>
          )}
          <Text style={styles.storageMeta}>Vault {formatBytes(usage.usedBytes.vault)} · Events {formatBytes(usage.usedBytes.events)}</Text>
        </View>
      )}

      {usage && usage.plan.state !== 'active' && <PlanBanner usage={usage} onRenew={() => router.push('/(tabs)/pricing')} />}
      {usage?.plan.state === 'active' && usage.overLimit && (
        <Banner tone="red" title="You're over your plan's storage">
          Your files are safe and you can still view, share and delete them, but new uploads are paused until you free up space or upgrade.
        </Banner>
      )}

      <View style={styles.searchBox}>
        <IconSymbol name="magnifyingglass" size={16} color={MidnightColors.slate600} />
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={() => {
            const q = searchText.trim();
            if (!q) return;
            setRows(null);
            setQuery(q);
            setSection('search');
          }}
          placeholder="Search your Vault"
          placeholderTextColor={MidnightColors.slate600}
          returnKeyType="search"
          accessibilityLabel="Search your Vault by file name"
          style={styles.searchInput}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {SECTIONS.map(({ id, label }) => {
          const active = section === id;
          return (
            <TouchableOpacity key={id} onPress={() => goTo(id)} accessibilityRole="tab" accessibilityState={{ selected: active }} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.headingRow}>
        <Text style={styles.heading} numberOfLines={1} accessibilityRole="header">{heading}</Text>
        {section === 'trash' && trash && trash.length > 0 && (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => appAlert('Empty Trash?', "Everything in Trash will be permanently deleted. This can't be undone.", [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Empty Trash', style: 'destructive', onPress: () => runOrAlert(() => vaultApi.emptyTrash(), 'Trash emptied') },
            ])}
          >
            <Text style={styles.emptyTrash}>Empty Trash</Text>
          </TouchableOpacity>
        )}
      </View>
      {section === 'trash' && <Text style={styles.hint}>Items in Trash are permanently deleted after 30 days. They still count toward your storage until then.</Text>}
      {hiddenCount > 0 && section !== 'trash' && (
        <Text style={styles.hiddenNote}>
          {hiddenCount} {hiddenCount === 1 ? 'file is' : 'files are'} hidden here because your plan expired. Renew to restore {hiddenCount === 1 ? 'it' : 'them'}.
        </Text>
      )}
    </View>
  );

  const onRefresh = () => {
    setRefreshing(true);
    refresh();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <Header onBack={back} subtitle={section === 'files' && folderId ? 'Back' : undefined} />

      {section === 'trash' ? (
        <FlatList
          data={trash ?? []}
          keyExtractor={(entry) => `${entry.kind}-${entry.id}`}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={trash === null ? <ActivityIndicator color={MidnightColors.gold} style={{ marginTop: 40 }} /> : <EmptyState icon="trash.fill" title="Trash is empty" text="" />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MidnightColors.gold} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: entry }) => (
            <TouchableOpacity onPress={() => openTrashActions(entry)} style={styles.row} accessibilityRole="button" accessibilityHint="Restore or delete forever">
              <IconSymbol name={(entry.kind === 'folder' ? 'folder' : fileIconName(entry.mimeType ?? '')) as any} size={22} color={entry.kind === 'folder' ? MidnightColors.gold : MidnightColors.slate600} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName} numberOfLines={1}>{entry.name}</Text>
                <Text style={styles.rowMeta}>{entry.sizeBytes !== null ? `${formatBytes(entry.sizeBytes)} · ` : ''}Gone forever on {formatDate(entry.permanentlyDeletedOn)}</Text>
              </View>
              <IconSymbol name="ellipsis" size={18} color={MidnightColors.slate400} />
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={rows ?? []}
          keyExtractor={(row) => (row.kind === 'folder' ? `f-${row.folder.id}` : `i-${row.item.id}`)}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            loadError ? <EmptyState icon="exclamationmark.triangle.fill" title="Couldn't load your files" text={loadError.message} />
            : rows === null ? <ActivityIndicator color={MidnightColors.gold} style={{ marginTop: 40 }} />
            : <EmptyState
                icon="externaldrive.fill"
                title={section === 'files' ? 'Nothing here yet' : section === 'search' ? 'No matching files' : section === 'starred' ? 'No starred files' : 'No recent files'}
                text={section === 'files' ? 'Tap + to upload photos, videos or files. Anything you store is private to you.' : ''}
              />
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MidnightColors.gold} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: row }) => (
            <TouchableOpacity
              onPress={() => (row.kind === 'folder' ? goTo('files', row.folder.id) : setPreview(row.item))}
              onLongPress={() => openRowActions(row)}
              style={styles.row}
              accessibilityRole="button"
              accessibilityHint={row.kind === 'folder' ? 'Opens the folder' : 'Opens a preview'}
            >
              <IconSymbol
                name={(row.kind === 'folder' ? 'folder' : fileIconName(row.item.mimeType)) as any}
                size={22}
                color={row.kind === 'folder' ? MidnightColors.gold : VAULT_GREEN}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName} numberOfLines={1}>{row.kind === 'folder' ? row.folder.name : row.item.filename}</Text>
                <Text style={styles.rowMeta}>
                  {row.kind === 'file' ? `${formatBytes(row.item.sizeBytes)} · ${formatDate(row.item.updatedAt)}` : formatDate(row.folder.updatedAt)}
                </Text>
                {row.kind === 'file' && row.item.atRisk && (
                  <Text style={styles.atRisk}>Plan expired · hidden after {formatDate(usage?.plan.graceEndsOn)}</Text>
                )}
              </View>
              {row.kind === 'file' && row.item.isStarred && <IconSymbol name="star.fill" size={14} color={MidnightColors.gold} />}
              <TouchableOpacity onPress={() => openRowActions(row)} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Actions for ${row.kind === 'folder' ? row.folder.name : row.item.filename}`}>
                <IconSymbol name="ellipsis" size={18} color={MidnightColors.slate400} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}

      {section !== 'trash' && (
        <TouchableOpacity onPress={openNewSheet} style={[styles.fab, uploads.tasks.length > 0 && { bottom: 290 }]} accessibilityRole="button" accessibilityLabel="Add to EB Vault">
          <IconSymbol name="plus" size={26} color="#13191F" />
        </TouchableOpacity>
      )}

      <UploadTray tasks={uploads.tasks} onCancel={uploads.cancel} onClear={uploads.clearFinished} />

      <ActionSheet visible={sheet !== null} title={sheet?.title ?? ''} actions={sheet?.actions ?? []} onClose={() => setSheet(null)} />

      {preview && <VaultPreview key={preview.id} item={preview} onClose={() => setPreview(null)} onShare={share} onSaveToPhotos={saveToPhotos} />}

      {dialog?.type === 'new-folder' && (
        <NamePrompt title="New folder" initial="Untitled folder" confirmLabel="Create" onClose={() => setDialog(null)}
          onSubmit={async (name) => {
            const error = await run(() => vaultApi.createFolder(name, section === 'files' ? folderId : null));
            if (!error) {
              setDialog(null);
              if (section !== 'files') goTo('files', null);
            }
            return error;
          }} />
      )}
      {dialog?.type === 'rename' && (
        <NamePrompt
          title="Rename"
          initial={dialog.row.kind === 'folder' ? dialog.row.folder.name : dialog.row.item.filename}
          confirmLabel="Rename"
          onClose={() => setDialog(null)}
          onSubmit={async (name) => {
            const row = dialog.row;
            const error = await run(() => (row.kind === 'folder' ? vaultApi.updateFolder(row.folder.id, { name }) : vaultApi.updateItem(row.item.id, { filename: name })));
            if (!error) setDialog(null);
            return error;
          }} />
      )}
      {dialog?.type === 'move' && (
        <FolderPicker
          title={`Move “${dialog.row.kind === 'folder' ? dialog.row.folder.name : dialog.row.item.filename}”`}
          confirmLabel="Move"
          excludeFolderIds={dialog.row.kind === 'folder' ? [dialog.row.folder.id] : []}
          onClose={() => setDialog(null)}
          onPick={async (target) => {
            const row = dialog.row;
            const error = await run(() => (row.kind === 'folder' ? vaultApi.updateFolder(row.folder.id, { parentFolderId: target }) : vaultApi.updateItem(row.item.id, { folderId: target })), 'Moved');
            if (!error) setDialog(null);
            return error;
          }} />
      )}
      {dialog?.type === 'copy' && (
        <FolderPicker title={`Copy “${dialog.item.filename}”`} confirmLabel="Copy" excludeFolderIds={[]} onClose={() => setDialog(null)}
          onPick={async (target) => {
            const error = await run(() => vaultApi.copyItem(dialog.item.id, target), 'Copied');
            if (!error) setDialog(null);
            return error;
          }} />
      )}
    </SafeAreaView>
  );
}

function Header({ onBack, subtitle }: { onBack: () => void; subtitle?: string }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} style={{ padding: 4 }}>
        <IconSymbol name="chevron.left" size={24} color={MidnightColors.gold} />
      </TouchableOpacity>
      <View style={styles.headerIcon}>
        <IconSymbol name="externaldrive.fill" size={18} color={VAULT_GREEN} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle} accessibilityRole="header">EB Vault</Text>
        <Text style={styles.headerSubtitle}>{subtitle ?? 'Your personal storage'}</Text>
      </View>
    </View>
  );
}

function Banner({ tone, title, children, action }: { tone: 'amber' | 'red' | 'grey'; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  const colors = {
    amber: { border: 'rgba(251,191,36,0.35)', bg: 'rgba(245,158,11,0.12)', text: '#FDE68A' },
    red: { border: 'rgba(248,113,113,0.35)', bg: 'rgba(239,68,68,0.12)', text: '#FECACA' },
    grey: { border: 'rgba(255,255,255,0.12)', bg: 'rgba(255,255,255,0.05)', text: '#E2E8F0' },
  }[tone];
  return (
    <View style={[styles.banner, { borderColor: colors.border, backgroundColor: colors.bg }]} accessibilityRole="alert">
      <Text style={[styles.bannerTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.bannerText, { color: colors.text }]}>{children}</Text>
      {action}
    </View>
  );
}

/** Messages agreed for the plan-expiry timeline (grace → hidden → deletion). */
function PlanBanner({ usage, onRenew }: { usage: VaultUsage & { fetchedAt: number }; onRenew: () => void }) {
  const { state, expiredOn, graceEndsOn, deletionOn } = usage.plan;
  const renew = (
    <TouchableOpacity onPress={onRenew} accessibilityRole="button" style={styles.bannerButton}>
      <Text style={styles.bannerButtonText}>{state === 'deleting' ? 'See plans' : 'Renew plan'}</Text>
    </TouchableOpacity>
  );
  if (state === 'grace') {
    return (
      <Banner tone="amber" title="Your plan has expired" action={renew}>
        Your plan expired on {formatDate(expiredOn)}, and uploads are paused. Renew by {formatDate(graceEndsOn)} to keep all your files visible. After that, only your oldest 1 GB stays visible, and the rest will be permanently deleted on {formatDate(deletionOn)}.
      </Banner>
    );
  }
  if (state === 'hidden') {
    const daysLeft = deletionOn ? Math.ceil((new Date(deletionOn).getTime() - usage.fetchedAt) / 86400000) : null;
    const title = daysLeft !== null && daysLeft <= 1 ? 'Deleting tomorrow' : daysLeft !== null && daysLeft <= 7 ? `Deleting in ${daysLeft} days` : 'Some of your files are hidden';
    return (
      <Banner tone="red" title={title} action={renew}>
        Only your oldest 1 GB is visible now. Files beyond it are hidden and will be permanently deleted on {formatDate(deletionOn)}. Renew before then to restore everything.
      </Banner>
    );
  }
  return (
    <Banner tone="grey" title="Files beyond your free 1 GB are being deleted" action={renew}>
      Your plan expired on {formatDate(expiredOn)}. Hidden files are permanently deleted from {formatDate(deletionOn)}. Your oldest 1 GB of files is safe on the Free plan.
    </Banner>
  );
}

function EmptyState({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <View style={styles.empty}>
      <IconSymbol name={icon as any} size={40} color={MidnightColors.slate700} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!text && <Text style={styles.emptyText}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0E1318' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  headerIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(127,163,140,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontFamily: 'Outfit_700Bold' },
  headerSubtitle: { color: MidnightColors.slate400, fontSize: 12, fontFamily: 'Inter_400Regular' },
  listContent: { paddingHorizontal: 16, paddingBottom: 140 },
  storageCard: { marginTop: 14, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)' },
  storageText: { color: '#E2E8F0', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  storageTrack: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.1)', marginTop: 8 },
  storageMeta: { color: MidnightColors.slate400, fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 8 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#141B22' },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, fontFamily: 'Inter_400Regular', paddingVertical: 11 },
  chips: { gap: 8, paddingVertical: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  chipActive: { backgroundColor: 'rgba(127,163,140,0.18)', borderColor: VAULT_GREEN },
  chipText: { color: MidnightColors.slate400, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  chipTextActive: { color: '#fff' },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  heading: { flex: 1, color: '#fff', fontSize: 17, fontFamily: 'Outfit_700Bold' },
  emptyTrash: { color: '#fca5a5', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  hint: { color: MidnightColors.slate400, fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 10 },
  hiddenNote: { color: '#FECACA', fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 10, padding: 10, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.12)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  rowName: { color: '#F1F5F9', fontSize: 14, fontFamily: 'Inter_500Medium' },
  rowMeta: { color: MidnightColors.slate600, fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  atRisk: { color: '#FCD34D', fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  fab: { position: 'absolute', right: 20, bottom: 28, width: 58, height: 58, borderRadius: 29, backgroundColor: MidnightColors.gold, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  banner: { marginTop: 14, padding: 14, borderRadius: 14, borderWidth: 1 },
  bannerTitle: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  bannerText: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 4, lineHeight: 19 },
  bannerButton: { alignSelf: 'flex-start', marginTop: 10, borderRadius: 999, backgroundColor: MidnightColors.gold, paddingHorizontal: 14, paddingVertical: 8 },
  bannerButtonText: { color: '#13191F', fontSize: 13, fontFamily: 'Inter_700Bold' },
  empty: { alignItems: 'center', marginTop: 48, paddingHorizontal: 24 },
  emptyTitle: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold', marginTop: 12 },
  emptyText: { color: MidnightColors.slate400, fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 6, textAlign: 'center' },
});
