import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useEventListener } from 'expo';
import { useVideoPlayer } from 'expo-video';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { supabase } from '../lib/supabase';

export type ThumbnailVideo = { id: string; url: string; storageKey?: string; thumbnailUrl?: string | null; status?: string };
type Props = { video: ThumbnailVideo; onClose: () => void; onSaved: (id: string, url: string) => void; onBusyChange: (busy: boolean) => void };
const label = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;

function originalUrl(video: ThumbnailVideo) {
  // Native frame extraction uses the original asset; HLS manifests are not supported by all devices.
  if (!video.url.includes('.m3u8')) return video.url;
  if (!video.storageKey) throw new Error('Original video is unavailable');
  return `${new URL(video.url).origin}/${video.storageKey.split('/').map(encodeURIComponent).join('/')}`;
}
function endpoint() {
  const base = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '');
  if (base) return `${base}/api/media/video-thumbnail`;
  const upload = process.env.EXPO_PUBLIC_MEDIA_UPLOAD_URL?.trim();
  if (upload && /\/upload$/.test(upload)) return upload.replace(/\/upload$/, '/video-thumbnail');
  throw new Error('The media API is not configured');
}

export default function VideoThumbnailPicker(props: Props) {
  let source = '';
  try { source = originalUrl(props.video); } catch { /* Display a recoverable state below. */ }
  return source ? <FramePicker {...props} source={source} /> : <View style={[styles.page, { padding: 24 }]}><Text style={styles.text}>The original video is unavailable. Refresh the gallery and try again.</Text><Pressable onPress={props.onClose} style={styles.button}><Text style={styles.text}>Close</Text></Pressable></View>;
}

function FramePicker({ video, source, onClose, onSaved, onBusyChange }: Props & { source: string; onBusyChange: (busy: boolean) => void }) {
  const player = useVideoPlayer(source, player => { player.muted = true; player.pause(); });
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [frame, setFrame] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [width, setWidth] = useState(1);
  const generation = useRef(0);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current++; }; }, []);
  useEventListener(player, 'sourceLoad', event => { if (Number.isFinite(event.duration) && event.duration > 0) setDuration(event.duration); });
  useEventListener(player, 'statusChange', event => {
    if (event.status === 'error') setError('This video cannot be opened for frame selection on this device. Try the web gallery.');
    if (event.status === 'readyToPlay' && player.duration > 0) setDuration(player.duration);
  });
  useEffect(() => {
    if (!duration) return;
    const request = ++generation.current;
    setFrame('');
    const timer = setTimeout(() => {
      void (async () => {
        const thumbnails = await player.generateThumbnailsAsync(position, { maxWidth: 1280, maxHeight: 1280 });
        const thumbnail = thumbnails[0];
        if (!thumbnail) throw new Error('Frame unavailable');
        try {
          const context = ImageManipulator.manipulate(thumbnail);
          try {
            const rendered = await context.renderAsync();
            try {
              const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
              try { new File(result.uri).delete(); } catch { /* Cache cleanup is best effort. */ }
              if (alive.current && request === generation.current) {
                if (!result.base64) throw new Error('Frame unavailable');
                setFrame(`data:image/jpeg;base64,${result.base64}`); setError('');
              }
            } finally { rendered.release(); }
          } finally { context.release(); }
        } finally { thumbnails.forEach(thumbnail => thumbnail.release()); }
      })().catch(() => { if (alive.current && request === generation.current) setError('Unable to extract this frame. Try another position or use the web gallery.'); });
    }, 250);
    return () => { clearTimeout(timer); generation.current++; };
  }, [duration, player, position]);
  const seek = (value: number) => {
    if (saving || !duration) return;
    const next = Math.max(0, Math.min(value, Math.max(0, duration - 0.05)));
    if (Math.abs(next - position) < 0.0001) return;
    generation.current++; setFrame('');
    setPosition(next);
  };
  const save = async () => {
    if (!frame || saving) return;
    setSaving(true); onBusyChange(true); setError('');
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error('Please sign in again to save the thumbnail');
      const response = await fetch(endpoint(), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ photoId: video.id, previousThumbnailUrl: video.thumbnailUrl || null, image: frame }) });
      const result = await response.json();
      if (!response.ok || !result.thumbnailUrl) throw new Error(result.error || 'Unable to save thumbnail');
      onSaved(video.id, result.thumbnailUrl); onClose();
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'Unable to save thumbnail'); }
    finally { if (alive.current) { setSaving(false); onBusyChange(false); } }
  };
  return <ScrollView style={styles.page} contentContainerStyle={{ padding: 24, paddingTop: 40, paddingBottom: 48 }}>
    <Text accessibilityRole="header" style={styles.title}>Change thumbnail</Text>
    <Text style={styles.help}>Drag the timeline to choose a frame from your video. The preview is the image that will be saved.</Text>
    <View style={styles.preview}>{frame ? <Image source={{ uri: frame }} style={{ width: '100%', height: '100%' }} contentFit="contain" /> : <ActivityIndicator color="#CA9C68" />}</View>
    <Text style={styles.text}>{label(position)} / {label(duration)}</Text>
    <View accessibilityRole="adjustable" accessibilityLabel="Thumbnail frame position" accessibilityValue={{ min: 0, max: duration, now: position, text: label(position) }} accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={e => seek(position + (e.nativeEvent.actionName === 'increment' ? 1 : -1))} onLayout={e => setWidth(e.nativeEvent.layout.width)} onStartShouldSetResponder={() => !saving && duration > 0} onResponderGrant={e => seek(e.nativeEvent.locationX / width * duration)} onResponderMove={e => seek(e.nativeEvent.locationX / width * duration)} style={styles.timeline}>
      <View pointerEvents="none" style={styles.track} /><View pointerEvents="none" style={[styles.thumb, { left: `${duration ? position / duration * 100 : 0}%` }]} />
    </View>
    <View style={styles.row}>{[-0.1, 0.1].map(amount => <Pressable key={amount} accessibilityRole="button" disabled={saving || !duration} onPress={() => seek(position + amount)} style={styles.button}><Text style={styles.text}>{amount > 0 ? '+0.1s' : '−0.1s'}</Text></Pressable>)}</View>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <View style={[styles.row, { marginTop: 24 }]}><Pressable accessibilityRole="button" disabled={saving} onPress={onClose} style={styles.button}><Text style={styles.text}>Cancel</Text></Pressable><Pressable accessibilityRole="button" disabled={!frame || saving} onPress={save} style={[styles.button, styles.save, (!frame || saving) && { opacity: 0.4 }]}><Text style={{ color: '#0f172a', fontWeight: '700' }}>{saving ? 'Saving…' : 'Save thumbnail'}</Text></Pressable></View>
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0f172a' }, title: { color: '#fff', fontSize: 24, fontWeight: '700' }, text: { color: '#f1f5f9' }, help: { color: '#cbd5e1', lineHeight: 22, marginTop: 12 },
  preview: { height: 260, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', borderRadius: 12, overflow: 'hidden', marginVertical: 24 },
  timeline: { height: 48, justifyContent: 'center', marginHorizontal: 12 }, track: { height: 5, backgroundColor: '#64748b', borderRadius: 3 }, thumb: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: '#CA9C68', marginLeft: -12 },
  row: { flexDirection: 'row', gap: 12 }, button: { minHeight: 48, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#64748b', borderRadius: 10 }, save: { flex: 1, backgroundColor: '#CA9C68', borderColor: '#CA9C68' }, error: { color: '#fca5a5', marginTop: 16 },
});
