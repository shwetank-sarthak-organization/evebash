import { formatStorageSize } from "@/lib/planLimits";

export const formatBytes = (bytes: number) => (bytes === 0 ? "0 KB" : formatStorageSize(bytes));

export function formatDate(value: string | null | undefined) {
    if (!value) return "";
    return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(value: string) {
    return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export type PreviewKind = "image" | "video" | "pdf" | "text" | "none";

/** Phase 1 previews; everything else gets an info card with a Download button. */
export function previewKind(mimeType: string, extension: string): PreviewKind {
    if (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mimeType)) return "image";
    if (mimeType === "video/mp4") return "video";
    if (mimeType === "application/pdf" || extension === "pdf") return "pdf";
    if (mimeType === "text/plain" || mimeType === "text/csv" || extension === "txt" || extension === "csv") return "text";
    return "none";
}

export type FileTypeKey = "image" | "video" | "audio" | "sheet" | "archive" | "document" | "other";

export function fileTypeKey(mimeType: string, extension: string): FileTypeKey {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    if (["xls", "xlsx", "csv", "ods"].includes(extension)) return "sheet";
    if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) return "archive";
    if (mimeType.startsWith("text/") || ["pdf", "doc", "docx", "txt", "rtf", "odt", "ppt", "pptx"].includes(extension)) return "document";
    return "other";
}
