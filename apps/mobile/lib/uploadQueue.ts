import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';
import { getEndpointsForPath, fetchWithEndpointFallback } from './storage';

let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
  if (Notifications) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }
} catch (e) {
  console.warn('[UploadQueue] expo-notifications is not supported in this environment (e.g. Expo Go on Android). System notifications will be disabled.');
}

const STORAGE_KEY = '@evebash_upload_queue';
const PROGRESS_NOTIFICATION_ID = 'media-upload-progress';
const CHANNEL_PROGRESS = 'upload-progress';
const CHANNEL_COMPLETE = 'upload-completion';

/**
 * Maximum number of files uploaded simultaneously.
 * 3 is the sweet spot: ~3x faster than sequential on WiFi
 * without saturating mobile radio or server threads.
 */
const CONCURRENCY = 3;

export interface UploadQueueItem {
  id: string;
  fileUri: string;
  fileName: string;
  fileType: string;
  eventId: string;
  userId: string;
  mediaType: 'photo' | 'video';
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  progress: number; // 0 to 100
  error?: string;
  addedAt: number;
}

type QueueListener = (items: UploadQueueItem[]) => void;

let queue: UploadQueueItem[] = [];

/** Number of upload slots currently active */
let activeSlots = 0;


const listeners = new Set<QueueListener>();

// Helper to notify listeners of changes
function notifyListeners() {
  const immutableQueue = queue.map(item => ({ ...item }));
  listeners.forEach(listener => listener(immutableQueue));
}

// Persist queue to AsyncStorage
async function saveQueueToStorage() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('[UploadQueue] Failed to save queue:', err);
  }
}

// Set up channels on Android
async function ensureNotificationChannels() {
  if (!Notifications) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_PROGRESS, {
        name: 'Upload Progress',
        importance: Notifications.AndroidImportance.LOW, // Low importance so it doesn't make sound repeatedly
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

// Request permission and show notifications
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

// Initialize the queue
export async function initUploadQueue() {
  await ensureNotificationChannels();
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: UploadQueueItem[] = JSON.parse(stored);
      // Clean up previous run: reset 'uploading' status back to 'pending'
      queue = parsed.map(item => {
        if (item.status === 'uploading') {
          return { ...item, status: 'pending', progress: 0 };
        }
        return item;
      });
      notifyListeners();
      // Auto-start queue processing if there are pending items
      if (queue.some(item => item.status === 'pending')) {
        processQueue();
      }
    }
  } catch (err) {
    console.error('[UploadQueue] Init error:', err);
  }
}

// Add files to the queue
export async function addToUploadQueue(
  files: { uri: string; name: string; type: string }[],
  eventId: string,
  userId: string,
  mediaType: 'photo' | 'video'
) {
  const hasPermission = await checkNotificationPermission();
  if (!hasPermission) {
    console.warn('[UploadQueue] Notification permission not granted. Uploads will proceed without notifications.');
  }

  const newItems: UploadQueueItem[] = files.map(file => ({
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    fileUri: file.uri,
    fileName: file.name,
    fileType: file.type,
    eventId,
    userId,
    mediaType,
    status: 'pending',
    progress: 0,
    addedAt: Date.now(),
  }));

  queue = [...queue, ...newItems];
  notifyListeners();
  await saveQueueToStorage();

  // Trigger processing — fills all available concurrency slots
  processQueue();
}

// Get the active queue list
export function getUploadQueue(): UploadQueueItem[] {
  return queue;
}

// Subscribe to queue changes
export function subscribeToUploadQueue(listener: QueueListener) {
  listeners.add(listener);
  listener(queue.map(item => ({ ...item })));
  return () => {
    listeners.delete(listener);
  };
}

// Clear completed and failed items
export async function clearFinishedUploads() {
  queue = queue.filter(item => item.status === 'pending' || item.status === 'uploading');
  notifyListeners();
  await saveQueueToStorage();
}

// Cancel a specific pending/uploading item
export async function cancelUploadItem(itemId: string) {
  const item = queue.find(i => i.id === itemId);
  if (!item) return;

  // With fetch-based uploads, we can't cancel in-flight requests directly.
  // Removing from queue is sufficient — the worker will finish but the result
  // will be discarded when it can't find the item in the queue.
  queue = queue.filter(i => i.id !== itemId);
  notifyListeners();
  await saveQueueToStorage();

  // A slot just freed up — try to fill it
  if (item.status === 'uploading') {
    activeSlots = Math.max(0, activeSlots - 1);
    processQueue();
  }
}

// Retry a failed item
export async function retryUploadItem(itemId: string) {
  queue = queue.map(item => {
    if (item.id === itemId) {
      return { ...item, status: 'pending', progress: 0, error: undefined };
    }
    return item;
  });
  notifyListeners();
  await saveQueueToStorage();
  processQueue();
}

// Clean up entire queue
export async function resetUploadQueue() {
  activeSlots = 0;
  queue = [];
  notifyListeners();
  await saveQueueToStorage();
  if (Notifications) {
    try {
      await Notifications.dismissNotificationAsync(PROGRESS_NOTIFICATION_ID);
    } catch (e) {}
  }
}

// Update the system notification with overall progress details
async function updateProgressNotification() {
  if (!Notifications) return;
  
  const activeItems = queue.filter(item => item.status === 'pending' || item.status === 'uploading' || item.status === 'failed');
  if (activeItems.length === 0) {
    try {
      await Notifications.dismissNotificationAsync(PROGRESS_NOTIFICATION_ID);
    } catch (e) {}
    return;
  }

  const completedCount = queue.filter(item => item.status === 'completed').length;
  const totalCount = queue.length;
  
  // Calculate total overall percentage
  const totalProgressSum = queue.reduce((sum, item) => {
    if (item.status === 'completed') return sum + 100;
    return sum + item.progress;
  }, 0);
  const overallPercentage = totalProgressSum / (totalCount * 100) * 100;

  const bodyText = `Uploading: ${completedCount}/${totalCount} files completed (${Math.round(overallPercentage)}%)`;

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: PROGRESS_NOTIFICATION_ID,
      content: {
        title: 'Uploading Media to EveBash',
        body: bodyText,
        sound: false,
        color: '#CCA43B', // Golden theme color
        android: {
          channelId: CHANNEL_PROGRESS,
          sticky: true,
          ongoing: true,
        },
      },
      trigger: null, // show immediately
    });
  } catch (err) {
    console.warn('[UploadQueue] Failed to update progress notification:', err);
  }
}

async function notifyQueueDrained() {
  const totalCount = queue.length;
  if (totalCount === 0) return;

  const failed = queue.filter(item => item.status === 'failed');
  const succeeded = queue.filter(item => item.status === 'completed');

  // Trigger immediate face recognition on the backend if any uploads succeeded
  if (succeeded.length > 0) {
    try {
      const triggerUrl = getEndpointsForPath('/api/media/trigger-modal-batch?immediate=true')[0];
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (triggerUrl && accessToken) {
        const eventIds = Array.from(new Set(succeeded.map(item => item.eventId).filter(Boolean)));
        console.log(`[UploadQueue] Queue drained. Triggering face indexing for ${eventIds.length} event(s).`);

        for (const eventId of eventIds) {
          fetch(triggerUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ eventId }),
          }).catch(err => {
            console.warn(`[UploadQueue] Face indexing trigger failed for event ${eventId}:`, err);
          });
        }
      }
    } catch (triggerErr) {
      console.warn('[UploadQueue] Failed to initiate immediate face indexing trigger:', triggerErr);
    }
  }

  if (Notifications) {
    try {
      await Notifications.dismissNotificationAsync(PROGRESS_NOTIFICATION_ID);
    } catch (e) {}

    try {
      if (failed.length > 0) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Upload Finished with Issues',
            body: `Succeeded: ${succeeded.length}, Failed: ${failed.length}. Tap to retry.`,
            sound: true,
            android: { channelId: CHANNEL_COMPLETE },
          },
          trigger: null,
        });
      } else {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Upload Complete',
            body: 'Upload complete',
            sound: true,
            android: { channelId: CHANNEL_COMPLETE },
          },
          trigger: null,
        });
      }
    } catch (err) {
      console.warn('[UploadQueue] Failed to send completion notification:', err);
    }
  } else {
    try {
      if (failed.length > 0) {
        Alert.alert(
          'Upload finished with issues',
          `Succeeded: ${succeeded.length}, Failed: ${failed.length}. Open dashboard notifications to manage.`,
          [{ text: 'OK' }]
        );
      } else if (succeeded.length > 0) {
        Alert.alert(
          'Upload Complete',
          'Upload complete',
          [{ text: 'OK' }]
        );
      }
    } catch (err) {
      console.warn('[UploadQueue] Failed to show fallback Alert:', err);
    }
  }
}

/**
 * Uploads a single queue item and manages its lifecycle.
 * Runs concurrently with other uploadWorker() calls (up to CONCURRENCY).
 */
async function uploadWorkerLargeFileInChunks(item: UploadQueueItem, accessToken: string, fileSize: number) {
  console.log(`[UploadQueue] Starting chunked upload for: ${item.fileName} (${fileSize} bytes)`);

  // 1. Initiate chunked upload
  const initiateResponse = await fetchWithEndpointFallback(
    getEndpointsForPath('/api/media/upload/chunk/initiate'),
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
          contentType: item.fileType || 'application/octet-stream',
        }),
      });
    },
    'initiate chunked upload'
  );

  const initiateResult = await initiateResponse.json().catch(() => ({}));
  if (!initiateResponse.ok) {
    throw new Error(initiateResult.error || `Failed to initiate chunked upload (status: ${initiateResponse.status})`);
  }

  const { fileId, storageKey } = initiateResult;
  const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB chunks
  const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
  const partSha1Array: string[] = [];

  // 2. Upload chunks sequentially
  for (let partIndex = 0; partIndex < totalChunks; partIndex++) {
    // Check if item has been cancelled mid-upload
    const currentItem = queue.find(i => i.id === item.id);
    if (!currentItem) {
      // Abort B2 large file
      await fetchWithEndpointFallback(
        getEndpointsForPath('/api/media/upload/chunk/abort'),
        (endpoint: string) => {
          return fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ fileId }),
          });
        },
        'abort chunked upload'
      ).catch(() => {});
      throw new Error('Upload cancelled by user.');
    }

    const start = partIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, fileSize);
    const partNumber = partIndex + 1;
    const chunkBlobSize = end - start;

    console.log(`[UploadQueue] Uploading chunk ${partNumber}/${totalChunks} (${chunkBlobSize} bytes)...`);

    // Read chunk from local file as base64 string
    const base64Chunk = await FileSystem.readAsStringAsync(item.fileUri, {
      encoding: FileSystem.EncodingType.Base64,
      length: chunkBlobSize,
      position: start,
    });

    // Write chunk temporarily to cache
    const tempUri = `${FileSystem.cacheDirectory}temp_chunk_${item.id}_${partNumber}`;
    await FileSystem.writeAsStringAsync(tempUri, base64Chunk, {
      encoding: FileSystem.EncodingType.Base64,
    });

    let chunkUploadSuccess = false;
    let sha1 = "";
    let attempt = 0;

    while (!chunkUploadSuccess && attempt < 3) {
      attempt++;
      try {
        // Get fresh part upload URL
        const partUrlResponse = await fetchWithEndpointFallback(
          getEndpointsForPath('/api/media/upload/chunk/part-url'),
          (endpoint: string) => {
            return fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({ fileId }),
            });
          },
          'get chunk upload URL'
        );

        const partUrlResult = await partUrlResponse.json().catch(() => ({}));
        if (!partUrlResponse.ok) {
          throw new Error(partUrlResult.error || `Failed to get chunk upload URL (status: ${partUrlResponse.status})`);
        }

        const { uploadUrl, authorizationToken } = partUrlResult;

        // Upload chunk temp file directly to B2 URL
        const uploadTask = FileSystem.createUploadTask(
          uploadUrl,
          tempUri,
          {
            uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
            headers: {
              Authorization: authorizationToken,
              'Content-Type': 'application/octet-stream',
              'X-Bz-Part-Number': String(partNumber),
              'X-Bz-Content-Sha1': 'do_not_verify',
            },
            sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
          }
        );

        const response = await uploadTask.uploadAsync();
        if (!response || response.status !== 200) {
          throw new Error(`Chunk B2 upload failed with status: ${response ? response.status : 'unknown'}`);
        }

        // Retrieve SHA-1 from the B2 response body
        const b2Result = JSON.parse(response.body);
        sha1 = b2Result.contentSha1;
        if (!sha1 || sha1 === "do_not_verify") {
          throw new Error("B2 did not return part SHA-1 checksum in response");
        }

        chunkUploadSuccess = true;
        partSha1Array.push(sha1);

        // Update progress
        const percent = Math.min(99, ((start + chunkBlobSize) / fileSize) * 100);
        item.progress = percent;
        notifyListeners();
        void updateProgressNotification();
      } catch (err) {
        console.warn(`[UploadQueue] Failed chunk ${partNumber} (attempt ${attempt}/3):`, err);
        if (attempt >= 3) {
          throw err;
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      } finally {
        // Always clean up the temp file
        await FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => {});
      }
    }
  }

  // 3. Complete chunked upload on Railway
  console.log(`[UploadQueue] Chunks complete. Completing large file: ${storageKey}`);
  const completeResponse = await fetchWithEndpointFallback(
    getEndpointsForPath('/api/media/upload/chunk/complete'),
    (endpoint: string) => {
      return fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          fileId,
          storageKey,
          eventId: item.eventId,
          fileName: item.fileName,
          fileSize,
          resourceType: item.mediaType === 'video' ? 'video' : 'image',
          partSha1Array,
        }),
      });
    },
    'complete chunked upload'
  );

  const completeResult = await completeResponse.json().catch(() => ({}));
  if (!completeResponse.ok) {
    throw new Error(completeResult.error || `Failed to complete chunked upload (status: ${completeResponse.status})`);
  }

  item.status = 'completed';
  item.progress = 100;
}

async function uploadWorker(item: UploadQueueItem) {
  item.status = 'uploading';
  notifyListeners();
  await saveQueueToStorage();
  await updateProgressNotification();

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      throw new Error('Authorization required.');
    }

    // Get file size to save with metadata & decide upload method
    let fileSize = 0;
    try {
      const info = await FileSystem.getInfoAsync(item.fileUri);
      if (info && info.exists) {
        fileSize = info.size || 0;
      }
    } catch (infoErr) {
      console.warn('[UploadQueue] Could not get file size info:', infoErr);
    }

    if (item.mediaType === 'video') {
      await uploadVideoSegmentedMobile({
        fileUri: item.fileUri,
        fileName: item.fileName,
        fileSize,
        eventId: item.eventId,
        onProgress: (percent) => {
          item.progress = percent;
          notifyListeners();
          void updateProgressNotification();
        },
        onComplete: (res) => {
          item.status = 'completed';
          item.progress = 100;
          notifyListeners();
          void saveQueueToStorage();
        },
        onError: (err) => {
          item.status = 'failed';
          item.error = err.message || String(err);
          notifyListeners();
          void saveQueueToStorage();
        }
      });
      return;
    }

    if (fileSize > 100 * 1024 * 1024) { // > 100 MB
      await uploadWorkerLargeFileInChunks(item, accessToken, fileSize);
      return;
    }

    // 1. Get B2 upload URL and token
    console.log(`[UploadQueue] Getting B2 upload URL for: ${item.fileName}`);
    const getUrlResponse = await fetchWithEndpointFallback(
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
      'get upload url'
    );

    const getUrlResult = await getUrlResponse.json().catch(() => ({}));
    if (!getUrlResponse.ok) {
      throw new Error(getUrlResult.error || `Failed to get B2 upload URL (status: ${getUrlResponse.status})`);
    }

    const { uploadUrl, authorizationToken, storageKey } = getUrlResult;

    // 2. Upload file binary directly to B2
    console.log(`[UploadQueue] Uploading file binary directly to B2 for: ${storageKey}`);
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
        sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
      },
      (progress) => {
        const percent = Math.min(
          99, // limit to 99% until response is finalized
          Math.max(0, (progress.totalBytesSent / progress.totalBytesExpectedToSend) * 100)
        );
        item.progress = percent;
        notifyListeners();
        void updateProgressNotification();
      }
    );

    const response = await uploadTask.uploadAsync();
    if (!response || response.status !== 200) {
      throw new Error(`Direct B2 upload failed with status: ${response ? response.status : 'unknown'}`);
    }

    // 3. Save photo metadata to Vercel/Railway
    console.log(`[UploadQueue] Saving metadata to database for: ${storageKey}`);
    const saveResponse = await fetchWithEndpointFallback(
      getEndpointsForPath('/api/media/save-photo'),
      (endpoint: string) => {
        return fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            storageKey,
            eventId: item.eventId,
            fileName: item.fileName,
            fileSize,
            resourceType: item.mediaType === 'video' ? 'video' : 'image',
          }),
        });
      },
      'save photo metadata'
    );

    const saveResult = await saveResponse.json().catch(() => ({}));
    if (!saveResponse.ok) {
      throw new Error(saveResult.error || `Failed to save photo metadata (status: ${saveResponse.status})`);
    }

    item.status = 'completed';
    item.progress = 100;
  } catch (err: any) {
    console.error(`[UploadQueue] Error uploading ${item.fileName}:`, err);
    item.status = 'failed';
    item.error = err.message || String(err);
  } finally {
    activeSlots = Math.max(0, activeSlots - 1);
    notifyListeners();
    await saveQueueToStorage();
    await updateProgressNotification();

    // This slot is now free — fill it with the next pending item, or
    // fire the completion notification if the whole queue is drained.
    processQueue();
  }
}

/**
 * Concurrent queue dispatcher.
 * Launches up to CONCURRENCY upload workers simultaneously.
 * Safe to call multiple times — extra calls are no-ops when all slots are filled.
 */
async function processQueue() {
  // Fill as many slots as possible without exceeding the concurrency limit
  while (activeSlots < CONCURRENCY) {
    const nextItem = queue.find(item => item.status === 'pending');

    if (!nextItem) {
      // No more pending items — check if the whole queue is now drained
      if (activeSlots === 0) {
        const allSettled = queue.every(
          item => item.status === 'completed' || item.status === 'failed'
        );
        if (allSettled && queue.length > 0) {
          notifyQueueDrained();
        }
      }
      // No pending items left to schedule; remaining slots stay idle
      break;
    }

    // Claim this slot and launch the worker
    activeSlots++;
    uploadWorker(nextItem); // intentionally not awaited — runs concurrently
  }
}

// ---------------------------------------------------------------------------
// Real-Time Segment Upload Pipeline (Mobile — ffmpeg-kit-react-native)
// ---------------------------------------------------------------------------

const MODAL_SEGMENT_URL = (process.env.EXPO_PUBLIC_MODAL_SEGMENT_URL || "https://shwetank-sarthak--wedding-media-engine-process-video-segment.modal.run").trim().replace(/\/+$/, "");
const MOBILE_MAX_PARALLEL_UPLOADS = 4;

export interface MobileVideoUploadOptions {
  fileUri: string;
  fileName: string;
  fileSize: number;
  eventId: string;
  onProgress?: (percent: number) => void;
  onComplete?: (result: { storageKey: string; photoId: string }) => void;
  onError?: (err: Error) => void;
}

/**
 * Mobile Real-Time Video Segment Upload:
 * 1. Uses ffmpeg-kit-react-native to slice the video into 30s self-contained .ts segments.
 * 2. Uploads each segment in parallel to Modal's process_video_segment endpoint.
 * 3. Triggers manifest assembly via backend when all segments are done.
 */
export async function uploadVideoSegmentedMobile(options: MobileVideoUploadOptions): Promise<void> {
  const { fileUri, fileName, fileSize, eventId, onProgress, onComplete, onError } = options;

  const report = (err: Error) => {
    console.error('[MobileSegmentUpload]', err);
    onError?.(err);
  };

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error('Not authenticated');

    onProgress?.(2);

    // 1. Init: create Supabase record + get storageKey from backend
    const initEndpoints = getEndpointsForPath('/api/v1/media/upload/video/init');
    const initResponse = await fetchWithEndpointFallback(
      initEndpoints,
      (endpoint: string) => fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ eventId, fileName, fileSize }),
      }),
      'video upload init'
    );
    const { storageKey, photoId } = await initResponse.json();
    if (!storageKey || !photoId) throw new Error('Failed to init video upload');

    onProgress?.(5);

    // 2. Slice video into 30s segments using native FFmpeg
    const segmentsDir = `${FileSystem.cacheDirectory}segments_${Date.now()}/`;
    await FileSystem.makeDirectoryAsync(segmentsDir, { intermediates: true });

    console.log('[MobileSegmentUpload] Slicing video with native FFmpeg...');

    let FFmpegKit: any;
    try {
      FFmpegKit = require('ffmpeg-kit-react-native').FFmpegKit;
    } catch {
      throw new Error('ffmpeg-kit-react-native is not installed. Run: npm install ffmpeg-kit-react-native');
    }

    const outputPattern = `${segmentsDir}segment_%03d.ts`;
    const session = await FFmpegKit.execute(
      `-i "${fileUri}" -c copy -f segment -segment_time 30 -reset_timestamps 1 "${outputPattern}"`
    );

    const returnCode = await session.getReturnCode();
    if (!returnCode.isValueSuccess()) {
      const logs = await session.getOutput();
      throw new Error(`FFmpeg slicing failed: ${logs}`);
    }

    onProgress?.(20);

    // 3. List all produced segment files
    const dirContents = await FileSystem.readDirectoryAsync(segmentsDir);
    const segmentFiles = dirContents
      .filter((name: string) => /^segment_\d+\.ts$/.test(name))
      .sort();

    if (segmentFiles.length === 0) throw new Error('FFmpeg produced no segments');
    console.log(`[MobileSegmentUpload] Sliced into ${segmentFiles.length} segments`);

    const totalSegments = segmentFiles.length;
    let completedCount = 0;

    // 4. Upload each segment to Modal in parallel batches
    const uploadSegment = async (segName: string, segIndex: number): Promise<void> => {
      const segUri = `${segmentsDir}${segName}`;
      const segInfo = await FileSystem.getInfoAsync(segUri);
      if (!segInfo.exists) throw new Error(`Segment file not found: ${segUri}`);

      const url = `${MODAL_SEGMENT_URL}?storage_key=${encodeURIComponent(storageKey)}&segment_index=${segIndex}&total_segments=${totalSegments}&photo_id=${encodeURIComponent(photoId)}`;

      const uploadTask = FileSystem.createUploadTask(
        url,
        segUri,
        {
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: { 'Content-Type': 'application/octet-stream' },
          sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
        }
      );

      const res = await uploadTask.uploadAsync();
      if (!res || res.status !== 200) {
        throw new Error(`Segment ${segIndex} upload failed (status: ${res?.status ?? 'unknown'})`);
      }

      // Cleanup segment from cache
      await FileSystem.deleteAsync(segUri, { idempotent: true }).catch(() => {});

      completedCount++;
      // Progress: 20–90%
      onProgress?.(20 + Math.round((completedCount / totalSegments) * 70));
      console.log(`[MobileSegmentUpload] Segment ${segIndex}/${totalSegments} done`);
    };

    for (let i = 0; i < totalSegments; i += MOBILE_MAX_PARALLEL_UPLOADS) {
      const batch = segmentFiles.slice(i, i + MOBILE_MAX_PARALLEL_UPLOADS);
      await Promise.all(batch.map((name: string, idx: number) => uploadSegment(name, i + idx)));
    }

    // Cleanup segments dir
    await FileSystem.deleteAsync(segmentsDir, { idempotent: true }).catch(() => {});

    onProgress?.(90);

    // 5. Trigger manifest assembly via backend
    const completeEndpoints = getEndpointsForPath('/api/v1/media/upload/video/complete');
    const completeResponse = await fetchWithEndpointFallback(
      completeEndpoints,
      (endpoint: string) => fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ storageKey, photoId, eventId, totalSegments }),
      }),
      'trigger manifest assembly'
    );

    if (!completeResponse.ok) throw new Error('Failed to trigger manifest assembly');

    onProgress?.(100);
    onComplete?.({ storageKey, photoId });

  } catch (err: unknown) {
    report(err instanceof Error ? err : new Error(String(err)));
  }
}
