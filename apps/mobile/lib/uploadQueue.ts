import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';
import { getEndpointsForPath, fetchWithEndpointFallback } from './storage';
import { toDurationSeconds } from './mediaDuration';
import { appAlert } from './feedback';
import { getUploadAccount, isUploadPausedError, setUploadAccountId, uploadAccessToken } from './uploadAccount';
import { hasStorageUploadLink, storageUploadRequest } from '../../../shared/media/storageUploadRequest';

// Issue #144: an upload that failed because the phone lost its connection doesn't use up an attempt. The item waits
// until the backend answers again and then carries on; other errors still get MAX_UPLOAD_RETRIES attempts.
const NETWORK_ERROR = /Network request failed|network connection was lost|connection abort|Failed to connect to any|Unable to resolve host|offline|timed out/i;
const CONNECTION_CHECK_MS = 4000;
let connectionWait: Promise<void> | null = null;

function isNetworkError(err: any) {
  return err?.nonRetryable !== true && NETWORK_ERROR.test(String(err?.message || err || ''));
}

/** Resolves once the backend answers again (any HTTP reply counts); every waiting upload shares one check. */
export function waitForConnection(): Promise<void> {
  if (connectionWait) return connectionWait;
  const healthUrl = getEndpointsForPath('/health')[0];
  connectionWait = (async () => {
    for (;;) {
      await new Promise(res => setTimeout(res, CONNECTION_CHECK_MS));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CONNECTION_CHECK_MS);
      try {
        await fetch(healthUrl, { method: 'GET', signal: controller.signal });
        return;
      } catch {
        // Still offline
      } finally {
        clearTimeout(timer);
      }
    }
  })().finally(() => {
    connectionWait = null;
  });
  return connectionWait;
}

/** Set as an item's error while it waits for the phone to get a connection back (#144) */
export const WAITING_FOR_CONNECTION = 'Waiting for connection';

/**
 * What to tell people about a failed upload. item.error keeps the technical reason for logs and the startup
 * clean-up; this turns it into plain words. Plan-limit messages come from the server already written for people.
 */
export function uploadErrorMessage(error?: string): string {
  const text = error || '';
  if (/no longer on the device|deleted from device/i.test(text)) return 'This file is no longer on your phone. Pick it again to upload it.';
  if (/does not exist|foreign key/i.test(text)) return 'This gallery no longer exists, so the file was not uploaded.';
  if (/could not be processed/i.test(text)) return text;
  if (/storage|plan/i.test(text) && !/B2|server/i.test(text)) return text;
  if (NETWORK_ERROR.test(text)) return 'The connection dropped. Tap Retry to try again.';
  return "This file didn't upload. Tap Retry to try again.";
}

// The server refused an upload because of the gallery owner's plan (storage full or plan expired), or the event is being transferred.
// Retrying can't help, so the item fails at once; the reason is shown once per minute, not once per file.
const PLAN_LIMIT_CODES = new Set(['storage_full', 'plan_expired', 'transfer_pending']);
let lastPlanLimitAlertAt = 0;

function planLimitError(result: any): (Error & { nonRetryable: true; code: string }) | null {
  if (!result || !PLAN_LIMIT_CODES.has(result.code)) return null;
  const err = new Error(result.error || 'This upload is over the storage limit.') as Error & { nonRetryable: true; code: string };
  err.nonRetryable = true;
  err.code = result.code;
  return err;
}

function showPlanLimitAlert(message: string) {
  if (Date.now() - lastPlanLimitAlertAt < 60_000) return;
  lastPlanLimitAlertAt = Date.now();
  appAlert('Upload paused', message);
}

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

// The queue is saved as a JSON file. It used to be one AsyncStorage value, which a big queue (about 3,500 photos on
// Android) outgrew, so it was lost after a restart (issue #190); those keys are only read once to move the queue over
const QUEUE_FILE = `${FileSystem.documentDirectory}evebash_upload_queue.json`;
const QUEUE_FILE_TMP = `${QUEUE_FILE}.tmp`;
const STORAGE_KEY = '@evebash_upload_queue_v2';
const LEGACY_STORAGE_KEY = '@evebash_upload_queue';
const PROGRESS_NOTIFICATION_ID = 'media-upload-progress';
const CHANNEL_PROGRESS = 'upload-progress';
const CHANNEL_COMPLETE = 'upload-completion';

// Photos upload 3 at a time (about 2.5x faster than one at a time, issue #216); a video always uploads alone
const PHOTO_CONCURRENCY = 3;
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
// Files a worker has, by media type. A worker keeps its file while it waits for the network or a retry (the file
// shows as 'pending' then), so other slots must not start it again
const inFlight = new Map<string, UploadQueueItem['mediaType']>();
// Files cancelled while a worker still has them: the worker stops quietly instead of retrying or failing
const cancelledIds = new Set<string>();
// Files whose transfer was stopped because their account signed out (#302): the worker puts them back to wait,
// without using a retry or failing them
const pausedIds = new Set<string>();
// The single-part transfer in flight per file, so a cancel can stop it
const uploadTasks = new Map<string, FileSystem.UploadTask>();
const cancelledListeners = new Set<(photoId: string) => void>();
const listeners = new Set<QueueListener>();
// Names of copies in the uploads folder whose queue items haven't been added yet, so the startup clean-up keeps them
const copiesBeingAdded = new Set<string>();

/** True for a file picked by the account signed in now: only those upload or are saved (#303) */
function isOwnUpload(item: UploadQueueItem) {
  const account = getUploadAccount();
  return !!account && item.userId === account;
}

// Not finished yet: still to upload, being sent, or waiting for its save
const UNFINISHED = new Set<UploadStatus>(['pending', 'uploading', 'uploaded_pending_metadata', 'upload_needs_reconciliation']);

// ── 1. Non-Poisoning Queue Mutation Mutex ────────────────────────────────────
let queueWriteChain: Promise<void> = Promise.resolve();

function runExclusive(task: () => Promise<void>): Promise<void> {
  const operation = queueWriteChain
    .catch(() => undefined)
    .then(task);

  queueWriteChain = operation.catch(() => undefined);
  return operation;
}

export function mutateQueue(mutator: (currentQueue: UploadQueueItem[]) => void): Promise<void> {
  return runExclusive(async () => {
    mutator(queue);
    await saveQueueToStorage();
    notifyListeners();
  });
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
    // Written to a temporary file first and then moved into place, so stopping mid-write never leaves half a queue
    await FileSystem.writeAsStringAsync(QUEUE_FILE_TMP, serialized);
    await FileSystem.deleteAsync(QUEUE_FILE, { idempotent: true });
    await FileSystem.moveAsync({ from: QUEUE_FILE_TMP, to: QUEUE_FILE });
  } catch (err) {
    console.error('[UploadQueue] Failed to save queue to storage:', err);
  }
}

/** The saved queue, or null when there is none. The temporary file is only used when the app stopped just before moving it into place */
async function readQueueFile(): Promise<UploadQueueItem[] | null> {
  for (const uri of [QUEUE_FILE, QUEUE_FILE_TMP]) {
    try {
      if (!(await FileSystem.getInfoAsync(uri)).exists) continue;
      const parsed = JSON.parse(await FileSystem.readAsStringAsync(uri));
      if (Array.isArray(parsed)) return parsed;
    } catch (err) {
      console.warn('[UploadQueue] Could not read the saved queue:', err);
    }
  }
  return null;
}

/** File name of a copy in the uploads folder, or null for anything else (matched by name: the app's folder path can change after an iOS update) */
function uploadCopyName(fileUri: string): string | null {
  const at = fileUri ? fileUri.lastIndexOf(UPLOAD_DIR_NAME) : -1;
  return at === -1 ? null : fileUri.slice(at + UPLOAD_DIR_NAME.length);
}

/** The item with its copy's path in this app's current documents folder, which on iPhone can move after an app update (issue #245) */
function withCurrentCopyPath(item: UploadQueueItem): UploadQueueItem {
  const name = uploadCopyName(item.fileUri);
  const currentUri = name ? `${FileSystem.documentDirectory}${UPLOAD_DIR_NAME}${name}` : item.fileUri;
  return currentUri === item.fileUri ? item : { ...item, fileUri: currentUri };
}

/** Deletes copies in the uploads folder that no queue item points at: left behind by a queue that was lost, they only use space */
function deleteLeftoverCopies(): Promise<void> {
  // Runs in turn with queue changes, so a copy is either still being added or already in the queue
  return runExclusive(async () => {
    try {
      const uploadDir = `${FileSystem.documentDirectory}${UPLOAD_DIR_NAME}`;
      if (!(await FileSystem.getInfoAsync(uploadDir)).exists) return;
      const inUse = new Set(queue.map(item => uploadCopyName(item.fileUri)).filter((name): name is string => !!name));
      const leftovers = (await FileSystem.readDirectoryAsync(uploadDir)).filter(name => !inUse.has(name) && !copiesBeingAdded.has(name));
      for (const name of leftovers) {
        await FileSystem.deleteAsync(`${uploadDir}${name}`, { idempotent: true }).catch(() => {});
      }
      if (leftovers.length > 0) console.log(`[UploadQueue] Deleted ${leftovers.length} leftover upload copies`);
    } catch (err) {
      console.warn('[UploadQueue] Could not clean up leftover upload copies:', err);
    }
  });
}

// ── 2. Notification Channels ────────────────────────────────────────────────
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

// ── 3. Queue Initialization & Startup Reconciliation ────────────────────────
export async function initUploadQueue() {
  await ensureNotificationChannels();

  try {
    // 1. Load the saved queue; a queue saved in AsyncStorage by an older version is moved to the file
    const savedQueue = await readQueueFile();
    let initialQueue: UploadQueueItem[] = savedQueue ?? [];
    const legacyRaw = savedQueue ? null : await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
    const storedRaw = savedQueue ? null : await AsyncStorage.getItem(STORAGE_KEY);

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

    // Saved paths of copies may point at the documents folder from before an app update
    const repointed = initialQueue.map(withCurrentCopyPath);
    const copyPathsMoved = repointed.some((item, idx) => item !== initialQueue[idx]);
    initialQueue = repointed;

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

    if (storedRaw || legacyRaw || copyPathsMoved) {
      // Saves the moved or repointed queue to the file; an old AsyncStorage value goes only once the file is there
      await mutateQueue(() => {});
      if ((await FileSystem.getInfoAsync(QUEUE_FILE)).exists) await AsyncStorage.removeItem(STORAGE_KEY);
    }

    notifyListeners();
    void deleteLeftoverCopies();

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
  // Another account's files are checked when that account signs in again (#303)
  const own = items.filter(isOwnUpload);
  if (own.length === 0) return;
  let accessToken: string;
  try {
    accessToken = await uploadAccessToken(own[0].userId);
  } catch {
    return;
  }

  for (const item of own) {
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
  // No notification permission prompt here: the app asks once at sign-in (registerDeviceForPushNotifications), and
  // the upload panel shows progress either way (issue #212)
  // Only the signed-in person adds files, so they are the upload account (normally already set at sign-in)
  if (getUploadAccount() !== userId) setUploadAccount(userId);

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
    appAlert(
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

  const addingNames: string[] = [];
  for (let idx = 0; idx < fileDetails.length; idx++) {
    const detail = fileDetails[idx];
    const clientUploadId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const sanitizedFileName = detail.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const durableUri = `${uploadDir}${clientUploadId}_${sanitizedFileName}`;
    addingNames.push(`${clientUploadId}_${sanitizedFileName}`);
    copiesBeingAdded.add(`${clientUploadId}_${sanitizedFileName}`);

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
    // Drop finished files before starting a new batch, but keep failed ones so they can still be retried or
    // dismissed (and their copies cleaned up then, by clearFinishedUploads); issue #170
    const kept = q.filter(item => item.status !== 'completed');
    q.length = 0;
    q.push(...kept, ...newItems);
  });
  addingNames.forEach(name => copiesBeingAdded.delete(name));

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

/** A file stopped because its account signed out: back to waiting, without using a retry (#302) */
function putBackToWait(itemId: string) {
  return mutateQueue(q => {
    const target = q.find(i => i.id === itemId);
    if (target && (target.status === 'uploading' || target.status === 'pending')) {
      target.status = 'pending';
      target.progress = 0;
      target.storageKey = undefined; // A fresh upload link once it starts again
      target.error = undefined;
    }
  });
}

// ── 5. Single-Part Upload Worker (Up to 5GB) ─────────────────────────────────
async function uploadWorker(item: UploadQueueItem) {
  // A pause left from an earlier run doesn't apply: processQueue only starts files of the account signed in now
  pausedIds.delete(item.id);
  await mutateQueue(q => {
    const target = q.find(i => i.id === item.id);
    if (target) {
      target.status = 'uploading';
      target.progress = 0;
    }
  });

  void updateProgressNotification(true);

  try {
    // Only with the login of the person who picked this file (#303); signed out or another account: it waits (#302)
    const accessToken = await uploadAccessToken(item.userId);

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
      if (cancelledIds.delete(item.id)) {
        // Cancelled while the last part was finishing: the row exists now, so delete it like a saved upload
        await deleteCancelledUpload(storageKey);
        return;
      }
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
              contentType: item.fileType,
              clientUploadId: item.id,
            }),
          });
        },
        'get mobile upload url'
      );
      if (mobileResponse.ok) {
        getUrlResult = await mobileResponse.json().catch(() => null);
      } else if (mobileResponse.status === 403) {
        const refused = planLimitError(await mobileResponse.json().catch(() => null));
        if (refused) throw refused;
      }
    } catch (err: any) {
      if (err?.code && PLAN_LIMIT_CODES.has(err.code)) throw err;
      // Mobile endpoint not available on server yet
    }

    if (!hasStorageUploadLink(getUrlResult)) {
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
              fileSize,
              contentType: item.fileType,
            }),
          });
        },
        'get standard upload url'
      );

      getUrlResult = await standardResponse.json().catch(() => ({}));
      if (!standardResponse.ok) {
        throw planLimitError(getUrlResult) || new Error(getUrlResult.error || `Failed to get B2 upload URL (status: ${standardResponse.status})`);
      }
    }

    const { storageKey } = getUrlResult;
    // The one-file link when the backend sends one (issue #318), else Backblaze's own upload as before
    const storageRequest = storageUploadRequest(getUrlResult, item.fileType || 'application/octet-stream');

    await mutateQueue(q => {
      const target = q.find(i => i.id === item.id);
      if (target) {
        target.storageKey = storageKey;
        target.fileSize = fileSize;
      }
    });

    // 2. Upload file binary directly to Backblaze B2 via background task
    const fileInfo = await FileSystem.getInfoAsync(item.fileUri).catch(() => null);
    // Cancelled while the upload URL was fetched: its file is already deleted, and a background upload of a missing
    // file crashes the app on iOS (issue #289). Nothing may be awaited between this check and createUploadTask.
    if (cancelledIds.delete(item.id)) return;
    if (pausedIds.delete(item.id)) { await putBackToWait(item.id); return; }
    if (!fileInfo?.exists) throw new Error('The file to upload is no longer on this phone.');
    console.log(`[UploadQueue] Uploading directly to B2 (single-part, up to 5GB): ${storageKey}`);
    const uploadTask = FileSystem.createUploadTask(
      storageRequest.url,
      item.fileUri,
      {
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        httpMethod: storageRequest.method,
        headers: storageRequest.headers,
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

    uploadTasks.set(item.id, uploadTask);
    const response = await uploadTask.uploadAsync();
    // Cancelled: the transfer was stopped (or had just ended; the file is never saved to the gallery then)
    if (cancelledIds.delete(item.id)) return;
    // Its account signed out while it was being sent: it starts again when that account signs back in. If the file
    // had just finished, it is kept as uploaded and saved once that account signs back in (flushes are per account)
    if (pausedIds.delete(item.id) && (!response || response.status !== 200)) { await putBackToWait(item.id); return; }
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
    if (cancelledIds.delete(item.id)) return;
    if (pausedIds.delete(item.id) || isUploadPausedError(err)) {
      console.log(`[UploadQueue] ${item.fileName} waits until its account signs in again.`);
      await putBackToWait(item.id);
      return;
    }
    const retries = (item.retryCount || 0) + 1;
    // Set by chunkUpload for 4xx responses — repeating the identical request cannot succeed.
    const nonRetryable = err?.nonRetryable === true;

    if (isNetworkError(err)) {
      console.warn(`[UploadQueue] No connection while uploading ${item.fileName} (${err?.message || err}). Waiting for the network...`);
      await mutateQueue(q => {
        const target = q.find(i => i.id === item.id);
        if (target) {
          target.status = 'pending';
          target.progress = 0;
          target.storageKey = undefined; // Fresh upload URL once back online
          target.error = WAITING_FOR_CONNECTION;
        }
      });
      await waitForConnection();
      console.log(`[UploadQueue] Connection back; resuming ${item.fileName}`);
    } else if (!nonRetryable && retries < MAX_UPLOAD_RETRIES) {
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
      if (err?.code && PLAN_LIMIT_CODES.has(err.code)) showPlanLimitAlert(err.message);
    }
  } finally {
    uploadTasks.delete(item.id);
    inFlight.delete(item.id);
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
  // Saved only by the person who uploaded them (#303); another account's files are saved when it signs in again
  const pendingItems = queue.filter(i => i.status === 'uploaded_pending_metadata' && isOwnUpload(i));
  if (pendingItems.length === 0) return;

  let accessToken: string;
  try {
    accessToken = await uploadAccessToken(pendingItems[0].userId);
  } catch {
    return;
  }

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
        const { data: eventRow, error: lookupError } = await supabase
          .from('events')
          .select('id')
          .or(`id.eq.${rawEventId},legacy_id.eq.${rawEventId}`)
          .maybeSingle();

        // Issue #144: a lookup that failed (offline) says nothing about the gallery; keep the items and try once
        // the connection is back, instead of failing photos whose file is already uploaded
        if (lookupError) {
          console.warn(`[UploadQueue] Couldn't check event ${rawEventId} (${lookupError.message}). Saving when the connection is back.`);
          void waitForConnection().then(() => flushMetadataBatches());
          continue;
        }

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
      // Issue #144: offline, the files are already uploaded; save them once the connection is back without using attempts
      if (!isFatalFkError && isNetworkError(batchErr)) {
        void waitForConnection().then(() => flushMetadataBatches());
        continue;
      }
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

  // Face scanning is started by the upload pipeline itself; this only tracks progress
  // (the old trigger-modal-batch call was removed: it duplicated work)
  // Start polling if not already polling
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

    const processingVideos = queue.filter(item => item.eventId === eventId && item.status === 'processing' && item.mediaType === 'video' && isOwnUpload(item));
    let videosSettled = false;
    if (processingVideos.length > 0) {
      try {
        videosSettled = await settleProcessingVideos(processingVideos);
      } catch (videoErr) {
        console.warn(`[UploadQueue] Video processing check error for event ${eventId}:`, videoErr);
      }
    }

    // The signed-in person's files only: another account's waiting files mustn't hold these back (#303)
    const currentProcessing = queue.filter(item => item.eventId === eventId && item.status === 'processing' && isOwnUpload(item));
    const stillUploading = queue.filter(
      item => item.eventId === eventId && isOwnUpload(item) && (item.status === 'pending' || item.status === 'uploading' || item.status === 'uploaded_pending_metadata')
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
      // The server needs a login for this (issue #284)
      const { data: statusSession } = await supabase.auth.getSession();
      const statusToken = statusSession.session?.access_token;
      const response = await fetchWithEndpointFallback(
        statusEndpoints,
        (endpoint: string) => fetch(endpoint, statusToken ? { headers: { Authorization: `Bearer ${statusToken}` } } : undefined),
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
                if (item.eventId === eventId && item.status === 'processing' && item.mediaType !== 'video' && isOwnUpload(item)) {
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
                if (item.eventId === eventId && item.status === 'processing' && item.mediaType !== 'video' && isOwnUpload(item)) {
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
  while (inFlight.size < PHOTO_CONCURRENCY && ![...inFlight.values()].includes('video')) {
    // Only the signed-in person's files (#303); signed out, nothing starts (#302)
    const nextItem = queue.find(item => item.status === 'pending' && !inFlight.has(item.id) && isOwnUpload(item));

    if (!nextItem) {
      if (inFlight.size === 0) {
        const own = queue.filter(isOwnUpload);
        const allSettled = own.every(
          item => item.status === 'completed' || item.status === 'failed'
        );
        if (allSettled && own.length > 0) {
          notifyQueueDrained();
        }
      }
      break;
    }
    // A video waits until the files ahead of it are done, then uploads alone
    if (nextItem.mediaType === 'video' && inFlight.size > 0) break;

    // Claimed here, not when uploadWorker marks it 'uploading' (after an await): otherwise the next pass of this
    // loop picks the same file again and it uploads twice
    inFlight.set(nextItem.id, nextItem.mediaType);
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
  // Only the signed-in person's files; never while any of them is still uploading or processing
  const own = queue.filter(isOwnUpload);
  const hasActiveWork = own.some(
    item => item.status === 'pending' || item.status === 'uploading' || item.status === 'uploaded_pending_metadata' || item.status === 'upload_needs_reconciliation' || item.status === 'processing'
  );
  if (hasActiveWork) return;

  const itemsToRemove = own.filter(item => item.status === 'completed' || item.status === 'failed');
  if (itemsToRemove.length === 0) return;
  const removeIds = new Set(itemsToRemove.map(item => item.id));
  for (const item of itemsToRemove) {
    await cleanupDurableFile(item.fileUri);
    if (item.status === 'failed' && item.fileSize && item.fileSize >= 20 * 1024 * 1024) {
      // Release the unfinished B2 large file and its 'uploading' row (no-op if the upload had completed).
      const { abortChunkedUpload } = require('./chunkUpload');
      abortChunkedUpload(item).catch((err: any) => console.warn('[UploadQueue] Failed to abort chunked upload:', err));
    }
  }

  await mutateQueue(q => {
    queue = q.filter(item => !removeIds.has(item.id));
  });
}

/** Files that can be cancelled: not while the save itself is running (a few seconds), as on the website */
export function isUploadCancellable(item: UploadQueueItem) {
  return item.status !== 'uploaded_pending_metadata';
}

/** True when the file is already in the gallery, so cancelling it deletes it */
export function isUploadSaved(item: UploadQueueItem) {
  return (item.status === 'processing' || item.status === 'completed') && !!item.storageKey;
}

/** Called with the photo id of a saved upload that was cancelled (and so deleted), e.g. to reload the gallery on screen */
export function onUploadCancelled(listener: (photoId: string) => void) {
  cancelledListeners.add(listener);
  return () => { cancelledListeners.delete(listener); };
}

async function deleteCancelledUpload(storageKey: string) {
  const { deletePhoto } = require('./database');
  const photoId = photoRowIdFor(storageKey);
  const deleted: boolean = await deletePhoto(photoId);
  if (deleted) cancelledListeners.forEach(listener => listener(photoId));
  return deleted;
}

/**
 * Cancels one file, like the website's upload panel: a file not uploaded yet stops (nothing is kept), one already
 * in the gallery is deleted. Returns false if a saved file couldn't be deleted (it stays in the list and the gallery).
 */
export async function cancelUploadItem(itemId: string): Promise<boolean> {
  const item = queue.find(i => i.id === itemId);
  // Another account's files are only removed from the list, never deleted from a gallery (removeOtherAccountUploads)
  if (!item || !isUploadCancellable(item) || !isOwnUpload(item)) return true;

  if (isUploadSaved(item)) {
    if (!(await deleteCancelledUpload(item.storageKey!))) return false;
  } else if (item.status !== 'failed') {
    // A worker may have it (uploading, or waiting for the network): it stops at its next step
    cancelledIds.add(itemId);
    uploadTasks.get(itemId)?.cancelAsync().catch(() => {});
  }

  await cleanupDurableFile(item.fileUri);

  if (item.mediaType === 'video' && item.fileSize >= 20 * 1024 * 1024 && !isUploadSaved(item)) {
    const { abortChunkedUpload } = require('./chunkUpload');
    abortChunkedUpload(item).catch((err: any) => console.warn('[UploadQueue] Failed to abort chunked upload:', err));
  }

  await mutateQueue(q => {
    queue = q.filter(i => i.id !== itemId);
  });

  // The worker frees its own slot when it stops
  void updateProgressNotification(true);
  processQueue();
  return true;
}

export async function retryUploadItem(itemId: string) {
  const item = queue.find(i => i.id === itemId);
  // Never someone else's file under this account (#303)
  if (!item || !isOwnUpload(item)) return;

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

  // The signed-in person's files only: another account's stay for when it signs in again (#303)
  const own = queue.filter(isOwnUpload);
  for (const item of own) {
    if (inFlight.has(item.id)) {
      cancelledIds.add(item.id);
      uploadTasks.get(item.id)?.cancelAsync().catch(() => {});
    }
    await cleanupDurableFile(item.fileUri);
  }

  const ownIds = new Set(own.map(item => item.id));
  await mutateQueue(q => {
    queue = q.filter(item => !ownIds.has(item.id));
  });

  if (Notifications) {
    try {
      await Notifications.dismissNotificationAsync(PROGRESS_NOTIFICATION_ID);
    } catch (e) {}
  }
}

// ── 8b. Whose files upload (issues #302, #303) ────────────────────────────────

/**
 * Called by AuthContext with the signed-in person's id (null when signed out). Only that account's files upload or
 * are saved. Signing out or switching account stops the files being sent now; they wait in the list, without
 * failing, and carry on when their account signs in again on this phone.
 */
export function setUploadAccount(userId: string | null) {
  if (getUploadAccount() === userId) return;
  setUploadAccountId(userId);

  // Stop transfers that aren't this account's: a photo stops at once, a video after the part being sent
  for (const itemId of inFlight.keys()) {
    const item = queue.find(i => i.id === itemId);
    if (item && !isOwnUpload(item)) {
      pausedIds.add(itemId);
      uploadTasks.get(itemId)?.cancelAsync().catch(() => {});
    }
  }

  notifyListeners();
  void updateProgressNotification(true);
  if (!userId) return;

  // This account's files: check ones interrupted earlier, save uploaded ones, and carry on
  const needsReconciliation = queue.filter(item => item.status === 'upload_needs_reconciliation' && isOwnUpload(item));
  if (needsReconciliation.length > 0) void reconcileInterruptedUploads(needsReconciliation);
  void flushMetadataBatches();
  for (const eventId of new Set(queue.filter(item => item.status === 'processing' && isOwnUpload(item)).map(item => item.eventId))) {
    void triggerAndTrackProcessing(eventId);
  }
  processQueue();
}

/** The signed-in person's files that haven't finished uploading yet (shown before signing out, #302) */
export function unfinishedUploads(): UploadQueueItem[] {
  return queue.filter(item => isOwnUpload(item) && UNFINISHED.has(item.status));
}

/**
 * Files another account on this phone picked that still wait for it to sign in again (#303): not uploaded yet, or
 * failed. Its files already in a gallery are done and not counted.
 */
export function otherAccountUploads(items: UploadQueueItem[] = queue): UploadQueueItem[] {
  const account = getUploadAccount();
  return items.filter(item => item.userId !== account && (UNFINISHED.has(item.status) || item.status === 'failed'));
}

/**
 * Takes files of other accounts off this phone's list (#303): copies are deleted and nothing is uploaded or saved
 * for them. Files already in a gallery stay there (only their owner can delete them).
 */
export async function removeOtherAccountUploads() {
  const others = otherAccountUploads();
  if (others.length === 0) return;
  for (const item of others) {
    await cleanupDurableFile(item.fileUri);
    if (item.mediaType === 'video') {
      const { clearChunkUploadState } = require('./chunkUpload');
      await clearChunkUploadState(item.id).catch(() => {});
    }
  }
  const removeIds = new Set(others.map(item => item.id));
  await mutateQueue(q => {
    queue = q.filter(item => !removeIds.has(item.id));
  });
}

/** After the account was deleted: drops its files from this phone's list, since they can't upload any more */
export async function discardAccountUploads(userId: string) {
  const mine = queue.filter(item => item.userId === userId);
  if (mine.length === 0) return;
  for (const item of mine) {
    if (inFlight.has(item.id)) {
      cancelledIds.add(item.id);
      uploadTasks.get(item.id)?.cancelAsync().catch(() => {});
    }
    await cleanupDurableFile(item.fileUri);
    if (item.mediaType === 'video') {
      const { clearChunkUploadState } = require('./chunkUpload');
      await clearChunkUploadState(item.id).catch(() => {});
    }
  }
  const removeIds = new Set(mine.map(item => item.id));
  await mutateQueue(q => {
    queue = q.filter(item => !removeIds.has(item.id));
  });
  void updateProgressNotification(true);
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

  // The signed-in person's files only (#303): signed out, there is no progress to show
  const ownQueue = queue.filter(isOwnUpload);
  const activeItems = ownQueue.filter(
    item => item.status === 'pending' || item.status === 'uploading' || item.status === 'uploaded_pending_metadata' || item.status === 'processing'
  );

  if (activeItems.length === 0) {
    if (notificationThrottleTimer) {
      clearTimeout(notificationThrottleTimer);
      notificationThrottleTimer = null;
    }
    pendingNotificationUpdate = false;
    if (ownQueue.length === 0) {
      try {
        await Notifications.dismissNotificationAsync(PROGRESS_NOTIFICATION_ID);
      } catch (e) {}
    }
    return;
  }

  // Prioritize the latest active batch initiated by the user
  const sortedActive = [...activeItems].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  const currentEventId = sortedActive[0]?.eventId;
  const currentBatchItems = ownQueue.filter(item => item.eventId === currentEventId);
  // Every file of this gallery in the queue, like the upload panel: a set added mid-upload joins the count (issue #171)
  const total = currentBatchItems.length;

  if (total === 0) return;

  const totalProgressSum = currentBatchItems.reduce((sum, item) => {
    if (item.status === 'completed' || item.status === 'failed') return sum + 100;
    return sum + (item.progress || 0);
  }, 0);
  const overallPercentage = Math.min(100, Math.max(0, Math.round(totalProgressSum / total)));

  // Are any files still uploading binary to B2?
  const isUploadingBinary = currentBatchItems.some(
    item => item.status === 'pending' || item.status === 'uploading'
  );

  let title = '';
  let subtitle = `${overallPercentage}%`;
  let bodyText = '';

  if (isUploadingBinary) {
    // ── UPLOADING PHASE (Google Drive style) ──
    title = total > 1 ? `Uploading ${total} files` : 'Uploading 1 file';
    const uploadedCount = currentBatchItems.filter(
      i => i.status === 'uploaded_pending_metadata' || i.status === 'processing' || i.status === 'completed'
    ).length;
    const failedCount = currentBatchItems.filter(i => i.status === 'failed').length;
    const currentIndex = Math.min(total, uploadedCount + failedCount + 1);

    const currentItem = currentBatchItems.find(i => i.status === 'uploading') ||
      currentBatchItems.find(i => i.status === 'pending');

    const fileName = currentItem?.fileName || currentItem?.originalFileName || 'Photo';
    const displayName = fileName.length > 20 ? `${fileName.substring(0, 17)}...` : fileName;
    const filePercent = Math.round(currentItem?.progress || 0);

    if (currentItem?.error === WAITING_FOR_CONNECTION) {
      bodyText = total > 1
        ? `Waiting for connection • ${uploadedCount} of ${total} uploaded`
        : 'Waiting for connection';
    } else if (total > 1) {
      bodyText = `Uploading ${currentIndex} of ${total} • ${displayName} (${filePercent}%)`;
    } else {
      bodyText = `${displayName} (${filePercent}%)`;
    }
  } else {
    // ── PROCESSING & AI INDEXING PHASE (Google Drive style) ──
    title = total > 1 ? `Preparing ${total} files` : 'Preparing 1 file';
    const indexingData = lastIndexingStatus.get(currentEventId);
    const processingItems = currentBatchItems.filter(i => i.status === 'processing');

    if (processingItems.length > 0 && processingItems.every(i => i.mediaType === 'video')) {
      subtitle = 'Processing';
      bodyText = processingItems.length > 1
        ? `Preparing ${processingItems.length} videos for playback...`
        : 'Preparing video for playback...';
    } else if (indexingData && indexingData.total > 0) {
      subtitle = `${indexingData.percentComplete}%`;
      bodyText = `Getting photos ready: ${indexingData.indexed} of ${indexingData.total}`;
    } else {
      subtitle = 'Processing';
      bodyText = `Getting your photos ready... (${overallPercentage}%)`;
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
        color: '#CA9C68',
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

  const ownQueue = queue.filter(isOwnUpload);
  const totalCount = ownQueue.length;
  if (totalCount === 0) return;

  const failed = ownQueue.filter(item => item.status === 'failed');
  const succeeded = ownQueue.filter(item => item.status === 'completed');

  if (Notifications) {
    try {
      if (failed.length > 0) {
        await Notifications.scheduleNotificationAsync({
          identifier: PROGRESS_NOTIFICATION_ID,
          content: {
            title: "Some files didn't upload",
            body: `${succeeded.length} uploaded, ${failed.length} didn't. Open the gallery to retry.`,
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
        // The files saved in this run, from every set (one set's size was wrong when a set was added mid-upload)
        const title = succeeded.length > 1 ? `${succeeded.length} files uploaded` : '1 file uploaded';
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
