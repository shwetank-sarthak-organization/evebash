"use client";

import React, { useState } from "react";
import { Facebook, Instagram, Play } from "lucide-react";
import { HLSVideoPlayer } from "@/components/ui/HLSVideoPlayer";
import type { ClassicGalleryVideo } from "@/components/classic/ClassicGalleryHeader";
import { makeSpecks } from "@/components/confetti/confettiSpecks";
import { splitCoupleNames } from "../../../shared/text/coupleNames";

// Confetti Circle's section between the cover and the gallery header (styles in src/app/confetti-circle.css): a big
// heading, the highlight video (or, without one, the cover photo) in a frame that fades out at its edges like a
// watercolour, with paint specks and a white ribbon holding "Name ♥ Name"; the bride on the left and the groom on the
// right, each with a few words and their social links.
//
// The bride / groom words and social links are placeholders for now: hosts will fill them in the theme editor (todo
// #10 in evebash_todo.txt). Until then every gallery shows these.
const PLACEHOLDER_BIO = "A few words about them will show here once the couple adds them in the theme editor.";

/** The X (Twitter) logo; lucide only has the old bird */
function XLogo(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
    );
}
const PLACEHOLDER_SOCIALS = [
    { label: "Facebook", icon: Facebook },
    { label: "Instagram", icon: Instagram },
    { label: "X", icon: XLogo },
];

// Heavier at the top left, lighter at the bottom right, like the reference
const SPECKS = makeSpecks({ seed: 11, count: 60, heavyAngle: -Math.PI * 0.72, lightAngle: Math.PI * 0.25 });

/** The heading above the section, by the main event's category */
function confettiCoupleHeading(category?: string) {
    if (category === "Wedding") return "We're getting married!";
    if (category === "Anniversary") return "Still choosing each other";
    return "Our story";
}

function CouplePerson({ role, name }: { role: string; name: string }) {
    return (
        <div className="confetti-couple__person">
            <p className="confetti-couple__role">{role}</p>
            <h3 className="confetti-couple__name">{name}</h3>
            <p className="confetti-couple__bio">{PLACEHOLDER_BIO}</p>
            {/* Placeholders: no links until the couple adds theirs */}
            <ul className="confetti-couple__socials" aria-label={`${name}'s social links (not added yet)`}>
                {PLACEHOLDER_SOCIALS.map(({ label, icon: Icon }) => (
                    <li key={label} className="confetti-couple__social" title={`${label} (not added yet)`}>
                        <Icon aria-hidden="true" />
                        <span className="sr-only">{label}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export function ConfettiCoupleSection({ title, category, video, coverImage, coverImageStyle }: {
    /** The main event's title; "A and B" puts A on the left as the bride and B on the right as the groom */
    title: string;
    category?: string;
    /** The gallery's highlight video; without one the frame shows the cover photo */
    video?: ClassicGalleryVideo | null;
    coverImage?: string;
    coverImageStyle?: React.CSSProperties;
}) {
    const [playing, setPlaying] = useState(false);
    const couple = splitCoupleNames(title);
    const still = video?.poster || coverImage;

    return (
        <section className="confetti-couple" aria-label={confettiCoupleHeading(category)}>
            <h2 className="confetti-couple__heading">{confettiCoupleHeading(category)}</h2>

            <div className={couple ? "confetti-couple__row" : "confetti-couple__row confetti-couple__row--single"}>
                {couple && <CouplePerson role="The Bride" name={couple[0]} />}

                <figure className={playing ? "confetti-couple__frame confetti-couple__frame--playing" : "confetti-couple__frame"}>
                    <div className="confetti-couple__specks" aria-hidden="true">
                        {SPECKS.map((speck, index) => (
                            <span
                                key={index}
                                className={speck.pink ? "confetti-hero__speck" : "confetti-hero__speck confetti-hero__speck--orange"}
                                style={{ left: `${speck.left}%`, top: `${speck.top}%`, width: `${speck.size}cqi`, height: `${speck.size}cqi`, opacity: speck.opacity }}
                            />
                        ))}
                    </div>
                    <div className="confetti-couple__media">
                        {video && playing ? (
                            <HLSVideoPlayer
                                src={video.src}
                                mediaId={video.mediaId}
                                poster={video.poster}
                                autoPlay
                                controls
                                playsInline
                                className="confetti-couple__player"
                            />
                        ) : video ? (
                            <button type="button" className="confetti-couple__start" onClick={() => setPlaying(true)} aria-label="Play the highlight video">
                                {still && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={still} alt="" className="confetti-couple__still" style={video.poster ? undefined : coverImageStyle} />
                                )}
                                <span className="confetti-couple__play"><Play aria-hidden="true" /></span>
                            </button>
                        ) : still ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={still} alt="" className="confetti-couple__still" style={coverImageStyle} />
                        ) : (
                            <div className="confetti-couple__still confetti-couple__still--empty" />
                        )}
                    </div>
                    <figcaption className="confetti-couple__ribbon">
                        {couple ? (
                            <>
                                {couple[0]}
                                <span className="confetti-couple__heart" aria-label="and">♥</span>
                                {couple[1]}
                            </>
                        ) : title}
                    </figcaption>
                </figure>

                {couple && <CouplePerson role="The Groom" name={couple[1]} />}
            </div>
        </section>
    );
}
