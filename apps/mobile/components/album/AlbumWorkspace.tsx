import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  ALBUM_MAX_PAGE_BYTES, albumApi, albumCommentKindLabel, albumPageLabels, pinNumbers, sortByFileName,
  type AlbumDetail, type AlbumPage, type LocalFile,
} from '../../lib/albumApi';
import { Fonts, MidnightColors } from '../../constants/theme';
import { AlbumButton, albumStyles, AlbumStatusChip, PageStatusChip, ProgressBar } from './albumUi';
import { PageReviewer, type AlbumMode } from './PageReviewer';
import { RolesModal } from './RolePicker';
import { VoicePlayer } from './VoiceNote';

type UploadItem = { key: string; name: string; progress: number; state: 'waiting' | 'uploading' | 'processing' | 'done' | 'failed'; error?: string };

const PAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'];
const PAGE_EXTENSIONS = /\.(jpe?g|png|webp|tiff?)$/i;
const REFRESH_MS = 30_000;
const UPLOAD_CONCURRENCY = 2;

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
      } catch { /* the order can still be fixed with the arrows */ }
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
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <AlbumStatusChip status={album.status} />
            <Text style={albumStyles.small}>{album.pageCount} {album.pageCount === 1 ? 'page' : 'pages'}{album.currentRound ? ` · Round ${album.currentRound}` : ''}</Text>
          </View>
          {locked && album.approvedAt && (
            <Text style={[albumStyles.small, { color: '#6EE7B7' }]}>Approved by {album.approvedByName} on {new Date(album.approvedAt).toLocaleDateString()}</Text>
          )}
          {album.rolesAssigned && (
            <View style={{ gap: 3 }}>
              <Text style={albumStyles.small}>Photographer: <Text style={{ color: MidnightColors.slate300 }}>{album.roles.photographer?.name}</Text></Text>
              <Text style={albumStyles.small}>Client: <Text style={{ color: MidnightColors.slate300 }}>{album.roles.clients.map((p) => p.name).join(', ')}</Text></Text>
              <Text style={styles.youBadge}>{mode === 'photographer' ? 'YOU: PHOTOGRAPHER' : mode === 'client' ? 'YOU: COUPLE' : 'VIEW ONLY'}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={showOptions} style={{ padding: 6 }} accessibilityLabel="Album options">
          <MaterialIcons name="more-horiz" size={24} color={MidnightColors.slate400} />
        </TouchableOpacity>
      </View>

      {!album.rolesAssigned && (
        <View style={styles.assignCard}>
          <Text style={styles.progressTitle}>Assign the photographer and the client</Text>
          <Text style={albumStyles.small}>Pick them from the event host and guests with Admin Access. Nothing can be uploaded or reviewed until then.</Text>
          <AlbumButton kind="primary" icon="group" label="Assign roles" onPress={() => setRolesOpen(true)} />
        </View>
      )}

      {/* Progress and the main action for this side */}
      <View style={styles.progressCard}>
        <Text style={styles.progressTitle}>
          {album.approvedCount} of {album.pageCount} pages approved
          {album.changesCount > 0 ? <Text style={{ color: '#FDA4AF' }}> · {album.changesCount} need changes</Text> : null}
        </Text>
        <ProgressBar value={album.approvedCount} total={album.pageCount} />
        <Text style={albumStyles.small}>
          {mode === 'photographer'
            ? album.unsentCount
              ? `${album.unsentCount} ${album.unsentCount === 1 ? "page isn't" : "pages aren't"} sent yet.`
              : album.openRequestCount ? `${album.openRequestCount} ${album.openRequestCount === 1 ? 'change' : 'changes'} to do.` : album.currentRound ? 'Waiting for the client.' : 'Upload the album pages to start.'
            : mode === 'viewer'
              ? "View only: you're not the photographer or the client in this album."
              : album.myDraftCount
              ? `${album.myDraftCount} ${album.myDraftCount === 1 ? 'comment' : 'comments'} not sent yet.`
              : album.currentRound ? 'Open a page to comment on it, or approve it.' : "The photographer hasn't sent any pages yet."}
        </Text>
        {locked ? (
          <Text style={[styles.progressTitle, { color: '#A7F3D0' }]}>✓ Approved for print</Text>
        ) : mode === 'photographer' ? (
          <View style={{ gap: 8 }}>
            <AlbumButton icon="upload" label="Upload pages" onPress={() => void uploadPages()} disabled={uploading} />
            <AlbumButton
              kind="primary"
              icon="send"
              label={`Send for review${album.unsentCount ? ` (${album.unsentCount})` : ''}`}
              disabled={!album.unsentCount || uploading}
              busy={busy === 'send'}
              onPress={() => confirm(
                `Send ${album.unsentCount === 1 ? '1 page' : `${album.unsentCount} pages`} for review?`,
                'The event owner and admins get a notification and can comment on each page.',
                'Send',
                () => void run('send', async () => setAlbum((await albumApi.send(album.id)).album)),
              )}
            />
          </View>
        ) : mode === 'client' && album.currentRound > 0 ? (
          <View style={{ gap: 8 }}>
            {allApproved && (
              <AlbumButton
                kind="success"
                icon="verified"
                label="Approve album"
                busy={busy === 'approve'}
                onPress={() => confirm('Approve the album for print?', "Every page is approved. The album is locked with today's date; it can be reopened if something needs to change.", 'Approve',
                  () => void run('approve', async () => setAlbum((await albumApi.approve(album.id)).album)))}
              />
            )}
            <AlbumButton
              kind="primary"
              icon="send"
              label={`Send feedback${album.myDraftCount ? ` (${album.myDraftCount})` : ''}`}
              busy={busy === 'feedback'}
              onPress={() => confirm(
                album.myDraftCount ? `Send ${album.myDraftCount === 1 ? '1 comment' : `${album.myDraftCount} comments`} to the photographer?` : "Tell the photographer you're done?",
                `${album.approvedCount} of ${album.pageCount} pages approved. The photographer gets a notification.`,
                'Send',
                () => void run('feedback', async () => setAlbum((await albumApi.sendFeedback(album.id)).album)),
              )}
            />
          </View>
        ) : null}
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

      {/* Photographer: what the client asked for */}
      {mode === 'photographer' && openRequests.length > 0 && (
        <View style={styles.todo}>
          <Text style={[albumStyles.eyebrow, { color: '#FECDD3' }]}>Changes to do · {openRequests.length}</Text>
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

      {/* Pages */}
      {visiblePages.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="photo-album" size={32} color={MidnightColors.gold} />
          {mode === 'photographer' ? (
            <>
              <Text style={styles.emptyTitle}>Add the album pages</Text>
              <Text style={[albumStyles.body, { textAlign: 'center' }]}>
                One image per page or per spread, numbered by file name (01.jpg, 02.jpg…). We keep a sharp preview only; your original files aren&apos;t stored.
              </Text>
            </>
          ) : (
            <Text style={[albumStyles.body, { textAlign: 'center' }]}>
              {mode === 'client' ? "No pages to review yet. You'll get a notification when the photographer sends them." : 'No pages have been sent for review yet.'}
            </Text>
          )}
        </View>
      ) : (
        visiblePages.map((page, index) => {
          const shown = mode !== 'photographer' ? page.versions.find((v) => v.version === page.sentVersion) : page.versions.at(-1);
          const requests = page.comments.filter((c) => !c.parentId && c.status === 'open' && (!c.isDraft || c.authorId === album.viewer.id)).length;
          const updated = mode !== 'photographer' && (page.sentVersion ?? 0) > 1 && page.versions.find((v) => v.version === page.sentVersion)?.round === album.currentRound;
          const pageIndex = album.pages.findIndex((p) => p.id === page.id);
          return (
            <View key={page.id} style={albumStyles.card}>
              <Pressable onPress={() => setViewing(index)} style={styles.thumbBox} accessibilityRole="button" accessibilityLabel={`Open ${labels.get(page.id)}`}>
                {shown && <Image source={{ uri: shown.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} />}
                {updated && <Text style={styles.updated}>UPDATED</Text>}
                {requests > 0 && (
                  <View style={styles.requestCount}>
                    <MaterialIcons name="chat-bubble-outline" size={12} color="#FFFFFF" />
                    <Text style={styles.requestCountText}>{requests}</Text>
                  </View>
                )}
              </Pressable>
              <View style={styles.pageInfo}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.pageLabel}>{labels.get(page.id)}</Text>
                  <Text style={albumStyles.small} numberOfLines={1}>
                    v{mode !== 'photographer' ? page.sentVersion : page.latestVersion}
                    {mode === 'photographer' && page.latestVersion > (page.sentVersion ?? 0) ? ' · not sent' : ''}
                    {page.versions.at(-1)?.fileName ? ` · ${page.versions.at(-1)!.fileName}` : ''}
                  </Text>
                </View>
                <PageStatusChip status={page.status} />
              </View>
              {mode === 'photographer' && !locked && (
                <View style={styles.pageTools}>
                  <View style={styles.layoutToggle}>
                    {(['spread', 'single'] as const).map((layout) => (
                      <TouchableOpacity
                        key={layout}
                        onPress={() => page.layout !== layout && void run(`layout-${page.id}`, async () => setAlbum((await albumApi.setLayout(album.id, page.id, layout)).album))}
                        style={[styles.layoutItem, page.layout === layout && styles.layoutActive]}
                        accessibilityState={{ selected: page.layout === layout }}
                      >
                        <Text style={[styles.layoutText, page.layout === layout && { color: MidnightColors.text }]}>{layout === 'spread' ? 'Spread' : 'Single'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row' }}>
                    <TouchableOpacity onPress={() => movePage(page.id, -1)} disabled={pageIndex === 0} style={[styles.toolIcon, pageIndex === 0 && { opacity: 0.3 }]} accessibilityLabel="Move up">
                      <MaterialIcons name="arrow-upward" size={18} color={MidnightColors.slate400} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => movePage(page.id, 1)} disabled={pageIndex === album.pages.length - 1} style={[styles.toolIcon, pageIndex === album.pages.length - 1 && { opacity: 0.3 }]} accessibilityLabel="Move down">
                      <MaterialIcons name="arrow-downward" size={18} color={MidnightColors.slate400} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => confirm(`Delete ${labels.get(page.id)}?`, 'All its versions and comments are deleted too.', 'Delete',
                        () => void run(`delete-${page.id}`, async () => setAlbum((await albumApi.removePage(album.id, page.id)).album)), true)}
                      style={styles.toolIcon}
                      accessibilityLabel={`Delete ${labels.get(page.id)}`}
                    >
                      <MaterialIcons name="delete-outline" size={18} color={MidnightColors.slate400} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        })
      )}

      {album.rounds.length > 0 && (
        <View style={[albumStyles.card, { padding: 14, gap: 6 }]}>
          <Text style={albumStyles.eyebrow}>Review history</Text>
          {[...album.rounds].reverse().map((r) => (
            <Text key={r.number} style={albumStyles.small}>
              Round {r.number}: {r.sentByName ?? 'Someone'} sent {r.pageCount} {r.pageCount === 1 ? 'page' : 'pages'}
              {r.updatedPageCount ? ` (${r.updatedPageCount} updated)` : ''} on {new Date(r.sentAt).toLocaleDateString()}
            </Text>
          ))}
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
  youBadge: { alignSelf: 'flex-start', marginTop: 2, color: MidnightColors.slate300, backgroundColor: 'rgba(255,255,255,0.1)', fontSize: 9, fontFamily: Fonts.outfit.extraBold, letterSpacing: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  assignCard: { borderWidth: 1, borderColor: 'rgba(202,156,104,0.5)', backgroundColor: 'rgba(202,156,104,0.08)', borderRadius: 20, padding: 14, gap: 8 },
  progressCard: { borderWidth: 1, borderColor: 'rgba(202,156,104,0.25)', backgroundColor: 'rgba(202,156,104,0.08)', borderRadius: 20, padding: 14, gap: 10 },
  progressTitle: { color: MidnightColors.text, fontSize: 14, fontFamily: Fonts.outfit.extraBold },
  todo: { borderWidth: 1, borderColor: 'rgba(251,113,133,0.25)', backgroundColor: 'rgba(244,63,94,0.04)', borderRadius: 20, padding: 12, gap: 10 },
  todoItem: { flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 16, padding: 10 },
  todoThumb: { width: 84, height: 48, borderRadius: 8, backgroundColor: '#000' },
  todoKind: { color: '#E8C9A0', fontSize: 13, fontFamily: Fonts.outfit.extraBold },
  empty: { alignItems: 'center', gap: 10, borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: 24 },
  emptyTitle: { color: MidnightColors.text, fontSize: 18, fontFamily: Fonts.playfair.bold },
  thumbBox: { aspectRatio: 2, backgroundColor: 'rgba(0,0,0,0.6)' },
  updated: { position: 'absolute', left: 8, top: 8, backgroundColor: MidnightColors.gold, color: MidnightColors.onAccent, fontSize: 9, fontFamily: Fonts.outfit.extraBold, letterSpacing: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  requestCount: { position: 'absolute', right: 8, top: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  requestCountText: { color: '#FFFFFF', fontSize: 11, fontFamily: Fonts.outfit.extraBold },
  pageInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  pageLabel: { color: MidnightColors.text, fontSize: 15, fontFamily: Fonts.outfit.extraBold },
  pageTools: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 8, paddingVertical: 6 },
  layoutToggle: { flexDirection: 'row', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 2 },
  layoutItem: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  layoutActive: { backgroundColor: 'rgba(255,255,255,0.15)' },
  layoutText: { color: MidnightColors.slate600, fontSize: 10, fontFamily: Fonts.outfit.extraBold, letterSpacing: 1, textTransform: 'uppercase' },
  toolIcon: { padding: 8 },
});
