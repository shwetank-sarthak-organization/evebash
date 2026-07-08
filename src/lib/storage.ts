import { supabase } from "@/lib/supabase";

/**
 * Uploads a file directly to Backblaze B2, bypassing the server body size limit.
 * 1. Obtains direct upload token/url from Railway.
 * 2. Uploads binary directly to Backblaze B2.
 * 3. Saves photo metadata to Supabase via Railway save-photo endpoint.
 */
export async function uploadEventImage(file: File, eventId: string, userId?: string, laneIndex = 0) {
    try {
        console.log(`[Storage] Starting direct B2 upload for: ${file.name} to event: ${eventId} (lane: ${laneIndex})`);

        const resourceType = file.type.startsWith("video/") ? "video" : "image";
        const { data: { session } } = await supabase.auth.getSession();

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (session?.access_token) {
            headers["Authorization"] = `Bearer ${session.access_token}`;
        }

        // 1. Get B2 upload URL and token from Railway
        const getUrlResponse = await fetch("/api/media/get-upload-url", {
            method: "POST",
            headers,
            body: JSON.stringify({
                eventId,
                fileName: file.name,
                resourceType,
                laneIndex,
            }),
        });

        const getUrlResult = await getUrlResponse.json().catch(() => ({}));
        if (!getUrlResponse.ok) {
            throw new Error(getUrlResult.error || `Failed to get B2 upload URL (status: ${getUrlResponse.status})`);
        }

        const { uploadUrl, authorizationToken, storageKey } = getUrlResult;

        // 2. Upload file binary directly to Backblaze B2 URL
        console.log(`[Storage] Uploading file binary directly to B2...`);
        let uploadResponse: Response | undefined;
        let uploadResult: { message?: string } = {};
        let currentUploadUrl = uploadUrl;
        let currentAuthToken = authorizationToken;

        try {
            uploadResponse = await fetch(currentUploadUrl, {
                method: "POST",
                headers: {
                    Authorization: currentAuthToken,
                    "Content-Type": file.type || "application/octet-stream",
                    "X-Bz-File-Name": encodeURIComponent(storageKey),
                    "X-Bz-Content-Sha1": "do_not_verify",
                    "Content-Length": String(file.size),
                },
                body: file,
            });
            uploadResult = await uploadResponse.json().catch(() => ({}));
            if (!uploadResponse.ok) {
                throw new Error(uploadResult.message || `Upload failed with status: ${uploadResponse.status}`);
            }
        } catch (fetchErr) {
            console.warn(`[Storage] Direct B2 upload failed for ${file.name}. Requesting fresh upload URL and retrying...`, fetchErr);
            
            const retryUrlResponse = await fetch("/api/media/get-upload-url", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    eventId,
                    fileName: file.name,
                    resourceType,
                    laneIndex,
                    forceRefresh: true,
                }),
            });

            const retryUrlResult = await retryUrlResponse.json().catch(() => ({}));
            if (!retryUrlResponse.ok) {
                throw new Error(retryUrlResult.error || `Failed to refresh B2 upload URL during retry (status: ${retryUrlResponse.status})`);
            }

            currentUploadUrl = retryUrlResult.uploadUrl;
            currentAuthToken = retryUrlResult.authorizationToken;

            // Retry the upload one more time with a fresh URL
            uploadResponse = await fetch(currentUploadUrl, {
                method: "POST",
                headers: {
                    Authorization: currentAuthToken,
                    "Content-Type": file.type || "application/octet-stream",
                    "X-Bz-File-Name": encodeURIComponent(storageKey),
                    "X-Bz-Content-Sha1": "do_not_verify",
                    "Content-Length": String(file.size),
                },
                body: file,
            });
            uploadResult = await uploadResponse.json().catch(() => ({}));
        }

        if (!uploadResponse || !uploadResponse.ok) {
            throw new Error((uploadResult && uploadResult.message) || `Direct B2 upload failed with status: ${uploadResponse ? uploadResponse.status : "unknown"}`);
        }

        // 3. Save database record and trigger background worker on Railway
        console.log(`[Storage] Saving metadata to database...`);
        const saveResponse = await fetch("/api/media/save-photo", {
            method: "POST",
            headers,
            body: JSON.stringify({
                storageKey,
                eventId,
                fileName: file.name,
                fileSize: file.size,
                resourceType,
            }),
        });

        const saveResult = await saveResponse.json().catch(() => ({}));
        if (!saveResponse.ok) {
            throw new Error(saveResult.error || `Failed to save photo metadata (status: ${saveResponse.status})`);
        }

        return {
            url: saveResult.url,
            publicId: storageKey,
            width: undefined,
            height: undefined,
            bytes: file.size,
            format: file.name.split(".").pop() || "jpg",
        };
    } catch (error: unknown) {
        console.error("[Storage] Direct upload flow error:", error);
        throw error;
    }
}
