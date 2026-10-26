"use client";

import React, { useState } from "react";
import { ArrowLeft, Check, Play, Share2 } from "lucide-react";
import { HLSVideoPlayer } from "@/components/ui/HLSVideoPlayer";
import type { ClassicGalleryVideo } from "@/components/classic/ClassicGalleryHeader";

// Top of the gallery section in the Sunlit Portrait design (styles in src/app/sunlit-portrait.css). It repeats the
// cover's layout below it: a thin strip with Back / Share, then the gallery name large on the left with the date under
// it and the host's message as a quote on the right, then the gallery video as a wide "second cover" (title bottom left,
// the cover's round white button bottom right), then the Photos / Videos switch marked with the navbar's dot.

type MediaTab = "photos" | "videos";

interface PortraitGalleryHeaderProps {
    title: string;
    /** Date and place line under the title; left out when empty */
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

function PortraitFilm({ video, title }: { video: ClassicGalleryVideo; title: string }) {
    const [playing, setPlaying] = useState(false);

    return (
        <figure className="portrait-gh__film">
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
                <button type="button" className="portrait-gh__start" onClick={() => setPlaying(true)} aria-label={`Play the ${title} highlight film`}>
                    {video.poster ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={video.poster} alt="" className="portrait-gh__poster" />
                    ) : (
                        <span className="portrait-gh__poster portrait-gh__poster--empty" />
                    )}
                    <span className="portrait-gh__film-shade" aria-hidden="true" />
                    <span className="portrait-gh__film-text" aria-hidden="true">
                        <span className="portrait-gh__film-kicker">{title}</span>
                        <span className="portrait-gh__film-title">Highlight film</span>
                    </span>
                    <span className="portrait-gh__play" aria-hidden="true">
                        <Play />
                    </span>
                </button>
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

    return (
        <section className="portrait-gh" aria-label={`${title} gallery`}>
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

            <div className={quote ? "portrait-gh__intro portrait-gh__intro--quote" : "portrait-gh__intro"}>
                <div className="portrait-gh__heading">
                    {details && <p className="portrait-gh__details">{details}</p>}
                    <h2 className="portrait-gh__title">{title}</h2>
                </div>
                {quote && (
                    <blockquote className="portrait-gh__quote">
                        <span className="portrait-gh__mark" aria-hidden="true">&ldquo;</span>
                        <p>{quote}</p>
                    </blockquote>
                )}
            </div>

            {video && <PortraitFilm video={video} title={title} />}

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
