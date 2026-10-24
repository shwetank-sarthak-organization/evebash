"use client";

import React, { useState } from "react";
import { ArrowLeft, Check, Play } from "lucide-react";
import { HLSVideoPlayer } from "@/components/ui/HLSVideoPlayer";

// Top of the gallery section in the Classic White design (styles in src/app/classic-white.css): Back / Share, the
// gallery title in large capitals, date and place, the [ Photos ] [ Videos ] switch, and on the right the gallery
// video in a white mat when the host picked one. Other themes keep the shared markup in the event page.

type MediaTab = "photos" | "videos";

export type ClassicGalleryVideo = {
    src: string;
    mediaId?: string;
    poster?: string;
};

interface ClassicGalleryHeaderProps {
    title: string;
    /** Date and place line under the title; left out when empty */
    details?: string;
    backLabel: string;
    onBack: () => void;
    onShare: () => void;
    copied?: boolean;
    photoCountLabel: string;
    videoCountLabel: string;
    activeTab: MediaTab;
    onTabChange: (tab: MediaTab) => void;
    /** Shown only when the host has chosen a gallery video for this page */
    video?: ClassicGalleryVideo | null;
}

function ClassicVideoFrame({ video, title }: { video: ClassicGalleryVideo; title: string }) {
    const [playing, setPlaying] = useState(false);

    return (
        <figure className="classic-gh__mat">
            <div className="classic-gh__screen">
                {playing ? (
                    <HLSVideoPlayer
                        src={video.src}
                        mediaId={video.mediaId}
                        poster={video.poster}
                        autoPlay
                        controls
                        playsInline
                        className="classic-gh__player"
                    />
                ) : (
                    <button type="button" className="classic-gh__start" onClick={() => setPlaying(true)} aria-label={`Play the ${title} video`}>
                        {video.poster && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={video.poster} alt="" className="classic-gh__poster" />
                        )}
                        <span className="classic-gh__play">
                            <Play className="classic-gh__play-icon" aria-hidden="true" />
                        </span>
                    </button>
                )}
            </div>
            <figcaption className="classic-gh__caption">Highlight film</figcaption>
        </figure>
    );
}

export function ClassicGalleryHeader({
    title,
    details,
    backLabel,
    onBack,
    onShare,
    copied,
    photoCountLabel,
    videoCountLabel,
    activeTab,
    onTabChange,
    video,
}: ClassicGalleryHeaderProps) {
    return (
        <section className={video ? "classic-gh classic-gh--video" : "classic-gh"} aria-label={`${title} gallery`}>
            <div className="classic-gh__text">
                <div className="classic-gh__actions">
                    <button type="button" onClick={onBack} className="classic-gh__action">
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        {backLabel}
                    </button>
                    <button type="button" onClick={onShare} className="classic-gh__action" aria-live="polite">
                        {copied && <Check className="h-4 w-4" aria-hidden="true" />}
                        {copied ? "Link copied" : "Share Event"}
                    </button>
                </div>

                <h2 className="classic-gh__title">{title}</h2>
                {details && <p className="classic-gh__details">{details}</p>}

                <div className="classic-gh__tabs" role="group" aria-label="Photos or videos">
                    {([
                        { id: "photos", label: `Photos (${photoCountLabel})` },
                        { id: "videos", label: `Videos (${videoCountLabel})` },
                    ] as const).map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            aria-pressed={activeTab === tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className="classic-gh__tab"
                        >
                            <span aria-hidden="true">[</span>
                            {tab.label}
                            <span aria-hidden="true">]</span>
                        </button>
                    ))}
                </div>
            </div>

            {video && <ClassicVideoFrame video={video} title={title} />}
        </section>
    );
}
