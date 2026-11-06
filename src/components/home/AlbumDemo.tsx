"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeftRight, Check, Heart, Lock, Send } from "lucide-react";
import { AnimatePresence, m, useInView, useReducedMotion } from "framer-motion";
import { homeEase } from "./HomeUI";
import { cn } from "@/lib/utils";
import { photos, type Photo } from "./photos";

// Album proofing in four scenes: the client picks photos, the photographer designs the pages, both review
// the same page live, and the album is approved for print. Loops while on screen; the step bar jumps to a
// scene. Reduced motion: no looping, the step bar still switches scenes.
const steps = ["Client picks the photos", "Photographer designs the pages", "Review together, live", "Approve for print"];
const sceneMs = [3200, 3000, 5600, 3400];

const gallery = [photos.couple, photos.matched1, photos.haldi, photos.matched4, photos.celebration, photos.matched3];
const picked = new Set([0, 3, 4]);
const ease = homeEase;

type Motion = { animate: boolean };

const appear = (animate: boolean, delay: number, from: Record<string, number | string> = { opacity: 0, y: 8 }) => ({
    initial: animate ? from : false,
    animate: { opacity: 1, y: 0, x: 0, scale: 1, rotate: 0, transition: { duration: 0.3, delay, ease } },
});

function Tile({ photo, className, children }: { photo: Photo; className?: string; children?: React.ReactNode }) {
    return (
        <div className={cn("relative overflow-hidden rounded-sm bg-[#E9E2D6]", className)}>
            <Image src={photo.src} alt="" fill sizes="(min-width: 1024px) 25vw, 45vw" className="object-cover" />
            {children}
        </div>
    );
}

// An album spread: one big photo on the left page, two on the right. `top` lets a scene swap the top-right photo.
function Spread({ top, className }: { top: React.ReactNode; className?: string }) {
    return (
        <div className={cn("relative grid aspect-[2/1] grid-cols-2 gap-1.5 rounded-md bg-[#F4EFE6] p-1.5 shadow-lg shadow-(color:--home-shadow) sm:gap-2 sm:p-2", className)}>
            <Tile photo={photos.couple} />
            <div className="grid grid-rows-2 gap-1.5 sm:gap-2">
                {top}
                <Tile photo={photos.celebration} />
            </div>
            <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-8 -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgba(0,0,0,0.18),transparent)]" />
        </div>
    );
}

function Pin({ animate, delay }: Motion & { delay: number }) {
    return (
        <m.span
            {...appear(animate, delay, { opacity: 0, scale: 0.5 })}
            className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[image:var(--home-gold)] text-[10px] font-bold text-[#13191F] shadow-lg ring-2 ring-white/80"
        >
            1
        </m.span>
    );
}

// The top-right photo, swapped for the haldi photo after `swapAt` seconds.
function SwappingTop({ animate, swapAt, pinAt }: Motion & { swapAt: number; pinAt: number }) {
    return (
        <Tile photo={photos.matched4}>
            <m.div className="absolute inset-0" initial={animate ? { opacity: 0 } : false} animate={{ opacity: 1, transition: { duration: 0.4, delay: swapAt } }}>
                <Image src={photos.haldi.src} alt="" fill sizes="(min-width: 1024px) 25vw, 45vw" className="object-cover" />
            </m.div>
            <Pin animate={animate} delay={pinAt} />
        </Tile>
    );
}

function Bubble({ who, text, gold, animate, delay }: Motion & { who: string; text: string; gold?: boolean; delay: number }) {
    return (
        <m.div {...appear(animate, delay)} className={cn("flex flex-col gap-1", gold && "items-end")}>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--site-muted)]">{who}</span>
            <p
                className={cn(
                    "max-w-[95%] rounded-2xl px-3 py-2 text-sm leading-snug",
                    gold ? "rounded-tr-sm border border-[var(--site-border)] text-[var(--site-subtle)]" : "rounded-tl-sm bg-[var(--site-surface-2)] text-[var(--site-subtle)]"
                )}
            >
                {text}
            </p>
        </m.div>
    );
}

function PickScene({ animate }: Motion) {
    return (
        <div className="flex h-full flex-col">
            <p className="text-sm font-semibold text-[var(--site-text)]">Client&apos;s favourites</p>
            <div className="mt-3 grid flex-1 grid-cols-3 grid-rows-2 gap-2 sm:gap-3">
                {gallery.map((photo, index) => (
                    <div key={photo.src} className="relative min-h-0 overflow-hidden rounded-xl">
                        <Image src={photo.src} alt="" fill sizes="(min-width: 1024px) 22vw, 30vw" className="object-cover" />
                        {picked.has(index) && (
                            <m.div
                                className="absolute inset-0 rounded-xl ring-2 ring-inset ring-[var(--home-accent)]"
                                {...appear(animate, 0.4 + [...picked].indexOf(index) * 0.45, { opacity: 0 })}
                            >
                                <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[image:var(--home-gold)] text-[#13191F]">
                                    <Heart className="h-3.5 w-3.5 fill-current" aria-hidden />
                                </span>
                            </m.div>
                        )}
                    </div>
                ))}
            </div>
            <m.div {...appear(animate, 2)} className="mt-3 flex items-center justify-center gap-2 self-center rounded-full bg-[var(--site-surface-2)] px-4 py-2 text-sm font-semibold text-[var(--site-text)]">
                <Send className="h-4 w-4 text-[var(--home-accent)]" aria-hidden />
                3 photos sent to the photographer
            </m.div>
        </div>
    );
}

function DesignScene({ animate }: Motion) {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-4">
            <p className="text-sm font-semibold text-[var(--site-text)]">Pages 6 and 7, draft 1</p>
            <div className="relative grid aspect-[2/1] w-full max-w-2xl grid-cols-2 gap-2 rounded-md bg-[#F4EFE6] p-2 shadow-lg shadow-(color:--home-shadow)">
                <m.div {...appear(animate, 0.3, { opacity: 0, scale: 0.85 })} className="relative overflow-hidden rounded-sm">
                    <Image src={photos.couple.src} alt="" fill sizes="(min-width: 1024px) 35vw, 45vw" className="object-cover" />
                </m.div>
                <div className="grid grid-rows-2 gap-2">
                    <m.div {...appear(animate, 0.7, { opacity: 0, scale: 0.85 })} className="relative overflow-hidden rounded-sm">
                        <Image src={photos.matched4.src} alt="" fill sizes="(min-width: 1024px) 35vw, 45vw" className="object-cover" />
                    </m.div>
                    <m.div {...appear(animate, 1.1, { opacity: 0, scale: 0.85 })} className="relative overflow-hidden rounded-sm">
                        <Image src={photos.celebration.src} alt="" fill sizes="(min-width: 1024px) 35vw, 45vw" className="object-cover" />
                    </m.div>
                </div>
                <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-10 -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgba(0,0,0,0.18),transparent)]" />
            </div>
        </div>
    );
}

function ReviewScene({ animate }: Motion) {
    return (
        <div className="flex h-full flex-col items-stretch gap-4 md:flex-row md:items-center md:gap-6">
            {/* Client's phone */}
            <div className="site-noir mx-auto w-full max-w-[260px] rounded-[1.75rem] border-[5px] border-[#26262C] bg-[#0E0E11] p-3 md:mx-0 md:w-[32%] md:max-w-none">
                <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--home-accent)]">Client&apos;s phone</p>
                <Spread top={<SwappingTop animate={animate} pinAt={0.4} swapAt={3.6} />} />
                <div className="mt-3 space-y-2">
                    <Bubble animate={animate} delay={0.7} who="Client" text="Can we use the haldi photo here instead?" />
                    <Bubble animate={animate} delay={3.9} who="Photographer" text="Done. Version 2 is up." gold />
                </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[var(--home-accent)] md:flex-col">
                <ArrowLeftRight className="h-5 w-5" aria-hidden />
                Live
            </div>

            {/* Photographer's laptop */}
            <div className="site-noir hidden flex-1 md:block">
                <div className="rounded-t-xl border border-[#2A2A30] bg-[#0E0E11] p-3">
                    <div className="mb-2 flex items-center justify-between">
                        <div className="flex gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-white/15" />
                            <span className="h-2 w-2 rounded-full bg-white/15" />
                            <span className="h-2 w-2 rounded-full bg-white/15" />
                        </div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--home-accent)]">Photographer&apos;s laptop</p>
                    </div>
                    <div className="grid grid-cols-[1.4fr_1fr] gap-3">
                        <Spread top={<SwappingTop animate={animate} pinAt={1.3} swapAt={2.6} />} />
                        <div className="space-y-2">
                            <Bubble animate={animate} delay={1.5} who="Client" text="Can we use the haldi photo here instead?" />
                            <Bubble animate={animate} delay={2.9} who="Photographer" text="Done. Version 2 is up." gold />
                        </div>
                    </div>
                </div>
                <div className="mx-auto h-2.5 w-[104%] -translate-x-[2%] rounded-b-lg bg-[#26262C]" />
            </div>
        </div>
    );
}

function ApproveScene({ animate }: Motion) {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-5">
            <div className="relative w-full max-w-2xl">
                <Spread top={<Tile photo={photos.haldi} />} />
                <m.div
                    {...appear(animate, 0.4, { opacity: 0, scale: 1.4, rotate: -12 })}
                    className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 -rotate-6 items-center gap-2 rounded-xl border-2 border-[#DCB579] bg-[#09090B]/85 px-5 py-2.5 text-xl font-bold uppercase tracking-widest text-[#F3DDAA] backdrop-blur"
                >
                    <Check className="h-6 w-6" aria-hidden />
                    Approved
                </m.div>
            </div>
            <div className="w-full max-w-md">
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--site-surface-2)]">
                    <m.div
                        className="h-full origin-left rounded-full bg-[image:var(--home-gold)]"
                        initial={animate ? { scaleX: 0.9 } : false}
                        animate={{ scaleX: 1, transition: { duration: 0.4, delay: 0.9, ease } }}
                    />
                </div>
                <m.p {...appear(animate, 1.3)} className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-[var(--site-text)]">
                    <Lock className="h-4 w-4 text-[var(--home-accent)]" aria-hidden />
                    20 of 20 pages approved. Locked for printing.
                </m.p>
            </div>
        </div>
    );
}

export default function AlbumDemo() {
    const ref = useRef<HTMLDivElement>(null);
    const reducedMotion = useReducedMotion();
    const inView = useInView(ref, { amount: 0.4 });
    const [scene, setScene] = useState(0);
    // Counts how often the demo came into view, so the current scene replays from the start each time.
    const [plays, setPlays] = useState(0);

    useEffect(() => {
        if (inView && !reducedMotion) setPlays((count) => count + 1);
    }, [inView, reducedMotion]);

    useEffect(() => {
        if (!inView || reducedMotion) return;
        const timer = setTimeout(() => setScene((index) => (index + 1) % steps.length), sceneMs[scene]);
        return () => clearTimeout(timer);
    }, [inView, reducedMotion, scene, plays]);

    const animate = !reducedMotion && plays > 0;
    const Scene = [PickScene, DesignScene, ReviewScene, ApproveScene][scene];

    return (
        <div ref={ref}>
            <div
                role="img"
                aria-label={`Album proofing, step ${scene + 1} of 4: ${steps[scene]}`}
                className="relative h-[560px] overflow-hidden rounded-3xl border border-[var(--site-border)] bg-[var(--site-bg)] p-4 shadow-2xl shadow-(color:--home-shadow) sm:p-6 md:h-[440px] lg:h-[480px] lg:p-8"
            >
                <AnimatePresence initial={false} mode="wait">
                    <m.div
                        key={`${scene}-${plays}`}
                        className="h-full"
                        initial={animate ? { opacity: 0 } : false}
                        animate={{ opacity: 1, transition: { duration: 0.25, ease } }}
                        exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    >
                        <Scene animate={animate} />
                    </m.div>
                </AnimatePresence>
            </div>

            {/* Step bar: shows the scene playing, and jumps to one */}
            <ol className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                {steps.map((label, index) => (
                    <li key={label}>
                        <button
                            type="button"
                            aria-pressed={index === scene}
                            onClick={() => setScene(index)}
                            className={cn(
                                "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-accent)]",
                                index === scene ? "home-btn-glass text-[var(--site-text)]" : "text-[var(--site-muted)] hover:text-[var(--site-text)]"
                            )}
                        >
                            <span
                                className={cn(
                                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs",
                                    index === scene ? "home-btn-gold" : "border border-[var(--site-border)]"
                                )}
                            >
                                {index + 1}
                            </span>
                            {label}
                        </button>
                    </li>
                ))}
            </ol>
        </div>
    );
}
