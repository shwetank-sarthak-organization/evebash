import { deleteCoverUsagePhoto, saveCoverUsagePhoto, updateEvent } from "@/lib/database";
import { uploadEventImage } from "@/lib/storage";
import type { CoverTarget } from "../../shared/themes/phoneCover";

// Uploading and removing a gallery's cover picture: one copy for the host page and Preview Guest Theme's edit mode.

/** Covers over 5 MB are scaled to at most 2500 px and saved as JPEG; smaller ones are uploaded as they are. */
export async function compressCoverImage(file: File): Promise<File> {
    if (file.size < 5 * 1024 * 1024) return file;

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement("canvas");
            let width = img.width;
            let height = img.height;

            // Max dimension 2500px for web display
            const MAX_DIM = 2500;
            if (width > height) {
                if (width > MAX_DIM) {
                    height *= MAX_DIM / width;
                    width = MAX_DIM;
                }
            } else {
                if (height > MAX_DIM) {
                    width *= MAX_DIM / height;
                    height = MAX_DIM;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(new File([blob], file.name, { type: "image/jpeg" }));
                    } else {
                        resolve(file);
                    }
                },
                "image/jpeg",
                0.85 // High quality but significantly smaller filesize
            );
            URL.revokeObjectURL(img.src);
        };
        img.onerror = (err) => reject(err);
    });
}

/** Uploads a new cover, makes it the gallery's computer cover (or phone cover) and counts it in the host's storage.
 *  Returns its link; throws if the upload or the save fails. */
export async function uploadEventCover(file: File, eventId: string, userId: string, target: CoverTarget = "computer"): Promise<string> {
    const optimizedFile = await compressCoverImage(file);
    if (optimizedFile.size !== file.size) {
        console.log(`[Cover] Optimized cover: ${Math.round(file.size / 1024 / 1024 * 10) / 10}MB -> ${Math.round(optimizedFile.size / 1024 / 1024 * 10) / 10}MB`);
    }

    const uploadResult = await uploadEventImage(optimizedFile, eventId, userId);
    const success = await updateEvent(eventId, target === "phone" ? { phoneCoverImage: uploadResult.url } : { coverImage: uploadResult.url });

    if (!success) {
        throw new Error("Cover upload completed, but saving the event cover failed.");
    }

    const usageSaved = await saveCoverUsagePhoto({
        eventId,
        storageKey: uploadResult.publicId || uploadResult.url,
        url: uploadResult.url,
        userId,
        width: uploadResult.width,
        height: uploadResult.height,
        size: uploadResult.bytes || optimizedFile.size,
        format: uploadResult.format,
    });

    if (!usageSaved) {
        console.warn("[Cover] Cover updated, but storage usage could not be synced.");
    }

    return uploadResult.url;
}

/** Takes the cover off the gallery and stops counting it in the host's storage: the computer cover goes back to the
 *  default cover, the phone cover back to "same as the computer cover". Throws if the save fails. */
export async function removeEventCover(eventId: string, coverUrl: string, target: CoverTarget = "computer"): Promise<void> {
    const success = await updateEvent(eventId, target === "phone"
        ? { phoneCoverImage: null, phoneCoverMode: null, phoneCoverOffset: null, phoneCoverOffsetX: null, phoneCoverScale: null }
        : { coverImage: "" });
    if (!success) {
        throw new Error("Failed to remove cover picture.");
    }

    const usageDeleted = await deleteCoverUsagePhoto(eventId, coverUrl);
    if (!usageDeleted) {
        console.warn("[Cover] Cover removed, but storage usage could not be synced.");
    }
}
