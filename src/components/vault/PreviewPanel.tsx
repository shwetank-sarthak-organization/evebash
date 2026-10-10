"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, X } from "lucide-react";
import { vaultApi, type VaultItem } from "@/lib/vaultApi";
import { formatBytes, formatDateTime, previewKind } from "./format";
import { FileTypeIcon } from "./FileTypeIcon";
import { PdfPreview } from "./PdfPreview";
import { VideoPreview } from "./VideoPreview";

const TEXT_PREVIEW_BYTES = 1024 * 1024;

export function PreviewPanel({ item, onClose, onDownload }: { item: VaultItem; onClose: () => void; onDownload: (item: VaultItem) => void }) {
    const kind = previewKind(item.mimeType, item.extension);
    const [url, setUrl] = useState<string | null>(null);
    const [text, setText] = useState<string | null>(null);
    const [truncated, setTruncated] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const showError = useCallback((message: string) => setError(message), []);

    useEffect(() => {
        // The parent remounts this panel per file (key={item.id}), so state starts empty.
        let cancelled = false;
        if (kind === "none") return;
        vaultApi.link(item.id, "view")
            .then(async ({ url: signed }) => {
                if (cancelled) return;
                if (kind !== "text") return setUrl(signed);
                // Only the first 1 MB of text is shown, so huge logs or CSVs don't freeze the page.
                const response = await fetch(signed, { headers: { Range: `bytes=0-${TEXT_PREVIEW_BYTES - 1}` } });
                const body = await response.text();
                if (!cancelled) {
                    setText(body);
                    setTruncated(item.sizeBytes > TEXT_PREVIEW_BYTES);
                }
            })
            .catch((err: Error) => !cancelled && setError(err.message || "This file couldn't be previewed."));
        return () => {
            cancelled = true;
        };
    }, [item.id, item.sizeBytes, kind]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const loading = kind !== "none" && !error && !url && text === null;

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90" role="dialog" aria-modal="true" aria-label={`Preview of ${item.filename}`}>
            <header className="flex items-center gap-3 border-b border-white/10 bg-[#0E1318] px-4 py-3">
                <FileTypeIcon mimeType={item.mimeType} extension={item.extension} className="h-5 w-5 shrink-0 text-[#7FA38C]" />
                <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white">{item.filename}</p>
                    <p className="text-xs text-slate-400">{formatBytes(item.sizeBytes)}</p>
                </div>
                <button type="button" onClick={() => onDownload(item)} className="flex items-center gap-2 rounded-full bg-[#CA9C68] px-4 py-2 text-sm font-semibold text-[#13191F] hover:bg-[#D9AE7E]">
                    <Download className="h-4 w-4" aria-hidden />
                    <span className="hidden sm:inline">Download</span>
                </button>
                <button type="button" onClick={onClose} aria-label="Close preview" className="rounded-full p-2 text-slate-300 hover:bg-white/10 hover:text-white">
                    <X className="h-5 w-5" />
                </button>
            </header>

            <div className="flex-1 overflow-auto p-4">
                <div className="mx-auto max-w-4xl">
                    {loading && (
                        <div className="flex items-center justify-center gap-2 py-24 text-slate-400">
                            <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Loading preview…
                        </div>
                    )}

                    {error || kind === "none" ? (
                        <div className="mx-auto mt-12 max-w-md rounded-2xl border border-white/10 bg-[#141B22] p-6 text-center">
                            <FileTypeIcon mimeType={item.mimeType} extension={item.extension} className="mx-auto h-12 w-12 text-[#7FA38C]" />
                            <p className="mt-4 break-words font-semibold text-white">{item.filename}</p>
                            <dl className="mt-4 grid grid-cols-2 gap-2 text-left text-sm">
                                <dt className="text-slate-400">Type</dt><dd className="truncate text-slate-200">{item.extension ? item.extension.toUpperCase() : item.mimeType}</dd>
                                <dt className="text-slate-400">Size</dt><dd className="text-slate-200">{formatBytes(item.sizeBytes)}</dd>
                                <dt className="text-slate-400">Modified</dt><dd className="text-slate-200">{formatDateTime(item.updatedAt)}</dd>
                            </dl>
                            <p className="mt-4 text-sm text-slate-400">{error ?? "A preview isn't available for this file type."}</p>
                            <button type="button" onClick={() => onDownload(item)} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#CA9C68] px-5 py-2.5 text-sm font-semibold text-[#13191F]">
                                <Download className="h-4 w-4" aria-hidden /> Download
                            </button>
                        </div>
                    ) : kind === "image" && url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={item.filename} className="mx-auto max-h-[80vh] w-auto rounded-lg object-contain" />
                    ) : kind === "video" && url ? (
                        <VideoPreview itemId={item.id} initialUrl={url} onError={showError} />
                    ) : kind === "pdf" && url ? (
                        <PdfPreview url={url} onError={showError} />
                    ) : kind === "text" && text !== null ? (
                        <div>
                            <pre className="overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[#141B22] p-4 font-mono text-sm leading-relaxed text-slate-200">{text}</pre>
                            {truncated && <p className="mt-3 text-center text-sm text-slate-400">Showing the first 1 MB. Download the file to see all of it.</p>}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
