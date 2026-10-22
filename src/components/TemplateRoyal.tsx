"use client";

import React from "react";
import Image from "next/image";
import { Event } from "@/lib/database";
import { cn } from "@/lib/utils";
import { Crown } from "lucide-react";
import { royalDisplay, royalScript, royalSerif } from "@/components/royal/royalFonts";
import { splitCoupleNames } from "@/components/royal/coupleNames";
import {
    RoyalDivider,
    RoyalFiligreeFrame,
    RoyalFlourish,
    RoyalOrnamentDefs,
    RoyalScreenCorner,
    RoyalWaxSeal,
} from "@/components/royal/RoyalOrnaments";

interface TemplateRoyalProps {
    event: Event;
    children?: React.ReactNode;
    /** True when the page shows an album inside a main gallery */
    hasParent?: boolean;
}

const DEFAULT_HERO_IMAGE = "/royal_emerald_palace_hero.jpg";
const SCREEN_CORNERS = ["tl", "tr", "bl", "br"] as const;

function initialOf(name: string) {
    const first = Array.from(name)[0] || "";
    return /\p{L}/u.test(first) ? first.toLocaleUpperCase() : "";
}

function coupleLead(category?: string) {
    const type = (category || "").toLowerCase();
    if (type.includes("anniversary")) return "The Anniversary of";
    if (type.includes("engagement")) return "The Engagement of";
    if (type.includes("wedding")) return "The Wedding of";
    return "Celebrating";
}

/** Smaller script for long names so they stay inside the card on phones */
function nameSizeClass(longest: number, isCouple: boolean) {
    const [long, extraLong] = isCouple ? [11, 16] : [18, 32];
    if (longest > extraLong) return "royal-card__names--xlong";
    if (longest > long) return "royal-card__names--long";
    return undefined;
}

/** Applies the host's cover settings (focus point, zoom, fit), as the dashboard cards do.
 *  The frame is always portrait, so the focus point decides which part of a landscape cover shows. */
function coverImageStyle(event: Event): React.CSSProperties {
    if (event.coverMode === "fit") return { objectFit: "contain" };
    const x = Math.max(0, Math.min(100, 50 + (event.coverOffsetX || 0)));
    const y = Math.max(0, Math.min(100, 50 + (event.coverOffset || 0)));
    return { objectFit: "cover", objectPosition: `${x}% ${y}%`, transform: `scale(${event.coverScale || 1})` };
}

export function TemplateRoyal({ event, children, hasParent = false }: TemplateRoyalProps) {
    const location = "location" in event && typeof event.location === "string" ? event.location : "";
    const heroImageSrc = event.coverImage || DEFAULT_HERO_IMAGE;
    const title = (event.title || "").trim();
    // Albums show their own name; the couple line and initials belong to the main gallery
    const couple = hasParent ? null : splitCoupleNames(title);
    const initials = couple ? [initialOf(couple[0]), initialOf(couple[1])] as [string, string] : null;
    const sealInitials = initials && initials[0] && initials[1] ? initials : null;
    const longestName = couple ? Math.max(couple[0].length, couple[1].length) : title.length;

    const scrollToContent = () => {
        document.getElementById("royal-collection-section")?.scrollIntoView({ behavior: "smooth" });
    };

    return (
        <div
            className={cn(
                "min-h-screen bg-[#02231c] text-[#fcfbf7] font-serif selection:bg-[#ca9c69] selection:text-[#02231c] relative overflow-x-clip",
                royalScript.variable,
                royalDisplay.variable,
                royalSerif.variable
            )}
        >
            <RoyalOrnamentDefs />

            <section id="hero" className="royal-hero">
                {SCREEN_CORNERS.map((corner) => (
                    <RoyalScreenCorner key={corner} className={`royal-hero__corner royal-hero__corner--${corner}`} />
                ))}

                <div className="royal-hero__grid">
                    <div className="royal-hero__card-col">
                        <article className="royal-card">
                            <div className="royal-card__paper" aria-hidden="true" />
                            <div className="royal-card__rules" aria-hidden="true" />
                            {couple && <p className="royal-card__lead royal-foil">{coupleLead(event.category)}</p>}
                            {title && (
                                <h1 className={cn("royal-card__names royal-foil", nameSizeClass(longestName, !!couple))}>
                                    {couple ? (
                                        <>
                                            {couple[0]}
                                            <span className="royal-card__amp">&amp;</span>
                                            {couple[1]}
                                        </>
                                    ) : title}
                                </h1>
                            )}
                            <RoyalFlourish className="royal-card__flourish" />
                            {event.date && <p className="royal-card__date">{event.date}</p>}
                            {location && <p className="royal-card__place">{location}</p>}
                            <RoyalWaxSeal initials={sealInitials} className="royal-card__seal" />
                        </article>
                    </div>

                    <RoyalDivider className="royal-hero__divider" />

                    <div className="royal-hero__frame-col">
                        <RoyalFiligreeFrame>
                            <Image
                                src={heroImageSrc}
                                alt={title || "Cover photo"}
                                fill
                                priority
                                sizes="(max-width: 879px) 88vw, 520px"
                                style={coverImageStyle(event)}
                            />
                        </RoyalFiligreeFrame>
                    </div>
                </div>

                <button type="button" onClick={scrollToContent} className="royal-cta">
                    Explore Gallery
                </button>
            </section>

            {/* Content Area for Gallery & Photos */}
            {children && (
                <main id="royal-collection-section" className="relative z-10 bg-[#021a15]/60 min-h-screen border-t border-[#ca9c69]/15 py-8">
                    <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-12">
                        {children}
                    </div>
                </main>
            )}

            {/* Footer */}
            <footer className="relative z-10 px-6 py-16 text-center border-t border-[#ca9c69]/20 bg-[#021a15]">
                <div className="flex items-center justify-center gap-2 mb-3 text-[#ca9c69]">
                    <Crown className="w-5 h-5" />
                </div>
                {title && <p className="royal-footer__title">{title}</p>}
            </footer>
        </div>
    );
}
