"use client";

import React, { useEffect, useRef, useState } from "react";
import { Clapperboard, EyeOff, Loader2, Play, Upload, X } from "lucide-react";
import { Event, Photo, getGalleryVideos } from "@/lib/database";
import { cn } from "@/lib/utils";
import { ModalHeader, modalStyles } from "@/components/ui/Modal";

// Host page, under a gallery's Welcome Message: the video that plays at the top of that gallery's guest page
// (events.gallery_video_id). The host uploads one straight into the gallery, or picks one of its existing videos.

const panelButton = "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50";
const goldButton = cn(panelButton, "bg-[#CA9C68] text-slate-950 hover:bg-[#D7AE7D]");
const outlineButton = cn(panelButton, "border border-[#CA9C68]/45 text-[#F5E7D4] hover:bg-[#CA9C68]/10");

function VideoThumb({ video, className }: { video?: Photo; className?: string }) {
    return (
        <span className={cn("relative block aspect-video overflow-hidden rounded-xl border border-[#CA9C68]/45 bg-slate-900", className)}>
            {video?.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={video.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            )}
            {video?.isHidden && (
                <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/75 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                    <EyeOff className="h-3 w-3" aria-hidden="true" />
                    Hidden
                </span>
            )}
            {video && video.status !== "processed" && (
                <span className="absolute inset-x-0 bottom-2 mx-auto flex w-fit items-center gap-1.5 rounded-full bg-slate-950/85 px-2.5 py-1 text-[11px] font-semibold text-[#F5E7D4]">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    Processing
                </span>
            )}
        </span>
    );
}

function GalleryVideoChooser({ videos, currentId, onChoose, onClose }: {
    videos: Photo[];
    currentId: string | null;
    onChoose: (videoId: string) => void;
    onClose: () => void;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => { const focused = document.activeElement as HTMLElement | null; ref.current?.showModal(); return () => focused?.focus(); }, []);
    return (
        <dialog ref={ref} onCancel={e => { e.preventDefault(); onClose(); }} aria-labelledby="gallery-video-chooser-title" className={cn(modalStyles.dialog, "max-w-2xl")}>
            <ModalHeader titleId="gallery-video-chooser-title" title="Choose the cinematic highlight video" onClose={onClose} />
            <p className={cn(modalStyles.body, "mb-4")}>Videos uploaded to this gallery, newest first.</p>
            <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
                {videos.map((video) => (
                    <button
                        key={video.id}
                        type="button"
                        aria-pressed={video.id === currentId}
                        onClick={() => onChoose(video.id)}
                        className={cn(
                            "rounded-2xl p-1 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#CA9C68]",
                            video.id === currentId ? "bg-[#CA9C68]/25 ring-2 ring-[#CA9C68]" : "hover:bg-white/5"
                        )}
                    >
                        <VideoThumb video={video} />
                        <span className="mt-1.5 block truncate px-1 text-xs text-slate-300">
                            {video.id === currentId ? "Current cinematic highlight video" : video.storageKey?.split("/").pop() || "Video"}
                        </span>
                    </button>
                ))}
            </div>
            <button type="button" onClick={onClose} className={cn(modalStyles.secondary, "mt-4 w-full")}>Cancel</button>
        </dialog>
    );
}

export function GalleryVideoPanel({ gallery, canUpload, onUpload, onChange, onPlay }: {
    gallery: Event;
    /** Event owner and event admins only, like the rest of video uploading */
    canUpload: boolean;
    /** Uploads the file into this gallery; the host page makes it the gallery video once its row is saved */
    onUpload: (file: File) => void;
    onChange: (videoId: string | null) => Promise<void>;
    onPlay: (video: Photo) => void;
}) {
    const chosenId = gallery.galleryVideoId || null;
    const [loaded, setLoaded] = useState<{ galleryId: string; videos: Photo[] } | null>(null);
    const [refreshTick, setRefreshTick] = useState(0);
    const [choosing, setChoosing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [pendingUpload, setPendingUpload] = useState<{ galleryId: string; fileName: string; before: string | null } | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let cancelled = false;
        void getGalleryVideos(gallery.id, gallery.legacyId).then((videos) => {
            if (!cancelled) setLoaded({ galleryId: gallery.id, videos });
        });
        return () => { cancelled = true; };
    }, [gallery.id, gallery.legacyId, chosenId, refreshTick]);

    const videos = loaded?.galleryId === gallery.id ? loaded.videos : null;
    const usableVideos = (videos || []).filter((video) => video.status !== "failed");
    const chosen = videos?.find((video) => video.id === chosenId);
    const chosenReady = chosen?.status === "processed";
    // Still uploading: shown until the new video becomes the gallery video
    const isUploading = pendingUpload?.galleryId === gallery.id && pendingUpload.before === chosenId;

    // A freshly uploaded video is still being processed: look again every 15 s until it's ready
    useEffect(() => {
        if (!chosen || chosenReady) return;
        const timer = window.setInterval(() => setRefreshTick((tick) => tick + 1), 15000);
        return () => window.clearInterval(timer);
    }, [chosen, chosenReady]);

    const change = async (videoId: string | null) => {
        setSaving(true);
        await onChange(videoId);
        setSaving(false);
        setChoosing(false);
    };

    const pickFile = () => fileInput.current?.click();

    return (
        <div className="mb-6 rounded-2xl border border-[#CA9C68]/55 bg-slate-950/40 p-4 sm:p-5">
            <p className="text-base font-semibold text-white">Cinematic Highlight Video</p>
            <p className="mb-4 mt-1 text-sm text-slate-400">
                Plays at the top of this gallery for guests. Usually the photographer&apos;s 3-6 minute summary film of the
                event.
            </p>

            {chosenId ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <button
                        type="button"
                        disabled={!chosenReady}
                        onClick={() => chosen && onPlay(chosen)}
                        aria-label="Play the cinematic highlight video"
                        className="group relative w-full shrink-0 sm:w-60"
                    >
                        <VideoThumb video={chosen} />
                        {chosenReady && (
                            <span className="absolute inset-0 grid place-items-center">
                                <span className="grid h-11 w-11 place-items-center rounded-full bg-[#CA9C68]/90 text-slate-950 shadow-lg transition-transform group-hover:scale-105">
                                    <Play className="ml-0.5 h-5 w-5 fill-current" aria-hidden="true" />
                                </span>
                            </span>
                        )}
                    </button>
                    <div className="flex flex-1 flex-col gap-3">
                        <p className="text-sm text-slate-300">
                            {!videos ? "Loading..." : !chosen
                                ? "This video is no longer in this gallery, so guests don't see it. Choose another one."
                                : chosen.isHidden ? "This video is hidden from guests, so they don't see it until you show it again."
                                : chosenReady ? "Guests see this video at the top of the gallery."
                                : "Processing: guests will see it once it's ready."}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <button type="button" disabled={saving || usableVideos.length === 0} onClick={() => setChoosing(true)} className={outlineButton}>
                                Change
                            </button>
                            {canUpload && (
                                <button type="button" disabled={saving || isUploading} onClick={pickFile} className={outlineButton}>
                                    <Upload className="h-4 w-4" aria-hidden="true" />
                                    Upload new
                                </button>
                            )}
                            <button
                                type="button"
                                disabled={saving}
                                onClick={() => void change(null)}
                                className={cn(outlineButton, "border-rose-400/40 text-rose-300 hover:bg-rose-400/10")}
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <X className="h-4 w-4" aria-hidden="true" />}
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[#CA9C68]/40 px-4 py-6 text-center">
                    <Clapperboard className="h-7 w-7 text-[#CA9C68]" aria-hidden="true" />
                    <p className="text-sm text-slate-300">No cinematic highlight video yet.</p>
                    <div className="flex flex-wrap justify-center gap-2">
                        {canUpload && (
                            <button type="button" disabled={isUploading} onClick={pickFile} className={goldButton}>
                                <Upload className="h-4 w-4" aria-hidden="true" />
                                Upload video
                            </button>
                        )}
                        <button type="button" disabled={!videos || usableVideos.length === 0} onClick={() => setChoosing(true)} className={outlineButton}>
                            Choose from this gallery&apos;s videos ({usableVideos.length})
                        </button>
                    </div>
                    {!canUpload && <p className="text-xs text-slate-500">Only the event owner and event admins can upload videos.</p>}
                </div>
            )}

            {isUploading && (
                <p className="mt-3 flex items-center gap-2 text-sm text-[#E2B77F]">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                        Uploading &quot;{pendingUpload?.fileName}&quot;. It becomes the cinematic highlight video once it&apos;s saved; progress shows in the upload panel.
                    </span>
                    <button type="button" onClick={() => setPendingUpload(null)} aria-label="Hide this note" className="rounded p-1 text-slate-400 hover:text-white">
                        <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                </p>
            )}

            <input
                ref={fileInput}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    setPendingUpload({ galleryId: gallery.id, fileName: file.name, before: chosenId });
                    onUpload(file);
                }}
            />

            {choosing && (
                <GalleryVideoChooser
                    videos={usableVideos}
                    currentId={chosenId}
                    onChoose={(videoId) => void change(videoId)}
                    onClose={() => setChoosing(false)}
                />
            )}
        </div>
    );
}
