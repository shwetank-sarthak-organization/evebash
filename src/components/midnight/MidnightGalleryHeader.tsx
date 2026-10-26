"use client";

import React from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { GalleryHighlightVideo } from "@/components/GalleryHighlightVideo";
import { displayCoupleTitle } from "../../../shared/text/coupleNames";

// Top of the gallery section in the Midnight Hero design (styles in src/app/midnight-hero.css):
// Back / event name / Share, a gold star, the gallery title, the photo and film count, the host's message,
// the gallery's highlight film in a gold frame (when the host picked one), then the Photos / Videos switch.

type MediaTab = "photos" | "videos";

interface MidnightGalleryHeaderProps {
    title: string;
    /** The main event's title, shown small at the top ("Samarth & Jyoti") */
    eventTitle?: string;
    /** The gallery's description, shown under the count */
    message?: string;
    backLabel: string;
    onBack: () => void;
    onShare: () => void;
    copied?: boolean;
    photoCountLabel: string;
    videoCountLabel: string;
    activeTab: MediaTab;
    onTabChange: (tab: MediaTab) => void;
    video?: { src: string; mediaId?: string; poster?: string } | null;
}

/** "24" -> "24 Photographs", "1" -> "1 Photograph"; nothing for 0 */
function countPart(label: string, one: string, many: string) {
    if (label === "0") return null;
    return `${label} ${label === "1" ? one : many}`;
}

/** The last word of the title in gold ("Home Gallery" -> "Home" + "Gallery") */
function splitLastWord(title: string): [string, string] {
    const index = title.trim().lastIndexOf(" ");
    return index > 0 ? [title.slice(0, index), title.slice(index + 1)] : ["", title.trim()];
}

export function MidnightGalleryHeader({
    title,
    eventTitle,
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
}: MidnightGalleryHeaderProps) {
    const [lead, last] = splitLastWord(title);
    const counts = [countPart(photoCountLabel, "Photograph", "Photographs"), countPart(videoCountLabel, "Film", "Films")].filter(Boolean);
    const welcome = message?.trim();

    return (
        <section className="midnight-gh" aria-label={`${title} gallery`}>
            <div className="midnight-gh__top">
                <button type="button" onClick={onBack} className="midnight-gh__side">
                    <ChevronLeft aria-hidden="true" />
                    {backLabel}
                </button>
                {eventTitle && <p className="midnight-gh__event">{displayCoupleTitle(eventTitle)}</p>}
                <button type="button" onClick={onShare} className="midnight-gh__side midnight-gh__side--right" aria-live="polite">
                    {copied ? "Link copied" : "Share Gallery"}
                    {copied ? <Check aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
                </button>
            </div>

            <svg viewBox="0 0 24 24" className="midnight-gh__star" aria-hidden="true">
                <path d="M12 1.8l2.6 7.1 7.5.3-5.9 4.7 2.1 7.3L12 17l-6.3 4.2 2.1-7.3-5.9-4.7 7.5-.3z" />
            </svg>
            <h2 className="midnight-gh__title">
                {lead && <>{lead} </>}
                <span className="midnight-gh__title-gold">{last}</span>
            </h2>
            {counts.length > 0 && <p className="midnight-gh__count">{counts.join(" · ")}</p>}
            {welcome && <p className="midnight-gh__message">{welcome}</p>}

            {video && <GalleryHighlightVideo video={video} title={title} className="midnight-film" />}

            <div className="midnight-gh__tabs" role="group" aria-label="Photos or videos">
                {([
                    { id: "photos", label: `Photos (${photoCountLabel})` },
                    { id: "videos", label: `Videos (${videoCountLabel})` },
                ] as const).map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        aria-pressed={activeTab === tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className="midnight-gh__tab"
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
        </section>
    );
}
