import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import { vaultApi, VaultApiError, type VaultItem } from './vaultApi';

export type VaultUploadSource = { uri: string; name: string; mimeType: string; sizeBytes: number };

const MAX_PART_ATTEMPTS = 3;

/** Lets the caller stop an upload; the running transfer is cancelled and reserved space released. */
export class UploadCancelToken {
  cancelled = false;
  private current: { cancelAsync: () => Promise<void> } | null = null;
  attach(task: { cancelAsync: () => Promise<void> } | null) {
    this.current = task;
  }
  async cancel() {
    this.cancelled = true;
    await this.current?.cancelAsync().catch(() => null);
  }
}

function cancelledError() {
  return new VaultApiError(0, 'cancelled', 'Upload cancelled');
}

function headerValue(headers: Record<string, string> | undefined, name: string) {
  if (!headers) return null;
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : null;
}

/** PUTs a local file to a signed link with native progress. Returns the response headers. */
async function putFile(url: string, fileUri: string, headers: Record<string, string>, onProgress: (sent: number) => void, token: UploadCancelToken) {
  if (token.cancelled) throw cancelledError();
  const task = FileSystem.createUploadTask(url, fileUri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers,
  }, ({ totalBytesSent }) => onProgress(totalBytesSent));
  token.attach(task);
  const result = await task.uploadAsync();
  token.attach(null);
  if (token.cancelled) throw cancelledError();
  if (!result || result.status < 200 || result.status >= 300) {
    throw new VaultApiError(result?.status ?? 0, 'storage_error', 'The upload was rejected by storage. Please try again.');
  }
  return result.headers;
}

/**
 * Uploads one file straight from the phone to Vault storage using signed links from the backend.
 * Small files go in one request; large files go part by part, each read from disk into a temporary
 * file and streamed natively (the same approach as event video uploads).
 */
export async function uploadVaultFile(
  source: VaultUploadSource,
  folderId: string | null,
  onProgress: (uploadedBytes: number) => void,
  token: UploadCancelToken,
): Promise<VaultItem> {
  const start = await vaultApi.startUpload({
    filename: source.name,
    sizeBytes: source.sizeBytes,
    mimeType: source.mimeType || 'application/octet-stream',
    folderId,
  });

  try {
    if (start.mode === 'single') {
      await putFile(start.url, source.uri, start.headers, onProgress, token);
      return (await vaultApi.completeUpload(start.uploadId)).item;
    }

    const file = new File(source.uri);
    const etags: { partNumber: number; etag: string }[] = [];
    let doneBytes = 0;
    for (let partNumber = 1; partNumber <= start.partCount; partNumber += 1) {
      if (token.cancelled) throw cancelledError();
      const offset = (partNumber - 1) * start.partSize;
      const length = Math.min(start.partSize, source.sizeBytes - offset);

      const handle = file.open();
      let bytes: Uint8Array;
      try {
        handle.offset = offset;
        bytes = handle.readBytes(length);
      } finally {
        handle.close();
      }
      if (bytes.byteLength !== length) throw new VaultApiError(0, 'read_error', "Couldn't read the file from your phone. Please try again.");

      const partFile = new File(FileSystem.cacheDirectory || '', `vault_${start.uploadId}_${partNumber}.part`);
      try {
        if (partFile.exists) partFile.delete();
        partFile.write(bytes);

        let etag: string | null = null;
        for (let attempt = 1; attempt <= MAX_PART_ATTEMPTS && !etag; attempt += 1) {
          try {
            const { parts } = await vaultApi.partUrls(start.uploadId, [partNumber]);
            const headers = await putFile(parts[0].url, partFile.uri, {}, (sent) => onProgress(doneBytes + sent), token);
            etag = headerValue(headers, 'etag');
            if (!etag) throw new VaultApiError(0, 'storage_error', "Storage didn't confirm part of the upload.");
          } catch (error) {
            if (token.cancelled || attempt === MAX_PART_ATTEMPTS) throw error;
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          }
        }
        etags.push({ partNumber, etag: etag! });
        doneBytes += length;
        onProgress(doneBytes);
      } finally {
        try {
          partFile.delete();
        } catch {}
      }
    }
    return (await vaultApi.completeUpload(start.uploadId, etags)).item;
  } catch (error) {
    // Release the reserved storage right away instead of waiting for the hourly cleanup.
    await vaultApi.abortUpload(start.uploadId).catch(() => null);
    throw error;
  }
}
