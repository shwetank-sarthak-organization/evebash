"use client";

import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { Event } from "@/lib/database";
import { cn } from "@/lib/utils";
import { coverImageStyle } from "@/lib/coverStyle";
import { confettiDisplay } from "@/components/confetti/confettiFonts";
import { coupleInitials, displayCoupleTitle, splitCoupleNames } from "../../shared/text/coupleNames";

interface TemplateConfettiProps {
    event: Event;
    /** The main event's title, shown on the cover on the main gallery and in every album (default: event.title) */
    mainTitle?: string;
    /** The main event's category, which picks the small line on the dark tag (default: event.category) */
    mainCategory?: string;
    children?: React.ReactNode;
}

/** The small line under the initials on the dark tag, by the main event's category */
function confettiTagLine(category?: string) {
    if (category === "Wedding") return "Happily married";
    if (category === "Anniversary") return "Still choosing each other";
    return "Our moments";
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** "28 March 2025" or "March 28, 2025" -> ["March", "28", "2025"]; anything else -> null (shown as written) */
function splitDate(date: string): [string, string, string] | null {
    const match = date.match(/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/) || date.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
    if (!match) return null;
    const [day, month] = /^\d/.test(match[1]) ? [match[1], match[2]] : [match[2], match[1]];
    if (!MONTHS.some((name) => name.startsWith(month.toLowerCase()) && month.length >= 3)) return null;
    return [month, day, match[3]];
}

// Paint specks around the circle: fixed positions (% of the circle), so the server and browser draw the same ones.
// Most sit on the left and right edges and spill a little past them, like the splash on a printed save-the-date.
const SPECKS = (() => {
    let seed = 7;
    const next = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    return Array.from({ length: 90 }, () => {
        // Heavier on the lower left, lighter on the right
        const angle = (next() < 0.6 ? Math.PI * 0.85 : -0.1) + (next() - 0.5) * 1.9;
        const radius = 30 + next() ** 0.7 * 26;
        // Rounded so the server's and the browser's numbers print the same (no hydration mismatch)
        const round = (value: number) => Math.round(value * 100) / 100;
        return {
            left: round(50 + Math.cos(angle) * radius),
            top: round(50 + Math.sin(angle) * radius),
            size: round(0.5 + next() ** 2.6 * 4.2),
            pink: next() < 0.6,
            opacity: round(0.25 + next() * 0.6),
        };
    });
})();

// Confetti Circle (styles in src/app/confetti-circle.css): the cover photo fills the first screen with a big white
// circle in the middle holding the couple's names in pink-to-orange capitals, a dark tag with their initials ("S ♥ R") on its
// top edge, and a torn-paper edge into the page. The gallery below is Classic White's (.classic-template, classic-white.css).
export function TemplateConfetti({ event, mainTitle, mainCategory, children }: TemplateConfettiProps) {
    const reducedMotion = useReducedMotion();
    const rawTitle = mainTitle || event.title;
    const couple = splitCoupleNames(rawTitle);
    const initials = coupleInitials(rawTitle);
    const title = displayCoupleTitle(rawTitle);
    const date = event.date?.trim() || "";
    const dateParts = date ? splitDate(date) : null;
    const location = "location" in event && typeof event.location === "string" ? event.location.trim() : "";
    // Longer names get a smaller size so each stays on one line inside the circle
    const longest = couple ? Math.max(couple[0].length, couple[1].length) : title.length;
    const nameSize = longest > 16 ? " confetti-hero__name--xlong" : longest > 9 ? " confetti-hero__name--long" : "";
    const isFit = event.coverMode === "fit";

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

                <div className="confetti-hero__circle">
                    <div className="confetti-hero__specks" aria-hidden="true">
                        {SPECKS.map((speck, index) => (
                            <span
                                key={index}
                                className={speck.pink ? "confetti-hero__speck" : "confetti-hero__speck confetti-hero__speck--orange"}
                                style={{ left: `${speck.left}%`, top: `${speck.top}%`, width: `${speck.size}cqi`, height: `${speck.size}cqi`, opacity: speck.opacity }}
                            />
                        ))}
                    </div>

                    <div className="confetti-hero__tag">
                        {initials && (
                            <span className="confetti-hero__initials">
                                {initials[0]}<span className="confetti-hero__heart" aria-label="and">♥</span>{initials[1]}
                            </span>
                        )}
                        <span className="confetti-hero__tagline">{confettiTagLine(mainCategory || event.category)}</span>
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
                    </div>
                </div>

                {children && (
                    <button type="button" onClick={scrollToContent} className="confetti-hero__open" aria-label="Open gallery" title="Open gallery">
                        <ArrowDown aria-hidden="true" />
                    </button>
                )}

                {/* Torn-paper edge in the page colour */}
                <svg className="confetti-hero__tear" viewBox="0 0 1440 48" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M0 20 L40 26 L72 18 L118 27 L160 21 L205 30 L248 22 L290 28 L336 19 L380 27 L426 23 L470 31 L512 22 L560 28 L604 20 L650 29 L694 23 L740 30 L786 21 L830 27 L876 19 L920 28 L966 22 L1010 30 L1056 21 L1100 27 L1146 20 L1190 29 L1236 22 L1280 28 L1326 19 L1372 27 L1410 21 L1440 25 L1440 48 L0 48 Z" />
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
