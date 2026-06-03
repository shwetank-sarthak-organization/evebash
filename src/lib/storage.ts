import { getPresignedUploadUrl } from "@/app/actions/upload";

/**
 * Uploads a file directly to Backblaze B2 from the browser using a presigned URL.
 * Returns the download URL and metadata.
 */
export async function uploadEventImage(file: File, eventId: string, userId?: string) {
    try {
        console.log(`[Storage] Starting browser-direct upload for: ${file.name} to event: ${eventId}`);

        const folder = userId ? `events/${eventId}/${userId}` : `events/${eventId}`;
        const resourceType = file.type.startsWith("video/") ? "video" : "image";

        // Step 1: Server issues a presigned URL (tiny request, no file payload)
        const presignedResult = await getPresignedUploadUrl(
            folder,
            file.name,
            file.type,
            resourceType
        );

        if (!presignedResult.success) {
            throw new Error(presignedResult.error || "Failed to generate presigned upload URL");
        }

        // Step 2: Browser uploads the raw file directly to Backblaze B2
        const uploadResponse = await fetch(presignedResult.uploadUrl, {
            method: "POST",
            headers: {
                Authorization: presignedResult.authToken,
                "Content-Type": file.type,
                "X-Bz-File-Name": encodeURIComponent(presignedResult.storageKey),
                "X-Bz-Content-Sha1": "do_not_verify",
            },
            body: file,
        });

        if (!uploadResponse.ok) {
            const err = await uploadResponse.json().catch(() => ({}));
            throw new Error(err.message || `Upload failed with status: ${uploadResponse.status}`);
        }

        const result = await uploadResponse.json();

        // Step 3: Return metadata matching the original signature
        return {
            url: presignedResult.finalUrl,
            publicId: presignedResult.storageKey,
            width: undefined,
            height: undefined,
            bytes: result.contentLength || file.size,
            format: file.name.split(".").pop() || "jpg",
        };
    } catch (error: unknown) {
        console.error("[Storage] Direct Upload Error:", error);
        throw error;
    }
}

