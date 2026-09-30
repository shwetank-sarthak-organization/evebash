import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';
import { getEndpointsForPath, fetchWithEndpointFallback } from './storage';
import { toDurationSeconds } from './mediaDuration';

let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
  if (Notifications) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }
} catch (e) {
  console.warn('[UploadQueue] expo-notifications is not supported in this environment. System notifications will be disabled.');
}

const STORAGE_KEY = '@evebash_upload_queue_v2';
const LEGACY_STORAGE_KEY = '@evebash_upload_queue';
const PROGRESS_NOTIFICATION_ID = 'media-upload-progress';
const CHANNEL_PROGRESS = 'upload-progress';
const CHANNEL_COMPLETE = 'upload-completion';

const CONCURRENCY = 1;
const MAX_UPLOAD_RETRIES = 3;
const UPLOAD_DIR_NAME = 'evebash_uploads/';

export type UploadStatus =
  | 'pending'
  | 'uploading'
  | 'uploaded_pending_metadata'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'upload_needs_reconciliation';

export interface UploadQueueItem {
  id: string; // clientUploadId
  fileUri: string;
  originalFileName: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  eventId: string;
  userId: string;
  mediaType: 'photo' | 'video';
  status: UploadStatus;
  progress: number; // In-memory progress 0-100
  storageKey?: string;
  error?: string;
  retryCount?: number;
  addedAt: number;
  batchId?: string;
  batchTotal?: number;
  duration?: number; // Optional duration from expo-image-picker, in MILLISECONDS — send toDurationSeconds(duration) to the API
  batchIndex?: number;
  processingStartedAt?: number; // When the backend saved the row; videos stay 'processing' until Modal has transcoded them
}

type QueueListener = (items: UploadQueueItem[]) => void;

let queue: UploadQueueItem[] = [];
let activeSlots = 0;
const listeners = new Set<QueueListener>();

// ── 1. Non-Poisoning Queue Mutation Mutex ────────────────────────────────────
let queueWriteChain: Promise<void> = Promise.resolve();

export function mutateQueue(mutator: (currentQueue: UploadQueueItem[]) => void): Promise<void> {
  const operation = queueWriteChain
    .catch(() => undefined)
    .then(async () => {
      mutator(queue);
      await saveQueueToStorage();
      notifyListeners();
    });

  queueWriteChain = operation.catch(() => undefined);
  return operation;
}

function notifyListeners() {
  const immutableQueue = queue.map(item => ({ ...item }));
  listeners.forEach(listener => {
    try {
      listener(immutableQueue);
    } catch (err) {
      console.error('[UploadQueue] Listener error:', err);
    }
  });
}

async function saveQueueToStorage() {
  try {
    // Progress % is ephemeral — strip or keep state for persistence
    const serialized = JSON.stringify(queue);
    await AsyncStorage.setItem(STORAGE_KEY, serialized);
  } catch (err) {
    console.error('[UploadQueue] Failed to save queue to storage:', err);
  }
}

// ── 2. Notification Channels & Permissions ──────────────────────────────────
async function ensureNotificationChannels() {
  if (!Notifications) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_PROGRESS, {
        name: 'Upload Progress',
        importance: Notifications.AndroidImportance.LOW,
        showBadge: false,
      });
      await Notifications.setNotificationChannelAsync(CHANNEL_COMPLETE, {
        name: 'Upload Completion',
        importance: Notifications.AndroidImportance.DEFAULT,
        showBadge: true,
      });
    }
  } catch (err) {
    console.warn('[UploadQueue] Failed to set notification channels:', err);
  }
}

async function checkNotificationPermission() {
  if (!Notifications) return false;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch (err) {
    console.warn('[UploadQueue] Failed to check notification permissions:', err);
    return false;
  }
}

// ── 3. Queue Initialization & Startup Reconciliation ────────────────────────
export async function initUploadQueue() {
  await ensureNotificationChannels();

  try {
    // 1. Check for legacy migration
    const legacyRaw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
    let initialQueue: UploadQueueItem[] = [];

    const storedRaw = await AsyncStorage.getItem(STORAGE_KEY);
    if (storedRaw) {
      initialQueue = JSON.parse(storedRaw);
    } else if (legacyRaw) {
      // Migrate legacy queue items
      try {
        const legacyParsed = JSON.parse(legacyRaw);
        if (Array.isArray(legacyParsed)) {
          initialQueue = legacyParsed.map((item: any) => ({
            id: item.id || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            fileUri: item.fileUri,
            originalFileName: item.fileName || 'upload.bin',
            fileName: item.fileName || 'upload.bin',
            fileType: item.fileType || 'application/octet-stream',
            fileSize: 0,
            eventId: item.eventId,
            userId: item.userId || 'anonymous',
            mediaType: item.mediaType || 'photo',
            status: item.status === 'uploading' ? 'upload_needs_reconciliation' : item.status,
            progress: item.status === 'completed' ? 100 : 0,
            error: item.error,
            addedAt: item.addedAt || Date.now(),
          }));
        }
        await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch (migrationErr) {
        console.warn('[UploadQueue] Legacy migration notice:', migrationErr);
      }
    }

    // 2. Filter out stale failed items hitting foreign key or invalid event constraints
    const validInitial = initialQueue.filter(item => {
      if (item.status === 'failed' && (item.error?.includes('foreign key constraint') || item.error?.includes('does not exist'))) {
        void cleanupDurableFile(item.fileUri);
        return false;
      }
      return true;
    });

    // Mark any interrupted uploads as needs reconciliation
    queue = validInitial.map(item => {
      if (item.status === 'uploading') {
        return { ...item, status: 'upload_needs_reconciliation' as UploadStatus, progress: 0 };
      }
      return item;
    });

    notifyListeners();

    // 3. Reconcile interrupted uploads with remote server
    const needsReconciliation = queue.filter(i => i.status === 'upload_needs_reconciliation');
    if (needsReconciliation.length > 0) {
      void reconcileInterruptedUploads(needsReconciliation);
    }

    // 4. Flush any pending metadata batches
    void flushMetadataBatches();

    // 5. Resume tracking any processing batches
    const processingEventIds = Array.from(new Set(queue.filter(i => i.status === 'processing').map(i => i.eventId)));
    for (const eventId of processingEventIds) {
      void triggerAndTrackProcessing(eventId);
    }

    // 6. Start queue processing if there are pending items
    if (queue.some(item => item.status === 'pending')) {
      processQueue();
    } else if (Notifications && !queue.some(i => i.status === 'uploading' || i.status === 'uploaded_pending_metadata' || i.status === 'processing')) {
      try {
        await Notifications.dismissNotificationAsync(PROGRESS_NOTIFICATION_ID);
      } catch (e) {}
    }
  } catch (err) {
    console.error('[UploadQueue] Init error:', err);
  }
}

async function reconcileInterruptedUploads(items: UploadQueueItem[]) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return;

  for (const item of items) {
    // Chunked uploads (videos >= 20 MiB) handle their own resume state perfectly.
    // Transition them to pending so processQueue -> uploadWorker -> chunkUpload resumes them.
    if (item.mediaType === 'video' && item.fileSize && item.fileSize >= 20 * 1024 * 1024) {
      await mutateQueue(q => {
        const target = q.find(i => i.id === item.id);
        if (target) {
          target.status = 'pending';
          target.progress = 0;
        }
      });
      processQueue();
      continue;
    }

    try {
      let reconciled = false;
      try {
        const response = await fetchWithEndpointFallback(
          getEndpointsForPath('/api/media/mobile/reconcile-upload'),
          (endpoint: string) => {
            return fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                clientUploadId: item.id,
                storageKey: item.storageKey,
                expectedSize: item.fileSize,
              }),
            });
          },
          'reconcile upload'
        );

        const result = await response.json().catch(() => ({}));
        if (response.ok && result.state === 'completed') {
          reconciled = true;
          if (result.alreadySaved) {
            await cleanupDurableFile(item.fileUri);
            await mutateQueue(q => {
              const target = q.find(i => i.id === item.id);
              if (target) {
                target.status = 'processing';
                target.progress = 90;
                target.processingStartedAt = Date.now();
              }
            });
            void triggerAndTrackProcessing(item.eventId);
          } else {
            await mutateQueue(q => {
              const target = q.find(i => i.id === item.id);
              if (target) {
                target.status = 'uploaded_pending_metadata';
                target.storageKey = result.storageKey || target.storageKey;
              }
            });
          }
        }
      } catch (err) {
        console.warn(`[UploadQueue] Reconcile endpoint notice for ${item.id}:`, err);
      }

      if (!reconciled) {
        // Not completed in B2 or endpoint unavailable — verify local file still exists
        const fileInfo = await FileSystem.getInfoAsync(item.fileUri).catch(() => null);
        await mutateQueue(q => {
          const target = q.find(i => i.id === item.id);
          if (target) {
            if (fileInfo?.exists) {
              target.status = 'pending';
              target.progress = 0;
            } else {
              target.status = 'failed';
              target.error = 'Original file was deleted from device while app was inactive.';
            }
          }
        });
      }
    } catch (reconcileErr) {
      console.warn(`[UploadQueue] Reconcile error for ${item.id}:`, reconcileErr);
    }
  }

  void flushMetadataBatches();
  processQueue();
}

// ── 4. Add Files with Durable Copy & Disk Budget Check ───────────────────────
export async function addToUploadQueue(
  files: { uri: string; name: string; type: string; duration?: number }[],
  eventId: string,
  userId: string,
  mediaType: 'photo' | 'video'
) {
  await checkNotificationPermission();

  // 1. Calculate total batch size & check disk space
  let totalBatchBytes = 0;
  const fileDetails: Array<{ originalUri: string; name: string; type: string; size: number; duration?: number }> = [];

  for (const file of files) {
    try {
      const info = await FileSystem.getInfoAsync(file.uri);
      const size = info?.exists ? info.size || 0 : 0;
      totalBatchBytes += size;
      fileDetails.push({ originalUri: file.uri, name: file.name, type: file.type, size, duration: file.duration });
    } catch {
      fileDetails.push({ originalUri: file.uri, name: file.name, type: file.type, size: 0, duration: file.duration });
    }
  }

  const freeDisk = await FileSystem.getFreeDiskStorageAsync().catch(() => 1024 * 1024 * 1024);
  const safetyMargin = 50 * 1024 * 1024; // 50 MB safety margin
  if (freeDisk < totalBatchBytes + safetyMargin) {
    Alert.alert(
      'Storage Space Low',
      'Your device is very low on free storage space. Please free up some space before uploading large media batches.',
      [{ text: 'OK' }]
    );
    return;
  }

  // 2. Ensure durable upload directory exists
  const uploadDir = `${FileSystem.documentDirectory}${UPLOAD_DIR_NAME}`;
  await FileSystem.makeDirectoryAsync(uploadDir, { intermediates: true }).catch(() => {});

  // 3. Resolve eventId against DB in case it's a slug or legacy_id
  let resolvedEventId = eventId;
  try {
    const { data: eventRow } = await supabase
      .from('events')
      .select('id')
      .or(`id.eq.${eventId},legacy_id.eq.${eventId}`)
      .maybeSingle();
    if (eventRow?.id) {
      resolvedEventId = eventRow.id;
    }
  } catch (lookupErr) {
    // If lookup fails (e.g. offline), continue with original eventId
  }

  // 4. Copy files to durable document directory
  const newItems: UploadQueueItem[] = [];
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const batchTotal = fileDetails.length;

  for (let idx = 0; idx < fileDetails.length; idx++) {
    const detail = fileDetails[idx];
    const clientUploadId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const sanitizedFileName = detail.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const durableUri = `${uploadDir}${clientUploadId}_${sanitizedFileName}`;

    try {
      await FileSystem.copyAsync({ from: detail.originalUri, to: durableUri });
      // Free up device space by wiping the ImagePicker cache duplicate
      if (detail.originalUri.includes('ImagePicker')) {
        await FileSystem.deleteAsync(detail.originalUri, { idempotent: true }).catch(() => {});
      }
    } catch (copyErr) {
      console.warn(`[UploadQueue] Failed to make durable copy for ${detail.name}, using original URI:`, copyErr);
    }

    const effectiveUri = (await FileSystem.getInfoAsync(durableUri).catch(() => null))?.exists
      ? durableUri
      : detail.originalUri;

    newItems.push({
      id: clientUploadId,
      fileUri: effectiveUri,
      originalFileName: detail.name,
      fileName: detail.name,
      fileType: detail.type,
      fileSize: detail.size,
      eventId: resolvedEventId,
      userId,
      mediaType,
      status: 'pending',
      progress: 0,
      retryCount: 0,
      addedAt: Date.now(),
      batchId,
      batchTotal,
      batchIndex: idx + 1,
      duration: detail.duration,
    });
  }

  await mutateQueue(q => {
    // Purge any stale finished items (completed or failed) before starting a new batch
    const activeRemaining = q.filter(item => item.status !== 'completed' && item.status !== 'failed');
    q.length = 0;
    q.push(...activeRemaining, ...newItems);
  });

  void updateProgressNotification(true);
  processQueue();
}

async function cleanupDurableFile(fileUri: string) {
  if (fileUri && fileUri.includes(UPLOAD_DIR_NAME)) {
    try {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch (err) {
      console.warn('[UploadQueue] Notice on deleting durable file:', err);
    }
  }
}

// ── 5. Single-Part Upload Worker (Up to 5GB) ─────────────────────────────────
async function uploadWorker(item: UploadQueueItem) {
  await mutateQueue(q => {
    const target = q.find(i => i.id === item.id);
    if (target) {
      target.status = 'uploading';
      target.progress = 0;
    }
  });

  void updateProgressNotification(true);

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      throw new Error('Authorization required.');
    }

    // Retrieve file size if missing
    let fileSize = item.fileSize || 0;
    if (fileSize <= 0) {
      const info = await FileSystem.getInfoAsync(item.fileUri).catch(() => null);
      if (info && info.exists) {
        fileSize = info.size || 0;
      }
    }

    const MULTIPART_THRESHOLD = 20 * 1024 * 1024; // 20 MiB
    // Only videos: chunkUpload saves the row as a video. Photos of any size use the single-part path below.
    if (item.mediaType === 'video' && fileSize >= MULTIPART_THRESHOLD) {
      console.log(`[UploadQueue] Video is >= 20 MiB (${fileSize} bytes). Routing to ChunkUpload.`);
      const { uploadVideoInChunks, clearChunkUploadState } = require('./chunkUpload');
      // Pass the resolved size — item.fileSize can be 0 if the picker could not stat the file.
      const { storageKey } = await uploadVideoInChunks({ ...item, fileSize }, (rawPercent: number) => {
        const percent = Math.min(90, Math.round(rawPercent * 0.9));
        const target = queue.find(i => i.id === item.id);
        if (target) {
          target.progress = percent;
        }
        notifyListeners();
        void updateProgressNotification(false);
      });

      // /chunk/complete has already saved the photo row (status 'processing') and queued the
      // transcode — same as the web flow. No save-photo-batch call here: it would only re-upsert
      // the same row (resetting its duration) and send the host a second "new video" notification.
      console.log(`[UploadQueue] Chunked upload finalized for ${storageKey}. Backend saved the row and queued transcoding.`);
      await mutateQueue(q => {
        const target = q.find(i => i.id === item.id);
        if (target) {
          target.status = 'processing';
          target.progress = 90;
          target.processingStartedAt = Date.now();
          target.storageKey = storageKey;
          target.fileSize = fileSize;
          target.error = undefined;
        }
      });
      await clearChunkUploadState(item.id);
      void cleanupDurableFile(item.fileUri);
      void updateProgressNotification(true);
      void triggerAndTrackProcessing(item.eventId);
      return;
    }

    // 1. Get B2 upload URL (try /mobile/ endpoint first, fallback to standard endpoint if server is not yet updated)
    console.log(`[UploadQueue] Getting upload URL for: ${item.fileName} (${fileSize} bytes)`);
    let getUrlResult: any = null;

    try {
      const mobileResponse = await fetchWithEndpointFallback(
        getEndpointsForPath('/api/media/mobile/get-upload-url'),
        (endpoint: string) => {
          return fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              eventId: item.eventId,
              fileName: item.fileName,
              resourceType: item.mediaType === 'video' ? 'video' : 'image',
              fileSize,
              clientUploadId: item.id,
            }),
          });
        },
        'get mobile upload url'
      );
      if (mobileResponse.ok) {
        getUrlResult = await mobileResponse.json().catch(() => null);
      }
    } catch {
      // Mobile endpoint not available on server yet
    }

    if (!getUrlResult || !getUrlResult.uploadUrl) {
      console.log(`[UploadQueue] Mobile endpoint not found, falling back to standard /get-upload-url...`);
      const standardResponse = await fetchWithEndpointFallback(
        getEndpointsForPath('/api/media/get-upload-url'),
        (endpoint: string) => {
          return fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              eventId: item.eventId,
              fileName: item.fileName,
              resourceType: item.mediaType === 'video' ? 'video' : 'image',
            }),
          });
        },
        'get standard upload url'
      );

      getUrlResult = await standardResponse.json().catch(() => ({}));
      if (!standardResponse.ok) {
        throw new Error(getUrlResult.error || `Failed to get B2 upload URL (status: ${standardResponse.status})`);
      }
    }

    const { uploadUrl, authorizationToken, storageKey } = getUrlResult;

    await mutateQueue(q => {
      const target = q.find(i => i.id === item.id);
      if (target) {
        target.storageKey = storageKey;
        target.fileSize = fileSize;
      }
    });

    // 2. Upload file binary directly to Backblaze B2 via background task
    console.log(`[UploadQueue] Uploading directly to B2 (single-part, up to 5GB): ${storageKey}`);
    const uploadTask = FileSystem.createUploadTask(
      uploadUrl,
      item.fileUri,
      {
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          Authorization: authorizationToken,
          'Content-Type': item.fileType || 'application/octet-stream',
          'X-Bz-File-Name': encodeURIComponent(storageKey),
          'X-Bz-Content-Sha1': 'do_not_verify',
        },
      },
      (progress) => {
        const rawPercent = Math.min(
          100,
          Math.max(0, (progress.totalBytesSent / (progress.totalBytesExpectedToSend || fileSize || 1)) * 100)
        );
        // Upload phase spans 0% to 90% of overall lifecycle (last 10% is DB save + AI face indexing)
        const percent = Math.min(90, Math.round(rawPercent * 0.9));
        // Progress ticks are in-memory only — never save entire queue to disk on progress!
        const target = queue.find(i => i.id === item.id);
        if (target) {
          target.progress = percent;
        }
        notifyListeners();
        void updateProgressNotification(false);
      }
    );

    const response = await uploadTask.uploadAsync();
    if (!response || response.status !== 200) {
      throw new Error(`Direct B2 upload failed with status: ${response ? response.status : 'unknown'}`);
    }

    // 3. Mark as uploaded_pending_metadata
    console.log(`[UploadQueue] B2 binary upload successful for ${storageKey}. Enqueueing for metadata batch.`);
    await mutateQueue(q => {
      const target = q.find(i => i.id === item.id);
      if (target) {
        target.status = 'uploaded_pending_metadata';
        target.progress = 90;
      }
    });

    void updateProgressNotification(true);

    // Trigger metadata batch flusher
    void flushMetadataBatches();
  } catch (err: any) {
    const retries = (item.retryCount || 0) + 1;
    // Set by chunkUpload for 4xx responses — repeating the identical request cannot succeed.
    const nonRetryable = err?.nonRetryable === true;

    if (!nonRetryable && retries < MAX_UPLOAD_RETRIES) {
      console.warn(`[UploadQueue] Transient upload issue on ${item.fileName} (${err?.message || err}). Retrying attempt ${retries}/${MAX_UPLOAD_RETRIES}...`);
      await mutateQueue(q => {
        const target = q.find(i => i.id === item.id);
        if (target) {
          target.status = 'pending';
          target.retryCount = retries;
          target.progress = 0;
          target.storageKey = undefined; // Force acquiring fresh upload URL on retry
        }
      });
      // Backoff before slot is retried
      await new Promise(res => setTimeout(res, 2000 * retries));
    } else {
      console.error(
        nonRetryable
          ? `[UploadQueue] Upload rejected for ${item.fileName} (not retrying automatically):`
          : `[UploadQueue] Permanent upload failure for ${item.fileName} after ${MAX_UPLOAD_RETRIES} attempts:`,
        err
      );
      await mutateQueue(q => {
        const target = q.find(i => i.id === item.id);
        if (target) {
          target.status = 'failed';
          target.error = err.message || String(err);
        }
      });
    }
  } finally {
    activeSlots = Math.max(0, activeSlots - 1);
    void updateProgressNotification(true);
    processQueue();
  }
}

// ── 6. Single-Flight Metadata Batch Sync ─────────────────────────────────────
let metadataFlushPromise: Promise<void> | null = null;
let metadataFlushRequested = false;

export function flushMetadataBatches(): Promise<void> {
  if (metadataFlushPromise) {
    // An upload finished while a flush was running; that flush's snapshot doesn't include it, so run once more.
    metadataFlushRequested = true;
    return metadataFlushPromise;
  }

  metadataFlushPromise = (async () => {
    do {
      metadataFlushRequested = false;
      await flushMetadataBatchesInternal();
    } while (metadataFlushRequested);
  })().finally(() => {
    metadataFlushPromise = null;
  });

  return metadataFlushPromise;
}

async function flushMetadataBatchesInternal(): Promise<void> {
  const pendingItems = queue.filter(i => i.status === 'uploaded_pending_metadata');
  if (pendingItems.length === 0) return;

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return;

  // Group pending items by eventId
  const itemsByEvent = new Map<string, UploadQueueItem[]>();
  for (const item of pendingItems) {
    const list = itemsByEvent.get(item.eventId) || [];
    list.push(item);
    itemsByEvent.set(item.eventId, list);
  }

  for (const [rawEventId, items] of itemsByEvent.entries()) {
    try {
      console.log(`[UploadQueue] Flushing metadata batch for event ${rawEventId} (${items.length} items)...`);

      // 1. Resolve rawEventId to true database primary key id
      let targetEventId = rawEventId;
      try {
        const { data: eventRow } = await supabase
          .from('events')
          .select('id')
          .or(`id.eq.${rawEventId},legacy_id.eq.${rawEventId}`)
          .maybeSingle();

        if (eventRow?.id) {
          targetEventId = eventRow.id;
        } else {
          // Event was deleted or does not exist in database!
          console.warn(`[UploadQueue] Event ${rawEventId} does not exist in events table. Aborting batch.`);
          const nonExistentError = 'Event does not exist in database';
          await mutateQueue(q => {
            for (const item of items) {
              const target = q.find(i => i.id === item.id);
              if (target) {
                target.status = 'failed';
                target.error = nonExistentError;
                void cleanupDurableFile(target.fileUri);
              }
            }
          });
          continue;
        }
      } catch (lookupErr) {
        // Network error during lookup, continue with rawEventId
      }

      const photosPayload = items.map(item => ({
        clientUploadId: item.id,
        storageKey: item.storageKey,
        eventId: targetEventId,
        fileName: item.fileName,
        fileSize: item.fileSize,
        resourceType: item.mediaType === 'video' ? 'video' : 'image',
        // Picker duration is in ms; backend routes transcodes by seconds (> 600s → GPU).
        duration: item.mediaType === 'video' ? toDurationSeconds(item.duration) : undefined,
      }));

      let response: Response | null = null;
      try {
        response = await fetchWithEndpointFallback(
          getEndpointsForPath('/api/media/mobile/save-photo-batch'),
          (endpoint: string) => {
            return fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                eventId: targetEventId,
                photos: photosPayload,
              }),
            });
          },
          'save mobile photo batch'
        );
      } catch {
        // Mobile endpoint not available on server yet
      }

      if (!response || !response.ok) {
        console.log(`[UploadQueue] Mobile save-batch not found, falling back to standard /save-photo-batch...`);
        response = await fetchWithEndpointFallback(
          getEndpointsForPath('/api/media/save-photo-batch'),
          (endpoint: string) => {
            return fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                photos: photosPayload.map(p => ({
                  storageKey: p.storageKey,
                  eventId: targetEventId,
                  fileName: p.fileName,
                  fileSize: p.fileSize,
                  resourceType: p.resourceType,
                  duration: p.duration,
                })),
              }),
            });
          },
          'save standard photo batch'
        );
      }

      if (!response) {
        throw new Error('Network error: unable to reach metadata sync endpoints');
      }

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || `Failed to save metadata batch (status: ${response.status})`);
      }

      console.log(`[UploadQueue] Metadata batch response for event ${targetEventId}:`, JSON.stringify(result));

      // Inspect per-item results
      const resultsMap = new Map<string, { status: string; error?: string }>();
      if (Array.isArray(result.results)) {
        for (const res of result.results) {
          resultsMap.set(res.clientUploadId, res);
        }
      }

      await mutateQueue(q => {
        for (const item of items) {
          const itemResult = resultsMap.get(item.id);
          const target = q.find(i => i.id === item.id);
          if (!target) continue;

          if (!itemResult || itemResult.status === 'saved') {
            target.status = 'processing';
            target.progress = 90;
            target.processingStartedAt = Date.now();
            target.error = undefined;
            void cleanupDurableFile(target.fileUri);
          } else if (itemResult.status === 'not_uploaded') {
            const retries = (target.retryCount || 0) + 1;
            if (retries < MAX_UPLOAD_RETRIES) {
              target.status = 'pending';
              target.retryCount = retries;
              target.progress = 0;
              target.error = itemResult.error || 'Server did not find B2 file, retrying';
            } else {
              target.status = 'failed';
              target.error = itemResult.error || 'File failed to verify on server';
            }
          } else if (itemResult.status === 'rejected') {
            target.status = 'failed';
            target.error = itemResult.error || 'Rejected by server';
          }
        }
      });

      // Trigger immediate face indexing and track processing completion
      void triggerAndTrackProcessing(targetEventId);
      if (rawEventId !== targetEventId) {
        void triggerAndTrackProcessing(rawEventId);
      }
    } catch (batchErr: any) {
      const errorMsg = batchErr?.message || String(batchErr || 'Metadata sync failed');
      console.warn(`[UploadQueue] Error flushing metadata batch for event ${rawEventId}:`, errorMsg);
      const isFatalFkError = errorMsg.includes('foreign key constraint') || errorMsg.includes('does not exist');
      let shouldRetry = false;
      await mutateQueue(q => {
        for (const item of items) {
          const target = q.find(i => i.id === item.id);
          if (!target) continue;
          const retries = (target.retryCount || 0) + 1;
          target.retryCount = retries;
          if (retries >= MAX_UPLOAD_RETRIES || isFatalFkError) {
            target.status = 'failed';
            target.error = errorMsg;
            void cleanupDurableFile(target.fileUri);
          } else {
            shouldRetry = true;
          }
        }
      });
      if (shouldRetry) {
        setTimeout(() => {
          void flushMetadataBatches();
        }, 2000);
      }
    }
  }

  void updateProgressNotification(true);
  processQueue();
}

// ── 6b. Background Processing & AI Face Indexing Tracker ─────────────────────
const activeIndexingPollers = new Map<string, { timer: ReturnType<typeof setTimeout> | null; abort: boolean; photoPhaseStart: number | null }>();
const lastIndexingStatus = new Map<string, { indexed: number; total: number; percentComplete: number; status: string }>();

// Modal's video functions time out after 1h. Past that the upload is reported as done and the
// backend watchdog keeps retrying the transcode.
const MAX_VIDEO_PROCESSING_TRACK_MS = 60 * 60 * 1000;

export function getIndexingStatusForEvent(eventId: string) {
  return lastIndexingStatus.get(eventId) || null;
}

/** The backend's photos.id for a storage key (see toPhotoRow in apps/backend/src/routes/media.ts). */
function photoRowIdFor(storageKey: string) {
  return storageKey.replace(/\//g, '_');
}

/**
 * A video is finished only once Modal has transcoded it: its row becomes 'processed' (or 'failed').
 * Returns true when any item changed status.
 */
async function settleProcessingVideos(videos: UploadQueueItem[]): Promise<boolean> {
  const rowIds = videos.flatMap(video => (video.storageKey ? [photoRowIdFor(video.storageKey)] : []));
  const rowStatusById = new Map<string, string>();
  if (rowIds.length > 0) {
    const { data, error } = await supabase.from('photos').select('id, status').in('id', rowIds);
    if (error) {
      console.warn('[UploadQueue] Video processing status check notice:', error.message);
    }
    for (const row of data || []) {
      rowStatusById.set(row.id, row.status);
    }
  }

  const now = Date.now();
  const outcomes = new Map<string, 'completed' | 'failed'>();
  for (const video of videos) {
    const rowStatus = video.storageKey ? rowStatusById.get(photoRowIdFor(video.storageKey)) : undefined;
    if (rowStatus === 'processed') {
      outcomes.set(video.id, 'completed');
    } else if (rowStatus === 'failed') {
      outcomes.set(video.id, 'failed');
    } else if (now - (video.processingStartedAt ?? video.addedAt) >= MAX_VIDEO_PROCESSING_TRACK_MS) {
      console.warn(`[UploadQueue] Stopped waiting for video ${video.id} to finish processing; the server keeps handling it.`);
      outcomes.set(video.id, 'completed');
    }
  }
  if (outcomes.size === 0) return false;

  await mutateQueue(q => {
    for (const item of q) {
      const outcome = outcomes.get(item.id);
      if (!outcome || item.status !== 'processing') continue;
      item.status = outcome;
      if (outcome === 'completed') {
        item.progress = 100;
      } else {
        item.error = 'The video was uploaded but could not be processed. Please upload it again.';
      }
    }
  });
  void updateProgressNotification(true);
  return true;
}

export function triggerAndTrackProcessing(eventId: string) {
  if (!eventId) return;

  // 1. Fire trigger-modal-batch
  try {
    const triggerUrl = getEndpointsForPath('/api/media/trigger-modal-batch?immediate=true')[0];
    supabase.auth.getSession().then(({ data: sessionData }) => {
      const accessToken = sessionData.session?.access_token;
      if (triggerUrl && accessToken) {
        fetch(triggerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ eventId }),
        }).catch(err => {
          console.warn(`[UploadQueue] Face indexing trigger notice for event ${eventId}:`, err);
        });
      }
    }).catch(() => {});
  } catch (err) {
    console.warn('[UploadQueue] Notice on triggering indexing:', err);
  }

  // 2. Start polling if not already polling
  if (activeIndexingPollers.has(eventId)) {
    return;
  }

  const pollerState = { timer: null as any, abort: false, photoPhaseStart: null as number | null };
  activeIndexingPollers.set(eventId, pollerState);

  const MAX_POLL_DURATION_MS = 90000; // 90s max wait for photo face indexing

  const poll = async () => {
    if (pollerState.abort) {
      activeIndexingPollers.delete(eventId);
      return;
    }

    const processingVideos = queue.filter(item => item.eventId === eventId && item.status === 'processing' && item.mediaType === 'video');
    let videosSettled = false;
    if (processingVideos.length > 0) {
      try {
        videosSettled = await settleProcessingVideos(processingVideos);
      } catch (videoErr) {
        console.warn(`[UploadQueue] Video processing check error for event ${eventId}:`, videoErr);
      }
    }

    const currentProcessing = queue.filter(item => item.eventId === eventId && item.status === 'processing');
    const stillUploading = queue.filter(
      item => item.eventId === eventId && (item.status === 'pending' || item.status === 'uploading' || item.status === 'uploaded_pending_metadata')
    );

    if (currentProcessing.length === 0) {
      activeIndexingPollers.delete(eventId);
      // processQueue sends the completion notification once the whole queue has settled
      if (videosSettled) processQueue();
      return;
    }

    const hasPhotoProcessing = currentProcessing.some(item => item.mediaType !== 'video');
    const hasVideoProcessing = currentProcessing.some(item => item.mediaType === 'video');
    if (!hasPhotoProcessing) {
      // Only videos left: no face indexing to track, just wait for Modal
      pollerState.photoPhaseStart = null;
      if (!pollerState.abort) {
        pollerState.timer = setTimeout(poll, 5000);
      }
      return;
    }
    if (pollerState.photoPhaseStart === null) {
      pollerState.photoPhaseStart = Date.now();
    }
    const photoPhaseStart = pollerState.photoPhaseStart;

    try {
      const statusEndpoints = getEndpointsForPath(`/api/v1/media/indexing-status?eventId=${eventId}`);
      const response = await fetchWithEndpointFallback(
        statusEndpoints,
        (endpoint: string) => fetch(endpoint),
        'indexing-status'
      );

      if (response && response.ok) {
        const data = await response.json();
        if (data && typeof data.status === 'string') {
          lastIndexingStatus.set(eventId, data);

          // Update progress % for processing items (maps indexing % from 90% to 99%)
          if (typeof data.percentComplete === 'number') {
            const mappedProgress = Math.min(99, Math.max(90, Math.round(90 + (data.percentComplete * 0.09))));
            await mutateQueue(q => {
              for (const item of q) {
                if (item.eventId === eventId && item.status === 'processing' && item.mediaType !== 'video') {
                  item.progress = mappedProgress;
                }
              }
            });
            void updateProgressNotification(false);
          }

          // Check if indexing is complete AND all files have finished uploading to B2
          const elapsed = Date.now() - photoPhaseStart;
          const isComplete = data.status === 'complete' || (data.total > 0 && data.pending === 0) || (data.total === 0 && elapsed >= 4000);
          const isTimedOut = elapsed >= MAX_POLL_DURATION_MS;

          if ((isComplete || isTimedOut) && stillUploading.length === 0) {
            console.log(`[UploadQueue] Photo processing complete for event ${eventId} (status: ${data.status}, elapsed: ${Math.round(elapsed / 1000)}s)`);

            // Record finalized 100% indexing status for this event
            lastIndexingStatus.set(eventId, {
              ...data,
              indexed: data.total || data.indexed,
              percentComplete: 100,
              status: 'complete',
            });

            // Mark processing photos as completed (videos settle from their own row status)
            await mutateQueue(q => {
              for (const item of q) {
                if (item.eventId === eventId && item.status === 'processing' && item.mediaType !== 'video') {
                  item.status = 'completed';
                  item.progress = 100;
                }
              }
            });
            pollerState.photoPhaseStart = null;

            processQueue();
            if (!hasVideoProcessing) {
              activeIndexingPollers.delete(eventId);
              return;
            }
          }
        }
      }
    } catch (pollErr) {
      console.warn(`[UploadQueue] Polling error for event ${eventId}:`, pollErr);
    }

    if (!pollerState.abort) {
      pollerState.timer = setTimeout(poll, 3000);
    }
  };

  pollerState.timer = setTimeout(poll, 2500);
}

// ── 7. Concurrent Queue Dispatcher ──────────────────────────────────────────
async function processQueue() {
  while (activeSlots < CONCURRENCY) {
    const nextItem = queue.find(item => item.status === 'pending');

    if (!nextItem) {
      if (activeSlots === 0) {
        const allSettled = queue.every(
          item => item.status === 'completed' || item.status === 'failed'
        );
        if (allSettled && queue.length > 0) {
          notifyQueueDrained();
        }
      }
      break;
    }

    activeSlots++;
    uploadWorker(nextItem);
  }
}

// ── 8. Public Queue Control Methods ─────────────────────────────────────────
export function getUploadQueue(): UploadQueueItem[] {
  return queue;
}

export function subscribeToUploadQueue(listener: QueueListener) {
  listeners.add(listener);
  listener(queue.map(item => ({ ...item })));
  return () => {
    listeners.delete(listener);
  };
}

export async function clearFinishedUploads() {
  // Never clear finished items if any item is still uploading or processing
  const hasActiveWork = queue.some(
    item => item.status === 'pending' || item.status === 'uploading' || item.status === 'uploaded_pending_metadata' || item.status === 'upload_needs_reconciliation' || item.status === 'processing'
  );
  if (hasActiveWork) return;

  const itemsToRemove = queue.filter(item => item.status === 'completed' || item.status === 'failed');
  for (const item of itemsToRemove) {
    await cleanupDurableFile(item.fileUri);
    if (item.status === 'failed' && item.fileSize && item.fileSize >= 20 * 1024 * 1024) {
      // Release the unfinished B2 large file and its 'uploading' row (no-op if the upload had completed).
      const { abortChunkedUpload } = require('./chunkUpload');
      abortChunkedUpload(item).catch((err: any) => console.warn('[UploadQueue] Failed to abort chunked upload:', err));
    }
  }

  await mutateQueue(q => {
    queue = q.filter(item => item.status !== 'completed' && item.status !== 'failed');
  });
}

export async function cancelUploadItem(itemId: string) {
  const item = queue.find(i => i.id === itemId);
  if (!item) return;

  await cleanupDurableFile(item.fileUri);

  if (item.fileSize && item.fileSize >= 20 * 1024 * 1024) {
    const { abortChunkedUpload } = require('./chunkUpload');
    abortChunkedUpload(item).catch((err: any) => console.warn('[UploadQueue] Failed to abort chunked upload:', err));
  }

  await mutateQueue(q => {
    queue = q.filter(i => i.id !== itemId);
  });

  if (item.status === 'uploading') {
    activeSlots = Math.max(0, activeSlots - 1);
  }
  void updateProgressNotification(true);
  processQueue();
}

export async function retryUploadItem(itemId: string) {
  const item = queue.find(i => i.id === itemId);
  if (!item) return;

  // The local copy is deleted once the server has the file (e.g. a video whose processing failed),
  // so there is nothing left to re-upload.
  const fileInfo = await FileSystem.getInfoAsync(item.fileUri).catch(() => null);
  if (!fileInfo?.exists) {
    await mutateQueue(q => {
      const target = q.find(i => i.id === itemId);
      if (target) {
        target.error = 'This file is no longer on the device. Please select it again to upload.';
      }
    });
    return;
  }

  await mutateQueue(q => {
    const target = q.find(i => i.id === itemId);
    if (target) {
      target.status = 'pending';
      target.progress = 0;
      target.error = undefined;
      target.retryCount = 0;
    }
  });

  void updateProgressNotification(true);
  processQueue();
}

export async function resetUploadQueue() {
  if (notificationThrottleTimer) {
    clearTimeout(notificationThrottleTimer);
    notificationThrottleTimer = null;
  }
  pendingNotificationUpdate = false;

  for (const item of queue) {
    await cleanupDurableFile(item.fileUri);
  }

  activeSlots = 0;
  await mutateQueue(() => {
    queue = [];
  });

  if (Notifications) {
    try {
      await Notifications.dismissNotificationAsync(PROGRESS_NOTIFICATION_ID);
    } catch (e) {}
  }
}

// ── 9. Notification & Drainage Handlers ─────────────────────────────────────
let lastNotificationTime = 0;
let notificationThrottleTimer: ReturnType<typeof setTimeout> | null = null;
let isNotificationUpdating = false;
let pendingNotificationUpdate = false;

async function updateProgressNotification(force: boolean = false) {
  if (!Notifications) return;

  const now = Date.now();
  const timeSinceLast = now - lastNotificationTime;

  if (!force && timeSinceLast < 1000) {
    if (!notificationThrottleTimer) {
      notificationThrottleTimer = setTimeout(() => {
        notificationThrottleTimer = null;
        void updateProgressNotification(true);
      }, 1000 - timeSinceLast);
    }
    return;
  }

  if (notificationThrottleTimer) {
    clearTimeout(notificationThrottleTimer);
    notificationThrottleTimer = null;
  }

  if (isNotificationUpdating) {
    pendingNotificationUpdate = true;
    return;
  }

  isNotificationUpdating = true;
  lastNotificationTime = Date.now();

  try {
    await performNotificationUpdate();
  } finally {
    isNotificationUpdating = false;
    if (pendingNotificationUpdate) {
      pendingNotificationUpdate = false;
      void updateProgressNotification(false);
    }
  }
}

async function performNotificationUpdate() {
  if (!Notifications) return;

  const activeItems = queue.filter(
    item => item.status === 'pending' || item.status === 'uploading' || item.status === 'uploaded_pending_metadata' || item.status === 'processing'
  );

  if (activeItems.length === 0) {
    if (notificationThrottleTimer) {
      clearTimeout(notificationThrottleTimer);
      notificationThrottleTimer = null;
    }
    pendingNotificationUpdate = false;
    if (queue.length === 0) {
      try {
        await Notifications.dismissNotificationAsync(PROGRESS_NOTIFICATION_ID);
      } catch (e) {}
    }
    return;
  }

  // Prioritize the latest active batch initiated by the user
  const sortedActive = [...activeItems].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  const currentEventId = sortedActive[0]?.eventId;
  const currentBatchItems = queue.filter(item => item.eventId === currentEventId);
  const batchTotal = sortedActive[0]?.batchTotal || currentBatchItems.length;

  if (batchTotal === 0) return;

  const totalProgressSum = currentBatchItems.reduce((sum, item) => {
    if (item.status === 'completed' || item.status === 'failed') return sum + 100;
    return sum + (item.progress || 0);
  }, 0);
  const overallPercentage = Math.min(100, Math.max(0, Math.round(totalProgressSum / batchTotal)));

  // Are any files still uploading binary to B2?
  const isUploadingBinary = currentBatchItems.some(
    item => item.status === 'pending' || item.status === 'uploading'
  );

  let title = '';
  let subtitle = `${overallPercentage}%`;
  let bodyText = '';

  if (isUploadingBinary) {
    // ── UPLOADING PHASE (Google Drive style) ──
    title = batchTotal > 1 ? `Uploading ${batchTotal} files` : 'Uploading 1 file';
    const uploadedCount = currentBatchItems.filter(
      i => i.status === 'uploaded_pending_metadata' || i.status === 'processing' || i.status === 'completed'
    ).length;
    const failedCount = currentBatchItems.filter(i => i.status === 'failed').length;
    const currentIndex = Math.min(batchTotal, uploadedCount + failedCount + 1);

    const currentItem = currentBatchItems.find(i => i.status === 'uploading') ||
      currentBatchItems.find(i => i.status === 'pending');

    const fileName = currentItem?.fileName || currentItem?.originalFileName || 'Photo';
    const displayName = fileName.length > 20 ? `${fileName.substring(0, 17)}...` : fileName;
    const filePercent = Math.round(currentItem?.progress || 0);

    if (batchTotal > 1) {
      bodyText = `Uploading ${currentIndex} of ${batchTotal} • ${displayName} (${filePercent}%)`;
    } else {
      bodyText = `${displayName} (${filePercent}%)`;
    }
  } else {
    // ── PROCESSING & AI INDEXING PHASE (Google Drive style) ──
    title = batchTotal > 1 ? `Processing ${batchTotal} files` : 'Processing 1 file';
    const indexingData = lastIndexingStatus.get(currentEventId);
    const processingItems = currentBatchItems.filter(i => i.status === 'processing');

    if (processingItems.length > 0 && processingItems.every(i => i.mediaType === 'video')) {
      subtitle = 'Processing';
      bodyText = processingItems.length > 1
        ? `Preparing ${processingItems.length} videos for playback...`
        : 'Preparing video for playback...';
    } else if (indexingData && indexingData.total > 0) {
      subtitle = `${indexingData.percentComplete}%`;
      bodyText = `AI Face Indexing: ${indexingData.indexed} of ${indexingData.total} (${indexingData.percentComplete}%)`;
    } else {
      subtitle = 'Processing';
      bodyText = `Processing photos and indexing faces... (${overallPercentage}%)`;
    }
  }

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: PROGRESS_NOTIFICATION_ID,
      content: {
        title,
        subtitle,
        body: bodyText,
        sound: false,
        color: '#CCA43B',
        sticky: true,
        autoDismiss: false,
        android: {
          channelId: CHANNEL_PROGRESS,
          sticky: true,
          ongoing: true,
        },
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('[UploadQueue] Failed to update progress notification:', err);
  }
}

async function notifyQueueDrained() {
  if (notificationThrottleTimer) {
    clearTimeout(notificationThrottleTimer);
    notificationThrottleTimer = null;
  }
  pendingNotificationUpdate = false;

  const totalCount = queue.length;
  if (totalCount === 0) return;

  const failed = queue.filter(item => item.status === 'failed');
  const succeeded = queue.filter(item => item.status === 'completed');

  if (Notifications) {
    try {
      const batchTotal = succeeded[0]?.batchTotal || succeeded.length;
      if (failed.length > 0) {
        await Notifications.scheduleNotificationAsync({
          identifier: PROGRESS_NOTIFICATION_ID,
          content: {
            title: 'Upload finished with issues',
            body: `${succeeded.length} uploaded, ${failed.length} failed. Tap to retry.`,
            sound: true,
            sticky: false,
            autoDismiss: true,
            android: {
              channelId: CHANNEL_COMPLETE,
              sticky: false,
              ongoing: false,
            },
          },
          trigger: null,
        });
      } else {
        const title = batchTotal > 1 ? `${batchTotal} files uploaded` : '1 file uploaded';
        const bodyText = 'Upload finished successfully.';

        await Notifications.scheduleNotificationAsync({
          identifier: PROGRESS_NOTIFICATION_ID,
          content: {
            title,
            body: bodyText,
            sound: true,
            sticky: false,
            autoDismiss: true,
            android: {
              channelId: CHANNEL_COMPLETE,
              sticky: false,
              ongoing: false,
            },
          },
          trigger: null,
        });
      }
    } catch (err) {
      console.warn('[UploadQueue] Failed to send completion notification:', err);
    }
  }

  // Auto-prune settled items once the queue has completely drained without errors
  if (failed.length === 0) {
    void clearFinishedUploads();
  }
}
