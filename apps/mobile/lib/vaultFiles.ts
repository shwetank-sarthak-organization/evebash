import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { vaultApi, VaultApiError, type VaultItem } from './vaultApi';

export function formatBytes(bytes: number) {
  if (!bytes) return '0 KB';
  const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${parseFloat((bytes / Math.pow(1024, index)).toFixed(2))} ${units[index]}`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export type PreviewKind = 'image' | 'video' | 'pdf' | 'text' | 'none';

/** Same Phase 1 preview rules as the website. */
export function previewKind(mimeType: string, extension: string): PreviewKind {
  if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType)) return 'image';
  if (mimeType === 'video/mp4') return 'video';
  if (mimeType === 'application/pdf' || extension === 'pdf') return 'pdf';
  if (mimeType === 'text/plain' || mimeType === 'text/csv' || extension === 'txt' || extension === 'csv') return 'text';
  return 'none';
}

export function fileIconName(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'photo.fill';
  if (mimeType.startsWith('video/')) return 'video.fill';
  return 'doc.fill';
}

export function canSaveToPhotos(item: VaultItem) {
  return item.mimeType.startsWith('image/') || item.mimeType.startsWith('video/');
}

/** Downloads the file into the app's cache (kept only until the OS clears it). */
async function downloadToCache(item: VaultItem) {
  const { url } = await vaultApi.link(item.id, 'download');
  const safeName = item.filename.replace(/[/\\:*?"<>|]/g, '_');
  const target = `${FileSystem.cacheDirectory}vault-${item.id}-${safeName}`;
  const result = await FileSystem.downloadAsync(url, target);
  if (result.status < 200 || result.status >= 300) {
    throw new VaultApiError(result.status, 'download_failed', "Couldn't download the file. Please try again.");
  }
  return result.uri;
}

/** Opens the share sheet, from which the user can also choose Save to Files / Drive. */
export async function shareVaultFile(item: VaultItem) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new VaultApiError(0, 'unsupported', "Sharing isn't available on this device.");
  }
  const uri = await downloadToCache(item);
  await Sharing.shareAsync(uri, { mimeType: item.mimeType, dialogTitle: item.filename });
}

export async function saveVaultFileToPhotos(item: VaultItem) {
  const permission = await MediaLibrary.requestPermissionsAsync(true);
  if (!permission.granted) {
    throw new VaultApiError(0, 'permission', 'Allow EveBash to add to your Photos to save this file.');
  }
  const uri = await downloadToCache(item);
  await MediaLibrary.saveToLibraryAsync(uri);
}
