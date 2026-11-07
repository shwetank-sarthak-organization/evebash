"use client";

import React, { useState } from "react";
import { ArrowLeft, Check, Play, Share2 } from "lucide-react";
import { HLSVideoPlayer } from "@/components/ui/HLSVideoPlayer";
import { EditChip, useGuestEditSpots } from "@/components/guestEdit/EditChip";

// Top of the gallery section in the Classic White design (styles in src/app/classic-white.css). With a gallery video
// the text column is as tall as the video on its right: Back / Share at the top, the gallery name, date and the host's
// gallery message in the middle, the [ Photos ] [ Videos ] switch at the bottom just above the grid. Without a video
// the same parts simply stack. Other themes keep the shared markup in the event page.

type MediaTab = "photos" | "videos";

export type ClassicGalleryVideo = {
    src: string;
    mediaId?: string;
    poster?: string;
    /** The video's size, when known (Sunlit Portrait plays it at its own shape) */
    width?: number;
    height?: number;
};

interface ClassicGalleryHeaderProps {
    title: string;
    /** Date and place line under the title; left out when empty */
    details?: string;
    /** The host's gallery message (description), under the date; left out when empty */
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
    /** The title is this gallery's own name (an album's), so edit mode puts a pencil on it; the main gallery's is
     *  just "Home" and its title is on the cover */
    editableTitle?: boolean;
    /** The theme shows the gallery message somewhere else (Periwinkle Script's cover card): no message pencil here */
    messageElsewhere?: boolean;
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
                <EditChip field="video" label="Video" style={{ top: 12, right: 12 }} />
            </div>
            <figcaption className="classic-gh__caption">Highlight film</figcaption>
        </figure>
    );
}

export function ClassicGalleryHeader({
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
    editableTitle = false,
    messageElsewhere = false,
}: ClassicGalleryHeaderProps) {
    const welcome = message?.trim();
    // Edit mode (todo #11): pencils on the album's title, the message and the video, or places to add them
    const editing = useGuestEditSpots();

    return (
        <section className={video ? "classic-gh classic-gh--video" : "classic-gh"} aria-label={`${title} gallery`}>
            <div className="classic-gh__text">
                <div className="classic-gh__actions">
                    <button type="button" onClick={onBack} className="classic-gh__action">
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        {backLabel}
                    </button>
                    <button type="button" onClick={onShare} className="classic-gh__action" aria-live="polite">
                        {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Share2 className="h-4 w-4" aria-hidden="true" />}
                        {copied ? "Link copied" : "Share Event"}
                    </button>
                </div>

                <div className="classic-gh__middle">
                    <h2 className="classic-gh__title">{title}</h2>
                    {details && <p className="classic-gh__details">{details}</p>}
                    {welcome && <p className="classic-gh__message">&ldquo;{welcome}&rdquo;</p>}
                    {editing && (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {editableTitle && <EditChip field="title" label="Title" />}
                            {!messageElsewhere && (
                                <EditChip field="message" label={welcome ? "Message" : "Add welcome message"} adding={!welcome} />
                            )}
                            {!video && <EditChip field="video" label="Add highlight video" adding />}
                        </div>
                    )}
                </div>

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
