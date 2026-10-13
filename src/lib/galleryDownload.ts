import { getEventPhotosPaginated, type Photo } from "@/lib/database";
import type { DialogChoice } from "@/components/ui/Modal";
import type { ZipMediaItem } from "@/lib/zipDownload";

export type HomeDownloadChoice = "home" | "event";

/** Asked when Download All is pressed on Home (Primary Gallery), on the website gallery page and the host page. */
export const HOME_DOWNLOAD_DIALOG: { title: string; message: string; choices: DialogChoice<HomeDownloadChoice>[] } = {
    title: "What would you like to download?",
    message: "You're on Home (Primary Gallery).",
    choices: [
        {
            id: "home",
            label: "Home (Primary Gallery) only",
            description: "The favourite photos and videos shown on Home.",
        },
        {
            id: "event",
            label: "Entire event",
            description: "Every photo and video from Home and all sub-galleries, in a folder per gallery.",
        },
    ],
};

/** Every visible media row of one gallery (all pages; media rows only, no files). */
export async function fetchAllGalleryMedia(galleryId: string, legacyId?: string): Promise<Photo[]> {
    const all: Photo[] = [];
    for (let page = 0, more = true; more; page += 1) {
        const result = await getEventPhotosPaginated(galleryId, legacyId, page, 200);
        all.push(...result.photos);
        more = result.hasMore;
    }
    // Pages can share an item at their edges
    const seen = new Set<string>();
    return all.filter((photo) => !seen.has(photo.id) && seen.add(photo.id));
}

export function toZipItem(photo: Photo, folder?: string): ZipMediaItem {
    return {
        id: photo.id,
        url: photo.url,
        filename: photo.storageKey ? photo.storageKey.split("/").pop() : undefined,
        mediaType: photo.mediaType,
        resourceType: photo.resourceType,
        folder,
    };
}

/**
 * The whole event for one ZIP: the main gallery's own uploads in "Home", then each sub-gallery in its own folder.
 * Favourites live in their own galleries, so nothing is downloaded twice.
 */
export async function fetchEntireEventZipItems(
    mainGallery: { id: string; legacyId?: string },
    subGalleries: { id: string; legacyId?: string; title?: string }[],
): Promise<ZipMediaItem[]> {
    const galleries = [
        { ...mainGallery, folder: "Home" },
        ...subGalleries.map((gallery) => ({ ...gallery, folder: gallery.title || "Gallery" })),
    ];
    const media = await Promise.all(galleries.map((gallery) => fetchAllGalleryMedia(gallery.id, gallery.legacyId)));
    return galleries.flatMap((gallery, index) => media[index].map((photo) => toZipItem(photo, gallery.folder)));
}
