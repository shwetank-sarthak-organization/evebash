"use client";

import Link from "next/link";
import { useRef } from "react";
import type { Event } from "@/lib/database";
import { portraitDisplay } from "@/components/portrait/portraitFonts";
import { portraitIntro, portraitIntroJoinsDate } from "@/components/portrait/portraitIntro";
import { useFitOneLine } from "@/components/portrait/useFitOneLine";
import { THEME_FOOTER_LEFT_LINKS, THEME_FOOTER_RIGHT_LINKS } from "@/components/themeFooterLinks";
import { displayCoupleTitle } from "../../../shared/text/coupleNames";

// Footer of every Sunlit Portrait guest page (gallery, albums, Find You), drawn by EventRouteShell in place of the
// shared one-line event footer (styles in src/app/sunlit-portrait.css). Laid out like Confetti Circle's footer: links to
// EveBash on the left, the legal pages and Contact us on the right, and in the middle the cover's date line and the
// couple's names in Instrument Serif (one line, shrunk to fit) with "Made with EveBash" under them. Ink, so the page
// ends as it began, on the dark of the cover.

export function PortraitFooter({ event }: { event: Event }) {
    const title = displayCoupleTitle(event.title || "");
    const intro = portraitIntro(event.category, event.date);
    const date = event.date?.trim();
    const titleRef = useRef<HTMLParagraphElement>(null);
    useFitOneLine(titleRef, title);

    return (
        <footer className={`portrait-footer ${portraitDisplay.variable}`}>
            <div className="portrait-footer__inner">
                <nav className="portrait-footer__links portrait-footer__links--left" aria-label="EveBash">
                    {THEME_FOOTER_LEFT_LINKS.map((link) => (
                        <Link key={link.href} href={link.href} className="portrait-footer__link">{link.label}</Link>
                    ))}
                </nav>

                <div className="portrait-footer__middle">
                    {(intro || date) && (
                        <p className="portrait-footer__line">
                            {intro && <span>{intro}</span>}
                            {intro && date && !portraitIntroJoinsDate(intro) && <span className="portrait-footer__heart" aria-hidden="true">♥</span>}
                            {date && <span>{date}</span>}
                        </p>
                    )}
                    <p ref={titleRef} className="portrait-footer__couple">{title}</p>
                    <p className="portrait-footer__made">
                        Made with <Link href="/" className="portrait-footer__brand">EveBash</Link>
                    </p>
                </div>

                <nav className="portrait-footer__links portrait-footer__links--right" aria-label="Legal and contact">
                    {THEME_FOOTER_RIGHT_LINKS.map((link) => (
                        <Link key={link.href} href={link.href} className="portrait-footer__link">{link.label}</Link>
                    ))}
                </nav>
            </div>
        </footer>
    );
}
