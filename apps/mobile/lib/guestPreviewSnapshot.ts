import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { TurboModuleRegistry } from 'react-native';

/**
 * A picture of the app's guest home (todo #29), shown on the Design tab's Guest Home Preview. The app's guest view is
 * part of the event screen and can't be drawn small, so a picture is taken while the host has it open (Preview Guest
 * Theme). It stays on this phone only (app cache + AsyncStorage): nothing is uploaded.
 */
export type GuestPreviewSnapshot = {
  uri: string;
  /** The event's template when the picture was taken; a different one now means the picture is out of date */
  templateId: string | null;
  takenAt: number;
};

const storageKey = (eventId: string) => `guestPreviewSnapshot:${eventId}`;

type ViewShot = typeof import('react-native-view-shot');
let viewShot: ViewShot | null | undefined;

// Builds made before react-native-view-shot was added don't have its native part, and importing it there throws
// (TurboModuleRegistry.getEnforcing). Load it only when the native part is there; otherwise no picture is taken.
function loadViewShot(): ViewShot | null {
  if (viewShot === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      viewShot = TurboModuleRegistry.get('RNViewShot') ? require('react-native-view-shot') : null;
    } catch {
      viewShot = null;
    }
  }
  return viewShot ?? null;
}

export async function loadGuestPreviewSnapshot(eventId: string): Promise<GuestPreviewSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(eventId));
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as GuestPreviewSnapshot;
    const info = await FileSystem.getInfoAsync(snapshot.uri);
    return info.exists ? snapshot : null;
  } catch {
    return null;
  }
}

/** Pictures the whole screen as it is now and keeps it as this event's guest home picture. Returns false if it can't. */
export async function saveGuestPreviewSnapshot(eventId: string, templateId: string | null): Promise<boolean> {
  const shot = loadViewShot();
  if (!shot || !FileSystem.cacheDirectory) return false;
  try {
    // Taken as data and written straight into the app's cache: expo-file-system may not move files out of the
    // system's temporary folder, where 'tmpfile' puts them
    const jpeg = await shot.captureScreen({ format: 'jpg', quality: 0.8, result: 'base64' });
    // A new file name each time, so the image cache never shows the previous picture
    const uri = `${FileSystem.cacheDirectory}guest-preview-${encodeURIComponent(eventId)}-${Date.now()}.jpg`;
    await FileSystem.writeAsStringAsync(uri, jpeg, { encoding: FileSystem.EncodingType.Base64 });

    const previous = await loadGuestPreviewSnapshot(eventId);
    const snapshot: GuestPreviewSnapshot = { uri, templateId, takenAt: Date.now() };
    await AsyncStorage.setItem(storageKey(eventId), JSON.stringify(snapshot));
    if (previous) await FileSystem.deleteAsync(previous.uri, { idempotent: true });
    return true;
  } catch (err) {
    console.warn('[GuestPreviewSnapshot] Could not take the picture:', err);
    return false;
  }
}
