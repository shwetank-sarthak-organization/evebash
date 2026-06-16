import { uploadToBackblaze } from "@/app/actions/upload";
import { supabase } from "@/lib/supabase";

/**
 * Uploads a file through the app API so the browser does not need Backblaze CORS access.
 * Returns the download URL and metadata.
 */
export async function uploadEventImage(file: File, eventId: string, userId?: string) {
    try {
        console.log(`[Storage] Starting app-routed upload for: ${file.name} to event: ${eventId}`);

        const folder = userId ? `events/${eventId}/${userId}` : `events/${eventId}`;
        const resourceType = file.type.startsWith("video/") ? "video" : "image";
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.access_token) {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("eventId", eventId);
            formData.append("resourceType", resourceType);

            const uploadResponse = await fetch("/api/media/upload", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: formData,
            });

            const result = await uploadResponse.json().catch(() => ({}));
            if (!uploadResponse.ok) {
                throw new Error(result.error || `Upload failed with status: ${uploadResponse.status}`);
            }

            return {
                url: result.url,
                publicId: result.publicId || result.storageKey,
                width: undefined,
                height: undefined,
                bytes: result.bytes || file.size,
                format: result.format || file.name.split(".").pop() || "jpg",
            };
        }

        const base64File = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
            reader.readAsDataURL(file);
        });

        const fallbackResult = await uploadToBackblaze(base64File, folder, {
            fileName: file.name,
            contentType: file.type,
            resourceType,
        });

        if (!fallbackResult.success) {
            throw new Error(fallbackResult.error || "Upload failed");
        }

        return {
            url: fallbackResult.url,
            publicId: fallbackResult.public_id || fallbackResult.storageKey,
            width: fallbackResult.width,
            height: fallbackResult.height,
            bytes: fallbackResult.bytes || file.size,
            format: fallbackResult.format || file.name.split(".").pop() || "jpg",
        };
    } catch (error: unknown) {
        console.error("[Storage] Upload Error:", error);
        throw error;
    }
}
