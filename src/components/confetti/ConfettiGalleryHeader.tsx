"use client";

import React from "react";
import { ArrowLeft, Check, Share2 } from "lucide-react";
import { displayCoupleTitle } from "../../../shared/text/coupleNames";

// Top of the gallery section in the Confetti Circle design (styles in src/app/confetti-circle.css), in place of
// Classic White's header: Back / Share in a thin row, then "Photo gallery | GALLERY NAME | Video gallery", where the
// two small pink words switch between photos and videos. A long message (cut short on the cover's tag) is shown in
// full under it.

type MediaTab = "photos" | "videos";

/** Messages longer than this get the cover tag's smallest size and may be cut there (TemplateConfetti) */
export const CONFETTI_TAG_LONG_MESSAGE = 90;

export function ConfettiGalleryHeader({
    title,
    message,
    backLabel,
    onBack,
    onShare,
    copied,
    photoCountLabel,
    videoCountLabel,
    activeTab,
    onTabChange,
}: {
    /** The gallery's name ("Captured moments" if empty); "A and B" shows as "A & B" like the cover */
    title?: string;
    /** The gallery's message; shown here only when the cover's tag had to cut it */
    message?: string;
    backLabel: string;
    onBack: () => void;
    onShare: () => void;
    copied?: boolean;
    photoCountLabel: string;
    videoCountLabel: string;
    activeTab: MediaTab;
    onTabChange: (tab: MediaTab) => void;
}) {
    const heading = displayCoupleTitle(title?.trim() || "") || "Captured moments";
    const fullMessage = message?.trim() && message.trim().length > CONFETTI_TAG_LONG_MESSAGE ? message.trim() : "";

    const tab = (id: MediaTab, label: string, count: string) => (
        <button
            type="button"
            aria-pressed={activeTab === id}
            onClick={() => onTabChange(id)}
            className={`confetti-gh__tab confetti-gh__tab--${id}`}
        >
            {label}
            <span className="confetti-gh__count">{count}</span>
        </button>
    );

    return (
        <section className="confetti-gh" aria-label={`${heading} gallery`}>
            <div className="confetti-gh__actions">
                <button type="button" onClick={onBack} className="confetti-gh__action">
                    <ArrowLeft aria-hidden="true" />
                    {backLabel}
                </button>
                <button type="button" onClick={onShare} className="confetti-gh__action" aria-live="polite">
                    {copied ? <Check aria-hidden="true" /> : <Share2 aria-hidden="true" />}
                    {copied ? "Link copied" : "Share Event"}
                </button>
            </div>

            <div className="confetti-gh__bar" role="group" aria-label="Photos or videos">
                {tab("photos", "Photo gallery", photoCountLabel)}
                <h2 className="confetti-gh__title">{heading}</h2>
                {tab("videos", "Video gallery", videoCountLabel)}
            </div>

            {fullMessage && <p className="confetti-gh__message">&ldquo;{fullMessage}&rdquo;</p>}
        </section>
    );
}
