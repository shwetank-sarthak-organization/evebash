import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import { getEndpointsForPath, fetchWithEndpointFallback } from './storage';
import { supabase } from './supabase';
import { sha1 } from './sha1';
import { UploadQueueItem } from './uploadQueue';

const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MiB
const ASYNC_STORAGE_PREFIX = '@evebash_chunk_resume_';

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

export async function abortChunkedUpload(item: UploadQueueItem) {
  const stateKey = `${ASYNC_STORAGE_PREFIX}${item.id}`;
  const stateRaw = await AsyncStorage.getItem(stateKey);
  if (!stateRaw) return;

  const state: ChunkUploadState = JSON.parse(stateRaw);
  if (state.b2FileId) {
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token || '';
    
    await fetchWithEndpointFallback(
      getEndpointsForPath('/api/media/upload/chunk/abort'),
      (endpoint) => fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ fileId: state.b2FileId }),
      }),
      'chunk-abort'
    );
  }
  await AsyncStorage.removeItem(stateKey);
}

export async function uploadVideoInChunks(
  item: UploadQueueItem,
  onProgress: (progress: number) => void
): Promise<{ storageKey: string; b2FileId: string; duration?: number }> {
  const stateKey = `${ASYNC_STORAGE_PREFIX}${item.id}`;
  let state: ChunkUploadState | null = null;
  
  const stateRaw = await AsyncStorage.getItem(stateKey);
  if (stateRaw) {
    try {
      state = JSON.parse(stateRaw);
    } catch (e) {
      console.warn('[ChunkUpload] Invalid state JSON', e);
    }
  }

  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token || '';

  const totalParts = Math.ceil(item.fileSize / CHUNK_SIZE);
  
  if (!state) {
    state = {
      version: 1,
      clientUploadId: item.id,
      fileUri: item.fileUri,
      fileSize: item.fileSize,
      b2FileId: '',
      storageKey: '',
      chunkSize: CHUNK_SIZE,
      totalParts,
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

  // State Machine Loop
  while (state.status !== 'completed' && state.status !== 'failed' && state.status !== 'aborting') {
    if (state.status === 'initiating') {
      const response = await fetchWithEndpointFallback(
        getEndpointsForPath('/api/media/upload/chunk/initiate'),
        (endpoint) => fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            eventId: item.eventId,
            fileName: item.fileName,
            fileSize: item.fileSize,
            contentType: item.fileType || 'video/mp4',
            resourceType: 'video',
          }),
        }),
        'chunk-initiate'
      );

      if (!response || !response.ok) {
        throw new Error(`Initiate failed: ${response?.status}`);
      }

      const data = await response.json();
      state.b2FileId = data.fileId;
      state.storageKey = data.storageKey;
      state.status = 'uploading';
      
      // If server returned resumed parts, merge them
      if (data.resumed && Array.isArray(data.completedParts)) {
        // Just rely on what B2 told us, or keep our client parts if they are richer
        // Since we are client-authoritative on completedParts in AsyncStorage, we don't strictly need this,
        // but it's safe to merge.
      }
      
      await persistState();
    } 
    else if (state.status === 'uploading') {
      const file = new File(state.fileUri);
      
      // Find missing parts
      for (let partNumber = 1; partNumber <= state.totalParts; partNumber++) {
        if (state.completedParts[partNumber]) {
          continue;
        }

        const offset = (partNumber - 1) * CHUNK_SIZE;
        const remaining = state.fileSize - offset;
        const partSize = Math.min(CHUNK_SIZE, remaining);

        let chunkBytes: Uint8Array | null = null;
        let handle: any = null;
        try {
          handle = file.open();
          handle.offset = offset;
          chunkBytes = handle.readBytes(partSize);
        } finally {
          if (handle) handle.close();
        }

        if (!chunkBytes) throw new Error("Failed to read chunk bytes");

        const chunkSha1 = sha1(chunkBytes);

        // Get part URL
        const partUrlRes = await fetchWithEndpointFallback(
          getEndpointsForPath('/api/media/upload/chunk/part-url'),
          (endpoint) => fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ fileId: state!.b2FileId }),
          }),
          'chunk-part-url'
        );

        if (!partUrlRes) throw new Error("Failed to get part URL");
        
        if (partUrlRes.status === 410 || partUrlRes.status === 404) {
          // Session expired on B2 or missing
          state.status = 'initiating';
          state.b2FileId = '';
          state.completedParts = {};
          await persistState();
          break; // Break the inner loop, outer loop will re-initiate
        }

        if (!partUrlRes.ok) throw new Error(`Part URL failed: ${partUrlRes.status}`);

        const partUrlData = await partUrlRes.json();

        // Upload chunk to B2
        const uploadRes = await fetch(partUrlData.uploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': partUrlData.authorizationToken,
            'X-Bz-Part-Number': partNumber.toString(),
            'X-Bz-Content-Sha1': chunkSha1,
            'Content-Length': chunkBytes.byteLength.toString(),
          },
          body: chunkBytes as unknown as BodyInit,
        });

        if (!uploadRes.ok) {
          const bodyText = await uploadRes.text().catch(() => '');
          if (uploadRes.status === 401 || uploadRes.status === 403 || bodyText.includes('expired')) {
            // Token expired, retry getting URL
            partNumber--; 
            continue;
          }
          throw new Error(`B2 upload_part failed: ${uploadRes.status} ${bodyText}`);
        }

        // B2 verified the SHA1 and saved the part
        state.completedParts[partNumber] = { sha1: chunkSha1, size: chunkBytes.byteLength };
        await persistState();

        const progress = (Object.keys(state.completedParts).length / state.totalParts) * 100;
        onProgress(Math.min(99, progress));
      }

      if (Object.keys(state!.completedParts).length === state!.totalParts) {
        state!.status = 'completing';
        await persistState();
      }
    } 
    else if (state.status === 'completing') {
      const partSha1Array: string[] = [];
      for (let i = 1; i <= state.totalParts; i++) {
        partSha1Array.push(state.completedParts[i].sha1);
      }

      const completeRes = await fetchWithEndpointFallback(
        getEndpointsForPath('/api/media/upload/chunk/complete'),
        (endpoint) => fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            fileId: state!.b2FileId,
            partSha1Array,
            duration: item.duration || 0,
          }),
        }),
        'chunk-complete'
      );

      if (!completeRes) {
        throw new Error("Complete network failure");
      }

      if (completeRes.ok) {
        state.status = 'completed';
        await persistState();
      } else {
        const errText = await completeRes.text().catch(() => '');
        // Note: The backend already catches "No active upload for" and "already_finished" 
        // and returns 200 OK. If we get a 400 here, it's a real failure, but we shouldn't assume it's terminal
        // unless B2 rejected the sha1Array permanently.
        // If it's a 502/504 network drop, we throw so `uploadQueue` retries.
        throw new Error(`Complete failed: ${completeRes.status} ${errText}`);
      }
    }
  }

  await AsyncStorage.removeItem(stateKey);
  onProgress(100);

  return {
    storageKey: state.storageKey,
    b2FileId: state.b2FileId,
    duration: item.duration,
  };
}
