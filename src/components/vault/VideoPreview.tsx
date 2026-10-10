"use client";

import { useRef, useState } from "react";
import { vaultApi } from "@/lib/vaultApi";

const MAX_LINK_REFRESHES = 3;

/**
 * Plays an MP4 straight from storage. The browser keeps requesting more of the file as it plays, so if
 * the signed link expires mid-session (a long pause, a very long video), this fetches a fresh link and
 * resumes from the same moment instead of failing.
 */
export function VideoPreview({ itemId, initialUrl, onError }: { itemId: string; initialUrl: string; onError: (message: string) => void }) {
    const [url, setUrl] = useState(initialUrl);
    const videoRef = useRef<HTMLVideoElement>(null);
    const refreshes = useRef(0);
    const resume = useRef<{ time: number; playing: boolean } | null>(null);

    const handleError = async () => {
        const video = videoRef.current;
        if (!video || refreshes.current >= MAX_LINK_REFRESHES) {
            onError("This video couldn't be played. You can still download it.");
            return;
        }
        refreshes.current += 1;
        resume.current = { time: video.currentTime, playing: !video.paused };
        try {
            const { url: fresh } = await vaultApi.link(itemId, "view");
            setUrl(fresh);
        } catch {
            onError("This video couldn't be played. You can still download it.");
        }
    };

    const handleLoadedMetadata = () => {
        const video = videoRef.current;
        const saved = resume.current;
        if (!video || !saved) return;
        resume.current = null;
        video.currentTime = saved.time;
        if (saved.playing) void video.play().catch(() => null);
    };

    return (
        <video
            ref={videoRef}
            src={url}
            controls
            playsInline
            preload="metadata"
            onError={() => void handleError()}
            onLoadedMetadata={handleLoadedMetadata}
            className="mx-auto max-h-[80vh] w-full rounded-lg bg-black"
        />
    );
}
