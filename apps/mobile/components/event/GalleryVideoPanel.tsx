import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getGalleryVideos, type Event, type Photo } from '@/lib/database';
import { HighlightPlayer } from './GalleryHighlightVideo';

// Host view, under a gallery's Welcome Message: the video that plays under the welcome message of that gallery's
// guest page (events.gallery_video_id). Same as the website's GalleryVideoPanel: upload one straight into the
// gallery, or pick one of its existing videos.

const GOLD = '#CA9C68';

function VideoThumb({ video }: { video?: Photo }) {
  return (
    <View style={local.thumb}>
      {video?.thumbnailUrl ? (
        <ExpoImage source={{ uri: video.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : null}
      {video?.isHidden && (
        <View style={local.hiddenBadge}>
          <IconSymbol name="eye.slash.fill" size={10} color="#fff" />
          <Text style={local.hiddenBadgeText}>HIDDEN</Text>
        </View>
      )}
      {video && video.status !== 'processed' && (
        <View style={local.processingBadge}>
          <ActivityIndicator size="small" color="#F5E7D4" />
          <Text style={local.processingText}>Processing</Text>
        </View>
      )}
    </View>
  );
}

function Button({ label, icon, onPress, disabled, variant = 'outline' }: {
  label: string;
  icon?: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'gold' | 'outline' | 'danger';
}) {
  const color = variant === 'gold' ? '#0f172a' : variant === 'danger' ? '#fda4af' : '#F5E7D4';
  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        local.button,
        variant === 'gold' && { backgroundColor: GOLD, borderColor: GOLD },
        variant === 'danger' && { borderColor: 'rgba(251,113,133,0.4)' },
        disabled && { opacity: 0.5 },
      ]}
    >
      {icon ? <IconSymbol name={icon as any} size={14} color={color} /> : null}
      <Text style={[local.buttonText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function GalleryVideoChooser({ videos, currentId, onChoose, onClose }: {
  videos: Photo[];
  currentId: string | null;
  onChoose: (videoId: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={local.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[local.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={local.sheetHeader}>
          <Text style={local.sheetTitle}>Choose the cinematic highlight video</Text>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
            <IconSymbol name="xmark" size={18} color="#cbd5e1" />
          </TouchableOpacity>
        </View>
        <Text style={local.sheetSub}>Videos uploaded to this gallery, newest first.</Text>
        <ScrollView contentContainerStyle={local.grid}>
          {videos.map((video) => {
            const current = video.id === currentId;
            return (
              <TouchableOpacity
                key={video.id}
                accessibilityRole="button"
                accessibilityState={{ selected: current }}
                onPress={() => onChoose(video.id)}
                style={[local.gridItem, current && local.gridItemCurrent]}
              >
                <VideoThumb video={video} />
                <Text style={local.gridLabel} numberOfLines={1}>
                  {current ? 'Current highlight video' : video.storageKey?.split('/').pop() || 'Video'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

export function GalleryVideoPanel({ gallery, canUpload, uploading, onUpload, onChange }: {
  gallery: Event;
  /** Event owner and event admins only, like the rest of video uploading */
  canUpload: boolean;
  /** A video picked here is still uploading into this gallery; it becomes the highlight video once it's saved */
  uploading: boolean;
  onUpload: () => void;
  onChange: (videoId: string | null) => Promise<void>;
}) {
  const chosenId = gallery.galleryVideoId || null;
  const [loaded, setLoaded] = useState<{ galleryId: string; videos: Photo[] } | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [choosing, setChoosing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getGalleryVideos(gallery.id, gallery.legacyId).then((videos) => {
      if (!cancelled) setLoaded({ galleryId: gallery.id, videos });
    });
    return () => { cancelled = true; };
  }, [gallery.id, gallery.legacyId, chosenId, refreshTick]);

  useEffect(() => { setPlaying(false); }, [chosenId]);

  const videos = loaded?.galleryId === gallery.id ? loaded.videos : null;
  const usableVideos = (videos || []).filter((video) => video.status !== 'failed');
  const chosen = videos?.find((video) => video.id === chosenId);
  const chosenReady = chosen?.status === 'processed';

  // A freshly uploaded video is still being processed: look again every 15 s until it's ready
  useEffect(() => {
    if (!chosen || chosenReady) return;
    const timer = setInterval(() => setRefreshTick((tick) => tick + 1), 15000);
    return () => clearInterval(timer);
  }, [chosen, chosenReady]);

  const change = async (videoId: string | null) => {
    setSaving(true);
    await onChange(videoId);
    setSaving(false);
    setChoosing(false);
  };

  const statusText = !videos ? 'Loading...' : !chosen
    ? "This video is no longer in this gallery, so guests don't see it. Choose another one."
    : chosen.isHidden ? "This video is hidden from guests, so they don't see it until you show it again."
    : chosenReady ? 'Guests see this video under the welcome message.'
    : "Processing: guests will see it once it's ready.";

  return (
    <View style={local.panel}>
      <Text style={local.title}>Cinematic Highlight Video</Text>
      <Text style={local.sub}>
        Plays under the welcome message for guests. Usually the photographer&apos;s 3-6 minute summary film of the event.
      </Text>

      {chosenId ? (
        <View style={{ gap: 12 }}>
          {playing && chosen?.url ? (
            <View style={local.thumb}><HighlightPlayer src={chosen.url} /></View>
          ) : (
            <Pressable
              disabled={!chosenReady}
              onPress={() => setPlaying(true)}
              accessibilityRole="button"
              accessibilityLabel="Play the cinematic highlight video"
            >
              <VideoThumb video={chosen} />
              {chosenReady && (
                <View style={local.playOverlay} pointerEvents="none">
                  <View style={local.playButton}>
                    <IconSymbol name="play.fill" size={20} color="#0f172a" />
                  </View>
                </View>
              )}
            </Pressable>
          )}
          <Text style={local.status}>{statusText}</Text>
          <View style={local.row}>
            <Button label="Change" onPress={() => setChoosing(true)} disabled={saving || usableVideos.length === 0} />
            {canUpload && <Button label="Upload new" icon="plus" onPress={onUpload} disabled={saving || uploading} />}
            <Button label="Remove" icon="xmark" variant="danger" onPress={() => void change(null)} disabled={saving} />
          </View>
        </View>
      ) : (
        <View style={local.empty}>
          <IconSymbol name="play.rectangle.fill" size={26} color={GOLD} />
          <Text style={local.status}>No cinematic highlight video yet.</Text>
          <View style={[local.row, { justifyContent: 'center' }]}>
            {canUpload && <Button label="Upload video" icon="plus" variant="gold" onPress={onUpload} disabled={uploading} />}
            <Button
              label={`Choose from this gallery's videos (${usableVideos.length})`}
              onPress={() => setChoosing(true)}
              disabled={!videos || usableVideos.length === 0}
            />
          </View>
          {!canUpload && <Text style={local.note}>Only the event owner and event admins can upload videos.</Text>}
        </View>
      )}

      {uploading && (
        <View style={local.uploading}>
          <ActivityIndicator size="small" color="#E2B77F" />
          <Text style={local.uploadingText}>
            Uploading. It becomes the cinematic highlight video once it&apos;s saved; progress shows in the upload panel.
          </Text>
        </View>
      )}

      {choosing && (
        <GalleryVideoChooser
          videos={usableVideos}
          currentId={chosenId}
          onChoose={(videoId) => void change(videoId)}
          onClose={() => setChoosing(false)}
        />
      )}
    </View>
  );
}

const local = StyleSheet.create({
  panel: { marginBottom: 24, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(202,156,104,0.55)', backgroundColor: 'rgba(2,6,23,0.4)', padding: 16 },
  title: { color: '#fff', fontSize: 14, fontWeight: '700' },
  sub: { color: '#94a3b8', fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 14 },
  thumb: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(202,156,104,0.45)', backgroundColor: '#0f172a' },
  hiddenBadge: { position: 'absolute', left: 8, top: 8, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 8, paddingVertical: 2 },
  hiddenBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  processingBadge: { position: 'absolute', bottom: 8, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: 'rgba(2,6,23,0.85)', paddingHorizontal: 10, paddingVertical: 4 },
  processingText: { color: '#F5E7D4', fontSize: 11, fontWeight: '600' },
  playOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  playButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(202,156,104,0.92)', alignItems: 'center', justifyContent: 'center', paddingLeft: 3 },
  status: { color: '#cbd5e1', fontSize: 13, lineHeight: 19, textAlign: 'left' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(202,156,104,0.45)', paddingHorizontal: 14, paddingVertical: 9 },
  buttonText: { fontSize: 13, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(202,156,104,0.4)', paddingHorizontal: 12, paddingVertical: 20 },
  note: { color: '#64748b', fontSize: 11, textAlign: 'center' },
  uploading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  uploadingText: { flex: 1, color: '#E2B77F', fontSize: 12, lineHeight: 17 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { maxHeight: '75%', backgroundColor: '#0b1120', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: 'rgba(202,156,104,0.35)', paddingHorizontal: 16, paddingTop: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sheetTitle: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '700' },
  sheetSub: { color: '#94a3b8', fontSize: 12, marginTop: 4, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 8 },
  gridItem: { width: '48%', borderRadius: 14, padding: 4 },
  gridItemCurrent: { backgroundColor: 'rgba(202,156,104,0.25)', borderWidth: 2, borderColor: GOLD },
  gridLabel: { color: '#cbd5e1', fontSize: 11, marginTop: 6, paddingHorizontal: 2 },
});
