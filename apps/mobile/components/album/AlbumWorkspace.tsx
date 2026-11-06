import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  ALBUM_MAX_PAGE_BYTES, albumApi, albumCommentKindLabel, albumPageLabels, pinNumbers, sortByFileName,
  type AlbumDetail, type AlbumPage, type LocalFile,
} from '../../lib/albumApi';
import { Fonts, MidnightColors } from '../../constants/theme';
import { AlbumButton, albumStyles, ProgressBar } from './albumUi';
import { PageReviewer, type AlbumMode } from './PageReviewer';
import { RolesModal } from './RolePicker';
import { VoicePlayer } from './VoiceNote';
import type { AlbumNextStepTone } from '../../../../shared/text/albumNextStep';
import {
  ALBUM_PAGE_FILTERS, ALBUM_PAGE_STATE, ALBUM_STEPS, albumPageRatio, albumPageState, albumStep, albumWorkspaceStatus, formatAlbumDay, type AlbumPageState,
} from '../../../../shared/text/albumWorkspace';

type UploadItem = { key: string; name: string; progress: number; state: 'waiting' | 'uploading' | 'processing' | 'done' | 'failed'; error?: string };

const PAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'];
const PAGE_EXTENSIONS = /\.(jpe?g|png|webp|tiff?)$/i;
const REFRESH_MS = 30_000;
const UPLOAD_CONCURRENCY = 2;

/** Rows of page tiles aim for this height; each row is scaled to fill the width exactly. */
const TILE_HEIGHT = 180;
const TILE_GAP = 8;

const TONE_COLOR: Record<AlbumNextStepTone, string> = { action: '#E8C9A0', urgent: '#FDA4AF', waiting: MidnightColors.slate400, done: '#6EE7B7' };
const TONE_DOT: Record<AlbumNextStepTone, string> = { action: MidnightColors.gold, urgent: '#FB7185', waiting: 'rgba(255,255,255,0.3)', done: '#34D399' };
const TONE_ICON: Record<AlbumNextStepTone, keyof typeof MaterialIcons.glyphMap> = { action: 'arrow-forward', urgent: 'chat-bubble-outline', waiting: 'schedule', done: 'check-circle' };

/**
 * Packs items into rows that fill `width`: a row closes once its height (from the items' width/height ratios)
 * drops to `target` or below. The last row keeps `target` height and is left short rather than stretched.
 */
function packRows<T extends { ratio: number }>(items: T[], width: number, target: number, gap: number) {
  const rows: { height: number; items: (T & { width: number })[] }[] = [];
  let row: T[] = [];
  let sum = 0;
  const close = (height: number) => {
    rows.push({ height, items: row.map((item) => ({ ...item, width: Math.floor(item.ratio * height) })) });
    row = [];
    sum = 0;
  };
  for (const item of items) {
    row.push(item);
    sum += item.ratio;
    const height = (width - gap * (row.length - 1)) / sum;
    if (height <= target) close(height);
  }
  if (row.length) close(Math.min(target, (width - gap * (row.length - 1)) / sum));
  return rows;
}

function StepTracker({ step, round }: { step: number; round: number }) {
  const currentLabel = ALBUM_STEPS[step];
  return (
    <View style={{ gap: 8 }} accessibilityLabel="Album progress">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {ALBUM_STEPS.map((label, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: i < ALBUM_STEPS.length - 1 ? 1 : 0 }}>
              <View style={[styles.stepDot, done && styles.stepDone, current && styles.stepCurrent]} accessibilityLabel={`${label}${done ? ', done' : current ? ', now' : ''}`}>
                {done ? <MaterialIcons name="check" size={14} color={MidnightColors.onAccent} /> : <Text style={[styles.stepNumber, current && { color: '#E8C9A0' }]}>{i + 1}</Text>}
              </View>
              {i < ALBUM_STEPS.length - 1 && <View style={styles.stepLine} />}
            </View>
          );
        })}
      </View>
      <Text style={styles.stepCaption}>
        {currentLabel ? `Step ${step + 1} of ${ALBUM_STEPS.length}: ${currentLabel}${step === 2 && round > 0 ? ` · Round ${round}` : ''}` : 'All steps done'}
      </Text>
    </View>
  );
}

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

function checkFile(file: LocalFile) {
  if (!PAGE_TYPES.includes(file.mimeType) && !PAGE_EXTENSIONS.test(file.name)) return 'Not a JPEG, PNG, WebP or TIFF image';
  if (file.size && file.size > ALBUM_MAX_PAGE_BYTES) return 'Larger than 60 MB';
  return null;
}

/** Page designs from Photos or from Files (designers usually keep exports in Files or a drive). */
function pickPageFiles(multiple: boolean): Promise<LocalFile[]> {
  return new Promise((resolve) => {
    const fromPhotos = async () => {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photos access needed', 'Allow EveBash to use your photo library to add album pages.');
        return resolve([]);
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: multiple, selectionLimit: multiple ? 0 : 1, quality: 1 });
      resolve(result.canceled ? [] : result.assets.map((a, i) => ({
        uri: a.uri,
        name: a.fileName || `page-${String(i + 1).padStart(2, '0')}.jpg`,
        mimeType: a.mimeType || 'image/jpeg',
        size: a.fileSize,
      })));
    };
    const fromFiles = async () => {
      const result = await DocumentPicker.getDocumentAsync({ type: PAGE_TYPES, multiple, copyToCacheDirectory: true });
      resolve(result.canceled ? [] : result.assets.map((a) => ({ uri: a.uri, name: a.name, mimeType: a.mimeType || 'image/jpeg', size: a.size })));
    };
    Alert.alert(multiple ? 'Add album pages' : 'Upload new version', 'Where are the page designs?', [
      { text: 'Files', onPress: () => void fromFiles() },
      { text: 'Photos', onPress: () => void fromPhotos() },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve([]) },
    ], { cancelable: true, onDismiss: () => resolve([]) });
  });
}

export function AlbumWorkspace({ albumId, onBack }: { albumId: string; onBack: () => void }) {
  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [error, setError] = useState('');
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [viewing, setViewing] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | AlbumPageState>('all');
  const [reorder, setReorder] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [rowWidth, setRowWidth] = useState(0);
  const uploading = uploads.some((u) => u.state === 'waiting' || u.state === 'uploading' || u.state === 'processing');
  const uploadingRef = useRef(false);
  uploadingRef.current = uploading;

  const refresh = useCallback(async () => {
    try {
      setAlbum((await albumApi.get(albumId)).album);
      setError('');
    } catch (e) {
      setError(errorText(e, "Couldn't load the album."));
    }
  }, [albumId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const [rolesOpen, setRolesOpen] = useState(false);
  // Each person sees their own side: the photographer's, the client's, or (host and other admins) view only
  const mode: AlbumMode | null = album ? album.viewer.role : null;

  // Realtime is off (#49): check for the other side's changes every 30 s while the app is open
  useEffect(() => {
    const timer = setInterval(() => {
      if (AppState.currentState === 'active' && !uploadingRef.current) void refresh();
    }, REFRESH_MS);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [refresh]);

  const labels = useMemo(() => {
    const map = new Map<string, string>();
    if (album) albumPageLabels(album.pages).forEach((label, i) => map.set(album.pages[i].id, label));
    return map;
  }, [album]);

  const visiblePages = useMemo(
    () => (album ? (mode !== 'photographer' ? album.pages.filter((p) => p.sentVersion !== null) : album.pages) : []),
    [album, mode]
  );

  const run = async (key: string, task: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await task();
    } catch (e) {
      Alert.alert("That didn't work", errorText(e, 'Please try again.'));
    } finally {
      setBusy(null);
    }
  };

  const confirm = (title: string, message: string, action: string, onYes: () => void, destructive = false) =>
    Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: action, style: destructive ? 'destructive' : 'default', onPress: onYes }]);

  const updateUpload = (key: string, patch: Partial<UploadItem>) =>
    setUploads((items) => items.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const uploadPages = async () => {
    if (!album) return;
    const files = sortByFileName(await pickPageFiles(true));
    if (!files.length) return;
    const items: UploadItem[] = files.map((file) => {
      const problem = checkFile(file);
      return { key: `${file.uri}-${Math.random()}`, name: file.name, progress: 0, state: problem ? 'failed' : 'waiting', error: problem ?? undefined };
    });
    setUploads((current) => [...current.filter((u) => u.state !== 'done'), ...items]);
    const created: (string | null)[] = files.map(() => null);
    let next = 0;
    const worker = async () => {
      while (next < files.length) {
        const i = next++;
        if (items[i].state === 'failed') continue;
        updateUpload(items[i].key, { state: 'uploading' });
        try {
          const result = await albumApi.uploadPage(album.id, files[i], (fraction) => {
            updateUpload(items[i].key, { progress: fraction, state: fraction >= 1 ? 'processing' : 'uploading' });
          });
          created[i] = result.page?.id ?? null;
          updateUpload(items[i].key, { state: 'done', progress: 1 });
        } catch (e) {
          updateUpload(items[i].key, { state: 'failed', error: errorText(e, 'Upload failed') });
        }
      }
    };
    await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, worker));
    // Uploads finish in any order; put the new pages in file-name order after the existing ones
    const added = created.filter((id): id is string => Boolean(id));
    if (added.length > 1) {
      try {
        const ids = (await albumApi.get(album.id)).album.pages.map((p) => p.id);
        if (added.every((id) => ids.includes(id))) {
          setAlbum((await albumApi.reorder(album.id, [...ids.filter((id) => !added.includes(id)), ...added])).album);
          return;
        }
      } catch { /* the order can still be fixed in Reorder */ }
    }
    await refresh();
  };

  const uploadVersion = async (page: AlbumPage) => {
    const [file] = await pickPageFiles(false);
    if (!file) return;
    const problem = checkFile(file);
    if (problem) {
      Alert.alert("That file can't be used", `${problem}.`);
      return;
    }
    try {
      await albumApi.uploadVersion(albumId, page.id, file);
      await refresh();
    } catch (e) {
      Alert.alert('Upload failed', errorText(e, 'Please try again.'));
    }
  };

  const movePage = (pageId: string, delta: -1 | 1) => {
    if (!album) return;
    const ids = album.pages.map((p) => p.id);
    const from = ids.indexOf(pageId);
    const to = from + delta;
    if (to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    const byId = new Map(album.pages.map((p) => [p.id, p]));
    setAlbum({ ...album, pages: ids.map((id) => byId.get(id)!) });
    void run('reorder', async () => setAlbum((await albumApi.reorder(album.id, ids)).album));
  };

  if (!album || !mode) {
    return (
      <View style={styles.loading}>
        {error ? (
          <>
            <Text style={[albumStyles.body, { color: MidnightColors.dangerSoft, textAlign: 'center' }]}>{error}</Text>
            <AlbumButton label="Back to albums" onPress={onBack} />
          </>
        ) : <ActivityIndicator color={MidnightColors.gold} />}
      </View>
    );
  }

  const locked = album.status === 'approved';
  const allApproved = album.pageCount > 0 && album.approvedCount === album.pageCount && album.unsentCount === 0;
  const openRequests = album.pages.flatMap((page) => {
    const numbers = pinNumbers(page.comments);
    return page.comments
      .filter((c) => !c.parentId && !c.isDraft && c.status === 'open')
      .map((comment) => ({ page, comment, number: numbers.get(comment.id) }));
  });
  const openPage = (pageId: string) => setViewing(visiblePages.findIndex((p) => p.id === pageId));

  const showOptions = () => Alert.alert(album.title, undefined, [
    { text: 'Rename', onPress: () => setEditingTitle(album.title) },
    { text: album.rolesAssigned ? 'Change roles' : 'Assign roles', onPress: () => setRolesOpen(true) },
    ...(locked ? [{ text: 'Reopen album', onPress: () => void run('reopen', async () => setAlbum((await albumApi.reopen(album.id)).album)) }] : []),
    {
      text: 'Delete album',
      style: 'destructive' as const,
      onPress: () => confirm(`Delete “${album.title}”?`, 'Every page, version, comment and voice note in it is deleted for good.', 'Delete', () =>
        void run('delete', async () => { await albumApi.remove(album.id); onBack(); }), true),
    },
    { text: 'Cancel', style: 'cancel' as const },
  ]);

  const pageState = (page: AlbumPage) => albumPageState(page, mode, album.viewer.id);
  const stateCounts: Partial<Record<AlbumPageState, number>> = {};
  for (const page of visiblePages) stateCounts[pageState(page)] = (stateCounts[pageState(page)] ?? 0) + 1;
  const filters = ALBUM_PAGE_FILTERS[mode];
  // A tab that empties (its last page was approved or sent) falls back to All
  const activeFilter = filter !== 'all' && !stateCounts[filter] ? 'all' : filter;
  const shownPages = activeFilter === 'all' ? visiblePages : visiblePages.filter((p) => pageState(p) === activeFilter);
  const toCheck = stateCounts.check ?? 0;
  const status = albumWorkspaceStatus(album, mode, toCheck);
  const canEdit = mode === 'photographer' && !locked;
  const showAddTile = canEdit && !reorder && activeFilter === 'all' && album.rolesAssigned;
  const rows = rowWidth
    ? packRows([
      ...shownPages.map((page) => {
        const shown = mode !== 'photographer' ? page.versions.find((v) => v.version === page.sentVersion) : page.versions.at(-1);
        return { page, shown, ratio: albumPageRatio(shown, page.layout) };
      }),
      ...(showAddTile ? [{ page: null, shown: undefined, ratio: 0.75 }] : []),
    ], rowWidth, TILE_HEIGHT, TILE_GAP)
    : [];
  const activity = [
    ...album.rounds.map((r) => ({
      at: r.sentAt,
      text: `Round ${r.number}: ${r.sentByName ?? 'the photographer'} sent ${r.pageCount === 1 ? '1 page' : `${r.pageCount} pages`}${r.updatedPageCount ? ` (${r.updatedPageCount} updated)` : ''}`,
      done: false,
    })),
    ...album.pages.filter((p) => p.approvedAt).map((p) => ({ at: p.approvedAt!, text: `${p.approvedByName ?? 'The client'} approved ${labels.get(p.id)}`, done: false })),
    ...(album.approvedAt ? [{ at: album.approvedAt, text: `${album.approvedByName ?? 'The client'} approved the album for print`, done: true }] : []),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const sendPages = () => confirm(
    `Send ${album.unsentCount === 1 ? '1 page' : `${album.unsentCount} pages`} for review?`,
    'The event owner and admins get a notification and can comment on each page.',
    'Send',
    () => void run('send', async () => setAlbum((await albumApi.send(album.id)).album)),
  );
  const sendFeedback = () => confirm(
    album.myDraftCount ? `Send ${album.myDraftCount === 1 ? '1 note' : `${album.myDraftCount} notes`} to the photographer?` : "Tell the photographer you're done?",
    `${album.approvedCount} of ${visiblePages.length} pages approved. The photographer gets a notification.`,
    'Send',
    () => void run('feedback', async () => setAlbum((await albumApi.sendFeedback(album.id)).album)),
  );
  const quickApprove = (page: AlbumPage) => {
    const approve = () => void run(`approve-${page.id}`, async () => setAlbum((await albumApi.approvePage(album.id, page.id, true)).album));
    const open = page.comments.filter((c) => !c.parentId && !c.isDraft && c.status === 'open').length;
    if (!open) return approve();
    confirm(`Approve ${labels.get(page.id)}?`, `This also marks ${open === 1 ? 'the open request' : `the ${open} open requests`} on it as done.`, 'Approve', approve);
  };
  const pageOptions = (page: AlbumPage) => Alert.alert(labels.get(page.id) ?? 'Page', undefined, [
    { text: 'Upload a new version', onPress: () => void uploadVersion(page) },
    {
      text: 'Delete page',
      style: 'destructive',
      onPress: () => confirm(`Delete ${labels.get(page.id)}?`, 'All its versions and comments are deleted too.', 'Delete',
        () => void run(`delete-${page.id}`, async () => setAlbum((await albumApi.removePage(album.id, page.id)).album)), true),
    },
    { text: 'Cancel', style: 'cancel' },
  ]);

  return (
    <View style={{ gap: 14 }}>
      {/* Header */}
      <TouchableOpacity onPress={onBack} style={styles.back} accessibilityRole="button">
        <MaterialIcons name="arrow-back" size={16} color={MidnightColors.slate400} />
        <Text style={styles.backText}>All albums</Text>
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1, gap: 6 }}>
          {editingTitle !== null ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <TextInput value={editingTitle} onChangeText={setEditingTitle} maxLength={80} autoFocus style={[albumStyles.input, { flex: 1 }]} />
              <TouchableOpacity
                onPress={() => void run('rename', async () => { setAlbum((await albumApi.rename(album.id, editingTitle)).album); setEditingTitle(null); })}
                style={{ padding: 6 }}
                accessibilityLabel="Save name"
              >
                <MaterialIcons name="check" size={22} color={MidnightColors.gold} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingTitle(null)} style={{ padding: 6 }} accessibilityLabel="Cancel">
                <MaterialIcons name="close" size={22} color={MidnightColors.slate400} />
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={albumStyles.serifTitle} numberOfLines={2}>{album.title}</Text>
          )}
          {album.rolesAssigned && (
            <View style={styles.people}>
              <MaterialIcons name="photo-camera" size={15} color={MidnightColors.gold} accessibilityLabel="Photographer" />
              <Text style={styles.person}>{album.roles.photographer?.name}{mode === 'photographer' ? <Text style={styles.you}> (you)</Text> : null}</Text>
              <MaterialIcons name="arrow-forward" size={13} color={MidnightColors.slate600} />
              <MaterialIcons name="favorite-border" size={15} color={MidnightColors.gold} accessibilityLabel="Client" />
              <Text style={styles.person}>{album.roles.clients.map((p) => p.name).join(', ')}{mode === 'client' ? <Text style={styles.you}> (you)</Text> : null}</Text>
              {mode === 'viewer' ? <Text style={styles.viewOnly}>View only</Text> : null}
            </View>
          )}
        </View>
        <TouchableOpacity onPress={showOptions} style={{ padding: 6 }} accessibilityLabel="Album options">
          <MaterialIcons name="more-horiz" size={24} color={MidnightColors.slate400} />
        </TouchableOpacity>
      </View>

      <StepTracker step={albumStep(album)} round={album.currentRound} />

      {!album.rolesAssigned && (
        <View style={styles.assignCard}>
          <Text style={styles.progressTitle}>Assign the photographer and the client</Text>
          <Text style={albumStyles.small}>Pick them from the event host and guests with Admin Access. Nothing can be uploaded or reviewed until then.</Text>
          <AlbumButton kind="primary" icon="group" label="Assign roles" onPress={() => setRolesOpen(true)} />
        </View>
      )}

      {/* What now: where the album stands for this side, and at most one main action */}
      <View style={styles.progressCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MaterialIcons name={TONE_ICON[status.tone]} size={20} color={TONE_COLOR[status.tone]} />
          <Text style={[styles.statusTitle, { flex: 1 }]}>{status.title}</Text>
        </View>
        <Text style={albumStyles.body}>{status.detail}</Text>
        {visiblePages.length > 0 && (
          <View style={{ gap: 6 }}>
            <ProgressBar value={album.approvedCount} total={visiblePages.length} />
            <Text style={albumStyles.small}>
              <Text style={{ color: MidnightColors.text }}>{album.approvedCount}</Text> of {visiblePages.length} pages approved
              {filters.flatMap((f) => (f.id !== 'all' && f.id !== 'approved' && stateCounts[f.id] ? [` · ${stateCounts[f.id]} ${ALBUM_PAGE_STATE[f.id].counted}`] : [])).join('')}
            </Text>
          </View>
        )}
        {!locked && album.rolesAssigned && (mode === 'photographer' ? (
          <View style={{ gap: 8 }}>
            {album.unsentCount > 0 && (
              <AlbumButton kind="primary" icon="send" label={`Send ${album.unsentCount === 1 ? '1 page' : `${album.unsentCount} pages`}`} disabled={uploading} busy={busy === 'send'} onPress={sendPages} />
            )}
            {album.openRequestCount > 0 && activeFilter !== 'fix' && (
              <AlbumButton icon="chat-bubble-outline" label="See changes" onPress={() => { setReorder(false); setFilter('fix'); }} />
            )}
            <AlbumButton icon="add" label="Add pages" onPress={() => void uploadPages()} disabled={uploading} />
          </View>
        ) : mode === 'client' && album.currentRound > 0 ? (
          <View style={{ gap: 8 }}>
            {allApproved ? (
              <AlbumButton
                kind="success"
                icon="verified"
                label="Approve album"
                busy={busy === 'approve'}
                onPress={() => confirm('Approve the album for print?', "Every page is approved. The album is locked with today's date; it can be reopened if something needs to change.", 'Approve',
                  () => void run('approve', async () => setAlbum((await albumApi.approve(album.id)).album)))}
              />
            ) : toCheck > 0 ? (
              <AlbumButton
                kind={album.myDraftCount ? 'secondary' : 'primary'}
                icon="play-arrow"
                label={album.approvedCount || album.changesCount ? 'Continue review' : 'Start review'}
                onPress={() => setViewing(visiblePages.findIndex((p) => pageState(p) === 'check'))}
              />
            ) : null}
            {!allApproved && (
              <AlbumButton
                kind={album.myDraftCount ? 'primary' : 'secondary'}
                icon="send"
                label={album.myDraftCount ? `Send ${album.myDraftCount === 1 ? '1 note' : `${album.myDraftCount} notes`}` : 'Send feedback'}
                busy={busy === 'feedback'}
                onPress={sendFeedback}
              />
            )}
          </View>
        ) : null)}
      </View>

      {/* Uploads */}
      {uploads.length > 0 && (
        <View style={[albumStyles.card, { padding: 12, gap: 8 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[albumStyles.eyebrow, { flex: 1 }]}>Uploads · {uploads.filter((u) => u.state === 'done').length} of {uploads.length} done</Text>
            {!uploading && <AlbumButton kind="ghost" label="Clear" onPress={() => setUploads([])} />}
          </View>
          {uploads.map((u) => (
            <View key={u.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[albumStyles.small, { flex: 1, color: MidnightColors.slate300 }]} numberOfLines={1}>{u.name}</Text>
              {u.state === 'failed' ? (
                <Text style={[albumStyles.small, { color: MidnightColors.dangerSoft, maxWidth: '60%' }]} numberOfLines={2}>{u.error}</Text>
              ) : u.state === 'done' ? (
                <MaterialIcons name="check" size={18} color="#6EE7B7" />
              ) : (
                <Text style={albumStyles.small}>{u.state === 'processing' ? 'Processing' : u.state === 'waiting' ? 'Waiting' : `${Math.round(u.progress * 100)}%`}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Tabs */}
      {visiblePages.length > 0 && (
        <View style={{ gap: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {filters.filter((f) => f.id === 'all' || stateCounts[f.id]).map((f) => {
              const selected = activeFilter === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => { setReorder(false); setFilter(f.id); }}
                  style={[styles.tab, selected && styles.tabSelected]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.tabText, selected && { color: MidnightColors.background }]}>
                    {f.label} <Text style={{ opacity: 0.7 }}>{f.id === 'all' ? visiblePages.length : stateCounts[f.id]}</Text>
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {canEdit && visiblePages.length > 1 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {reorder && <Text style={[albumStyles.small, { flex: 1 }]}>Move the pages into the order they appear in the album.</Text>}
              <AlbumButton
                kind="ghost"
                icon={reorder ? 'check' : 'swap-vert'}
                label={reorder ? 'Done' : 'Reorder'}
                onPress={() => { setFilter('all'); setReorder(!reorder); }}
                style={{ marginLeft: 'auto' }}
              />
            </View>
          )}
        </View>
      )}

      {/* Photographer, To fix tab: what the client asked for */}
      {mode === 'photographer' && activeFilter === 'fix' && openRequests.length > 0 && (
        <View style={styles.todo}>
          <Text style={[albumStyles.eyebrow, { color: '#FECDD3' }]}>Changes to make · {openRequests.length}</Text>
          {openRequests.map(({ page, comment, number }) => (
            <View key={comment.id} style={styles.todoItem}>
              <TouchableOpacity onPress={() => openPage(page.id)}>
                <Image source={{ uri: page.versions.find((v) => v.version === comment.version)?.thumbnailUrl ?? page.versions.at(-1)?.thumbnailUrl }} style={styles.todoThumb} contentFit="contain" />
              </TouchableOpacity>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={albumStyles.small}>{labels.get(page.id)} · {comment.pinX !== null ? `pin ${number}` : 'whole page'} · {comment.authorName}</Text>
                <Text style={styles.todoKind}>{albumCommentKindLabel(comment.kind)}</Text>
                {!!comment.body && <Text style={[albumStyles.body, { color: MidnightColors.text }]} numberOfLines={3}>{comment.body}</Text>}
                {!!comment.voiceUrl && <VoicePlayer uri={comment.voiceUrl} seconds={comment.voiceSeconds} />}
                {comment.replacementPhoto?.thumbnailUrl && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Image source={{ uri: comment.replacementPhoto.thumbnailUrl }} style={{ width: 32, height: 32, borderRadius: 6 }} contentFit="cover" />
                    <Text style={albumStyles.small}>Replacement photo</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  <AlbumButton kind="ghost" icon="open-in-new" label="Open" onPress={() => openPage(page.id)} />
                  <AlbumButton kind="ghost" icon="check" label="Done" busy={busy === comment.id} onPress={() => void run(comment.id, async () => { await albumApi.setCommentStatus(album.id, comment.id, 'done'); await refresh(); })} />
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Pages, laid out like the album: rows that fill the width, each page keeping its own shape */}
      {visiblePages.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="photo-album" size={32} color={MidnightColors.gold} />
          {mode === 'photographer' ? (
            <>
              <Text style={styles.emptyTitle}>Add the album pages</Text>
              <Text style={[albumStyles.body, { textAlign: 'center' }]}>
                One image per page or per spread, numbered by file name (01.jpg, 02.jpg…). We keep a sharp preview only; your original files aren&apos;t stored.
              </Text>
              {album.rolesAssigned && !locked && <AlbumButton kind="primary" icon="add" label="Add pages" onPress={() => void uploadPages()} disabled={uploading} />}
            </>
          ) : (
            <Text style={[albumStyles.body, { textAlign: 'center' }]}>
              {mode === 'client' ? "No pages to review yet. You'll get a notification when the photographer sends them." : 'No pages have been sent for review yet.'}
            </Text>
          )}
        </View>
      ) : (
        <View style={{ gap: TILE_GAP }} onLayout={(e) => setRowWidth(Math.floor(e.nativeEvent.layout.width))}>
          {rows.map((row, r) => (
            <View key={r} style={{ flexDirection: 'row', gap: TILE_GAP, alignItems: 'flex-start' }}>
              {row.items.map(({ page, shown, width }) => {
                if (!page) {
                  return (
                    <TouchableOpacity key="add" onPress={() => void uploadPages()} disabled={uploading} style={[styles.addTile, { width, height: row.height }]} accessibilityRole="button">
                      <MaterialIcons name="add" size={22} color={MidnightColors.gold} />
                      <Text style={styles.addTileText}>Add pages</Text>
                    </TouchableOpacity>
                  );
                }
                const index = visiblePages.indexOf(page);
                const label = labels.get(page.id);
                const state = ALBUM_PAGE_STATE[pageState(page)];
                const requests = page.comments.filter((c) => !c.parentId && c.status === 'open' && (!c.isDraft || c.authorId === album.viewer.id)).length;
                const updated = mode !== 'photographer' && (page.sentVersion ?? 0) > 1 && page.versions.find((v) => v.version === page.sentVersion)?.round === album.currentRound;
                const pageIndex = album.pages.findIndex((p) => p.id === page.id);
                // Two buttons side by side need room; narrower tiles stack them, and only wide ones spell out "Ask for a change"
                const narrow = width < 150;
                const roomy = width >= 280;
                return (
                  <View key={page.id} style={[styles.tile, { width }, reorder && styles.tileReorder]}>
                    <Pressable onPress={() => !reorder && setViewing(index)} style={{ width, height: row.height, backgroundColor: 'rgba(0,0,0,0.6)' }} accessibilityRole="button" accessibilityLabel={`Open ${label}`}>
                      {shown && <Image source={{ uri: shown.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />}
                      {page.layout === 'spread' && <View style={styles.fold} />}
                      <View style={styles.badges}>
                        {updated && <Text style={styles.updated}>UPDATED</Text>}
                        {requests > 0 && (
                          <View style={styles.requestCount}>
                            <MaterialIcons name="chat-bubble-outline" size={12} color="#FFFFFF" />
                            <Text style={styles.requestCountText}>{requests}</Text>
                          </View>
                        )}
                      </View>
                    </Pressable>
                    {canEdit && !reorder && (
                      <TouchableOpacity onPress={() => pageOptions(page)} style={styles.tileMenu} accessibilityLabel={`Options for ${label}`}>
                        {busy?.endsWith(page.id) ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialIcons name="more-horiz" size={18} color="#FFFFFF" />}
                      </TouchableOpacity>
                    )}
                    <View style={styles.tileInfo}>
                      <Text style={styles.pageLabel} numberOfLines={1}>{label}{page.layout === 'spread' && !(canEdit && !reorder) ? <Text style={styles.spreadWord}> · spread</Text> : null}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <View style={[styles.dot, { backgroundColor: TONE_DOT[state.tone] }]} />
                        <Text style={[styles.stateText, { color: TONE_COLOR[state.tone] }]} numberOfLines={1}>{state.label}</Text>
                      </View>
                    </View>
                    {canEdit && !reorder && (
                      <View style={styles.layoutRow}>
                        <View style={styles.layoutToggle} accessibilityRole="radiogroup" accessibilityLabel={`Layout of ${label}`}>
                          {(['spread', 'single'] as const).map((layout) => {
                            const selected = page.layout === layout;
                            return (
                              <TouchableOpacity
                                key={layout}
                                onPress={() => !selected && void run(`layout-${page.id}`, async () => setAlbum((await albumApi.setLayout(album.id, page.id, layout)).album))}
                                disabled={busy === `layout-${page.id}`}
                                style={[styles.layoutItem, selected && styles.layoutActive]}
                                accessibilityRole="radio"
                                accessibilityState={{ selected }}
                              >
                                <MaterialIcons name={layout === 'spread' ? 'menu-book' : 'crop-portrait'} size={14} color={selected ? MidnightColors.text : MidnightColors.slate400} />
                                <Text style={[styles.layoutText, selected && { color: MidnightColors.text }]}>{layout === 'spread' ? 'Spread' : 'Single'}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}
                    {reorder && (
                      <View style={styles.reorderRow}>
                        <TouchableOpacity onPress={() => movePage(page.id, -1)} disabled={pageIndex === 0} style={[styles.toolIcon, pageIndex === 0 && { opacity: 0.3 }]} accessibilityLabel={`Move ${label} earlier`}>
                          <MaterialIcons name="arrow-back" size={18} color={MidnightColors.text} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => movePage(page.id, 1)} disabled={pageIndex === album.pages.length - 1} style={[styles.toolIcon, pageIndex === album.pages.length - 1 && { opacity: 0.3 }]} accessibilityLabel={`Move ${label} later`}>
                          <MaterialIcons name="arrow-forward" size={18} color={MidnightColors.text} />
                        </TouchableOpacity>
                      </View>
                    )}
                    {mode === 'client' && !locked && pageState(page) !== 'approved' && (
                      <View style={[styles.quickRow, narrow && { flexDirection: 'column' }]}>
                        <TouchableOpacity onPress={() => quickApprove(page)} disabled={busy === `approve-${page.id}`} style={[styles.quick, styles.quickApprove]} accessibilityRole="button" accessibilityLabel={`Approve ${label}`}>
                          {busy === `approve-${page.id}` ? <ActivityIndicator size="small" color="#A7F3D0" /> : <MaterialIcons name="check" size={15} color="#A7F3D0" />}
                          <Text style={[styles.quickText, { color: '#A7F3D0' }]}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setViewing(index)} style={[styles.quick, styles.quickChange]} accessibilityRole="button" accessibilityLabel={`Ask for a change on ${label}`}>
                          <MaterialIcons name="edit" size={14} color={MidnightColors.slate300} />
                          <Text style={[styles.quickText, { color: MidnightColors.slate300 }]} numberOfLines={1}>{roomy ? 'Ask for a change' : 'Change'}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      )}

      {activity.length > 0 && (
        <View style={[albumStyles.card, { paddingHorizontal: 14, paddingVertical: 12, gap: 10 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MaterialIcons name="history" size={16} color={MidnightColors.slate400} />
            <Text style={[albumStyles.small, { flex: 1 }]} numberOfLines={historyOpen ? 1 : 2}>
              <Text style={{ color: MidnightColors.text }}>Activity</Text>
              {!historyOpen ? ` · ${activity[0].text} · ${formatAlbumDay(activity[0].at)}` : ''}
            </Text>
            {activity.length > 1 && (
              <TouchableOpacity onPress={() => setHistoryOpen(!historyOpen)} accessibilityRole="button" accessibilityState={{ expanded: historyOpen }}>
                <Text style={styles.seeAll}>{historyOpen ? 'Hide' : `See all ${activity.length}`}</Text>
              </TouchableOpacity>
            )}
          </View>
          {historyOpen && (
            <View style={styles.activityList}>
              {activity.map((item, i) => (
                <Text key={i} style={albumStyles.small}>
                  <Text style={{ color: item.done ? '#A7F3D0' : MidnightColors.text }}>{item.text}</Text> · {formatAlbumDay(item.at)}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      {rolesOpen && (
        <RolesModal
          eventId={album.eventId}
          albumId={album.id}
          title={album.rolesAssigned ? 'Change roles' : 'Assign roles'}
          initial={{ photographerId: album.roles.photographer?.id, clientIds: album.roles.clients.map((p) => p.id) }}
          onClose={() => setRolesOpen(false)}
          onSaved={(updated) => { setAlbum(updated); setRolesOpen(false); }}
        />
      )}

      {viewing !== null && viewing >= 0 && visiblePages[viewing] && (
        <PageReviewer
          album={album}
          pages={visiblePages}
          labels={labels}
          index={viewing}
          mode={mode}
          onIndexChange={setViewing}
          onClose={() => setViewing(null)}
          onAlbum={setAlbum}
          refresh={refresh}
          onUploadVersion={uploadVersion}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { minHeight: 200, alignItems: 'center', justifyContent: 'center', gap: 12 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  backText: { color: MidnightColors.slate400, fontSize: 11, fontFamily: Fonts.outfit.extraBold, letterSpacing: 1.4, textTransform: 'uppercase' },
  people: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 6, rowGap: 4 },
  person: { color: MidnightColors.text, fontSize: 13, fontFamily: Fonts.outfit.semiBold },
  you: { color: MidnightColors.slate400 },
  viewOnly: { color: MidnightColors.slate300, backgroundColor: 'rgba(255,255,255,0.1)', fontSize: 11, fontFamily: Fonts.outfit.bold, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  stepDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  stepDone: { backgroundColor: MidnightColors.gold, borderColor: MidnightColors.gold },
  stepCurrent: { borderColor: MidnightColors.gold },
  stepNumber: { color: MidnightColors.slate400, fontSize: 11, fontFamily: Fonts.outfit.extraBold },
  stepLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.15)' },
  stepCaption: { color: '#E8C9A0', fontSize: 12, fontFamily: Fonts.outfit.bold },
  assignCard: { borderWidth: 1, borderColor: 'rgba(202,156,104,0.5)', backgroundColor: 'rgba(202,156,104,0.08)', borderRadius: 20, padding: 14, gap: 8 },
  progressCard: { borderWidth: 1, borderColor: 'rgba(220,181,121,0.26)', backgroundColor: MidnightColors.surface, borderRadius: 20, padding: 14, gap: 10 },
  progressTitle: { color: MidnightColors.text, fontSize: 14, fontFamily: Fonts.outfit.extraBold },
  statusTitle: { color: MidnightColors.text, fontSize: 16, fontFamily: Fonts.outfit.extraBold },
  tab: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  tabSelected: { backgroundColor: MidnightColors.text, borderColor: MidnightColors.text },
  tabText: { color: MidnightColors.slate400, fontSize: 12, fontFamily: Fonts.outfit.bold },
  todo: { borderWidth: 1, borderColor: 'rgba(251,113,133,0.25)', backgroundColor: 'rgba(244,63,94,0.04)', borderRadius: 20, padding: 12, gap: 10 },
  todoItem: { flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 16, padding: 10 },
  todoThumb: { width: 84, height: 48, borderRadius: 8, backgroundColor: '#000' },
  todoKind: { color: '#E8C9A0', fontSize: 13, fontFamily: Fonts.outfit.extraBold },
  empty: { alignItems: 'center', gap: 10, borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: 24 },
  emptyTitle: { color: MidnightColors.text, fontSize: 18, fontFamily: Fonts.playfair.bold },
  tile: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: MidnightColors.surface, overflow: 'hidden' },
  tileReorder: { borderStyle: 'dashed', borderColor: 'rgba(202,156,104,0.5)' },
  fold: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  badges: { position: 'absolute', left: 8, top: 8, flexDirection: 'row', gap: 6 },
  updated: { backgroundColor: MidnightColors.gold, color: MidnightColors.onAccent, fontSize: 9, fontFamily: Fonts.outfit.extraBold, letterSpacing: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  requestCount: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  requestCountText: { color: '#FFFFFF', fontSize: 11, fontFamily: Fonts.outfit.extraBold },
  tileMenu: { position: 'absolute', right: 6, top: 6, width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  tileInfo: { paddingHorizontal: 10, paddingVertical: 8, gap: 3 },
  pageLabel: { color: MidnightColors.text, fontSize: 15, fontFamily: Fonts.playfair.bold },
  spreadWord: { color: MidnightColors.slate400, fontSize: 11, fontFamily: Fonts.outfit.semiBold },
  dot: { width: 7, height: 7, borderRadius: 4 },
  stateText: { fontSize: 12, fontFamily: Fonts.outfit.bold },
  layoutRow: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', padding: 6 },
  layoutToggle: { flexDirection: 'row', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 2 },
  layoutItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7, borderRadius: 10 },
  layoutActive: { backgroundColor: 'rgba(255,255,255,0.15)' },
  layoutText: { color: MidnightColors.slate400, fontSize: 12, fontFamily: Fonts.outfit.bold },
  reorderRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 4 },
  quickRow: { flexDirection: 'row', gap: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', padding: 6 },
  quick: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 6 },
  quickApprove: { backgroundColor: 'rgba(52,211,153,0.12)' },
  quickChange: { backgroundColor: 'rgba(255,255,255,0.06)' },
  quickText: { fontSize: 12, fontFamily: Fonts.outfit.bold },
  addTile: { borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(202,156,104,0.4)', alignItems: 'center', justifyContent: 'center', gap: 4 },
  addTileText: { color: '#E8C9A0', fontSize: 13, fontFamily: Fonts.outfit.bold },
  seeAll: { color: '#E8C9A0', fontSize: 12, fontFamily: Fonts.outfit.bold },
  activityList: { gap: 6, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)', paddingLeft: 12 },
  toolIcon: { padding: 8 },
});
