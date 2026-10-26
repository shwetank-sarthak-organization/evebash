"use client";

import React, { useState } from "react";
import { ArrowLeft, Check, Play, Share2 } from "lucide-react";
import { HLSVideoPlayer } from "@/components/ui/HLSVideoPlayer";
import type { ClassicGalleryVideo } from "@/components/classic/ClassicGalleryHeader";

// Top of the gallery section in the Sunlit Portrait design (styles in src/app/sunlit-portrait.css). With a gallery video
// the opening fills one screen like the cover (below the navbar): the video edge to edge with Back / Share on its top
// edge, the date, gallery name and host's message at the bottom left and a play button at the bottom right. Without a
// video, Back / Share sit on a thin line on paper with the name and message under it. The Photos / Videos switch, marked
// with the navbar's dot, comes next.

type MediaTab = "photos" | "videos";

interface PortraitGalleryHeaderProps {
    title: string;
    /** Date and place line above the title; left out when empty */
    details?: string;
    /** The host's gallery message (description); left out when empty */
    message?: string;
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

/** Date, gallery name and message: over the film, or on paper when there is none */
function PortraitIntro({ title, details, quote }: { title: string; details?: string; quote?: string }) {
    return (
        <div className="portrait-gh__intro">
            {details && <p className="portrait-gh__details">{details}</p>}
            <h2 className="portrait-gh__title">{title}</h2>
            {quote && <p className="portrait-gh__quote">&ldquo;{quote}&rdquo;</p>}
        </div>
    );
}

function PortraitFilm({ video, title, details, quote, strip }: { video: ClassicGalleryVideo; title: string; details?: string; quote?: string; strip: React.ReactNode }) {
    const [playing, setPlaying] = useState(false);

    return (
        <figure className="portrait-gh__film">
            {/* Back / Share sit on the film's top edge, as the navbar sits on the cover */}
            {strip}
            {playing ? (
                <HLSVideoPlayer
                    src={video.src}
                    mediaId={video.mediaId}
                    poster={video.poster}
                    autoPlay
                    controls
                    playsInline
                    className="portrait-gh__player"
                />
            ) : (
                <>
                    {video.poster ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={video.poster} alt="" className="portrait-gh__poster" />
                    ) : (
                        <span className="portrait-gh__poster portrait-gh__poster--empty" />
                    )}
                    <span className="portrait-gh__film-shade" aria-hidden="true" />
                    <PortraitIntro title={title} details={details} quote={quote} />
                    <button type="button" className="portrait-gh__play" onClick={() => setPlaying(true)} aria-label={`Play the ${title} highlight film`}>
                        <Play aria-hidden="true" />
                        <span className="portrait-gh__play-label">Highlight film</span>
                    </button>
                </>
            )}
        </figure>
    );
}

export function PortraitGalleryHeader({
    title,
    details,
    message,
    backLabel,
    onBack,
    onShare,
    copied,
    photoCountLabel,
    videoCountLabel,
    activeTab,
    onTabChange,
    video,
}: PortraitGalleryHeaderProps) {
    const quote = message?.trim();
    const strip = (
        <div className="portrait-gh__strip">
            <button type="button" onClick={onBack} className="portrait-gh__link">
                <ArrowLeft aria-hidden="true" />
                {backLabel}
            </button>
            <button type="button" onClick={onShare} className="portrait-gh__link" aria-live="polite">
                {copied ? "Link copied" : "Share"}
                {copied ? <Check aria-hidden="true" /> : <Share2 aria-hidden="true" />}
            </button>
        </div>
    );

    return (
        <section className="portrait-gh" aria-label={`${title} gallery`}>
            <div className={video ? "portrait-gh__screen portrait-gh__screen--film" : "portrait-gh__screen"}>
                {video ? (
                    <PortraitFilm video={video} title={title} details={details} quote={quote} strip={strip} />
                ) : (
                    <div className="portrait-gh__paper">
                        {strip}
                        <PortraitIntro title={title} details={details} quote={quote} />
                    </div>
                )}
            </div>

            <div className="portrait-gh__tabs" role="group" aria-label="Photos or videos">
                {([
                    { id: "photos", label: "Photos", count: photoCountLabel },
                    { id: "videos", label: "Videos", count: videoCountLabel },
                ] as const).map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        aria-pressed={activeTab === tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className="portrait-gh__tab"
                    >
                        {tab.label}
                        <sup className="portrait-gh__count">{tab.count}</sup>
                    </button>
                ))}
            </div>
        </section>
    );
}
