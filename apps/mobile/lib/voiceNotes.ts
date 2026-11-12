import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

// expo-audio (album voice notes) is a native module. App builds made before it was added don't have it, and
// over-the-air updates still reach them (runtimeVersion follows the app version), so it is only loaded when the
// native side is there. Without it the app can't record, and voice notes open in the browser to play.
const hasNativeAudio = Platform.OS !== 'web' && requireOptionalNativeModule('ExpoAudio') != null;

// eslint-disable-next-line @typescript-eslint/no-require-imports
export const expoAudio: typeof import('expo-audio') | null = hasNativeAudio ? require('expo-audio') : null;

/** AAC in an .m4a, mono at 64 kbps: about 0.5 MB a minute and plays on every phone and browser. */
export const VOICE_RECORDING_OPTIONS = expoAudio
  ? { ...expoAudio.RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, bitRate: 64000 }
  : null;
