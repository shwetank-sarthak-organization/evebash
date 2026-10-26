"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Event } from "@/lib/database";
import { coverImageStyle } from "@/lib/coverStyle";
import { cn } from "@/lib/utils";
import { Crown } from "lucide-react";
import { royalDisplay, royalScript, royalSerif } from "@/components/royal/royalFonts";
import { coupleInitials, displayCoupleTitle, splitCoupleNames } from "../../shared/text/coupleNames";
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

export function TemplateRoyal({ event, children, hasParent = false }: TemplateRoyalProps) {
    const location = "location" in event && typeof event.location === "string" ? event.location : "";
    const heroImageSrc = event.coverImage || DEFAULT_HERO_IMAGE;
    const title = (event.title || "").trim();
    // Albums show their own name; the couple line and initials belong to the main gallery
    const couple = hasParent ? null : splitCoupleNames(title);
    const sealInitials = couple ? coupleInitials(title) : null;
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
                <main id="royal-collection-section" className="relative z-10 bg-[#021a15]/60 border-t border-[#ca9c69]/15 py-8">
                    <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-12">
                        {children}
                    </div>
                </main>
            )}

            {/* One footer for the whole page: it also carries the EveBash line and links, so the shared event footer
                (src/components/Footer.tsx) hides itself on Royal Emerald pages (royal-emerald.css) */}
            <footer className="royal-footer">
                <div className="royal-footer__inner">
                    <nav className="royal-footer__links royal-footer__links--start" aria-label="EveBash">
                        <Link href="/login?mode=signup" className="royal-footer__cta">Create your own event free</Link>
                        <Link href="/sample-galleries">Sample Galleries</Link>
                        <Link href="/pricing">Pricing</Link>
                    </nav>
                    <div className="royal-footer__center">
                        <Crown className="royal-footer__crown" aria-hidden="true" />
                        {title && <p className="royal-footer__title">{displayCoupleTitle(title)}</p>}
                        <p className="royal-footer__made">
                            Made with <Link href="/" className="royal-footer__brand">EveBash</Link>
                        </p>
                    </div>
                    <nav className="royal-footer__links royal-footer__links--end" aria-label="Help and legal">
                        <Link href="/privacy-policy">Privacy</Link>
                        <Link href="/terms-and-conditions">Terms</Link>
                        <Link href="/contact-us">Contact Us</Link>
                        <Link href="/cancellation-refund-policy">Cancellation &amp; Refund</Link>
                    </nav>
                </div>
            </footer>
        </div>
    );
}
