"use client";

import React, { useState } from "react";
import { Play } from "lucide-react";
import { HLSVideoPlayer } from "@/components/ui/HLSVideoPlayer";
import type { ClassicGalleryVideo } from "@/components/classic/ClassicGalleryHeader";
import { CONFETTI_FRAME_SPECKS, confettiCoupleHeading } from "../../../shared/themes/confettiCircle";
import { SOCIAL_ICONS } from "@/components/icons/SocialIcons";
import { splitCoupleNames } from "../../../shared/text/coupleNames";
import {
    COUPLE_SIDES,
    SOCIAL_NETWORKS,
    SOCIAL_NETWORK_NAMES,
    defaultCoupleLabels,
    shownCouple,
    type CoupleBlock,
    type CouplePerson as CouplePersonContent,
    type CoupleSide,
} from "../../../shared/themes/themeContent";
import { EditChip, useGuestEditSpots } from "@/components/guestEdit/EditChip";
import { GUEST_EDIT_ENABLED } from "@/components/guestEdit/guestEditStore";

// Confetti Circle's section between the cover and the gallery header (styles in src/app/confetti-circle.css): a big
// heading, the highlight video (or, without one, the cover photo) in a frame that fades out at its edges like a
// watercolour, with paint specks and a white ribbon; the couple on either side, each with a few words and their
// social links.
//
// The host fills in the couple in Preview Guest Theme's edit mode (todo #10), saved in the main event's theme content
// (shared/themes/themeContent.ts). Only a side with a name shows, with only what was filled in; the ribbon says
// "Name ♥ Name" once both names are in, else the event's title. Nothing is taken from the title.
//
// While edit mode is off (NEXT_PUBLIC_GUEST_EDIT_MODE), hosts can't fill it in, so the section stays as it was: the two
// names in a "Name and Name" title, with placeholder words and icons.
const PLACEHOLDER_BIO = "A few words about them will show here once the couple adds them in the theme editor.";
const PLACEHOLDER_NETWORKS = ["facebook", "instagram", "x"] as const;

/** The section as it was before todo #10 (edit mode off): placeholder words and icons that link nowhere */
function PlaceholderPerson({ role, name }: { role: string; name: string }) {
    return (
        <div className="confetti-couple__person">
            <p className="confetti-couple__role">{role}</p>
            <h3 className="confetti-couple__name">{name}</h3>
            <p className="confetti-couple__bio">{PLACEHOLDER_BIO}</p>
            {/* Placeholders: no links until the couple adds theirs */}
            <ul className="confetti-couple__socials" aria-label={`${name}'s social links (not added yet)`}>
                {PLACEHOLDER_NETWORKS.map((network) => {
                    const Icon = SOCIAL_ICONS[network];
                    return (
                        <li key={network} className="confetti-couple__social" title={`${SOCIAL_NETWORK_NAMES[network]} (not added yet)`}>
                            <Icon aria-hidden="true" />
                            <span className="sr-only">{SOCIAL_NETWORK_NAMES[network]}</span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

/** One side as the host filled it in; while editing, a pencil (or, for an empty side, only a place to add it) */
function CouplePerson({ side, person, alone, editName }: {
    side: CoupleSide;
    person?: CouplePersonContent;
    /** The only side showing: phones give it the full width */
    alone: boolean;
    /** What the pencil calls this side ("bride"); set only while editing */
    editName?: string;
}) {
    const className = `confetti-couple__person confetti-couple__person--${side}${alone ? " confetti-couple__person--alone" : ""}`;
    if (!person) {
        return editName ? (
            <div className={className}>
                <EditChip field="couple" part={side} label={`Add ${editName}`} adding />
            </div>
        ) : null;
    }
    const links = SOCIAL_NETWORKS.filter((network) => person.links[network]);

    return (
        <div className={className}>
            {person.label && <p className="confetti-couple__role">{person.label}</p>}
            <h3 className="confetti-couple__name">{person.name}</h3>
            {person.about && <p className="confetti-couple__bio">{person.about}</p>}
            {links.length > 0 && (
                <ul className="confetti-couple__socials" aria-label={`${person.name}'s social links`}>
                    {links.map((network) => {
                        const Icon = SOCIAL_ICONS[network];
                        return (
                            <li key={network} className="confetti-couple__social">
                                <a href={person.links[network]} target="_blank" rel="noopener noreferrer nofollow" title={`${person.name} on ${SOCIAL_NETWORK_NAMES[network]}`}>
                                    <Icon aria-hidden="true" />
                                    <span className="sr-only">{`${person.name} on ${SOCIAL_NETWORK_NAMES[network]}`}</span>
                                </a>
                            </li>
                        );
                    })}
                </ul>
            )}
            {editName && (
                <div className="mt-4">
                    <EditChip field="couple" part={side} label={editName.charAt(0).toUpperCase() + editName.slice(1)} />
                </div>
            )}
        </div>
    );
}

export function ConfettiCoupleSection({ title, category, couple, video, coverImage, coverImageStyle }: {
    /** The main event's title: the ribbon's text until both names are filled in */
    title: string;
    category?: string;
    /** The couple as the host filled it in (the main event's theme content) */
    couple?: CoupleBlock;
    /** The gallery's highlight video; without one the frame shows the cover photo */
    video?: ClassicGalleryVideo | null;
    coverImage?: string;
    coverImageStyle?: React.CSSProperties;
}) {
    const [playing, setPlaying] = useState(false);
    const editing = useGuestEditSpots();
    const still = video?.poster || coverImage;

    // Edit mode off: as before todo #10
    const titleNames = GUEST_EDIT_ENABLED ? null : splitCoupleNames(title);
    // Edit mode on: only the sides the host named; while editing, both sides (an empty one as a place to add it)
    const shown = GUEST_EDIT_ENABLED ? shownCouple(couple) : {};
    const defaultLabels = defaultCoupleLabels(category);
    const editName = (side: CoupleSide) => {
        if (!editing) return undefined;
        const name = (couple?.[side]?.label.trim() || defaultLabels[side]).replace(/^the\s+/i, "");
        return (name || (side === "left" ? "first person" : "second person")).toLowerCase();
    };
    const sides = COUPLE_SIDES.filter((side) => shown[side] || editing);
    const ribbonNames = titleNames || (shown.left && shown.right ? [shown.left.name, shown.right.name] : null);
    const sideBySide = titleNames ? true : sides.length > 0;

    const person = (side: CoupleSide) => titleNames
        ? <PlaceholderPerson role={side === "left" ? "The Bride" : "The Groom"} name={titleNames[side === "left" ? 0 : 1]} />
        : sides.includes(side) && <CouplePerson side={side} person={shown[side]} alone={sides.length === 1} editName={editName(side)} />;

    return (
        <section className="confetti-couple" aria-label={confettiCoupleHeading(category)}>
            <h2 className="confetti-couple__heading">{confettiCoupleHeading(category)}</h2>

            <div className={sideBySide ? "confetti-couple__row" : "confetti-couple__row confetti-couple__row--single"}>
                {person("left")}

                <figure className={playing ? "confetti-couple__frame confetti-couple__frame--playing" : "confetti-couple__frame"}>
                    <div className="confetti-couple__specks" aria-hidden="true">
                        {CONFETTI_FRAME_SPECKS.map((speck, index) => (
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
                    {/* Edit mode (todo #11): the highlight video, or a place to add one (the frame shows the cover until then) */}
                    <EditChip field="video" label={video ? "Video" : "Add highlight video"} adding={!video} style={{ top: 12, right: 12 }} />
                    <figcaption className="confetti-couple__ribbon">
                        {ribbonNames ? (
                            <>
                                {ribbonNames[0]}
                                <span className="confetti-couple__heart" aria-label="and">♥</span>
                                {ribbonNames[1]}
                            </>
                        ) : title}
                    </figcaption>
                </figure>

                {person("right")}
            </div>
        </section>
    );
}
