"use client";

import Image from "next/image";
import { Event } from "@/lib/database";
import { cn } from "@/lib/utils";
import { coverImageStyle } from "@/lib/coverStyle";
import { periwinkleScript, periwinkleSerif } from "@/components/periwinkle/periwinkleFonts";
import { displayCoupleTitle } from "../../shared/text/coupleNames";

interface TemplatePeriwinkleProps {
    event: Event;
    /** The main event's title, shown on the cover on the main gallery and in every album (default: event.title) */
    mainTitle?: string;
    /** The main event's category, which picks the second line of the title (default: event.category) */
    mainCategory?: string;
    children?: React.ReactNode;
}

/** The line under the couple's names, by the main event's category */
function periwinkleTitleLine(category?: string) {
    if (category === "Wedding") return "Wedding Day!";
    if (category === "Anniversary") return "Anniversary!";
    return "";
}

// Periwinkle Script (styles in src/app/periwinkle-script.css): the cover photo sits in a rounded frame below a cream
// navbar, with the couple's names in a large cream script across it. A cream card with cut corners straddles the photo's
// bottom edge and a periwinkle band, holding the date, the gallery's message and the place. The gallery below is
// Classic White's (.classic-template, classic-white.css); its header leaves the message out, since the card shows it.
export function TemplatePeriwinkle({ event, mainTitle, mainCategory, children }: TemplatePeriwinkleProps) {
    const title = displayCoupleTitle(mainTitle || event.title);
    const titleLine = periwinkleTitleLine(mainCategory || event.category);
    const date = event.date?.trim() || "";
    const location = "location" in event && typeof event.location === "string" ? event.location.trim() : "";
    // A new main gallery gets "Main Event: <title>" as its description; that isn't a message for guests
    const rawMessage = event.description?.trim() || "";
    const message = rawMessage.startsWith("Main Event: ") ? "" : rawMessage;
    // Long titles get a smaller size so they stay on two or three lines
    const titleSize = title.length > 30 ? " periwinkle-hero__title--xlong" : title.length > 18 ? " periwinkle-hero__title--long" : "";
    const isFit = event.coverMode === "fit";
    const hasCard = Boolean(date || message || location);

    return (
        <div className={cn("classic-template periwinkle-template min-h-screen bg-[#F4F1EA] text-[#2B2A26] font-sans selection:bg-[#C9DBFB]", periwinkleScript.variable, periwinkleSerif.variable)}>
            <div className="periwinkle-frame">
                <section className="periwinkle-hero" aria-label="Gallery cover">
                    {event.coverImage ? (
                        <>
                            {/* "Fit" covers keep the whole photo; a blurred copy fills the sides */}
                            {isFit && <Image src={event.coverImage} alt="" fill sizes="100vw" className="periwinkle-hero__fill" aria-hidden="true" />}
                            <Image
                                src={event.coverImage}
                                alt={title ? `Cover photo of ${title}` : "Cover photo"}
                                fill
                                priority
                                sizes="100vw"
                                className="periwinkle-hero__photo"
                                style={coverImageStyle(event)}
                            />
                        </>
                    ) : (
                        <div className="periwinkle-hero__empty" />
                    )}
                    <div className="periwinkle-hero__shade" aria-hidden="true" />

                    <h1 className={`periwinkle-hero__title${titleSize}`}>
                        <span>{titleLine && title ? `${title}’s` : title}</span>
                        {titleLine && <span>{titleLine}</span>}
                    </h1>
                </section>

                <div className={cn("periwinkle-band", !hasCard && "periwinkle-band--empty")}>
                    {hasCard && (
                        <div className="periwinkle-card">
                            {date && <p className="periwinkle-card__date">{date}</p>}
                            {message && <p className="periwinkle-card__message">{message}</p>}
                            {location && <p className="periwinkle-card__place">{location}</p>}
                        </div>
                    )}
                </div>
            </div>

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
