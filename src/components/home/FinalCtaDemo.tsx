"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check, Download, FolderClosed, Lock, ScanFace, Users } from "lucide-react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { playfair } from "@/app/fonts";
import { cn } from "@/lib/utils";
import { homeEase } from "./HomeUI";
import { photos } from "./photos";

// The usual way (a busy group chat and a Drive link) next to EveBash (one gallery link). Generic chat and folder
// UI on purpose: no WhatsApp or Google Drive logos or brand colours. Loops while on screen.
const sceneMs = [5600, 4800];
const ease = homeEase;

const appear = (animate: boolean, delay: number, from: Record<string, number> = { opacity: 0, y: 10 }) => ({
    initial: animate ? from : false,
    animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, delay, ease } },
});

const chat = [
    { who: "Mausi", text: "Please send all the haldi photos here" },
    { who: "Rohan", drive: true },
    { who: "Priya", text: "Link not opening, need access" },
    { who: "Uncle", text: "Photos are so blurry on WhatsApp" },
    { who: "Neha", text: "Who has the stage photos??" },
];

function UsualWay({ animate }: { animate: boolean }) {
    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-[var(--site-muted)]">
                    <Users className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--site-text)]">Wedding family group</p>
                    <p className="text-xs text-[var(--site-muted)]">243 members</p>
                </div>
                <motion.span {...appear(animate, 2.6, { opacity: 0, scale: 0.6 })} className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-[var(--site-text)]">
                    128 unread
                </motion.span>
            </div>

            <div className="flex flex-1 flex-col justify-end gap-2.5 overflow-hidden pt-3">
                {chat.map((message, index) => (
                    <motion.div key={index} {...appear(animate, 0.3 + index * 0.5)} className="max-w-[85%]">
                        <p className="mb-0.5 text-[11px] font-semibold text-[var(--site-muted)]">{message.who}</p>
                        {message.drive ? (
                            <div className="flex items-center gap-3 rounded-2xl rounded-tl-sm bg-white/[0.07] px-3 py-2.5">
                                <FolderClosed className="h-6 w-6 shrink-0 text-[var(--site-muted)]" aria-hidden />
                                <div className="min-w-0">
                                    <p className="truncate text-sm text-[var(--site-text)]">Wedding_photos_FINAL (2).zip</p>
                                    <p className="flex items-center gap-1 text-xs text-[var(--site-muted)]">
                                        <Lock className="h-3 w-3" aria-hidden />
                                        4.2 GB, request access
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <p className="rounded-2xl rounded-tl-sm bg-white/[0.07] px-3 py-2 text-sm text-[var(--site-subtle)]">{message.text}</p>
                        )}
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

function WithEveBash({ animate }: { animate: boolean }) {
    return (
        <div className="flex h-full flex-col justify-center gap-3">
            <motion.div {...appear(animate, 0.2, { opacity: 0, scale: 0.94 })} className="overflow-hidden rounded-2xl border border-[var(--site-border)] bg-[#060A18]">
                <div className="relative h-24 sm:h-28">
                    <Image src={photos.couple.src} alt="" fill sizes="(min-width: 1024px) 35vw, 90vw" className="object-cover object-[center_30%]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#060A18] to-transparent" />
                    <p className={cn(playfair.className, "absolute bottom-2 left-4 text-xl text-[#F5EFE2]")}>
                        Isha <span className="text-[#CA9C69]">weds</span> Vihaan
                    </p>
                </div>
                <div className="space-y-3 p-3">
                    <motion.div {...appear(animate, 0.6)} className="flex gap-1.5">
                        {["Haldi", "Sangeet", "Reception"].map((album, index) => (
                            <span
                                key={album}
                                className={cn(
                                    "rounded-full px-2.5 py-0.5 text-[11px]",
                                    index === 0 ? "bg-[#CA9C69] text-[#060A18]" : "border border-white/15 text-[#AEB6CC]"
                                )}
                            >
                                {album}
                            </span>
                        ))}
                    </motion.div>
                    <div className="grid grid-cols-3 gap-1.5">
                        {[photos.haldi, photos.celebration, photos.matched1].map((photo, index) => (
                            <motion.div key={photo.src} {...appear(animate, 0.8 + index * 0.12, { opacity: 0, scale: 0.9 })} className="relative aspect-square overflow-hidden rounded-md">
                                <Image src={photo.src} alt="" fill sizes="(min-width: 1024px) 12vw, 28vw" className="object-cover" />
                            </motion.div>
                        ))}
                    </div>
                    <motion.div {...appear(animate, 1.3)} className="flex gap-2">
                        <span className="home-btn-gold flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold">
                            <ScanFace className="h-3.5 w-3.5" aria-hidden />
                            Find my photos
                        </span>
                        <span className="home-btn-glass flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold">
                            <Download className="h-3.5 w-3.5" aria-hidden />
                            Download all
                        </span>
                    </motion.div>
                </div>
            </motion.div>
            <motion.p {...appear(animate, 1.8)} className="flex items-center justify-center gap-2 text-sm font-semibold text-[var(--site-text)]">
                <Check className="h-4 w-4 text-[var(--home-accent)]" aria-hidden />
                Shared with 243 guests by one link
            </motion.p>
        </div>
    );
}

export default function FinalCtaDemo() {
    const ref = useRef<HTMLDivElement>(null);
    const reducedMotion = useReducedMotion();
    const inView = useInView(ref, { amount: 0.4 });
    // Reduced motion: hold on the EveBash scene.
    const [scene, setScene] = useState(0);
    const [plays, setPlays] = useState(0);

    useEffect(() => {
        if (inView && !reducedMotion) setPlays((count) => count + 1);
    }, [inView, reducedMotion]);

    useEffect(() => {
        if (!inView || reducedMotion) return;
        const timer = setTimeout(() => setScene((index) => (index + 1) % sceneMs.length), sceneMs[scene]);
        return () => clearTimeout(timer);
    }, [inView, reducedMotion, scene, plays]);

    const shown = reducedMotion ? 1 : scene;
    const animate = !reducedMotion && plays > 0;

    return (
        <div ref={ref} role="img" aria-label="A busy family group chat with a Drive link that needs access, replaced by one EveBash gallery shared with all the guests">
            <div className="relative h-[400px] overflow-hidden">
                <AnimatePresence initial={false} mode="wait">
                    <motion.div
                        key={`${shown}-${plays}`}
                        className="h-full"
                        initial={animate ? { opacity: 0, scale: 0.98 } : false}
                        animate={{ opacity: 1, scale: 1, transition: { duration: 0.3, ease } }}
                        exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.2 } }}
                    >
                        {shown === 0 ? <UsualWay animate={animate} /> : <WithEveBash animate={animate} />}
                    </motion.div>
                </AnimatePresence>
            </div>
            <div className="mt-3 flex justify-center gap-2 text-xs font-semibold">
                <span className={cn("rounded-full px-3 py-1", shown === 0 ? "bg-white/15 text-[var(--site-text)]" : "text-[var(--site-muted)]")}>The usual way</span>
                <span className={cn("rounded-full px-3 py-1", shown === 1 ? "home-btn-gold" : "text-[var(--site-muted)]")}>With EveBash</span>
            </div>
        </div>
    );
}
