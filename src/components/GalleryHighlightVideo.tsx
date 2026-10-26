"use client";

import React, { useState } from "react";
import { Play } from "lucide-react";
import { HLSVideoPlayer } from "@/components/ui/HLSVideoPlayer";

// The gallery's cinematic highlight video in every theme except Royal Emerald (which draws its own gold frame in
// RoyalGalleryHeader). Colours come from the theme's --event-template-* variables; styles in gallery-refinements.css.

export function GalleryHighlightVideo({ video, title, className }: {
    video: { src: string; mediaId?: string; poster?: string };
    title: string;
    /** Extra class on the outer box, for a theme's own frame (e.g. "midnight-film" in midnight-hero.css) */
    className?: string;
}) {
    const [playing, setPlaying] = useState(false);

    return (
        <div className={className ? `gallery-highlight ${className}` : "gallery-highlight"}>
            <div className="gallery-highlight__frame">
                {playing ? (
                    <HLSVideoPlayer
                        src={video.src}
                        mediaId={video.mediaId}
                        poster={video.poster}
                        autoPlay
                        controls
                        playsInline
                        className="gallery-highlight__player"
                    />
                ) : (
                    <button type="button" className="gallery-highlight__start" onClick={() => setPlaying(true)} aria-label={`Play the ${title} highlight video`}>
                        {video.poster && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={video.poster} alt="" className="gallery-highlight__poster" />
                        )}
                        <span className="gallery-highlight__play">
                            <Play className="gallery-highlight__play-icon" aria-hidden="true" />
                        </span>
                    </button>
                )}
            </div>
        </div>
    );
}
