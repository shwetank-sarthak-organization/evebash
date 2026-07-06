import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createUploadTask, FileSystemUploadType, FileSystemSessionType } from 'expo-file-system/legacy';
import { supabase } from './supabase';
import { addPhoto, deletePhoto } from './database';

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

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function getUploadEndpoints() {
  const explicitEndpoint = process.env.EXPO_PUBLIC_MEDIA_UPLOAD_URL?.trim();
  if (explicitEndpoint) return [explicitEndpoint];

  const endpoints: string[] = [];

  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (apiBaseUrl) {
    endpoints.push(joinUrl(apiBaseUrl, '/api/media/upload'));
  }

  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.developer?.hostUri;
  const devHost = typeof hostUri === 'string' ? hostUri.split(':')[0] : '';
  if (devHost) {
    endpoints.push(`http://${devHost}:3000/api/media/upload`);
  }

  if (Platform.OS === 'android') {
    endpoints.push('http://10.0.2.2:3000/api/media/upload');
  }

  endpoints.push('http://localhost:3000/api/media/upload');

  return Array.from(new Set(endpoints));
}

/**
 * Fires completion notification/alert when every item in the queue is settled
 * (completed or failed) and no slots are active.
 */
async function notifyQueueDrained() {
  const totalCount = queue.length;
  if (totalCount === 0) return;

  const failed = queue.filter(item => item.status === 'failed');
  const succeeded = queue.filter(item => item.status === 'completed');

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

    const endpoints = getUploadEndpoints();
    let uploadSuccess = false;
    let lastError: any = null;

    for (const uploadUrl of endpoints) {
      try {
        console.log(`[UploadQueue] Trying: ${item.fileName} via ${uploadUrl}`);

        const uploadTask = createUploadTask(
          uploadUrl,
          item.fileUri,
          {
            uploadType: FileSystemUploadType.MULTIPART,
            fieldName: 'file',
            mimeType: item.fileType,
            parameters: {
              eventId: item.eventId,
              resourceType: item.mediaType === 'video' ? 'video' : 'image',
            },
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            sessionType: FileSystemSessionType.BACKGROUND,
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

        if (response && response.status === 200) {
          let result: any = {};
          try {
            result = JSON.parse(response.body);
          } catch (parseErr) {
            throw new Error(`Server returned 200 but body could not be parsed: ${response.body.slice(0, 200)}`);
          }
          console.log(`[UploadQueue] Upload succeeded for ${item.fileName}. Writing DB record...`);

          // Write to Supabase database (only if the server hasn't already written it)
          let savedPhotoId = result.savedPhotoId;
          if (!savedPhotoId) {
            console.log(`[UploadQueue] Server did not write to DB. Writing client-side DB record...`);
            savedPhotoId = await addPhoto({
              eventId: item.eventId,
              url: result.url,
              storageKey: result.publicId || '',
              mediaType: item.mediaType,
              resourceType: result.resourceType,
              uploadedAt: new Date(),
              userId: item.userId,
              width: result.width,
              height: result.height,
              size: result.bytes,
              format: result.format,
            });
            if (!savedPhotoId) {
              throw new Error('Failed to record photo meta in DB.');
            }
          } else {
            console.log(`[UploadQueue] Server successfully recorded photo meta in DB: ${savedPhotoId}`);
          }

          // Poll for thumbnail URL to confirm processing is complete (matches web flow)
          item.progress = 90;
          notifyListeners();
          await updateProgressNotification();

          let thumbnailGenerated = false;
          for (let poll = 0; poll < 30; poll++) {
            const { data: checkData } = await supabase
              .from('photos')
              .select('thumbnail_url')
              .eq('storage_key', result.storageKey || result.publicId)
              .maybeSingle();
            if (checkData?.thumbnail_url) {
              thumbnailGenerated = true;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }

          if (thumbnailGenerated) {
            item.status = 'completed';
            item.progress = 100;
            uploadSuccess = true;
          } else {
            console.warn(`[UploadQueue] Thumbnail generation timed out for ${item.fileName}. Rolling back upload...`);
            await deletePhoto(savedPhotoId);
            throw new Error('Failed to generate optimized thumbnails (Timeout).');
          }
          break; // Exit endpoints loop
        } else {
          const errBody = response ? response.body : 'No response body';
          throw new Error(`Upload returned status ${response?.status || 'unknown'}: ${errBody}`);
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[UploadQueue] Endpoint failed: ${uploadUrl}`, err?.message || err);
      }
    }

    if (!uploadSuccess) {
      const endpointsStr = endpoints.join(', ');
      throw new Error(`Failed to connect to any upload endpoint. Tried: [${endpointsStr}]. Last error: ${lastError?.message || lastError}`);
    }
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
