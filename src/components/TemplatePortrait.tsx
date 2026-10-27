"use client";

import Image from "next/image";
import { useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { Event } from "@/lib/database";
import { cn } from "@/lib/utils";
import { coverImageStyle } from "@/lib/coverStyle";
import { portraitDisplay } from "@/components/portrait/portraitFonts";
import { useFitOneLine } from "@/components/portrait/useFitOneLine";
import { portraitIntro, portraitIntroJoinsDate } from "../../shared/themes/portraitIntro";
import { displayCoupleTitle } from "../../shared/text/coupleNames";

interface TemplatePortraitProps {
    event: Event;
    /** The main event's title, shown on the cover on the main gallery and in every album (default: event.title) */
    mainTitle?: string;
    /** The main event's category, which picks the small line above the names (default: event.category) */
    mainCategory?: string;
    /** The main event's date: before it a wedding says "We're getting married", after it "Happily married since" */
    mainDate?: string;
    children?: React.ReactNode;
}

// Sunlit Portrait (styles in src/app/sunlit-portrait.css): the cover photo fills the first screen with the couple's
// names in a large serif along its bottom edge. The gallery below uses Classic White's markup (.classic-template,
// classic-white.css) in its own warm paper and ink look (sunlit-portrait.css).
export function TemplatePortrait({ event, mainTitle, mainCategory, mainDate, children }: TemplatePortraitProps) {
    const reducedMotion = useReducedMotion();
    const location = "location" in event && typeof event.location === "string" ? event.location.trim() : "";
    const intro = portraitIntro(mainCategory || event.category, mainDate || event.date);
    // "Happily married since 29 September 2026" reads as one phrase (no heart) and always uses the wedding's date,
    // even in an album with a date of its own
    const joinsDate = portraitIntroJoinsDate(intro);
    const details = [(joinsDate ? mainDate || event.date : event.date)?.trim(), location].filter(Boolean).join(", ");
    const title = displayCoupleTitle(mainTitle || event.title);
    // Always one line: a long title shrinks to the cover's width
    const titleRef = useRef<HTMLHeadingElement>(null);
    useFitOneLine(titleRef, title);
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
                            {intro && details && !joinsDate && <span className="portrait-hero__heart" aria-hidden="true">♥</span>}
                            {details && <span>{details}</span>}
                        </p>
                    )}
                    <h1 ref={titleRef} className="portrait-hero__title">{title}</h1>
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
