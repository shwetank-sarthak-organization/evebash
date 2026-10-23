import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ALBUM_COMMENT_KINDS, albumApi, albumCommentKindLabel, pinNumbers,
  type AlbumComment, type AlbumCommentKind, type AlbumDetail, type AlbumPage, type AlbumPhoto, type LocalFile,
} from '../../lib/albumApi';
import { Fonts, MidnightColors } from '../../constants/theme';
import { AlbumButton, albumStyles, PageStatusChip } from './albumUi';
import { FavouritePicker } from './FavouritePicker';
import { VoicePlayer, VoiceRecorder, type VoiceRecording } from './VoiceNote';

export type AlbumMode = 'photographer' | 'couple';
type Draft = { pinX: number | null; pinY: number | null };

const ZOOM = 2.2;

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

function Pin({ number, state, x, y, width, height, active, onPress }: {
  number: number | string;
  state: 'draft' | 'open' | 'done' | 'new';
  x: number;
  y: number;
  width: number;
  height: number;
  active?: boolean;
  onPress?: () => void;
}) {
  const look = {
    draft: { backgroundColor: 'rgba(19,25,31,0.9)', borderColor: MidnightColors.gold, color: MidnightColors.gold, borderStyle: 'dashed' as const },
    open: { backgroundColor: MidnightColors.gold, borderColor: '#FFFFFF', color: MidnightColors.onAccent, borderStyle: 'solid' as const },
    done: { backgroundColor: '#10B981', borderColor: '#D1FAE5', color: '#FFFFFF', borderStyle: 'solid' as const },
    new: { backgroundColor: '#F43F5E', borderColor: '#FFFFFF', color: '#FFFFFF', borderStyle: 'solid' as const },
  }[state];
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      hitSlop={8}
      style={[styles.pin, { left: x * width - 14, top: y * height - 14, backgroundColor: look.backgroundColor, borderColor: look.borderColor, borderStyle: look.borderStyle }, active && styles.pinActive]}
      accessibilityLabel={`Comment ${number}`}
    >
      <Text style={[styles.pinText, { color: look.color }]}>{number}</Text>
    </TouchableOpacity>
  );
}

function CommentCard({ comment, number, replies, album, page, mode, active, onFocus, onChanged }: {
  comment: AlbumComment;
  number: number | undefined;
  replies: AlbumComment[];
  album: AlbumDetail;
  page: AlbumPage;
  mode: AlbumMode;
  active: boolean;
  onFocus: () => void;
  onChanged: () => Promise<void>;
}) {
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const mine = comment.authorId === album.viewer.id;
  const locked = album.status === 'approved';

  const run = async (task: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await task();
      await onChanged();
    } catch (e) {
      Alert.alert("That didn't work", errorText(e, 'Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const badgeStyle = comment.status === 'done'
    ? { backgroundColor: '#10B981' }
    : comment.isDraft ? { borderWidth: 1, borderStyle: 'dashed' as const, borderColor: MidnightColors.gold } : { backgroundColor: MidnightColors.gold };

  return (
    <Pressable onPress={onFocus} style={[styles.comment, active && styles.commentActive, comment.status === 'done' && !active && { opacity: 0.75 }]}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={[styles.badge, badgeStyle]}>
          <Text style={[styles.badgeText, { color: comment.isDraft && comment.status !== 'done' ? MidnightColors.gold : comment.status === 'done' ? '#FFFFFF' : MidnightColors.onAccent }]}>
            {comment.pinX !== null ? number : '•'}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <Text style={styles.kind}>{albumCommentKindLabel(comment.kind)}</Text>
            {comment.isDraft && <Text style={styles.draft}>Draft</Text>}
            {comment.status === 'done' && <Text style={styles.done}>✓ Done</Text>}
          </View>
          <Text style={albumStyles.small}>{comment.authorName} · on v{comment.version}</Text>
          {!!comment.body && <Text style={styles.bodyText}>{comment.body}</Text>}
          {!!comment.voiceUrl && <VoicePlayer uri={comment.voiceUrl} seconds={comment.voiceSeconds} />}
          {comment.replacementPhoto && (
            <TouchableOpacity
              style={styles.replacement}
              onPress={() => comment.replacementPhoto?.previewUrl && WebBrowser.openBrowserAsync(comment.replacementPhoto.previewUrl)}
            >
              {comment.replacementPhoto.thumbnailUrl && <Image source={{ uri: comment.replacementPhoto.thumbnailUrl }} style={styles.replacementImage} contentFit="cover" />}
              <Text style={[albumStyles.body, { flex: 1 }]}>♥ Use this favourite instead</Text>
            </TouchableOpacity>
          )}
          {comment.status === 'done' && !!comment.resolvedByName && (
            <Text style={[albumStyles.small, { color: '#6EE7B7' }]}>Marked done by {comment.resolvedByName}</Text>
          )}
          {replies.length > 0 && (
            <View style={styles.replies}>
              {replies.map((r) => (
                <View key={r.id} style={{ gap: 2 }}>
                  <Text style={[albumStyles.small, { color: MidnightColors.slate400 }]}>{r.authorName}</Text>
                  {!!r.body && <Text style={styles.bodyText}>{r.body}</Text>}
                  {!!r.voiceUrl && <VoicePlayer uri={r.voiceUrl} seconds={r.voiceSeconds} />}
                </View>
              ))}
            </View>
          )}
          {replying && (
            <View style={{ gap: 8 }}>
              <TextInput value={reply} onChangeText={setReply} placeholder="Write a reply" placeholderTextColor={MidnightColors.slate600} multiline maxLength={2000} autoFocus style={[albumStyles.input, { minHeight: 64 }]} />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                <AlbumButton kind="ghost" label="Cancel" onPress={() => { setReplying(false); setReply(''); }} />
                <AlbumButton
                  kind="primary"
                  label="Reply"
                  busy={busy}
                  disabled={!reply.trim()}
                  onPress={() => run(async () => {
                    await albumApi.addComment(album.id, page.id, { parentId: comment.id, body: reply });
                    setReply('');
                    setReplying(false);
                  })}
                />
              </View>
            </View>
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
            {!comment.isDraft && !locked && (
              comment.status === 'open'
                ? <AlbumButton kind="ghost" icon="check" label={mode === 'photographer' ? 'Mark done' : 'Resolved'} busy={busy} onPress={() => run(() => albumApi.setCommentStatus(album.id, comment.id, 'done'))} />
                : <AlbumButton kind="ghost" icon="undo" label="Reopen" busy={busy} onPress={() => run(() => albumApi.setCommentStatus(album.id, comment.id, 'open'))} />
            )}
            {!comment.isDraft && !locked && !replying && <AlbumButton kind="ghost" icon="reply" label="Reply" onPress={() => setReplying(true)} />}
            {mine && !locked && (
              <AlbumButton
                kind="ghost"
                icon="delete-outline"
                label="Delete"
                onPress={() => Alert.alert('Delete this comment?', comment.isDraft ? "It hasn't been sent yet." : 'The photographer will no longer see it.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => void run(() => albumApi.removeComment(album.id, comment.id)) },
                ])}
              />
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function Composer({ album, page, version, draft, onCancel, onSaved }: {
  album: AlbumDetail;
  page: AlbumPage;
  version: number;
  draft: Draft;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [kind, setKind] = useState<AlbumCommentKind | null>(null);
  const [body, setBody] = useState('');
  const [voice, setVoice] = useState<VoiceRecording | null>(null);
  const [photo, setPhoto] = useState<AlbumPhoto | null>(null);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!body.trim() && !voice && !photo && (kind === null || kind === 'note')) {
      setError('Choose what should change, write a comment or record a voice note.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { comment } = await albumApi.addComment(album.id, page.id, {
        kind: kind ?? 'note', pinX: draft.pinX, pinY: draft.pinY, body: body.trim() || null, replacementPhotoId: photo?.id ?? null, version,
      });
      if (voice) {
        const file: LocalFile = { uri: voice.uri, name: 'voice.m4a', mimeType: 'audio/mp4' };
        try {
          await albumApi.attachVoice(album.id, comment.id, file, voice.seconds);
        } catch (e) {
          await onSaved();
          Alert.alert('Voice note not uploaded', `The comment was saved, but the voice note didn't upload: ${errorText(e, 'try again')}.`);
          return;
        }
      }
      await onSaved();
    } catch (e) {
      setError(errorText(e, "Couldn't save the comment."));
      setSaving(false);
    }
  };

  return (
    <View style={styles.composer}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[styles.composerTitle, { flex: 1 }]}>{draft.pinX !== null ? 'Comment on this spot' : 'Comment on the whole page'}</Text>
        <TouchableOpacity onPress={onCancel} hitSlop={8} accessibilityLabel="Cancel comment">
          <MaterialIcons name="close" size={20} color={MidnightColors.slate400} />
        </TouchableOpacity>
      </View>
      <View style={styles.kinds}>
        {ALBUM_COMMENT_KINDS.map(({ id, label }) => (
          <TouchableOpacity
            key={id}
            onPress={() => setKind(kind === id ? null : id)}
            style={[styles.kindChip, kind === id && styles.kindChipActive]}
            accessibilityState={{ selected: kind === id }}
          >
            <Text style={[styles.kindChipText, kind === id && { color: MidnightColors.onAccent }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {kind === 'replace' && (
        <TouchableOpacity style={styles.replacement} onPress={() => setPicking(true)}>
          {photo?.thumbnailUrl
            ? <Image source={{ uri: photo.thumbnailUrl }} style={styles.replacementImage} contentFit="cover" />
            : <View style={[styles.replacementImage, { alignItems: 'center', justifyContent: 'center' }]}><MaterialIcons name="favorite-border" size={20} color={MidnightColors.gold} /></View>}
          <Text style={[albumStyles.body, { flex: 1, color: MidnightColors.slate300 }]}>{photo ? 'Change the replacement photo' : 'Pick the new photo from favourites (optional)'}</Text>
        </TouchableOpacity>
      )}
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder="Describe the change (optional)"
        placeholderTextColor={MidnightColors.slate600}
        multiline
        maxLength={2000}
        style={[albumStyles.input, { minHeight: 80, textAlignVertical: 'top' }]}
      />
      <VoiceRecorder value={voice} onChange={setVoice} disabled={saving} />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <AlbumButton label="Cancel" onPress={onCancel} disabled={saving} style={{ flex: 1 }} />
        <AlbumButton kind="primary" label="Save" busy={saving} onPress={save} style={{ flex: 1 }} />
      </View>
      {picking && (
        <FavouritePicker albumId={album.id} selectedId={photo?.id ?? null} onClose={() => setPicking(false)} onPick={(p) => { setPhoto(p); setPicking(false); }} />
      )}
    </View>
  );
}

export function PageReviewer({ album, pages, labels, index, mode, onIndexChange, onClose, onAlbum, refresh, onUploadVersion }: {
  album: AlbumDetail;
  pages: AlbumPage[];
  labels: Map<string, string>;
  index: number;
  mode: AlbumMode;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onAlbum: (album: AlbumDetail) => void;
  refresh: () => Promise<void>;
  onUploadVersion: (page: AlbumPage) => Promise<void>;
}) {
  const page = pages[index];
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const visibleVersions = useMemo(() => (page ? page.versions.filter((v) => mode === 'photographer' || v.round > 0) : []), [page, mode]);
  const defaultVersion = mode === 'couple' ? page?.sentVersion ?? page?.latestVersion : page?.latestVersion;
  const [shownVersion, setShownVersion] = useState(defaultVersion ?? 1);
  const [zoom, setZoom] = useState(false);
  const [compare, setCompare] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [activeComment, setActiveComment] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  // A new page, or a new version arriving, shows the newest version
  useEffect(() => {
    setShownVersion(defaultVersion ?? 1);
    setDraft(null);
    setCompare(false);
  }, [page?.id, defaultVersion]);

  if (!page) return null;

  const version = visibleVersions.find((v) => v.version === shownVersion) ?? visibleVersions.at(-1);
  const previousVersion = version ? visibleVersions.filter((v) => v.version < version.version).at(-1) : undefined;
  const numbers = pinNumbers(page.comments);
  const topLevel = page.comments.filter((c) => !c.parentId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const repliesOf = (id: string) => page.comments.filter((c) => c.parentId === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const onThisVersion = topLevel.filter((c) => c.version === version?.version);
  const earlier = topLevel.filter((c) => c.version !== version?.version);
  const locked = album.status === 'approved';
  const canComment = !locked && !!version && (mode === 'photographer' || version.round > 0);
  const label = labels.get(page.id) ?? 'Page';
  const myDrafts = album.pages.reduce((n, p) => n + p.comments.filter((c) => c.isDraft && c.authorId === album.viewer.id).length, 0);

  const sizeOf = (v: NonNullable<typeof version>, scale: number) => {
    const ratio = v.width && v.height ? v.height / v.width : page.layout === 'spread' ? 1 / 3 : 1;
    let width = (screenWidth - 24) * scale;
    // A tall single page shouldn't push everything off screen when it fits
    if (scale === 1 && width * ratio > screenHeight * 0.55) width = (screenHeight * 0.55) / ratio;
    return { width, height: width * ratio };
  };

  const act = async (task: () => Promise<{ album: AlbumDetail }>) => {
    setBusy(true);
    try {
      onAlbum((await task()).album);
    } catch (e) {
      Alert.alert("That didn't work", errorText(e, 'Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const approve = () => {
    const open = page.comments.filter((c) => !c.parentId && !c.isDraft && c.status === 'open').length;
    const go = () => void act(() => albumApi.approvePage(album.id, page.id, true));
    if (!open) return go();
    Alert.alert('Approve this page?', `This also marks ${open === 1 ? 'the open request' : `the ${open} open requests`} on it as done.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: go },
    ]);
  };

  const pageImage = (v: NonNullable<typeof version>, withPins: boolean, scale: number) => {
    const { width, height } = sizeOf(v, scale);
    return (
      <Pressable
        disabled={!withPins || !canComment}
        onPress={(e) => {
          const x = Math.min(1, Math.max(0, e.nativeEvent.locationX / width));
          const y = Math.min(1, Math.max(0, e.nativeEvent.locationY / height));
          setDraft({ pinX: Math.round(x * 1000) / 1000, pinY: Math.round(y * 1000) / 1000 });
          setActiveComment(null);
        }}
        style={{ width, height }}
        accessibilityLabel={`${label}, version ${v.version}${withPins && canComment ? '. Tap a spot to pin a comment' : ''}`}
      >
        <Image source={{ uri: v.previewUrl }} placeholder={{ uri: v.thumbnailUrl }} style={{ width, height }} contentFit="contain" transition={150} />
        {withPins && topLevel.filter((c) => c.version === v.version && c.pinX !== null && c.pinY !== null).map((c) => (
          <Pin
            key={c.id}
            number={numbers.get(c.id) ?? '?'}
            state={c.isDraft ? 'draft' : c.status === 'done' ? 'done' : 'open'}
            x={c.pinX!}
            y={c.pinY!}
            width={width}
            height={height}
            active={activeComment === c.id}
            onPress={() => setActiveComment(c.id)}
          />
        ))}
        {withPins && draft?.pinX != null && draft.pinY != null && <Pin number="+" state="new" x={draft.pinX} y={draft.pinY} width={width} height={height} />}
      </Pressable>
    );
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={() => (draft ? setDraft(null) : onClose())}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton} accessibilityLabel="Close">
            <MaterialIcons name="close" size={24} color={MidnightColors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{label}</Text>
            <Text style={albumStyles.small}>{index + 1} of {pages.length} · {page.layout === 'spread' ? 'Spread' : 'Single page'}</Text>
          </View>
          <TouchableOpacity onPress={() => onIndexChange(index - 1)} disabled={index === 0} style={[styles.headerButton, index === 0 && { opacity: 0.3 }]} accessibilityLabel="Previous page">
            <MaterialIcons name="chevron-left" size={28} color={MidnightColors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onIndexChange(index + 1)} disabled={index === pages.length - 1} style={[styles.headerButton, index === pages.length - 1 && { opacity: 0.3 }]} accessibilityLabel="Next page">
            <MaterialIcons name="chevron-right" size={28} color={MidnightColors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.toolbar}>
          <PageStatusChip status={page.status} />
          <View style={{ flex: 1 }} />
          {visibleVersions.length > 1 && (
            <View style={styles.versions}>
              {visibleVersions.map((v) => (
                <TouchableOpacity key={v.version} onPress={() => setShownVersion(v.version)} style={[styles.versionChip, v.version === version?.version && styles.versionChipActive]}>
                  <Text style={[styles.versionText, v.version === version?.version && { color: MidnightColors.onAccent }]}>v{v.version}{v.round === 0 ? '*' : ''}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {previousVersion && (
            <TouchableOpacity onPress={() => setCompare(!compare)} style={[styles.toolButton, compare && styles.toolButtonActive]} accessibilityLabel="Compare with the previous version">
              <MaterialIcons name="compare" size={20} color={compare ? MidnightColors.text : MidnightColors.slate400} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setZoom(!zoom)} style={[styles.toolButton, zoom && styles.toolButtonActive]} accessibilityLabel={zoom ? 'Fit to screen' : 'Zoom in'}>
            <MaterialIcons name={zoom ? 'zoom-out' : 'zoom-in'} size={20} color={zoom ? MidnightColors.text : MidnightColors.slate400} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
            {compare && previousVersion && (
              <View style={styles.imageArea}>
                <Text style={styles.versionLabel}>v{previousVersion.version} (before)</Text>
                {pageImage(previousVersion, false, 1)}
              </View>
            )}
            <View style={styles.imageArea}>
              {compare && version && <Text style={[styles.versionLabel, { color: MidnightColors.gold }]}>v{version.version} (now)</Text>}
              {version ? (
                zoom ? (
                  <ScrollView horizontal style={{ maxWidth: screenWidth }} contentContainerStyle={{ paddingHorizontal: 12 }} showsHorizontalScrollIndicator>
                    <ScrollView style={{ maxHeight: screenHeight * 0.6 }} nestedScrollEnabled>
                      {pageImage(version, true, ZOOM)}
                    </ScrollView>
                  </ScrollView>
                ) : pageImage(version, true, 1)
              ) : (
                <Text style={albumStyles.body}>This page hasn&apos;t been sent for review yet.</Text>
              )}
            </View>

            <View style={styles.panel}>
              {mode === 'couple' && page.sentVersion !== null && !locked && (
                page.status === 'approved' ? (
                  <View style={styles.approved}>
                    <Text style={styles.approvedText}>✓ You approved this page</Text>
                    <AlbumButton kind="ghost" label="Undo" busy={busy} onPress={() => void act(() => albumApi.approvePage(album.id, page.id, false))} />
                  </View>
                ) : (
                  <AlbumButton kind="success" icon="check" label="Looks good, approve page" busy={busy} onPress={approve} />
                )
              )}
              {mode === 'photographer' && !locked && (
                <AlbumButton
                  icon="upload"
                  label={uploading ? 'Uploading…' : 'Upload new version'}
                  busy={uploading}
                  onPress={async () => {
                    setUploading(true);
                    try { await onUploadVersion(page); } finally { setUploading(false); }
                  }}
                />
              )}
              {mode === 'photographer' && page.latestVersion > (page.sentVersion ?? 0) && (
                <Text style={styles.notice}>v{page.latestVersion} isn&apos;t sent yet. Use “Send for review” on the album to share it.</Text>
              )}

              {draft ? (
                <Composer
                  key={`${draft.pinX}-${draft.pinY}`}
                  album={album}
                  page={page}
                  version={version?.version ?? 1}
                  draft={draft}
                  onCancel={() => setDraft(null)}
                  onSaved={async () => { setDraft(null); await refresh(); }}
                />
              ) : canComment && (
                <View style={styles.hint}>
                  <Text style={[albumStyles.small, { textAlign: 'center' }]}>Tap a spot on the page to pin a comment to a photo.</Text>
                  <AlbumButton kind="ghost" icon="add-comment" label="Comment on the whole page" onPress={() => setDraft({ pinX: null, pinY: null })} />
                </View>
              )}

              {onThisVersion.length === 0 && earlier.length === 0 && !draft && (
                <Text style={[albumStyles.small, { textAlign: 'center', paddingVertical: 8 }]}>No comments on this page yet.</Text>
              )}
              {onThisVersion.map((c) => (
                <CommentCard key={c.id} comment={c} number={numbers.get(c.id)} replies={repliesOf(c.id)} album={album} page={page} mode={mode} active={activeComment === c.id} onFocus={() => setActiveComment(c.id)} onChanged={refresh} />
              ))}
              {earlier.length > 0 && <Text style={[albumStyles.eyebrow, { marginTop: 4 }]}>Other versions ({earlier.length})</Text>}
              {earlier.map((c) => (
                <CommentCard key={c.id} comment={c} number={numbers.get(c.id)} replies={repliesOf(c.id)} album={album} page={page} mode={mode} active={activeComment === c.id} onFocus={() => { setActiveComment(c.id); setShownVersion(c.version); }} onChanged={refresh} />
              ))}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {mode === 'couple' && myDrafts > 0 && (
          <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
            <Text style={[albumStyles.small, { color: '#E8C9A0', textAlign: 'center' }]}>
              {myDrafts === 1 ? '1 comment is' : `${myDrafts} comments are`} waiting. Close this view and tap Send feedback when you&apos;ve been through the pages.
            </Text>
          </View>
        )}
        {busy && <ActivityIndicator style={StyleSheet.absoluteFill} color={MidnightColors.gold} pointerEvents="none" />}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B0F12' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 6, gap: 4 },
  headerButton: { padding: 8 },
  title: { color: MidnightColors.text, fontSize: 18, fontFamily: Fonts.playfair.bold },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  versions: { flexDirection: 'row', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 3, gap: 2 },
  versionChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9 },
  versionChipActive: { backgroundColor: MidnightColors.gold },
  versionText: { color: MidnightColors.slate300, fontSize: 12, fontFamily: Fonts.outfit.extraBold },
  toolButton: { padding: 8, borderRadius: 10 },
  toolButtonActive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  imageArea: { alignItems: 'center', paddingVertical: 12, backgroundColor: 'rgba(0,0,0,0.4)', gap: 6 },
  versionLabel: { color: MidnightColors.slate400, fontSize: 10, fontFamily: Fonts.outfit.extraBold, letterSpacing: 1.2, textTransform: 'uppercase' },
  panel: { padding: 14, gap: 12 },
  approved: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(52,211,153,0.4)', backgroundColor: 'rgba(52,211,153,0.1)', borderRadius: 16, paddingLeft: 14 },
  approvedText: { color: '#A7F3D0', fontSize: 14, fontFamily: Fonts.outfit.extraBold },
  notice: { color: MidnightColors.slate300, fontSize: 12, fontFamily: Fonts.outfit.semiBold, backgroundColor: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 12 },
  hint: { borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 12, alignItems: 'center', gap: 4 },
  pin: { position: 'absolute', width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pinActive: { transform: [{ scale: 1.25 }] },
  pinText: { fontSize: 12, fontFamily: Fonts.outfit.extraBold },
  comment: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 12 },
  commentActive: { borderColor: 'rgba(202,156,104,0.7)', backgroundColor: 'rgba(202,156,104,0.07)' },
  badge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  badgeText: { fontSize: 11, fontFamily: Fonts.outfit.extraBold },
  kind: { color: '#E8C9A0', fontSize: 12, fontFamily: Fonts.outfit.extraBold, textTransform: 'uppercase', letterSpacing: 0.8 },
  draft: { color: MidnightColors.slate300, fontSize: 9, fontFamily: Fonts.outfit.extraBold, textTransform: 'uppercase', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  done: { color: '#6EE7B7', fontSize: 10, fontFamily: Fonts.outfit.extraBold, textTransform: 'uppercase' },
  bodyText: { color: MidnightColors.text, fontSize: 14, fontFamily: Fonts.inter.medium, lineHeight: 20 },
  replacement: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 8 },
  replacementImage: { width: 44, height: 44, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)' },
  replies: { borderLeftWidth: 2, borderLeftColor: 'rgba(255,255,255,0.1)', paddingLeft: 10, gap: 8 },
  composer: { borderWidth: 1, borderColor: 'rgba(202,156,104,0.5)', backgroundColor: 'rgba(202,156,104,0.06)', borderRadius: 18, padding: 14, gap: 12 },
  composerTitle: { color: MidnightColors.text, fontSize: 14, fontFamily: Fonts.outfit.extraBold },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  kindChip: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  kindChipActive: { backgroundColor: MidnightColors.gold, borderColor: MidnightColors.gold },
  kindChipText: { color: MidnightColors.slate300, fontSize: 12, fontFamily: Fonts.outfit.bold },
  error: { color: MidnightColors.dangerSoft, fontSize: 12, fontFamily: Fonts.outfit.semiBold },
  footer: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(202,156,104,0.06)', paddingHorizontal: 16, paddingTop: 10 },
});
