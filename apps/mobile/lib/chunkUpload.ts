import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import { getEndpointsForPath } from './storage';
import { supabase } from './supabase';
import { sha1 } from './sha1';
import { toDurationSeconds } from './mediaDuration';
import type { UploadQueueItem } from './uploadQueue';

// Chunked (B2 large-file) upload for videos >= 20 MiB.
// The request flow mirrors the web client (src/lib/storage.ts → uploadLargeFileInChunks):
//   initiate → part-url + upload_part (per part, with retries) → complete.

const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MiB (B2 minimum part size is 5 MB)
const ASYNC_STORAGE_PREFIX = '@evebash_chunk_resume_';
const MAX_PART_RETRIES = 6; // same as web MAX_CHUNK_RETRIES
const MAX_SESSION_RESTARTS = 2; // how many times an expired B2 session may be restarted
const API_TIMEOUT_MS = 20_000;
const COMPLETE_TIMEOUT_MS = 60_000; // finish_large_file + DB save + QStash enqueue

export interface ChunkUploadState {
  version: 1;
  clientUploadId: string;
  fileUri: string;
  fileSize: number;
  b2FileId: string;
  storageKey: string;
  chunkSize: number;
  totalParts: number;
  completedParts: Record<number, { sha1: string; size: number }>;
  status: 'initiating' | 'uploading' | 'completing' | 'completed' | 'failed' | 'aborting';
  createdAt: number;
  updatedAt: number;
}

type CompletedPart = { sha1: string; size: number };

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Failures that an automatic retry of the same request cannot fix (e.g. backend 4xx validation errors). */
export function isNonRetryableUploadError(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { nonRetryable?: boolean }).nonRetryable === true;
}

function nonRetryableError(message: string): Error {
  const err = new Error(message) as Error & { nonRetryable: boolean };
  err.nonRetryable = true;
  return err;
}

function isNonRetryableStatus(status: number) {
  return status === 400 || status === 403 || status === 404 || status === 409 || status === 413 || status === 422;
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function stateKeyFor(itemId: string) {
  return `${ASYNC_STORAGE_PREFIX}${itemId}`;
}

function partSizeFor(state: ChunkUploadState, partNumber: number) {
  const offset = (partNumber - 1) * state.chunkSize;
  return Math.max(0, Math.min(state.chunkSize, state.fileSize - offset));
}

/**
 * All requests of one chunk session go to ONE API host (like web's getApiUrl).
 * The generic endpoint fallback could send `complete` to a different backend
 * (e.g. prod) after a timeout on staging.
 */
function chunkApiUrl(path: string): string {
  return getEndpointsForPath(path)[0];
}

async function getAccessToken(forceRefresh = false): Promise<string> {
  if (forceRefresh) {
    const { data } = await supabase.auth.refreshSession();
    if (data.session?.access_token) return data.session.access_token;
  }
  // getSession() transparently refreshes an expired token, so long uploads always send a valid one.
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || '';
}

/** POST JSON to the chunk API with a fresh token; on 401 refresh the session once and retry (same as web). */
async function postChunkApi(path: string, body: unknown, timeoutMs = API_TIMEOUT_MS): Promise<Response> {
  const url = chunkApiUrl(path);

  const send = async (token: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  let response = await send(await getAccessToken());
  if (response.status === 401) {
    console.warn(`[ChunkUpload] 401 from ${path}. Refreshing session and retrying once...`);
    response = await send(await getAccessToken(true));
  }
  return response;
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Removes the persisted resume state. Call once the queue has recorded the finished upload. */
export async function clearChunkUploadState(itemId: string) {
  await AsyncStorage.removeItem(stateKeyFor(itemId));
}

/** Cancels an unfinished B2 large file (and its 'uploading' row) and drops the local resume state. */
export async function abortChunkedUpload(item: UploadQueueItem) {
  const stateKey = stateKeyFor(item.id);
  const stateRaw = await AsyncStorage.getItem(stateKey);
  if (!stateRaw) return;

  try {
    const state: ChunkUploadState = JSON.parse(stateRaw);
    // A completed upload is already a real photo row — never abort it.
    if (state.b2FileId && state.status !== 'completed') {
      const response = await postChunkApi('/api/media/upload/chunk/abort', { fileId: state.b2FileId });
      if (!response.ok && response.status !== 404 && response.status !== 409) {
        console.warn(`[ChunkUpload] Abort returned ${response.status} for fileId=${state.b2FileId}`);
      }
    }
  } finally {
    await AsyncStorage.removeItem(stateKey);
  }
}

export async function uploadVideoInChunks(
  item: UploadQueueItem,
  onProgress: (progress: number) => void
): Promise<{ storageKey: string; b2FileId: string; duration?: number }> {
  if (!item.fileSize || item.fileSize <= 0) {
    throw new Error(`Unknown file size for chunked upload of ${item.fileName}`);
  }

  const stateKey = stateKeyFor(item.id);
  let state: ChunkUploadState | null = null;

  const stateRaw = await AsyncStorage.getItem(stateKey);
  if (stateRaw) {
    try {
      const saved: ChunkUploadState = JSON.parse(stateRaw);
      if (saved.fileSize === item.fileSize && saved.chunkSize > 0 && saved.totalParts > 0) {
        state = saved;
      } else {
        console.warn('[ChunkUpload] Saved resume state does not match this file. Starting fresh.');
      }
    } catch (e) {
      console.warn('[ChunkUpload] Invalid state JSON', e);
    }
  }

  if (!state) {
    state = {
      version: 1,
      clientUploadId: item.id,
      fileUri: item.fileUri,
      fileSize: item.fileSize,
      b2FileId: '',
      storageKey: '',
      chunkSize: CHUNK_SIZE,
      totalParts: Math.ceil(item.fileSize / CHUNK_SIZE),
      completedParts: {},
      status: 'initiating',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  const persistState = async () => {
    if (state) {
      state.updatedAt = Date.now();
      await AsyncStorage.setItem(stateKey, JSON.stringify(state));
    }
  };

  const reportProgress = () => {
    if (!state) return;
    const done = Object.keys(state.completedParts).length;
    onProgress(Math.min(99, Math.round((done / state.totalParts) * 100)));
  };

  let sessionRestarts = 0;
  reportProgress();

  // State Machine Loop
  while (state.status !== 'completed' && state.status !== 'failed' && state.status !== 'aborting') {
    if (state.status === 'initiating') {
      console.log(`[ChunkUpload] Initiating chunked upload for ${item.fileName} (${item.fileSize} bytes, ${state.totalParts} parts) via ${chunkApiUrl('/api/media/upload/chunk/initiate')}`);
      const response = await postChunkApi('/api/media/upload/chunk/initiate', {
        eventId: item.eventId,
        fileName: item.fileName,
        fileSize: item.fileSize,
        contentType: item.fileType || 'video/mp4',
        resourceType: 'video',
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = `Initiate failed: ${response.status} ${data?.error || ''}`.trim();
        throw isNonRetryableStatus(response.status) ? nonRetryableError(message) : new Error(message);
      }
      if (!data.fileId || !data.storageKey) {
        throw new Error('Initiate response is missing fileId/storageKey');
      }

      state.b2FileId = data.fileId;
      state.storageKey = data.storageKey;
      state.completedParts = {};

      // Server-side resume (same as web): parts already on B2 for this session are skipped.
      if (data.resumed && Array.isArray(data.completedParts)) {
        for (const part of data.completedParts) {
          const partNumber = Number(part?.partNumber);
          const rawSha1 = typeof part?.sha1 === 'string' ? part.sha1 : '';
          const partSha1 = rawSha1.startsWith('unverified:') ? rawSha1.split(':')[1] : rawSha1;
          if (partNumber >= 1 && partNumber <= state.totalParts && partSha1) {
            state.completedParts[partNumber] = { sha1: partSha1, size: partSizeFor(state, partNumber) };
          }
        }
        console.log(`[ChunkUpload] Server-side resume: ${Object.keys(state.completedParts).length}/${state.totalParts} parts already on B2.`);
      }

      state.status = 'uploading';
      console.log(`[ChunkUpload] Initiate succeeded (fileId=${data.fileId}, storageKey=${data.storageKey}).`);
      await persistState();
      reportProgress();
    }
    else if (state.status === 'uploading') {
      const file = new File(item.fileUri);
      let sessionExpired = false;

      for (let partNumber = 1; partNumber <= state.totalParts; partNumber++) {
        if (state.completedParts[partNumber]) {
          console.log(`[ChunkUpload] Part ${partNumber}/${state.totalParts} already uploaded. Skipping.`);
          continue;
        }

        const result = await uploadPartWithRetry(file, state, item.id, partNumber);
        if (result === 'session_expired') {
          sessionExpired = true;
          break;
        }

        // B2 verified the SHA1 and saved the part
        state.completedParts[partNumber] = result;
        await persistState();
        reportProgress();
      }

      if (sessionExpired) {
        sessionRestarts++;
        if (sessionRestarts > MAX_SESSION_RESTARTS) {
          throw new Error('B2 upload session keeps expiring. Please retry later.');
        }
        console.warn('[ChunkUpload] B2 file session expired or missing on B2. Restarting fresh.');
        state.status = 'initiating';
        state.b2FileId = '';
        state.storageKey = '';
        state.completedParts = {};
        await persistState();
        continue;
      }

      if (Object.keys(state.completedParts).length !== state.totalParts) {
        throw new Error(`Chunked upload incomplete: ${Object.keys(state.completedParts).length}/${state.totalParts} parts uploaded`);
      }
      state.status = 'completing';
      await persistState();
    }
    else if (state.status === 'completing') {
      const partSha1Array: string[] = [];
      const missingParts: number[] = [];
      for (let i = 1; i <= state.totalParts; i++) {
        const part = state.completedParts[i];
        if (part?.sha1) partSha1Array.push(part.sha1);
        else missingParts.push(i);
      }
      if (missingParts.length > 0) {
        console.warn(`[ChunkUpload] Parts ${missingParts.join(', ')} missing before complete. Uploading them first.`);
        state.status = 'uploading';
        await persistState();
        continue;
      }

      const durationSeconds = toDurationSeconds(item.duration);
      console.log(`[ChunkUpload] All ${state.totalParts} parts verified. Finalizing large file on B2 (duration=${durationSeconds}s)...`);

      // Same body as the web client — the backend requires fileId, storageKey, eventId and partSha1Array.
      const completeRes = await postChunkApi(
        '/api/media/upload/chunk/complete',
        {
          fileId: state.b2FileId,
          storageKey: state.storageKey,
          eventId: item.eventId,
          fileName: item.fileName,
          fileSize: state.fileSize,
          resourceType: 'video',
          partSha1Array,
          duration: durationSeconds,
        },
        COMPLETE_TIMEOUT_MS
      );

      if (!completeRes.ok) {
        const errText = await completeRes.text().catch(() => '');
        const message = `Complete failed: ${completeRes.status} ${errText}`.trim();
        // Resume state stays at 'completing', so a manual Retry finalizes without re-uploading any part.
        throw isNonRetryableStatus(completeRes.status) ? nonRetryableError(message) : new Error(message);
      }

      // Backend has saved the photo row (status 'processing') and queued the transcode.
      state.status = 'completed';
      await persistState();
      console.log(`[ChunkUpload] Large file completed successfully on B2! (storageKey=${state.storageKey})`);
    }
  }

  if (state.status !== 'completed') {
    throw new Error(`Chunked upload stopped in unexpected state: ${state.status}`);
  }

  // Resume state is intentionally kept (status 'completed') until the queue has recorded the result
  // and calls clearChunkUploadState(). If the app is killed in between, the next run returns here
  // immediately instead of uploading the whole video again.
  onProgress(100);

  return {
    storageKey: state.storageKey,
    b2FileId: state.b2FileId,
    duration: item.duration,
  };
}

/**
 * Uploads one part with up to MAX_PART_RETRIES attempts (mirrors web uploadChunk):
 * a fresh part URL per attempt and exponential backoff (2s, 4s, 8s, 16s, 30s).
 * Returns 'session_expired' when the B2 large-file session no longer exists.
 */
async function uploadPartWithRetry(
  file: File,
  state: ChunkUploadState,
  itemId: string,
  partNumber: number
): Promise<CompletedPart | 'session_expired'> {
  const offset = (partNumber - 1) * state.chunkSize;
  const partSize = partSizeFor(state, partNumber);
  const label = `[ChunkUpload] [Part ${partNumber}/${state.totalParts}]`;

  console.log(`${label} Reading ${partSize} bytes at offset ${offset}...`);
  let chunkBytes: Uint8Array | null = null;
  let handle: ReturnType<File['open']> | null = null;
  try {
    handle = file.open();
    handle.offset = offset;
    chunkBytes = handle.readBytes(partSize);
  } finally {
    if (handle) handle.close();
  }

  if (!chunkBytes || chunkBytes.byteLength !== partSize) {
    throw new Error(`${label} Failed to read chunk bytes (got ${chunkBytes?.byteLength ?? 0} of ${partSize})`);
  }

  // SHA-1 is computed once and reused for every attempt.
  const chunkSha1 = sha1(chunkBytes);
  console.log(`${label} SHA1: ${chunkSha1}.`);

  // Write the chunk to a temp file once; FileSystem.uploadAsync streams it natively.
  const chunkTempFile = new File(FileSystem.cacheDirectory || '', `part_${itemId}_${partNumber}.tmp`);
  try {
    if (chunkTempFile.exists) chunkTempFile.delete();
    chunkTempFile.write(chunkBytes);
    chunkBytes = null; // let the 10 MiB buffer be garbage-collected during the upload

    let lastErr: unknown;
    for (let attempt = 1; attempt <= MAX_PART_RETRIES; attempt++) {
      try {
        // Fresh part URL per attempt (B2 upload URLs are single-use and tokens expire).
        const partUrlRes = await postChunkApi('/api/media/upload/chunk/part-url', { fileId: state.b2FileId });
        if (partUrlRes.status === 410 || partUrlRes.status === 404) {
          return 'session_expired';
        }
        const partUrlData = await partUrlRes.json().catch(() => ({}));
        if (!partUrlRes.ok || !partUrlData.uploadUrl) {
          throw new Error(`Part URL failed: ${partUrlRes.status} ${partUrlData?.error || ''}`.trim());
        }

        console.log(`${label} Uploading ${partSize} bytes directly to B2 (attempt ${attempt}/${MAX_PART_RETRIES})...`);
        const uploadRes = await FileSystem.uploadAsync(partUrlData.uploadUrl, chunkTempFile.uri, {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            Authorization: partUrlData.authorizationToken,
            'X-Bz-Part-Number': String(partNumber),
            'X-Bz-Content-Sha1': chunkSha1,
          },
        });

        if (uploadRes.status < 200 || uploadRes.status >= 300) {
          // 401/403/503 from B2 → the next attempt fetches a new upload URL + token.
          throw new Error(`B2 upload_part failed: ${uploadRes.status} ${uploadRes.body || ''}`.trim());
        }

        console.log(`${label} Upload successful (status ${uploadRes.status}).`);
        return { sha1: chunkSha1, size: partSize };
      } catch (err) {
        lastErr = err;
        if (attempt < MAX_PART_RETRIES) {
          const wait = Math.min(1000 * 2 ** attempt, 30_000);
          console.warn(`${label} Attempt ${attempt}/${MAX_PART_RETRIES} failed (${errorMessage(err)}). Retrying in ${wait / 1000}s...`);
          await sleep(wait);
        }
      }
    }

    throw new Error(`Part ${partNumber} failed after ${MAX_PART_RETRIES} attempts: ${errorMessage(lastErr)}`);
  } finally {
    try {
      chunkTempFile.delete();
    } catch {}
  }
}
