// @ts-ignore
import JSZip from "jszip";

export interface ZipMediaItem {
    id: string;
    url: string;
    filename?: string;
    mediaType?: string;
    resourceType?: string;
}

export type ZipProgressCallback = (percent: number, currentItem: number, totalItems: number) => void;

function getExtensionFromUrl(url: string, defaultExt = "jpg") {
    try {
        const path = new URL(url).pathname;
        const ext = path.split(".").pop()?.toLowerCase();
        if (ext && ext.length <= 4 && !ext.includes("/")) {
            return ext;
        }
    } catch {}
    return defaultExt;
}

/**
 * The file to download for a gallery item. Processed videos are stored for streaming: their url is an HLS
 * playlist at "<host>/hls/<storage key>/master.m3u8", and the uploaded file is kept at "<host>/<storage key>".
 * Downloads use that uploaded file, not the half-KB playlist. Photos (and anything else) download as they are.
 */
export function getOriginalMediaUrl(url: string) {
    const hls = url.match(/^(https?:\/\/[^/]+)\/hls\/(.+)\/master\.m3u8(\?.*)?$/i);
    if (hls) return `${hls[1]}/${hls[2]}`;
    return url.replace(/\/master\.m3u8(\?.*)?$/i, "");
}

function fileNameFromUrl(url: string) {
    try {
        return decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
    } catch {
        return "";
    }
}

export interface ZipDownloadResult {
    total: number;
    included: number;
    failed: number;
}

export async function downloadGalleryAsZip(
    galleryTitle: string,
    items: ZipMediaItem[],
    onProgress?: ZipProgressCallback
): Promise<ZipDownloadResult> {
    if (!items || items.length === 0) {
        throw new Error("No media items selected to download.");
    }

    const zip = new JSZip();
    const folderName = (galleryTitle || "Gallery").replace(/[^a-zA-Z0-9_-]/g, "_");
    const zipFolder = zip.folder(folderName) || zip;
    const usedNames = new Set<string>();

    const total = items.length;
    let completed = 0;
    let attempted = 0;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.url) continue;
        const mediaUrl = getOriginalMediaUrl(item.url);

        try {
            const response = await fetch(mediaUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const blob = await response.blob();
            const isVideo = item.mediaType === "video" || item.resourceType === "video";
            const ext = getExtensionFromUrl(mediaUrl, isVideo ? "mp4" : "jpg");

            const baseName = (item.filename || fileNameFromUrl(mediaUrl) || `media_${i + 1}`).replace(/[^a-zA-Z0-9._-]/g, "_");
            const withExt = baseName.includes(".") ? baseName : `${baseName}.${ext}`;
            // Two files with the same name would overwrite each other in the ZIP
            let finalName = withExt;
            for (let n = 2; usedNames.has(finalName.toLowerCase()); n++) {
                const dot = withExt.lastIndexOf(".");
                finalName = `${withExt.slice(0, dot)}_${n}${withExt.slice(dot)}`;
            }
            usedNames.add(finalName.toLowerCase());
            zipFolder.file(finalName, blob);
            completed++;
        } catch (err) {
            console.warn(`[ZipDownload] Failed to download media item ${item.id}:`, err);
        } finally {
            attempted++;
            // Downloading is the slow part (0-90%); building the ZIP is the rest
            onProgress?.(Math.round((attempted / total) * 90), completed, total);
        }
    }

    if (completed === 0) {
        throw new Error("Failed to download media files. Please check network connection.");
    }

    // Photos and videos are already compressed, so they're stored as they are (much faster, same size)
    const zipBlob = await (zip as any).generateAsync({ type: "blob", compression: "STORE" }, (metadata: any) => {
        onProgress?.(90 + Math.round(metadata.percent / 10), completed, total);
    });

    const safeZipName = `${folderName}_Gallery.zip`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(zipBlob);
    link.download = safeZipName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
        URL.revokeObjectURL(link.href);
    }, 10000);

    return { total, included: completed, failed: total - completed };
}
