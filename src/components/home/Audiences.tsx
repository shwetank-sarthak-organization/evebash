"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, m } from "framer-motion";
import { Camera, CalendarCheck, Check, Users } from "lucide-react";
import { displayFont, homeEase, PrimaryButton, Reveal, SectionHeader } from "./HomeUI";
import { cn } from "@/lib/utils";
import { photos } from "./photos";

const audiences = [
    {
        icon: Camera,
        label: "Photographers",
        title: "Deliver galleries your clients will love",
        photo: photos.photographer,
        points: [
            "Upload photos and videos straight after the shoot",
            "Organize every event into albums",
            "Clients pick album photos and approve pages in the app",
            "Guests find their own photos with Find You",
            "Share by link, or print a QR code for the venue",
            "A gallery design to match every event",
            "Plans from 10 GB to 1 TB as your work grows",
        ],
        cta: { href: "/pricing", label: "Compare plans" },
    },
    {
        icon: CalendarCheck,
        label: "Event organizers",
        title: "Every photo from your event, in one place",
        photo: photos.organizers,
        points: [
            "One gallery for the whole event",
            "Share it with every guest by link or QR code",
            "Choose who can view each event",
            "Give your team admin access to help manage it",
            "Albums for every day, session or ceremony",
            "Guests find their own photos with a selfie",
            "Guests open it in any browser, no app needed",
        ],
        cta: { href: "/login?mode=signup", label: "Create an event" },
    },
    {
        icon: Users,
        label: "Guests and clients",
        title: "Your memories, ready when you are",
        photo: photos.guests,
        points: [
            "Open the gallery on the web or in the app",
            "Find your own photos with a selfie",
            "Mark favourites and leave comments",
            "Download one photo or the whole gallery",
            "Watch the event videos right in the gallery",
            "Share it with family with one link",
            "Full quality, no blurry forwards",
        ],
        cta: { href: "/sample-galleries", label: "See a sample gallery" },
    },
];

export default function Audiences() {
    const [active, setActive] = useState(0);
    const audience = audiences[active];

    return (
        <section className="relative before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,rgba(220,181,121,0.45),transparent)] bg-[var(--site-surface)] py-16 md:py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                {/* Heading on the left; on large screens the audience tabs sit to its right */}
                <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                    <Reveal>
                        <SectionHeader align="left" title="Made for everyone at the event" />
                    </Reveal>

                    <div role="tablist" aria-label="Who EveBash is for" className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                        {audiences.map(({ icon: Icon, label }, index) => (
                            <button
                                key={label}
                                type="button"
                                role="tab"
                                id={`audience-tab-${index}`}
                                aria-selected={index === active}
                                aria-controls="audience-panel"
                                onClick={() => setActive(index)}
                                className={cn(
                                    "flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-accent)]",
                                    index === active
                                        ? "home-btn-gold"
                                        : "home-btn-glass text-[var(--site-muted)] hover:text-[var(--site-text)]"
                                )}
                            >
                                <Icon className="h-4 w-4" aria-hidden />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div
                    id="audience-panel"
                    role="tabpanel"
                    aria-labelledby={`audience-tab-${active}`}
                    className="mt-6 grid items-start gap-8 lg:grid-cols-2 lg:gap-14"
                >
                    <div className="relative order-last aspect-[4/3] overflow-hidden rounded-3xl">
                        <AnimatePresence initial={false}>
                            <m.div
                                key={audience.label}
                                className="absolute inset-0"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1, transition: { duration: 0.3, ease: homeEase } }}
                                exit={{ opacity: 0, transition: { duration: 0.3 } }}
                            >
                                <Image src={audience.photo.src} alt={audience.photo.alt} fill sizes="(min-width: 1024px) 45vw, 90vw" className="object-cover" />
                            </m.div>
                        </AnimatePresence>
                    </div>

                    <div className="flex flex-col justify-center">
                        <h3 className={cn(displayFont.className, "text-2xl font-semibold leading-tight text-[var(--site-text)] md:text-[1.625rem]")}>{audience.title}</h3>
                        <ul className="mt-5 space-y-3">
                            {audience.points.map((point) => (
                                <li key={point} className="flex items-start gap-3 text-lg text-[var(--site-subtle)]">
                                    <Check className="mt-1 h-5 w-5 shrink-0 text-[var(--home-accent)]" aria-hidden />
                                    {point}
                                </li>
                            ))}
                        </ul>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <PrimaryButton href={audience.cta.href}>{audience.cta.label}</PrimaryButton>
                            {/* Not wired up yet */}
                            <button
                                type="button"
                                title="Coming soon"
                                className="home-btn-glass inline-flex items-center justify-center whitespace-nowrap rounded-full px-6 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-accent)]"
                            >
                                Book a demo
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
