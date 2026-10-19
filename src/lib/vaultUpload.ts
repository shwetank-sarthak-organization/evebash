import { vaultApi, VaultApiError, type VaultItem } from "@/lib/vaultApi";

/**
 * Uploads one file straight from the browser to Vault storage using signed links from the backend.
 * Small files go in one request; large files go in parts (four at a time), so nothing streams
 * through our server. Progress is reported in bytes.
 */
export async function uploadVaultFile(
    file: File,
    folderId: string | null,
    onProgress: (uploadedBytes: number) => void,
    signal: AbortSignal,
): Promise<VaultItem> {
    const start = await vaultApi.startUpload({
        filename: file.name,
        sizeBytes: file.size,
        mimeType: file.type || "application/octet-stream",
        folderId,
    });

    try {
        if (start.mode === "single") {
            await putBlob(start.url, file, start.headers, (loaded) => onProgress(loaded), signal);
            return (await vaultApi.completeUpload(start.uploadId)).item;
        }

        const { partSize, partCount } = start;
        const loadedByPart = new Map<number, number>();
        const report = () => onProgress([...loadedByPart.values()].reduce((sum, bytes) => sum + bytes, 0));
        const etags: { partNumber: number; etag: string }[] = [];
        const pending = Array.from({ length: partCount }, (_, i) => i + 1);

        const worker = async () => {
            while (pending.length > 0) {
                if (signal.aborted) throw new DOMException("Upload cancelled", "AbortError");
                const batch = pending.splice(0, 1);
                const { parts } = await vaultApi.partUrls(start.uploadId, batch);
                for (const { partNumber, url } of parts) {
                    const blob = file.slice((partNumber - 1) * partSize, Math.min(partNumber * partSize, file.size));
                    const etag = await withRetry(() => putBlob(url, blob, {}, (loaded) => {
                        loadedByPart.set(partNumber, loaded);
                        report();
                    }, signal), signal);
                    if (!etag) throw new VaultApiError(0, "storage_cors", "Storage didn't return an upload receipt. The Vault bucket's CORS rule must expose the ETag header.");
                    etags.push({ partNumber, etag });
                }
            }
        };
        await Promise.all(Array.from({ length: Math.min(4, partCount) }, worker));
        return (await vaultApi.completeUpload(start.uploadId, etags.sort((a, b) => a.partNumber - b.partNumber))).item;
    } catch (error) {
        // Release the reserved storage right away instead of waiting for the hourly cleanup.
        await vaultApi.abortUpload(start.uploadId).catch(() => null);
        throw error;
    }
}

async function withRetry<T>(run: () => Promise<T>, signal: AbortSignal, attempts = 3): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
        try {
            return await run();
        } catch (error) {
            if (signal.aborted || attempt >= attempts || error instanceof DOMException) throw error;
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
    }
}

/** PUT with upload progress (fetch can't report upload progress). Resolves with the ETag header. */
function putBlob(url: string, body: Blob, headers: Record<string, string>, onProgress: (loaded: number) => void, signal: AbortSignal) {
    return new Promise<string | null>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", url);
        for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
        xhr.upload.onprogress = (event) => onProgress(event.loaded);
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                onProgress(body.size);
                resolve(xhr.getResponseHeader("ETag"));
            } else {
                reject(new VaultApiError(xhr.status, "storage_error", "The upload was rejected by storage. Please try again."));
            }
        };
        xhr.onerror = () => reject(new VaultApiError(0, "network", "The upload was interrupted. Check your connection and try again."));
        const abort = () => {
            xhr.abort();
            reject(new DOMException("Upload cancelled", "AbortError"));
        };
        if (signal.aborted) return abort();
        signal.addEventListener("abort", abort, { once: true });
        xhr.send(body);
    });
}

/** For a folder upload: the folder path of each file, e.g. "Trip/Day 1" for "Trip/Day 1/a.jpg". */
export function folderPathsOf(files: File[]): string[] {
    const paths = new Set<string>();
    for (const file of files) {
        const segments = (file.webkitRelativePath || "").split("/").slice(0, -1);
        for (let depth = 1; depth <= segments.length; depth += 1) paths.add(segments.slice(0, depth).join("/"));
    }
    return [...paths];
}
