import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Where the app keeps its sign-in (issue #311): the phone's secure storage (iPhone Keychain, Android Keystore)
// instead of normal app storage (AsyncStorage), which a hacked phone or a backup could read.
//
// - A sign-in is often bigger than secure storage likes in one value (about 2 KB), so it is saved in parts:
//   "<key>.n" holds how many parts, "<key>.0", "<key>.1"... hold the text.
// - Readable after the phone's first unlock, so uploads and sign-in renewals keep working while the screen is
//   locked; "this device only", so it never moves to another phone with a backup.
// - Phones signed in before this change have the sign-in in AsyncStorage: the first read moves it across and
//   deletes the old copy, so nobody is signed out.
// - If secure storage fails, the sign-in falls back to AsyncStorage (as before), so a phone with a broken keychain
//   can still sign in.

const PART_SIZE = 1800;
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

// Secure storage keys may only use letters, digits, ".", "-" and "_"
const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');
const countKey = (key: string) => `${safeKey(key)}.n`;
const partKey = (key: string, index: number) => `${safeKey(key)}.${index}`;

async function readSecure(key: string): Promise<string | null> {
  const count = Number(await SecureStore.getItemAsync(countKey(key), OPTIONS));
  if (!Number.isInteger(count) || count <= 0) return null;
  const parts: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const part = await SecureStore.getItemAsync(partKey(key, i), OPTIONS);
    if (part === null) return null; // A part is missing: treat as not saved
    parts.push(part);
  }
  return parts.join('');
}

async function removeSecure(key: string): Promise<void> {
  const count = Number(await SecureStore.getItemAsync(countKey(key), OPTIONS)) || 0;
  // The count goes first, so a half-finished removal reads as "not saved"
  await SecureStore.deleteItemAsync(countKey(key), OPTIONS);
  for (let i = 0; i < count; i += 1) {
    await SecureStore.deleteItemAsync(partKey(key, i), OPTIONS);
  }
}

async function writeSecure(key: string, value: string): Promise<void> {
  const parts: string[] = [];
  for (let i = 0; i < value.length; i += PART_SIZE) parts.push(value.slice(i, i + PART_SIZE));
  if (parts.length === 0) parts.push('');
  const oldCount = Number(await SecureStore.getItemAsync(countKey(key), OPTIONS)) || 0;
  // The count is removed first and written last, so a half-finished save reads as "not saved", never as a mix of
  // old and new parts
  await SecureStore.deleteItemAsync(countKey(key), OPTIONS);
  for (let i = 0; i < parts.length; i += 1) {
    await SecureStore.setItemAsync(partKey(key, i), parts[i], OPTIONS);
  }
  await SecureStore.setItemAsync(countKey(key), String(parts.length), OPTIONS);
  // A shorter sign-in than before: delete the parts that are left over
  for (let i = parts.length; i < oldCount; i += 1) {
    await SecureStore.deleteItemAsync(partKey(key, i), OPTIONS);
  }
}

/** The storage supabase-js uses for the app's sign-in (lib/supabase.ts) */
export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const saved = await readSecure(key);
      if (saved !== null) return saved;
    } catch (error) {
      console.warn('[SecureSession] Could not read secure storage:', error);
      return AsyncStorage.getItem(key);
    }
    // Not in secure storage yet: a sign-in saved before #311 (or after a failed secure write) is moved across
    const old = await AsyncStorage.getItem(key);
    if (old !== null) {
      try {
        await writeSecure(key, old);
        await AsyncStorage.removeItem(key);
      } catch (error) {
        console.warn('[SecureSession] Could not move the sign-in to secure storage:', error);
      }
    }
    return old;
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      await writeSecure(key, value);
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.warn('[SecureSession] Could not save to secure storage, using app storage:', error);
      // Clear any older copy there, or it would be read instead of this one
      await removeSecure(key).catch(() => {});
      await AsyncStorage.setItem(key, value);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await removeSecure(key);
    } catch (error) {
      console.warn('[SecureSession] Could not remove from secure storage:', error);
    }
    await AsyncStorage.removeItem(key);
  },
};
