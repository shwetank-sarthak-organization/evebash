"use client";

import { Event } from "@/lib/database";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { ClassicCoverPrint } from "@/components/classic/ClassicCoverPrint";
import { displayCoupleTitle } from "../../shared/text/coupleNames";
import { classicCoverLine } from "../../shared/themes/classicCoverLine";

interface TemplateClassicProps {
    event: Event;
    /** The main event's title, shown on the cover on the main gallery and in every album (default: event.title) */
    mainTitle?: string;
    /** The main event's category, which picks the cover card's line (default: event.category) */
    mainCategory?: string;
    children?: React.ReactNode;
}

/** Applies the host's cover settings (focus point, zoom, fit), as the dashboard cards do. */
function coverImageStyle(event: Event): React.CSSProperties {
    if (event.coverMode === "fit") return { objectFit: "contain" };
    const x = Math.max(0, Math.min(100, 50 + (event.coverOffsetX || 0)));
    const y = Math.max(0, Math.min(100, 50 + (event.coverOffset || 0)));
    return { objectFit: "cover", objectPosition: `${x}% ${y}%`, transform: `scale(${event.coverScale || 1})` };
}

/** Sage line, dot, line (the same divider as the app's Classic White) */
function ClassicDivider({ className }: { className?: string }) {
    return (
        <div className={`flex items-center justify-center gap-3 ${className || ""}`} aria-hidden="true">
            <span className="h-px w-12 bg-[#8B9A6E]/50 md:w-16" />
            <span className="h-1.5 w-1.5 rotate-45 bg-[#8B9A6E]" />
            <span className="h-px w-12 bg-[#8B9A6E]/50 md:w-16" />
        </div>
    );
}

// Colours come from the Classic White palette (src/lib/webTemplateTheme.ts): soft white #FCFCFA, white mount,
// dark green text #2C352E, muted #596653, sage #8B9A6E (lines only: too light for text).
export function TemplateClassic({ event, mainTitle, mainCategory, children }: TemplateClassicProps) {
    const location = "location" in event && typeof event.location === "string" ? event.location.trim() : "";
    const details = [event.date?.trim(), location].filter(Boolean).join(" · ");
    const title = displayCoupleTitle(mainTitle || event.title);
    // Capitals run wide, so longer titles get a smaller size and keep the cover's room
    const titleSize = title.length > 32 ? " classic-hero__title--xlong" : title.length > 18 ? " classic-hero__title--long" : "";

    const scrollToContent = () => {
        document.getElementById("event-content")?.scrollIntoView({ behavior: "smooth" });
    };

    return (
        <div className="classic-template min-h-screen bg-[#FCFCFA] text-[#2C352E] font-sans selection:bg-[#8B9A6E]/30">
            {/* The first screen is exactly the window height (at least 640px) on every computer: navbar space, title,
                message card and cover print, "Open Gallery", with the gallery header starting right below. The print
                takes whatever height is left (ClassicCoverPrint). */}
            <main className="flex h-[max(100svh,640px)] flex-col px-4 pt-[90px] pb-[clamp(12px,2svh,24px)] sm:px-6 lg:px-8">
                {/* The title shows straight away (it's the page's largest text), the rest fades in */}
                <div className="mx-auto w-full max-w-6xl shrink-0 text-center">
                    {details && (
                        <p className="classic-hero__details mb-[clamp(4px,1svh,10px)]">
                            {details}
                        </p>
                    )}
                    {/* Always capitals; "X and Y" / "X weds Y" / "X + Y" read as "X & Y" (same rule as Royal Emerald) */}
                    <h1 className={`classic-hero__title${titleSize}`}>
                        {title}
                    </h1>

                    <ScrollReveal delay={0.1}>
                        <ClassicDivider className="mt-[clamp(8px,1.6svh,18px)]" />
                    </ScrollReveal>
                </div>

                {/* Cover as a print in a white mount with the theme's card on its top edge; fills the space left */}
                <ClassicCoverPrint coverImage={event.coverImage} alt={event.title} cardText={classicCoverLine(mainCategory || event.category)} imageStyle={coverImageStyle(event)} />

                {children && (
                    <div className="mt-[clamp(14px,3svh,32px)] shrink-0 text-center">
                        {/* Same outlined button as "Back to Gallery" in the gallery header */}
                        <button
                            type="button"
                            onClick={scrollToContent}
                            className="classic-gh__action focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2C352E]"
                        >
                            Open Gallery
                        </button>
                    </div>
                )}
            </main>

            {/* Full width with the page's side padding, like the navbar. The gallery's header comes from the event page */}
            {children && (
                <section id="event-content" className="classic-gallery-content border-t border-[#E6E6E0] pb-16 md:pb-20">
                    <div className="w-full px-4 sm:px-6 lg:px-8">
                        {children}
                    </div>
                </section>
            )}
        </div>
    );
}
