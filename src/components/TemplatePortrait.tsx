"use client";

import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { Event } from "@/lib/database";
import { cn } from "@/lib/utils";
import { coverImageStyle } from "@/lib/coverStyle";
import { portraitDisplay } from "@/components/portrait/portraitFonts";
import { displayCoupleTitle } from "../../shared/text/coupleNames";

interface TemplatePortraitProps {
    event: Event;
    /** The main event's title, shown on the cover on the main gallery and in every album (default: event.title) */
    mainTitle?: string;
    /** The main event's category, which picks the small line above the names (default: event.category) */
    mainCategory?: string;
    children?: React.ReactNode;
}

/** The small line before the date, by the main event's category */
function portraitIntro(category?: string) {
    if (category === "Wedding") return "We're getting married";
    if (category === "Anniversary") return "Still choosing each other";
    return "";
}

// Sunlit Portrait (styles in src/app/sunlit-portrait.css): the cover photo fills the first screen with the couple's
// names in a large serif along its bottom edge. The gallery below uses Classic White's markup (.classic-template,
// classic-white.css) in its own warm paper and ink look (sunlit-portrait.css).
export function TemplatePortrait({ event, mainTitle, mainCategory, children }: TemplatePortraitProps) {
    const reducedMotion = useReducedMotion();
    const location = "location" in event && typeof event.location === "string" ? event.location.trim() : "";
    const details = [event.date?.trim(), location].filter(Boolean).join(", ");
    const intro = portraitIntro(mainCategory || event.category);
    const title = displayCoupleTitle(mainTitle || event.title);
    // Long titles get a smaller size so they stay on one or two lines
    const titleSize = title.length > 32 ? " portrait-hero__title--xlong" : title.length > 18 ? " portrait-hero__title--long" : "";
    const isFit = event.coverMode === "fit";

    const scrollToContent = () => {
        document.getElementById("event-content")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
    };

    return (
        <div className={cn("classic-template portrait-template min-h-screen font-sans", portraitDisplay.variable)}>
            <section className="portrait-hero" aria-label="Gallery cover">
                {event.coverImage ? (
                    <>
                        {/* "Fit" covers keep the whole photo; a blurred copy fills the sides */}
                        {isFit && <Image src={event.coverImage} alt="" fill sizes="100vw" className="portrait-hero__fill" aria-hidden="true" />}
                        <Image
                            src={event.coverImage}
                            alt={title ? `Cover photo of ${title}` : "Cover photo"}
                            fill
                            priority
                            sizes="100vw"
                            className="portrait-hero__photo"
                            style={coverImageStyle(event)}
                        />
                    </>
                ) : (
                    <div className="portrait-hero__empty" />
                )}
                <div className="portrait-hero__shade" aria-hidden="true" />

                <div className="portrait-hero__text">
                    {(intro || details) && (
                        <p className="portrait-hero__details">
                            {intro && <span>{intro}</span>}
                            {intro && details && <span className="portrait-hero__heart" aria-hidden="true">♥</span>}
                            {details && <span>{details}</span>}
                        </p>
                    )}
                    <h1 className={`portrait-hero__title${titleSize}`}>{title}</h1>
                </div>

                {children && (
                    <button type="button" onClick={scrollToContent} className="portrait-hero__open" aria-label="Open gallery" title="Open gallery">
                        <ArrowDown aria-hidden="true" />
                    </button>
                )}
            </section>

            {/* Full width with the page's side padding, like the navbar. The gallery's header comes from the event page */}
            {children && (
                <section id="event-content" className="classic-gallery-content pb-16 md:pb-20">
                    <div className="w-full px-4 sm:px-6 lg:px-8">
                        {children}
                    </div>
                </section>
            )}
        </div>
    );
}
