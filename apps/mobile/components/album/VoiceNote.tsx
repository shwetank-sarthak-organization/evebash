import { useEffect, useRef, useState, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as WebBrowser from 'expo-web-browser';
import { ALBUM_MAX_VOICE_SECONDS, formatSeconds } from '../../lib/albumApi';
import { expoAudio, VOICE_RECORDING_OPTIONS } from '../../lib/voiceNotes';
import { Fonts, MidnightColors } from '../../constants/theme';
import { useAlbumLook } from './albumUi';

export type VoiceRecording = { uri: string; seconds: number };

function NativePlayer({ uri, seconds }: { uri: string; seconds?: number | null }) {
  const { colors, isDark } = useAlbumLook();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const player = expoAudio!.useAudioPlayer(uri);
  const status = expoAudio!.useAudioPlayerStatus(player);

  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      void player.seekTo(0);
    }
  }, [status.didJustFinish, player]);

  const toggle = async () => {
    if (status.playing) {
      player.pause();
      return;
    }
    await expoAudio!.setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    player.play();
  };

  const total = status.duration || seconds || 0;
  const progress = total > 0 ? Math.min(1, status.currentTime / total) : 0;
  return (
    <TouchableOpacity style={styles.player} onPress={toggle} accessibilityRole="button" accessibilityLabel={status.playing ? 'Pause voice note' : 'Play voice note'}>
      <MaterialIcons name={status.playing ? 'pause' : 'play-arrow'} size={22} color={colors.gold} />
      <View style={styles.track}>
        <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.time}>{formatSeconds(status.playing || status.currentTime > 0 ? status.currentTime : total)}</Text>
    </TouchableOpacity>
  );
}

/** Plays a voice note. Without the audio module (older app builds) it opens in the browser instead. */
export function VoicePlayer({ uri, seconds }: { uri: string; seconds?: number | null }) {
  const { colors, isDark } = useAlbumLook();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  if (expoAudio) return <NativePlayer uri={uri} seconds={seconds} />;
  return (
    <TouchableOpacity style={styles.player} onPress={() => WebBrowser.openBrowserAsync(uri)} accessibilityRole="button">
      <MaterialIcons name="play-arrow" size={22} color={colors.gold} />
      <Text style={[styles.time, { flex: 1 }]}>Play voice note{seconds ? ` · ${formatSeconds(seconds)}` : ''}</Text>
    </TouchableOpacity>
  );
}

function NativeRecorder({ onChange, disabled }: { onChange: (recording: VoiceRecording) => void; disabled?: boolean }) {
  const { colors, isDark } = useAlbumLook();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const recorder = expoAudio!.useAudioRecorder(VOICE_RECORDING_OPTIONS!);
  const state = expoAudio!.useAudioRecorderState(recorder, 250);
  const [error, setError] = useState('');
  const stopping = useRef(false);

  const stop = async () => {
    if (stopping.current) return;
    stopping.current = true;
    try {
      const seconds = (recorder.currentTime || state.durationMillis / 1000) || 0;
      await recorder.stop();
      await expoAudio!.setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = recorder.uri;
      if (uri && seconds >= 0.5) onChange({ uri, seconds: Math.min(seconds, ALBUM_MAX_VOICE_SECONDS) });
    } catch {
      setError("The recording couldn't be saved. Try again.");
    } finally {
      stopping.current = false;
    }
  };

  useEffect(() => {
    if (state.isRecording && state.durationMillis >= ALBUM_MAX_VOICE_SECONDS * 1000) void stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isRecording, state.durationMillis]);

  const start = async () => {
    setError('');
    const permission = await expoAudio!.requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError('Allow microphone access in Settings to record a voice note.');
      return;
    }
    try {
      await expoAudio!.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      setError("Recording couldn't start. Try again.");
    }
  };

  return (
    <View>
      {state.isRecording ? (
        <TouchableOpacity style={[styles.recordButton, styles.recording]} onPress={stop} accessibilityRole="button" accessibilityLabel="Stop recording">
          <View style={styles.dot} />
          <Text style={[styles.recordText, { color: (isDark ? '#FECDD3' : colors.danger) }]}>
            Recording {formatSeconds(state.durationMillis / 1000)} / {formatSeconds(ALBUM_MAX_VOICE_SECONDS)}
          </Text>
          <MaterialIcons name="stop" size={20} color="#FECDD3" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.recordButton} onPress={start} disabled={disabled} accessibilityRole="button">
          <MaterialIcons name="mic" size={18} color={colors.gold} />
          <Text style={styles.recordText}>Record a voice note</Text>
        </TouchableOpacity>
      )}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

/** Records a voice note of up to 2 minutes, then shows it with a player and a delete button. */
export function VoiceRecorder({ value, onChange, disabled }: {
  value: VoiceRecording | null;
  onChange: (recording: VoiceRecording | null) => void;
  disabled?: boolean;
}) {
  const { colors, isDark } = useAlbumLook();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  if (!expoAudio) {
    return <Text style={styles.note}>Update EveBash to record voice notes. You can type your comment instead.</Text>;
  }
  if (value) {
    return (
      <View style={styles.row}>
        <View style={{ flex: 1 }}><VoicePlayer uri={value.uri} seconds={value.seconds} /></View>
        <TouchableOpacity onPress={() => onChange(null)} disabled={disabled} style={styles.iconButton} accessibilityLabel="Delete voice note">
          <MaterialIcons name="delete-outline" size={20} color={colors.slate400} />
        </TouchableOpacity>
      </View>
    );
  }
  return <NativeRecorder onChange={onChange} disabled={disabled} />;
}

const getStyles = (c: typeof MidnightColors, isDark: boolean) => StyleSheet.create({
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: c.tint(0.1),
    backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : c.card,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: c.tint(0.12), overflow: 'hidden' },
  trackFill: { height: '100%', backgroundColor: c.goldFill },
  time: { color: c.slate400, fontSize: 12, fontFamily: Fonts.outfit.semiBold },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { padding: 8 },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: c.tint(0.15),
    borderRadius: 14,
    paddingVertical: 12,
  },
  recording: { borderColor: 'rgba(251,113,133,0.5)', backgroundColor: 'rgba(244,63,94,0.15)' },
  recordText: { color: c.slate300, fontSize: 14, fontFamily: Fonts.outfit.bold },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FB7185' },
  error: { marginTop: 6, color: c.dangerSoft, fontSize: 12, fontFamily: Fonts.outfit.semiBold },
  note: { color: c.slate600, fontSize: 12, fontFamily: Fonts.outfit.semiBold },
});
