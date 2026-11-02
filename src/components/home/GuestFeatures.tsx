"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Briefcase, Download, Heart, LockKeyhole, Palette, PartyPopper, QrCode, ScanFace, Sparkles, Trophy } from "lucide-react";
import { displayFont, homeEase, Reveal, SectionHeader } from "./HomeUI";
import { cn } from "@/lib/utils";
import { photos } from "./photos";

// The event type picked in the tabs changes the big photo, its line and the album examples.
const eventTypes = [
    {
        label: "Wedding",
        icon: Sparkles,
        photo: photos.celebration,
        text: "From haldi to reception, every photo and video in one place.",
        albums: ["Haldi", "Mehendi", "Sangeet", "Pheras", "Reception"],
    },
    {
        label: "Fest",
        icon: PartyPopper,
        photo: photos.fest,
        text: "Three days, every stage, one gallery for the whole campus.",
        albums: ["Day 1", "Day 2", "Main stage", "Backstage", "Pro night"],
    },
    {
        label: "Sports",
        icon: Trophy,
        photo: photos.sports,
        text: "Every heat, every finish line and every podium.",
        albums: ["Day 1", "Day 2", "Heats", "Finals", "Prize ceremony"],
    },
    {
        label: "Corporate",
        icon: Briefcase,
        photo: photos.corporate,
        text: "Keynotes, sessions, awards and the team dinner after.",
        albums: ["Keynote", "Sessions", "Awards", "Networking", "Team dinner"],
    },
];

const features = [
    { icon: ScanFace, title: "Find You", text: "Guests upload a selfie and see the photos they're in." },
    { icon: QrCode, title: "Link or QR code", text: "Share it in a message, or print it for the venue." },
    { icon: Download, title: "Download all", text: "Save one photo or the whole gallery in one go." },
    { icon: LockKeyhole, title: "Access control", text: "An open gallery, or one only invited guests can view." },
    { icon: Heart, title: "Favourites and comments", text: "Guests mark the shots they love and leave a note." },
    { icon: Palette, title: "Gallery designs", text: "Pick a design that matches the feel of your event." },
];

export default function GuestFeatures() {
    const reducedMotion = useReducedMotion();
    const [active, setActive] = useState(0);
    const eventType = eventTypes[active];

    return (
        <section id="features" className="scroll-mt-20 bg-[var(--site-bg)] py-16 md:py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                {/* Heading on the left; on large screens the event type tabs sit to its right */}
                <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                    <Reveal>
                        <SectionHeader
                            align="left"
                            title="Built for every kind of event"
                            description="From a 50-person team offsite to a 5,000-student fest."
                        />
                    </Reveal>

                    <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                        {eventTypes.map(({ label, icon: Icon }, index) => (
                            <button
                                key={label}
                                type="button"
                                aria-pressed={index === active}
                                onClick={() => setActive(index)}
                                className={cn(
                                    "flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-accent)]",
                                    index === active ? "home-btn-gold" : "home-btn-glass text-[var(--site-muted)] hover:text-[var(--site-text)]"
                                )}
                            >
                                <Icon className="h-4 w-4" aria-hidden />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <Reveal className="mt-10">
                    <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
                        {/* The event type's photo */}
                        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-[var(--site-border)] lg:aspect-auto lg:min-h-[500px]">
                            <AnimatePresence initial={false}>
                                <motion.div
                                    key={eventType.label}
                                    className="absolute inset-0"
                                    initial={reducedMotion ? false : { opacity: 0 }}
                                    animate={{ opacity: 1, transition: { duration: 0.3, ease: homeEase } }}
                                    exit={{ opacity: 0, transition: { duration: 0.2 } }}
                                >
                                    <Image src={eventType.photo.src} alt={eventType.photo.alt} fill sizes="(min-width: 1024px) 50vw, 95vw" className="object-cover" />
                                </motion.div>
                            </AnimatePresence>
                            <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/30 to-transparent" />
                            <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
                                <h3 className={cn(displayFont.className, "text-[1.75rem] font-semibold text-[#FFF9F0] md:text-[2rem]")}>Photos and videos, together</h3>
                                <p className="mt-2 max-w-sm text-[#D3D8DF]">{eventType.text}</p>
                            </div>
                        </div>

                        <div className="flex flex-col justify-center">
                            {/* Albums, matching the event type */}
                            <h3 className="text-lg font-semibold text-[var(--site-text)]">Albums for every part of the event</h3>
                            <p className="mt-1.5 text-sm leading-relaxed text-[var(--site-subtle)]">Every day, session or ceremony gets its own album.</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {eventType.albums.map((album, index) => (
                                    <motion.span
                                        key={`${eventType.label}-${album}`}
                                        initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0, transition: { duration: 0.2, delay: index * 0.03, ease: homeEase } }}
                                        className={cn(
                                            "rounded-full px-3 py-1 text-sm",
                                            index === 0 ? "home-btn-gold" : "border border-[var(--site-border)] text-[var(--site-muted)]"
                                        )}
                                    >
                                        {album}
                                    </motion.span>
                                ))}
                            </div>

                            {/* The rest of the platform, as a list */}
                            <ul className="mt-8 grid gap-x-8 gap-y-6 border-t border-[var(--site-border)] pt-8 sm:grid-cols-2">
                                {features.map(({ icon: Icon, title, text }) => (
                                    <li key={title} className="flex gap-3">
                                        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--home-accent)]" aria-hidden />
                                        <div>
                                            <h3 className="font-semibold text-[var(--site-text)]">{title}</h3>
                                            <p className="mt-1 text-sm leading-relaxed text-[var(--site-subtle)]">{text}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}
