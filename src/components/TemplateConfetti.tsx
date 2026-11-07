"use client";

import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { Event } from "@/lib/database";
import { cn } from "@/lib/utils";
import { coverImageStyle } from "@/lib/coverStyle";
import { confettiDisplay } from "@/components/confetti/confettiFonts";
import { CONFETTI_COVER_SPECKS, CONFETTI_TEAR_PATH, confettiMessage, confettiNameSize, confettiTagLine, confettiTagSize, splitConfettiDate } from "../../shared/themes/confettiCircle";
import { displayCoupleTitle, splitCoupleNames } from "../../shared/text/coupleNames";
import { EditChip, useGuestEditSpots } from "@/components/guestEdit/EditChip";

interface TemplateConfettiProps {
    event: Event;
    /** The main event's title, shown on the cover on the main gallery and in every album (default: event.title) */
    mainTitle?: string;
    /** The main event's category, which picks the dark tag's line when the gallery has no message (default: event.category) */
    mainCategory?: string;
    /** An album: the circle's names are then its main event's, so edit mode leaves the title pencil to the gallery
     *  header */
    hasParent?: boolean;
    children?: React.ReactNode;
}

// Confetti Circle (styles in src/app/confetti-circle.css): the cover photo fills the first screen with a big white
// circle in the middle holding the couple's names in pink-to-orange capitals, a dark tag with a red heart and the
// gallery's message on its top edge, and a torn-paper edge into the page. The gallery below is Classic White's
// (.classic-template, classic-white.css), with the couple section (ConfettiCoupleSection) above its header.
export function TemplateConfetti({ event, mainTitle, mainCategory, hasParent = false, children }: TemplateConfettiProps) {
    const reducedMotion = useReducedMotion();
    const rawTitle = mainTitle || event.title;
    const couple = splitCoupleNames(rawTitle);
    const message = confettiMessage(event.description);
    const tagText = message || confettiTagLine(mainCategory || event.category);
    // Longer messages get a wider tag and smaller text, and the tag shows at most 4 lines; the gallery header below the
    // cover then shows the whole message
    const tagSizeName = confettiTagSize(tagText);
    const tagSize = tagSizeName ? ` confetti-hero__tag--${tagSizeName}` : "";
    const title = displayCoupleTitle(rawTitle);
    const date = event.date?.trim() || "";
    const dateParts = date ? splitConfettiDate(date) : null;
    const location = "location" in event && typeof event.location === "string" ? event.location.trim() : "";
    // Longer names get a smaller size so each stays on one line inside the circle
    const longest = couple ? Math.max(couple[0].length, couple[1].length) : title.length;
    const nameSizeName = confettiNameSize(longest);
    const nameSize = nameSizeName ? ` confetti-hero__name--${nameSizeName}` : "";
    const isFit = event.coverMode === "fit";
    // Edit mode (todo #11): pencils on the cover, and on the circle's names, date and the tag's message; guests see none
    const editing = useGuestEditSpots();

    const scrollToContent = () => {
        document.getElementById("event-content")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
    };

    return (
        <div className={cn("classic-template confetti-template min-h-screen bg-[#FCFCFA] text-[#2C352E] font-sans selection:bg-[#e8175d]/20", confettiDisplay.variable)}>
            <section className="confetti-hero" aria-label="Gallery cover">
                {event.coverImage ? (
                    <>
                        {/* "Fit" covers keep the whole photo; a blurred copy fills the sides */}
                        {isFit && <Image src={event.coverImage} alt="" fill sizes="100vw" className="confetti-hero__fill" aria-hidden="true" />}
                        <Image
                            src={event.coverImage}
                            alt={title ? `Cover photo of ${title}` : "Cover photo"}
                            fill
                            priority
                            sizes="100vw"
                            className="confetti-hero__photo"
                            style={coverImageStyle(event)}
                        />
                    </>
                ) : (
                    <div className="confetti-hero__empty" />
                )}
                {/* Below the navbar, which sits on the cover */}
                <EditChip field="cover" label={event.coverImage ? "Cover" : "Add cover photo"} adding={!event.coverImage} style={{ top: 84, right: 20 }} />

                <div className="confetti-hero__circle">
                    <div className="confetti-hero__specks" aria-hidden="true">
                        {CONFETTI_COVER_SPECKS.map((speck, index) => (
                            <span
                                key={index}
                                className={speck.pink ? "confetti-hero__speck" : "confetti-hero__speck confetti-hero__speck--orange"}
                                style={{ left: `${speck.left}%`, top: `${speck.top}%`, width: `${speck.size}cqi`, height: `${speck.size}cqi`, opacity: speck.opacity }}
                            />
                        ))}
                    </div>

                    {/* The host's message is italic in quotes; the fallback line is plain capitals */}
                    <div className={`confetti-hero__tag${tagSize}${message ? " confetti-hero__tag--message" : ""}`}>
                        <span className="confetti-hero__heart" aria-hidden="true">♥</span>
                        <p className="confetti-hero__tagline" title={tagText}>{message ? <>&ldquo;{message}&rdquo;</> : tagText}</p>
                    </div>

                    <div className="confetti-hero__body">
                        <h1 className="confetti-hero__names">
                            {couple ? (
                                <>
                                    <span className={`confetti-hero__name${nameSize}`}>{couple[0]}</span>
                                    <span className="confetti-hero__and">- and -</span>
                                    <span className={`confetti-hero__name confetti-hero__name--second${nameSize}`}>{couple[1]}</span>
                                </>
                            ) : (
                                <span className={`confetti-hero__name confetti-hero__name--single${nameSize}`}>{title}</span>
                            )}
                        </h1>

                        {dateParts ? (
                            <p className="confetti-hero__date">
                                <span>{dateParts[0]}</span>
                                <span className="confetti-hero__day">{dateParts[1]}</span>
                                <span>{dateParts[2]}</span>
                            </p>
                        ) : date && (
                            <p className="confetti-hero__date confetti-hero__date--plain">{date}</p>
                        )}
                        {location && <p className="confetti-hero__place">{location}</p>}
                        {editing && (
                            <div className="mt-3 flex flex-wrap justify-center gap-2">
                                {!hasParent && <EditChip field="title" label="Title" />}
                                <EditChip field="date" label={date ? "Date" : "Add date"} adding={!date} />
                                <EditChip field="message" label={message ? "Message" : "Add message"} adding={!message} />
                            </div>
                        )}
                    </div>
                </div>

                {children && (
                    <button type="button" onClick={scrollToContent} className="confetti-hero__open" aria-label="Open gallery" title="Open gallery">
                        <ArrowDown aria-hidden="true" />
                    </button>
                )}

                {/* Torn-paper edge in the page colour */}
                <svg className="confetti-hero__tear" viewBox="0 0 1440 48" preserveAspectRatio="none" aria-hidden="true">
                    <path d={CONFETTI_TEAR_PATH} />
                </svg>
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
