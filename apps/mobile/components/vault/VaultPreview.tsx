import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { MidnightColors } from '@/constants/theme';
import { getVaultWebBaseUrl, vaultApi, type VaultItem } from '@/lib/vaultApi';
import { canSaveToPhotos, fileIconName, formatBytes, formatDate, previewKind } from '@/lib/vaultFiles';

const TEXT_PREVIEW_BYTES = 1024 * 1024;

type Props = {
  item: VaultItem;
  onClose: () => void;
  onShare: (item: VaultItem) => void;
  onSaveToPhotos: (item: VaultItem) => void;
};

/** Full-screen preview. Mount with key={item.id} so state starts fresh for each file. */
export function VaultPreview({ item, onClose, onShare, onSaveToPhotos }: Props) {
  const insets = useSafeAreaInsets();
  const kind = previewKind(item.mimeType, item.extension);
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (kind === 'none') return;
    let cancelled = false;
    vaultApi.link(item.id, 'view')
      .then(async ({ url: signed }) => {
        if (cancelled) return;
        if (kind !== 'text') return setUrl(signed);
        // Only the first 1 MB of text is shown, so huge files don't freeze the app.
        const response = await fetch(signed, { headers: { Range: `bytes=0-${TEXT_PREVIEW_BYTES - 1}` } });
        const body = await response.text();
        if (!cancelled) setText(body);
      })
      .catch((err: Error) => !cancelled && setError(err.message || "This file couldn't be previewed."));
    return () => {
      cancelled = true;
    };
  }, [item.id, kind]);

  const showInfo = kind === 'none' || error !== null;
  const loading = !showInfo && !url && text === null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close preview" hitSlop={12} style={styles.iconButton}>
            <IconSymbol name="xmark" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{item.filename}</Text>
            <Text style={styles.subtitle}>{formatBytes(item.sizeBytes)}</Text>
          </View>
          {canSaveToPhotos(item) && (
            <TouchableOpacity onPress={() => onSaveToPhotos(item)} accessibilityRole="button" accessibilityLabel="Save to Photos" hitSlop={12} style={styles.iconButton}>
              <IconSymbol name="square.and.arrow.down" size={22} color={MidnightColors.gold} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => onShare(item)} accessibilityRole="button" accessibilityLabel="Share or save" hitSlop={12} style={styles.iconButton}>
            <IconSymbol name="square.and.arrow.up" size={22} color={MidnightColors.gold} />
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1 }}>
          {loading && <ActivityIndicator color={MidnightColors.gold} style={{ marginTop: 80 }} />}
          {showInfo ? (
            <InfoCard item={item} message={error ?? "A preview isn't available for this file type."} onShare={onShare} />
          ) : kind === 'image' && url ? (
            <Image source={{ uri: url }} style={{ flex: 1 }} contentFit="contain" accessibilityLabel={item.filename} onError={() => setError("This image couldn't be shown.")} />
          ) : kind === 'video' && url ? (
            <VideoPreview itemId={item.id} initialUrl={url} onFail={() => setError("This video couldn't be played. You can still save or share it.")} />
          ) : kind === 'pdf' && url ? (
            <PdfPreview url={url} onFail={() => setError("This PDF couldn't be displayed. You can still save or share it.")} />
          ) : kind === 'text' && text !== null ? (
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <Text selectable style={styles.text}>{text}</Text>
              {item.sizeBytes > TEXT_PREVIEW_BYTES && <Text style={styles.note}>Showing the first 1 MB. Share or save the file to see all of it.</Text>}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function InfoCard({ item, message, onShare }: { item: VaultItem; message: string; onShare: (item: VaultItem) => void }) {
  return (
    <View style={styles.infoCard}>
      <IconSymbol name={fileIconName(item.mimeType) as any} size={48} color="#7FA38C" />
      <Text style={styles.infoName}>{item.filename}</Text>
      <Text style={styles.infoMeta}>
        {(item.extension || item.mimeType).toUpperCase()} · {formatBytes(item.sizeBytes)} · Modified {formatDate(item.updatedAt)}
      </Text>
      <Text style={styles.note}>{message}</Text>
      <TouchableOpacity onPress={() => onShare(item)} accessibilityRole="button" style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Share or save</Text>
      </TouchableOpacity>
    </View>
  );
}

/**
 * Streams the MP4 from storage. If its signed link expires mid-session, a fresh link is fetched and
 * playback resumes from the same moment.
 */
function VideoPreview({ itemId, initialUrl, onFail }: { itemId: string; initialUrl: string; onFail: () => void }) {
  const player = useVideoPlayer({ uri: initialUrl }, (created) => created.play());
  const refreshes = useRef(0);

  useEventListener(player, 'statusChange', ({ status }) => {
    if (status !== 'error') return;
    if (refreshes.current >= 3) return onFail();
    refreshes.current += 1;
    const resumeAt = player.currentTime;
    vaultApi.link(itemId, 'view')
      .then(async ({ url }) => {
        await player.replaceAsync({ uri: url });
        player.currentTime = resumeAt;
        player.play();
      })
      .catch(onFail);
  });

  return <VideoView player={player} style={{ flex: 1 }} contentFit="contain" nativeControls />;
}

/**
 * Renders the PDF with the website's pdf.js viewer inside the app. The signed link is handed to the
 * page in memory before it loads, never in the page address.
 */
function PdfPreview({ url, onFail }: { url: string; onFail: () => void }) {
  const viewer = `${getVaultWebBaseUrl()}/vault-pdf`;
  return (
    <WebView
      source={{ uri: viewer }}
      originWhitelist={[getVaultWebBaseUrl()]}
      injectedJavaScriptBeforeContentLoaded={`window.__EVEBASH_VAULT_PDF__ = { url: ${JSON.stringify(url)} }; true;`}
      onMessage={(event) => {
        try {
          if (JSON.parse(event.nativeEvent.data)?.type === 'error') onFail();
        } catch {}
      }}
      onError={onFail}
      onHttpError={onFail}
      startInLoadingState
      renderLoading={() => <ActivityIndicator color={MidnightColors.gold} style={{ marginTop: 80 }} />}
      style={{ flex: 1, backgroundColor: '#0E1318' }}
      setSupportMultipleWindows={false}
      allowsLinkPreview={false}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E1318' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  iconButton: { padding: 6 },
  title: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  subtitle: { color: MidnightColors.slate400, fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  text: { color: '#E2E8F0', fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  note: { color: MidnightColors.slate400, fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 12 },
  infoCard: { margin: 24, marginTop: 64, padding: 24, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#141B22', alignItems: 'center' },
  infoName: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold', marginTop: 14, textAlign: 'center' },
  infoMeta: { color: MidnightColors.slate400, fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 6, textAlign: 'center' },
  primaryButton: { marginTop: 18, backgroundColor: MidnightColors.gold, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12 },
  primaryButtonText: { color: '#13191F', fontSize: 14, fontFamily: 'Inter_700Bold' },
});
