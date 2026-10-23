"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Image as ImageIcon, Loader2, Trash2, Video, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { getApiUrl } from "@/lib/apiBase";

// Event uploads live here, above the pages, so moving to another page of the website doesn't
// lose the queue, the panel, the Cancel buttons or the "don't leave" warning (issue #78).
// The host page starts uploads and fills the queue; the upload work itself keeps running after
// the host page unmounts, and now updates this queue instead of state that no longer exists.

export interface UploadQueueItem {
    id: string;
    fileName: string;
    status: "pending" | "uploading" | "finalizing" | "cancelling" | "cancelled" | "processing" | "success" | "error";
    progress: number; // 0 to 100
    error?: string;
    mediaType?: "photo" | "video";
    storageKey?: string;
    photoId?: string;
    eventId?: string;
}

export interface IndexingStatus {
    total: number;
    indexed: number;
    photosWithFaces?: number;
    photosWithoutFaces?: number;
    pending: number;
    percentComplete: number;
    status: string;
}

type VideoReadyListener = (rows: any[]) => void;

/** One photo or video being deleted, shown in the delete panel next to the upload panel */
export interface DeleteQueueItem {
    id: string;
    name: string;
    mediaType: "photo" | "video";
    status: "deleting" | "deleted" | "error";
}

/** "1 photo", "3 videos", "2 photos and 1 video" */
export function describeMediaCount(items: { mediaType: "photo" | "video" }[]) {
    const photos = items.filter(item => item.mediaType !== "video").length;
    const videos = items.length - photos;
    const part = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
    if (photos && videos) return `${part(photos, "photo")} and ${part(videos, "video")}`;
    return videos ? part(videos, "video") : part(photos, "photo");
}

interface UploadContextType {
    uploadQueue: UploadQueueItem[];
    setUploadQueue: React.Dispatch<React.SetStateAction<UploadQueueItem[]>>;
    uploadControllers: React.MutableRefObject<Map<string, AbortController>>;
    showUploadPanel: () => void;
    // Called with the processing records of uploaded videos once they are ready; returns an unsubscribe
    onVideosReady: (listener: VideoReadyListener) => () => void;
    /** Deletes the items 4 at a time with deleteOne, showing them in the delete panel; resolves with the ids deleted */
    runDeletes: (items: Omit<DeleteQueueItem, "status">[], deleteOne: (id: string) => Promise<boolean>) => Promise<Set<string>>;
    /** Ids being deleted right now, so the gallery can show "Deleting..." over them */
    deletingIds: Set<string>;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

const isUnfinished = (item: UploadQueueItem) =>
    item.status === "pending" || item.status === "uploading" || item.status === "processing" || item.status === "finalizing" || item.status === "cancelling";

export function UploadProvider({ children }: { children: React.ReactNode }) {
    const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
    const uploadControllers = useRef(new Map<string, AbortController>());
    const [isUploadPanelOpen, setIsUploadPanelOpen] = useState(false);
    const [isUploadPanelMinimized, setIsUploadPanelMinimized] = useState(false);
    const [indexingStatus, setIndexingStatus] = useState<IndexingStatus | null>(null);
    const uploadQueueRef = useRef<UploadQueueItem[]>([]);
    const videoReadyListeners = useRef(new Set<VideoReadyListener>());
    const [deleteQueue, setDeleteQueue] = useState<DeleteQueueItem[]>([]);
    const [isDeletePanelMinimized, setIsDeletePanelMinimized] = useState(false);
    const deleteClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        uploadQueueRef.current = uploadQueue;
    }, [uploadQueue]);

    const cancelUpload = (id: string) => {
        const controller = uploadControllers.current.get(id);
        if (!controller || controller.signal.aborted) return;
        controller.abort();
        // A queued file has nothing in flight, so it is cancelled at once; its worker skips it when it gets there
        setUploadQueue(previous => previous.map(item => item.id === id ? { ...item, status: item.status === "pending" ? "cancelled" : "cancelling" } : item));
    };
    const cancelAllUploads = () => {
        for (const id of uploadControllers.current.keys()) cancelUpload(id);
    };

    const showUploadPanel = useCallback(() => {
        setIsUploadPanelOpen(true);
        setIsUploadPanelMinimized(false);
    }, []);

    const runDeletes = useCallback(async (items: Omit<DeleteQueueItem, "status">[], deleteOne: (id: string) => Promise<boolean>) => {
        const deleted = new Set<string>();
        if (items.length === 0) return deleted;
        if (deleteClearTimer.current) clearTimeout(deleteClearTimer.current);
        setIsDeletePanelMinimized(false);
        // A new batch replaces finished rows but keeps any still being deleted
        setDeleteQueue(previous => [
            ...previous.filter(item => item.status === "deleting" && !items.some(next => next.id === item.id)),
            ...items.map(item => ({ ...item, status: "deleting" as const })),
        ]);
        const setStatus = (id: string, status: DeleteQueueItem["status"]) =>
            setDeleteQueue(previous => previous.map(item => item.id === id ? { ...item, status } : item));
        let next = 0;
        const worker = async () => {
            while (next < items.length) {
                const item = items[next++];
                let ok = false;
                try { ok = await deleteOne(item.id); } catch { ok = false; }
                if (ok) deleted.add(item.id);
                setStatus(item.id, ok ? "deleted" : "error");
            }
        };
        await Promise.all(Array.from({ length: Math.min(4, items.length) }, worker));
        // A clean batch closes itself after a few seconds; failures stay until the host closes the panel
        if (deleted.size === items.length) {
            deleteClearTimer.current = setTimeout(() => setDeleteQueue(previous => previous.filter(item => item.status === "deleting")), 5000);
        }
        return deleted;
    }, []);

    const deletingIds = React.useMemo(() => new Set(deleteQueue.filter(item => item.status === "deleting").map(item => item.id)), [deleteQueue]);

    const onVideosReady = useCallback((listener: VideoReadyListener) => {
        videoReadyListeners.current.add(listener);
        return () => { videoReadyListeners.current.delete(listener); };
    }, []);

    // Warn user before closing/refreshing tab during active uploads
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (uploadQueue.some(isUnfinished) || deleteQueue.some(item => item.status === "deleting")) {
                e.preventDefault();
                e.returnValue = "You have active uploads in progress. If you leave or reload now, these uploads will be cancelled.";
                return e.returnValue;
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, [uploadQueue, deleteQueue]);

    // Video readiness comes from its processing record, never thumbnail or face-index completion.
    const pendingVideoIds = uploadQueue.filter(item => item.mediaType === "video" && item.status === "processing" && item.photoId).map(item => item.photoId!).join(",");
    useEffect(() => {
        if (!pendingVideoIds) return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout>;
        const checkVideos = async () => {
            try {
                const ids = pendingVideoIds.split(",");
                const records: any[] = [];
                for (let start = 0; start < ids.length; start += 50) {
                    const { data, error } = await supabase.from("photos").select("*").in("id", ids.slice(start, start + 50));
                    if (error) throw error;
                    records.push(...(data || []));
                }
                if (cancelled) return;
                const byId = new Map(records.map(row => [row.id, row]));
                setUploadQueue(previous => previous.map(item => {
                    if (item.mediaType !== "video" || item.status !== "processing") return item;
                    const row = byId.get(item.photoId);
                    if (row?.status === "failed") return { ...item, status: "error", progress: 90, error: row.processing_error || "Video processing failed" };
                    if (row?.status === "processed" && row.url) return { ...item, status: "success", progress: 100 };
                    return item;
                }));
                const ready = records.filter(row => row.status === "processed" && row.url);
                if (ready.length) videoReadyListeners.current.forEach(listener => listener(ready));
            } catch (error) {
                console.warn("[VideoProcessing] Waiting for processing status", error);
            } finally {
                if (!cancelled) timer = setTimeout(checkVideos, 5000);
            }
        };
        void checkVideos();
        return () => { cancelled = true; clearTimeout(timer); };
    }, [pendingVideoIds]);

    // Poll face indexing status for the event of the latest upload while items are in queue
    const indexingEventId = uploadQueue[uploadQueue.length - 1]?.eventId;
    useEffect(() => {
        if (!indexingEventId || uploadQueue.length === 0) {
            setIndexingStatus(null);
            return;
        }

        let pollInterval: NodeJS.Timeout;

        const checkStatus = async () => {
            try {
                const res = await fetch(getApiUrl(`/api/v1/media/indexing-status?eventId=${indexingEventId}`));
                if (res.ok) {
                    const data = await res.json();
                    setIndexingStatus(data);

                    // Check if there are any items still actively uploading or pending in the queue
                    const hasActiveUploads = uploadQueueRef.current.some(item => item.status === "pending" || item.status === "uploading");

                    // Only stop polling when indexing is fully complete AND all file uploads have finished
                    if (data.status === "complete" && !hasActiveUploads) {
                        clearInterval(pollInterval);
                        // Mark all processing/pending items in the queue as success
                        setUploadQueue(prev => prev.map(item =>
                            item.mediaType !== "video" && (item.status === "processing" || item.status === "pending" || item.status === "uploading")
                                ? { ...item, status: "success", progress: 100 }
                                : item
                        ));
                    }
                }
            } catch (err) {
                console.error("[Dashboard] Error polling indexing status:", err);
            }
        };

        // Run immediately
        checkStatus();

        // Poll every 5 seconds
        pollInterval = setInterval(checkStatus, 5000);

        return () => {
            if (pollInterval) clearInterval(pollInterval);
        };
    }, [indexingEventId, uploadQueue.length]);

    const hasUnfinishedUploads = uploadQueue.some(isUnfinished);
    const totalItems = uploadQueue.length;
    const completedItems = uploadQueue.filter(item => item.status === "success" || item.status === "error" || item.status === "cancelled").length;
    const processingItems = uploadQueue.filter(item => item.status === "processing").length;
    const uploadingItems = uploadQueue.filter(item => item.status === "uploading" || item.status === "pending" || item.status === "finalizing" || item.status === "cancelling").length;

    let overallStatusText = "";
    if (uploadingItems > 0) {
        overallStatusText = `Uploading ${uploadingItems} of ${totalItems} ${uploadingItems === 1 ? 'file' : 'files'}...`;
    } else if (processingItems > 0) {
        overallStatusText = `Processing ${processingItems} ${processingItems === 1 ? 'file' : 'files'}...`;
    } else if (indexingStatus && indexingStatus.status === "processing") {
        overallStatusText = `AI Indexing: ${indexingStatus.indexed}/${indexingStatus.total} (${indexingStatus.percentComplete}%)`;
    } else if (completedItems === totalItems) {
        const failedItems = uploadQueue.filter(item => item.status === "error").length;
        const cancelledItems = uploadQueue.filter(item => item.status === "cancelled").length;
        overallStatusText = failedItems > 0 || cancelledItems > 0
            ? `${totalItems - failedItems - cancelledItems} ready · ${failedItems} failed · ${cancelledItems} cancelled`
            : `✓ 100% complete · ${totalItems} files ready`;
    } else {
        overallStatusText = "Upload status";
    }

    return (
        <UploadContext.Provider value={{ uploadQueue, setUploadQueue, uploadControllers, showUploadPanel, onVideosReady, runDeletes, deletingIds }}>
            {children}

            {/* Upload and delete panels share the bottom-right corner, the delete panel above */}
            <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex w-96 max-w-[calc(100vw-2rem)] flex-col items-stretch gap-3">
            <AnimatePresence>
                {deleteQueue.length > 0 && (() => {
                    const deleting = deleteQueue.filter(item => item.status === "deleting").length;
                    const failed = deleteQueue.filter(item => item.status === "error").length;
                    const done = deleteQueue.length - deleting;
                    const headline = deleting > 0
                        ? `Deleting ${describeMediaCount(deleteQueue)}... ${done} of ${deleteQueue.length} done`
                        : failed > 0
                            ? `${deleteQueue.length - failed} deleted · ${failed} couldn't be deleted`
                            : `✓ ${describeMediaCount(deleteQueue)} deleted`;
                    return (
                        <motion.div
                            key="delete-panel"
                            initial={{ opacity: 0, y: 50, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 50, scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            role="status"
                            aria-live="polite"
                            className="pointer-events-auto bg-slate-950/95 border border-slate-800 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden font-sans"
                        >
                            <div
                                role="button"
                                tabIndex={0}
                                aria-expanded={!isDeletePanelMinimized}
                                title={isDeletePanelMinimized ? "Expand" : "Minimize"}
                                onClick={() => setIsDeletePanelMinimized(!isDeletePanelMinimized)}
                                onKeyDown={(e) => {
                                    if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                                        e.preventDefault();
                                        setIsDeletePanelMinimized(!isDeletePanelMinimized);
                                    }
                                }}
                                className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 cursor-pointer select-none hover:bg-slate-800/70 transition-colors"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    {deleting > 0 ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-rose-300 shrink-0" />
                                    ) : failed > 0 ? (
                                        <X className="w-4 h-4 text-rose-400 shrink-0" />
                                    ) : (
                                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                                    )}
                                    <span className="text-xs font-bold text-slate-200 truncate">{headline}</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={() => setDeleteQueue(previous => previous.filter(item => item.status === "deleting"))}
                                        disabled={deleting > 0}
                                        className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                        title={deleting > 0 ? "Wait for the deletes to finish" : "Close"}
                                        aria-label="Close"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Overall progress: items finished out of all items */}
                            <div className="w-full h-1 bg-slate-900 overflow-hidden">
                                <div
                                    className={cn("h-full transition-all duration-300", failed > 0 && deleting === 0 ? "bg-rose-400" : deleting === 0 ? "bg-emerald-400" : "bg-rose-300")}
                                    style={{ width: `${(done / deleteQueue.length) * 100}%` }}
                                ></div>
                            </div>

                            <AnimatePresence initial={false}>
                                {!isDeletePanelMinimized && (
                                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                                        <div className="max-h-56 overflow-y-auto divide-y divide-slate-900">
                                            {deleteQueue.map(item => (
                                                <div key={item.id} className="flex items-center justify-between gap-3 p-3">
                                                    <div className="w-10 h-10 rounded-lg border border-slate-800 bg-slate-900 flex items-center justify-center shrink-0">
                                                        {item.mediaType === "video" ? <Video className="w-5 h-5 text-sky-400" /> : <ImageIcon className="w-5 h-5 text-[#CA9C68]" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-slate-300 truncate" title={item.name}>{item.name}</p>
                                                        <p className={cn("text-[10px] font-bold", item.status === "deleting" ? "text-rose-300 animate-pulse" : item.status === "deleted" ? "text-emerald-400" : "text-rose-400")}>
                                                            {item.status === "deleting" ? `Deleting ${item.mediaType}...` : item.status === "deleted" ? "Deleted" : "Couldn't delete. Please try again."}
                                                        </p>
                                                    </div>
                                                    <div className="shrink-0">
                                                        {item.status === "deleting" && <Trash2 className="w-4 h-4 text-rose-300 animate-pulse" />}
                                                        {item.status === "deleted" && <Check className="w-4 h-4 text-emerald-400" />}
                                                        {item.status === "error" && <X className="w-4 h-4 text-rose-400" />}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    );
                })()}
            </AnimatePresence>

            {/* Floating Upload Queue Panel (Google Drive style) */}
            <AnimatePresence>
                {(isUploadPanelOpen || hasUnfinishedUploads) && uploadQueue.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="pointer-events-auto bg-slate-950/95 border border-slate-800 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden font-sans"
                    >
                        {/* Header */}
                        <div
                            role="button"
                            tabIndex={0}
                            aria-expanded={!isUploadPanelMinimized}
                            title={isUploadPanelMinimized ? "Expand" : "Minimize"}
                            onClick={() => setIsUploadPanelMinimized(!isUploadPanelMinimized)}
                            onKeyDown={(e) => {
                                if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                                    e.preventDefault();
                                    setIsUploadPanelMinimized(!isUploadPanelMinimized);
                                }
                            }}
                            className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 cursor-pointer select-none hover:bg-slate-800/70 transition-colors"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                {(uploadingItems > 0 || processingItems > 0) ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-[#CA9C68] shrink-0" />
                                ) : (
                                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                                )}
                                <span className="text-xs font-bold text-slate-200 truncate">
                                    {overallStatusText}
                                </span>
                            </div>
                            {/* Buttons here act on their own and don't minimize the panel */}
                            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                {uploadQueue.some(item => item.status === "pending" || item.status === "uploading") && (
                                    <button type="button" onClick={cancelAllUploads} className="px-2 py-1 text-xs text-rose-300 hover:text-white">Cancel all uploads</button>
                                )}
                                {completedItems === totalItems && (
                                    <button
                                        onClick={() => setUploadQueue([])}
                                        className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-800 transition-colors"
                                    >
                                        Clear
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsUploadPanelOpen(false)}
                                    disabled={hasUnfinishedUploads}
                                    className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    title={hasUnfinishedUploads ? "Video uploads and processing must finish before closing" : "Close"}
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Overall progress bar at the very bottom of minimized header */}
                        {isUploadPanelMinimized && (uploadingItems > 0 || processingItems > 0 || (indexingStatus && indexingStatus.status === "processing")) && (
                            <div className="w-full h-1 bg-slate-900 overflow-hidden relative">
                                <div
                                    className="h-full bg-gradient-to-r from-[#CA9C68] to-sky-500 transition-all duration-300"
                                    style={{
                                        width: `${
                                            processingItems === 0 && uploadingItems === 0 && indexingStatus && indexingStatus.status === "processing"
                                                ? indexingStatus.percentComplete
                                                : (uploadQueue.reduce((acc, curr) => acc + curr.progress, 0) / (totalItems * 100)) * 100
                                        }%`
                                    }}
                                ></div>
                            </div>
                        )}

                        {/* Body (List of items) */}
                        <AnimatePresence initial={false}>
                            {!isUploadPanelMinimized && (
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: "auto" }}
                                    exit={{ height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-900">
                                        {uploadQueue.map((item) => (
                                            <div
                                                key={item.id}
                                                className="flex items-center justify-between gap-3 p-3 hover:bg-slate-900/50 transition-colors"
                                            >
                                                {/* File Preview Icon */}
                                                <div className="w-10 h-10 rounded-lg border border-slate-800 bg-slate-900 flex items-center justify-center shrink-0">
                                                    {item.mediaType === "video" ? (
                                                        <Video className="w-5 h-5 text-sky-400" />
                                                    ) : (
                                                        <ImageIcon className="w-5 h-5 text-[#CA9C68]" />
                                                    )}
                                                </div>

                                                {/* File Details & Progress */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2 mb-1">
                                                        <p className="text-xs font-bold text-slate-300 truncate" title={item.fileName}>
                                                            {item.fileName}
                                                        </p>
                                                        {item.status === "pending" && (
                                                            <span className="text-[10px] font-bold text-slate-500 shrink-0">
                                                                Queued...
                                                            </span>
                                                        )}
                                                        {item.status === "uploading" && (
                                                            <span className="text-[10px] font-bold text-[#CA9C68] shrink-0">
                                                                {item.progress}%
                                                            </span>
                                                        )}
                                                        {(item.status === "finalizing" || item.status === "cancelling" || item.status === "cancelled") && (
                                                            <span className="text-[10px] text-slate-300">{item.status === "finalizing" ? "Finalizing..." : item.status === "cancelling" ? "Cancelling..." : "Cancelled"}</span>
                                                        )}
                                                        {item.status === "processing" && (
                                                            <span className="text-[10px] font-bold text-sky-400 shrink-0 animate-pulse">
                                                                {item.mediaType === "video" ? "Processing video..." : indexingStatus && indexingStatus.status === "processing" ? "Indexing..." : "Resizing..."}
                                                            </span>
                                                        )}
                                                        {item.status === "success" && (
                                                            <span className="text-[10px] font-bold text-emerald-400 shrink-0">
                                                                {item.mediaType === "video" ? "100% · Ready" : "Done"}
                                                            </span>
                                                        )}
                                                        {item.status === "error" && (
                                                            <span className="text-[10px] font-bold text-rose-400 shrink-0 truncate max-w-[80px]">
                                                                Error
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Progress bar */}
                                                    <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                                                        <div
                                                            className={cn(
                                                                "h-full rounded-full transition-all duration-300",
                                                                item.status === "pending" ? "bg-slate-700" :
                                                                item.status === "uploading" ? "bg-[#CA9C68]" :
                                                                item.status === "processing" ? "bg-sky-400 animate-pulse" :
                                                                item.status === "success" ? "bg-emerald-400" : "bg-rose-400"
                                                            )}
                                                            style={{
                                                                width: item.status === "pending" ? "0%" : item.status === "processing" ? "90%" : `${item.progress}%`
                                                            }}
                                                        ></div>
                                                    </div>
                                                </div>

                                                {(item.status === "pending" || item.status === "uploading") && (
                                                    <button type="button" onClick={() => cancelUpload(item.id)} title={`Cancel upload: ${item.fileName}`} aria-label={`Cancel upload: ${item.fileName}`} className="rounded p-2 text-rose-300 hover:bg-rose-500/10"><X className="h-4 w-4" /></button>
                                                )}
                                                {/* Status Icon */}
                                                <div className="shrink-0">
                                                    {item.status === "uploading" && (
                                                        <Loader2 className="w-4 h-4 animate-spin text-[#CA9C68]" />
                                                    )}
                                                    {item.status === "processing" && (
                                                        <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                                                    )}
                                                    {item.status === "success" && (
                                                        <Check className="w-4 h-4 text-emerald-400" />
                                                    )}
                                                    {item.status === "error" && (
                                                        <div title={item.error}>
                                                            <X className="w-4 h-4 text-rose-400" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>
            </div>
        </UploadContext.Provider>
    );
}

export function useUploads() {
    const context = useContext(UploadContext);
    if (context === undefined) {
        throw new Error("useUploads must be used within an UploadProvider");
    }
    return context;
}
