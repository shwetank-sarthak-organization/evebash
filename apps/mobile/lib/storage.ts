import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

type EventUploadResourceType = 'image' | 'video' | 'auto';

type UploadFile = {
    uri: string;
    name: string;
    type: string;
};

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

async function fetchWithEndpointFallback(
    requestFactory: (endpoint: string) => Promise<Response>,
    context: string
) {
    const endpoints = getUploadEndpoints();
    let lastError: unknown;

    for (const endpoint of endpoints) {
        try {
            console.log(`[Storage] Trying ${context} endpoint: ${endpoint}`);
            return await requestFactory(endpoint);
        } catch (error) {
            lastError = error;
            console.warn(`[Storage] ${context} endpoint failed: ${endpoint}`, error);
        }
    }

    const endpointsStr = endpoints.join(', ');
    throw new Error(`Failed to connect to any ${context} endpoint. Tried: [${endpointsStr}]. Last error: ${lastError instanceof Error ? lastError.message : lastError}`);
}

function inferResourceType(resourceType: EventUploadResourceType, mimeType: string) {
    if (resourceType === 'auto') {
        return mimeType.startsWith('video/') ? 'video' : 'image';
    }
    return resourceType;
}

export async function uploadEventMedia(
    file: UploadFile,
    eventId: string,
    userId?: string,
    resourceType: EventUploadResourceType = 'image'
) {
    try {
        const resolvedResourceType = inferResourceType(resourceType, file.type);
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;

        if (!accessToken) {
            throw new Error('Please log in before uploading media.');
        }

        console.log(`[Storage] Uploading ${file.name} to Backblaze for event ${eventId}`);

        const response = await fetchWithEndpointFallback(
            (endpoint) => {
                const formData = new FormData();
                formData.append('file', {
                    uri: file.uri,
                    type: file.type,
                    name: file.name,
                } as any);
                formData.append('eventId', eventId);
                formData.append('resourceType', resolvedResourceType);
                if (userId) {
                    formData.append('userId', userId);
                }

                return fetch(endpoint, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                });
            },
            'media upload'
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.error || 'Upload failed');
        }

        return {
            url: result.url,
            publicId: result.publicId || result.storageKey || '',
            storageKey: result.storageKey,
            width: result.width,
            height: result.height,
            bytes: result.bytes,
            format: result.format,
            mediaType: result.mediaType,
            resourceType: result.resourceType || resolvedResourceType,
        };
    } catch (error) {
        console.error('[Storage] Error:', error);
        throw error;
    }
}

export async function uploadEventImage(file: UploadFile, eventId: string, userId?: string) {
    return uploadEventMedia(file, eventId, userId, 'image');
}

export async function uploadProfileImage(base64: string, userId: string) {
    try {
        console.log(`[Storage] Starting profile upload to Backblaze for user ${userId}`);

        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;

        if (!accessToken) {
            throw new Error('Please log in before uploading a profile image.');
        }

        const response = await fetchWithEndpointFallback((endpoint) => fetch(endpoint, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    scope: 'profile',
                    base64,
                    fileName: `profile-${userId}.jpg`,
                    contentType: 'image/jpeg',
                    resourceType: 'image',
                }),
            }),
            'profile upload'
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.error || 'Upload failed');
        }

        return {
            url: result.url,
            publicId: result.publicId || result.storageKey || '',
        };
    } catch (error) {
        console.error('[Storage] Error in uploadProfileImage:', error);
        throw error;
    }
}
