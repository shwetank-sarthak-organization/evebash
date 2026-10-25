"use client";

import React, { useState } from "react";
import { Check, ChevronLeft, Play, Share2 } from "lucide-react";
import { HLSVideoPlayer } from "@/components/ui/HLSVideoPlayer";
import { coupleInitials } from "../../../shared/text/coupleNames";
import { RoyalCrest, RoyalPlaqueCorner, RoyalTitleRule } from "@/components/royal/RoyalOrnaments";

// Top of the gallery section in the Royal Emerald design (styles in src/app/royal-emerald.css):
// crest, title between gold rules, the gallery video (when the host picked one), Back / welcome plaque / Share,
// then the Photos / Videos switch. Other themes keep the shared markup in the event page.

export type RoyalGalleryVideo = {
    src: string;
    rawSrc?: string;
    mediaId?: string;
    poster?: string;
};

type MediaTab = "photos" | "videos";

interface RoyalGalleryHeaderProps {
    title: string;
    /** The gallery's description: the host's welcome message, shown on the plaque */
    message?: string;
    /** Main gallery title, for the initials on the crest; leave out on album pages (the crest shows a fleur-de-lis) */
    coupleTitle?: string;
    backLabel: string;
    onBack: () => void;
    onShare: () => void;
    copied?: boolean;
    photoCountLabel: string;
    videoCountLabel: string;
    activeTab: MediaTab;
    onTabChange: (tab: MediaTab) => void;
    /** Shown only when the host has chosen a gallery video for this page */
    video?: RoyalGalleryVideo | null;
}

const PLAQUE_CORNERS = ["tl", "tr", "bl", "br"] as const;

function RoyalVideoFrame({ video, title }: { video: RoyalGalleryVideo; title: string }) {
    const [playing, setPlaying] = useState(false);

    return (
        <div className="royal-video">
            <div className="royal-video__screen">
                {playing ? (
                    <HLSVideoPlayer
                        src={video.src}
                        rawSrc={video.rawSrc}
                        mediaId={video.mediaId}
                        poster={video.poster}
                        autoPlay
                        controls
                        playsInline
                        className="royal-video__player"
                    />
                ) : (
                    <button type="button" className="royal-video__start" onClick={() => setPlaying(true)} aria-label={`Play the ${title} video`}>
                        {video.poster && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={video.poster} alt="" className="royal-video__poster" />
                        )}
                        <span className="royal-video__play">
                            <Play className="royal-video__play-icon" aria-hidden="true" />
                        </span>
                    </button>
                )}
            </div>
        </div>
    );
}

export function RoyalGalleryHeader({
    title,
    message,
    coupleTitle,
    backLabel,
    onBack,
    onShare,
    copied,
    photoCountLabel,
    videoCountLabel,
    activeTab,
    onTabChange,
    video,
}: RoyalGalleryHeaderProps) {
    const initials = coupleTitle ? coupleInitials(coupleTitle) : null;
    const welcome = message?.trim();

    return (
        <section className="royal-gh" aria-label={`${title} gallery`}>
            <RoyalCrest initials={initials} className="royal-gh__crest" />

            <div className="royal-gh__title-row">
                <RoyalTitleRule className="royal-gh__rule" />
                <h2 className="royal-gh__title">{title}</h2>
                <RoyalTitleRule className="royal-gh__rule royal-gh__rule--right" />
            </div>

            {video && <RoyalVideoFrame video={video} title={title} />}

            <div className={welcome ? "royal-gh__bar" : "royal-gh__bar royal-gh__bar--no-message"}>
                <button type="button" onClick={onBack} className="royal-gh__side royal-gh__back" aria-label={backLabel} title={backLabel}>
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    Back
                </button>

                {welcome && (
                    <div className="royal-plaque">
                        <div className="royal-plaque__panel" aria-hidden="true" />
                        {PLAQUE_CORNERS.map((corner) => (
                            <RoyalPlaqueCorner key={corner} className={`royal-plaque__corner royal-plaque__corner--${corner}`} />
                        ))}
                        <p className="royal-plaque__text">{welcome}</p>
                    </div>
                )}

                <button type="button" onClick={onShare} className="royal-gh__side royal-gh__share" aria-live="polite">
                    {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Share2 className="h-4 w-4" aria-hidden="true" />}
                    {copied ? "Link copied" : "Share"}
                </button>
            </div>

            <div className="royal-gh__tabs" role="group" aria-label="Photos or videos">
                {([
                    { id: "photos", label: `Photos (${photoCountLabel})` },
                    { id: "videos", label: `Videos (${videoCountLabel})` },
                ] as const).map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        aria-pressed={activeTab === tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className="royal-gh__tab"
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
        </section>
    );
}
