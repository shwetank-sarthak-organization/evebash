
/**
 * Simple Cloudinary upload for mobile
 * Uses unsigned upload for simplicity since we don't have a backend to sign requests
 */

const CLOUD_NAME = (process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || "db0feghsr").trim();
const UPLOAD_PRESET = (process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "ml_default").trim();


type EventUploadResourceType = 'image' | 'video' | 'auto';

export async function uploadEventMedia(
    file: { uri: string; name: string; type: string },
    eventId: string,
    userId?: string,
    resourceType: EventUploadResourceType = 'image'
) {
    try {
        console.log(`[Storage] Starting upload for ${file.name} to event ${eventId}`);
        console.log(`[Storage] Config - Cloud Name: "${CLOUD_NAME}", Upload Preset: "${UPLOAD_PRESET}"`);

        const formData = new FormData();
        formData.append('file', {
            uri: file.uri,
            type: file.type,
            name: file.name,
        } as any);
        formData.append('upload_preset', UPLOAD_PRESET);
        formData.append('folder', `wed_album/${userId ? `${userId}/${eventId}` : eventId}`);

        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, {
            method: 'POST',
            body: formData,
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('[Cloudinary] Upload failed:', result);
            throw new Error(result.error?.message || 'Upload failed');
        }

        return {
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
            bytes: result.bytes,
            format: result.format,
            resourceType: result.resource_type || resourceType
        };
    } catch (error) {
        console.error('[Storage] Error:', error);
        throw error;
    }
}

export async function uploadEventImage(file: { uri: string; name: string; type: string }, eventId: string, userId?: string) {
    return uploadEventMedia(file, eventId, userId, 'image');
}

export async function uploadProfileImage(base64: string, userId: string) {
    try {
        console.log(`[Storage] Starting profile upload to Cloudinary for user ${userId}`);
        console.log(`[Storage] Config - Cloud Name: "${CLOUD_NAME}", Upload Preset: "${UPLOAD_PRESET}"`);

        const formData = new FormData();
        formData.append('file', base64);
        formData.append('upload_preset', UPLOAD_PRESET);
        formData.append('folder', `wed_album/profiles/${userId}`);

        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
            method: 'POST',
            body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('[Cloudinary] Profile photo upload failed:', result);
            console.error('[Cloudinary] Failed with config - Cloud Name:', CLOUD_NAME, 'Preset:', UPLOAD_PRESET);
            throw new Error(result.error?.message || 'Upload failed');
        }

        return {
            url: result.secure_url,
            publicId: result.public_id,
        };
    } catch (error) {
        console.error('[Storage] Error in uploadProfileImage:', error);
        throw error;
    }
}
