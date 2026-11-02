"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ScanFace } from "lucide-react";
import { AnimatePresence, m, useInView, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { homeEase } from "./HomeUI";
import { photos, type Photo } from "./photos";

// Three guests, three selfies, and the photos each one is in. Loops while on screen; reduced motion shows
// one round at a time and the dots switch rounds.
const rounds: { selfie: Photo; matches: Photo[] }[] = [
    { selfie: photos.selfie, matches: [photos.matched1, photos.matched2, photos.matched3, photos.matched4] },
    {
        selfie: photos.groomSelfie,
        matches: [photos.couple, photos.matched1, photos.matched2, photos.matched3, photos.matched4, photos.groomSolo],
    },
    { selfie: photos.haldiSelfie, matches: [photos.haldi, photos.haldiFamily] },
];

// Where to crop wide photos in the tall result tiles, so the guest stays in frame.
const focus: Partial<Record<string, string>> = { [photos.haldi.src]: "25% 50%" };

const ROUND_MS = 4800;
const ease = homeEase;

export default function FindYouVisual() {
    const ref = useRef<HTMLDivElement>(null);
    const reducedMotion = useReducedMotion();
    const inView = useInView(ref, { amount: 0.4 });
    const [round, setRound] = useState(0);
    // Counts how often the demo came into view, so the current round replays from the start each time.
    const [plays, setPlays] = useState(0);

    useEffect(() => {
        if (inView && !reducedMotion) setPlays((count) => count + 1);
    }, [inView, reducedMotion]);

    useEffect(() => {
        if (!inView || reducedMotion) return;
        const timer = setTimeout(() => setRound((index) => (index + 1) % rounds.length), ROUND_MS);
        return () => clearTimeout(timer);
    }, [inView, reducedMotion, round, plays]);

    const animate = !reducedMotion && plays > 0;
    const { selfie, matches } = rounds[round];
    const key = `${round}-${plays}`;
    // 4 photos in a 2x2 grid, 6 in 3x2, 2 side by side
    const columns = matches.length > 4 ? "grid-cols-3" : "grid-cols-2";
    const rows = matches.length > 2 ? "grid-rows-2" : "grid-rows-1";

    return (
        <div ref={ref}>
            <div role="img" aria-label="Three guests each upload a selfie and see the event photos they appear in" className="grid grid-cols-[0.85fr_1fr] gap-3 sm:gap-4">
                {/* The selfie, with a scan line */}
                <div className="relative aspect-[3/4] overflow-hidden rounded-[1.75rem] ring-1 ring-[var(--site-border)]">
                    <AnimatePresence initial={false}>
                        <m.div
                            key={key}
                            className="absolute inset-0"
                            initial={animate ? { opacity: 0, x: -16 } : false}
                            animate={{ opacity: 1, x: 0, transition: { duration: 0.3, ease } }}
                            exit={{ opacity: 0, transition: { duration: 0.2 } }}
                        >
                            <Image src={selfie.src} alt="" fill sizes="(min-width: 1024px) 22vw, 42vw" className="object-cover" />
                            {/* Full-size layer with the line on its bottom edge, so the sweep is the selfie's own height. */}
                            <m.div
                                className="absolute inset-0"
                                initial={animate ? { y: "-100%", opacity: 0 } : false}
                                animate={{ y: "0%", opacity: [0, 1, 1, 0], transition: { duration: 0.9, delay: 0.25, ease: "easeInOut" } }}
                            >
                                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-[image:var(--home-gold)] shadow-[0_0_16px_3px_rgba(220,181,121,0.7)]" />
                            </m.div>
                        </m.div>
                    </AnimatePresence>
                    <div className="absolute inset-x-3 bottom-3 flex items-center justify-center gap-2 rounded-full bg-[#09090B]/80 px-3 py-2 text-xs font-semibold text-[var(--site-text)] backdrop-blur">
                        <ScanFace className="h-4 w-4 text-[var(--home-accent)]" aria-hidden />
                        Find my photos
                    </div>
                </div>

                {/* The photos they're in */}
                <div key={key} className={cn("grid gap-2 sm:gap-3", columns, rows)}>
                    {matches.map((photo, index) => (
                        <m.div
                            key={photo.src}
                            className="relative min-h-0 overflow-hidden rounded-2xl ring-2 ring-[var(--home-accent)]"
                            initial={animate ? { opacity: 0, scale: 0.94 } : false}
                            animate={{ opacity: 1, scale: 1, transition: { duration: 0.3, delay: 1 + index * 0.1, ease } }}
                        >
                            <Image src={photo.src} alt="" fill sizes="(min-width: 1024px) 14vw, 28vw" className="object-cover" style={{ objectPosition: focus[photo.src] }} />
                        </m.div>
                    ))}
                </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4">
                <m.p
                    key={key}
                    className="text-sm font-semibold text-[var(--site-text)]"
                    initial={animate ? { opacity: 0 } : false}
                    animate={{ opacity: 1, transition: { duration: 0.2, delay: 1.1 + matches.length * 0.1, ease } }}
                >
                    {matches.length} photos found from one selfie
                </m.p>
                <div className="flex gap-1">
                    {rounds.map((_, index) => (
                        <button
                            key={index}
                            type="button"
                            aria-label={`Show guest ${index + 1}`}
                            aria-pressed={index === round}
                            onClick={() => setRound(index)}
                            className="group flex h-6 min-w-6 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-accent)]"
                        >
                            {/* The dot stays small; the button around it is a 24px tap target. */}
                            <span
                                className={cn(
                                    "h-2.5 rounded-full transition-[width,background-color] duration-200",
                                    index === round ? "w-6 bg-[image:var(--home-gold)]" : "w-2.5 bg-[var(--site-surface-2)] group-hover:bg-[var(--site-muted)]"
                                )}
                            />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
