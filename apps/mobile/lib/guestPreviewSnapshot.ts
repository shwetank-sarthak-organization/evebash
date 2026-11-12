import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { TurboModuleRegistry } from 'react-native';
import { fetchWithEndpointFallback, getEndpointsForPath } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { readGuestPreviewPicture, type GuestPreviewPicture } from '../../../shared/themes/guestPreviewPicture';

/**
 * A picture of the app's guest home (todo #29), shown on the Design tab's Guest Home Preview. The app's guest view is
 * part of the event screen and can't be drawn small, so a picture is taken while the host has it open (Preview Guest
 * Theme). This phone keeps it (app cache + AsyncStorage), and a smaller copy goes to the backend for the event (todo
 * #31), so the website's preview and the host's other phones show the app too.
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
    void sendGuestPreviewPicture(eventId, templateId, uri);
    return true;
  } catch (err) {
    console.warn('[GuestPreviewSnapshot] Could not take the picture:', err);
    return false;
  }
}

// About half the phone's screen pixels: sharp enough for the preview's phone frame, around 100 KB
const SENT_WIDTH = 585;

/** Sends a smaller copy of the picture to the backend, which keeps it on the event (POST /api/media/guest-preview-picture) */
async function sendGuestPreviewPicture(eventId: string, templateId: string | null, uri: string) {
  try {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) return;
    const small = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: SENT_WIDTH } }], {
      compress: 0.7,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    if (!small.base64) return;
    const response = await fetchWithEndpointFallback(
      getEndpointsForPath('/api/media/guest-preview-picture'),
      (endpoint) => fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ eventId, templateId, image: `data:image/jpeg;base64,${small.base64}` }),
      }),
      'guest preview picture'
    );
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      console.warn('[GuestPreviewSnapshot] The backend did not keep the picture:', response.status, result.error);
    }
  } catch (err) {
    console.warn('[GuestPreviewSnapshot] Could not send the picture:', err);
  }
}

/** The picture the backend keeps for the event (from any of the host's phones), or null for none */
export async function loadSavedGuestPreviewPicture(eventId: string): Promise<GuestPreviewPicture | null> {
  try {
    const { data, error } = await supabase.from('events').select('guest_preview_picture').eq('id', eventId).maybeSingle();
    if (error || !data) return null;
    return readGuestPreviewPicture((data as { guest_preview_picture?: unknown }).guest_preview_picture);
  } catch {
    return null;
  }
}
