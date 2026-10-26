"use client";

import Link from "next/link";
import { confettiDisplay } from "@/components/confetti/confettiFonts";
import { THEME_FOOTER_LEFT_LINKS as LEFT_LINKS, THEME_FOOTER_RIGHT_LINKS as RIGHT_LINKS } from "@/components/themeFooterLinks";
import { coupleInitials, displayCoupleTitle } from "../../../shared/text/coupleNames";

// Footer of every Confetti Circle guest page (gallery, albums, Find You), drawn by EventRouteShell in place of the
// shared one-line event footer (styles in src/app/confetti-circle.css). A torn-paper edge, then: links to EveBash on
// the left, the couple's initials "S ♥ R" with "Made with EveBash" under them in the middle, and the legal pages and
// Contact us on the right. Titles that aren't two names show the title instead of initials.

export function ConfettiFooter({ title }: { title: string }) {
    const initials = coupleInitials(title);

    return (
        <footer className={`confetti-footer ${confettiDisplay.variable}`}>
            <svg className="confetti-footer__tear" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true">
                {/* A grey shadow under the torn edge, then the footer's paper */}
                <path className="confetti-footer__tear-shadow" d="M0 18 L60 14 L110 22 L170 16 L230 24 L290 18 L350 27 L410 20 L470 26 L540 17 L600 25 L660 19 L720 28 L790 21 L850 26 L910 18 L980 25 L1040 20 L1110 27 L1170 19 L1230 24 L1300 17 L1360 23 L1440 18 L1440 60 L0 60 Z" />
                <path className="confetti-footer__tear-paper" d="M0 26 L50 22 L100 30 L160 24 L220 32 L280 26 L340 34 L400 28 L460 33 L530 25 L590 32 L650 27 L710 35 L780 29 L840 33 L900 26 L970 32 L1030 28 L1100 34 L1160 27 L1220 31 L1290 25 L1350 30 L1440 26 L1440 60 L0 60 Z" />
            </svg>

            <div className="confetti-footer__inner">
                <nav className="confetti-footer__links confetti-footer__links--left" aria-label="EveBash">
                    {LEFT_LINKS.map((link) => (
                        <Link key={link.href} href={link.href} className="confetti-footer__link">{link.label}</Link>
                    ))}
                </nav>

                <div className="confetti-footer__middle">
                    <p className={initials ? "confetti-footer__couple" : "confetti-footer__couple confetti-footer__couple--title"}>
                        {initials ? (
                            <>
                                {initials[0]}
                                <span className="confetti-footer__heart" aria-label="and">♥</span>
                                {initials[1]}
                            </>
                        ) : displayCoupleTitle(title)}
                    </p>
                    <p className="confetti-footer__made">
                        Made with <Link href="/" className="confetti-footer__brand">EveBash</Link>
                    </p>
                </div>

                <nav className="confetti-footer__links confetti-footer__links--right" aria-label="Legal and contact">
                    {RIGHT_LINKS.map((link) => (
                        <Link key={link.href} href={link.href} className="confetti-footer__link">{link.label}</Link>
                    ))}
                </nav>
            </div>
        </footer>
    );
}
