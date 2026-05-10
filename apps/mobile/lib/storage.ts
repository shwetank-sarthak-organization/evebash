
/**
 * Simple Cloudinary upload for mobile
 * Uses unsigned upload for simplicity since we don't have a backend to sign requests
 */

const CLOUD_NAME = "db0feghsr";
const UPLOAD_PRESET = "ml_default"; // Common default, hope it works or user has one

export async function uploadEventImage(file: { uri: string; name: string; type: string }, eventId: string, userId?: string) {
    try {
        console.log(`[Storage] Starting upload for ${file.name} to event ${eventId}`);

        const formData = new FormData();
        formData.append('file', {
            uri: file.uri,
            type: file.type,
            name: file.name,
        } as any);
        formData.append('upload_preset', UPLOAD_PRESET);
        formData.append('folder', `wed_album/${userId ? `${userId}/${eventId}` : eventId}`);

        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
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
            format: result.format
        };
    } catch (error) {
        console.error('[Storage] Error:', error);
        throw error;
    }
}
