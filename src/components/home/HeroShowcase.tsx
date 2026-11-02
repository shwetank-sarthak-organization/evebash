"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Download, Images, Palette, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { playfair } from "@/app/fonts";
import { homeEase } from "./HomeUI";
import { photos, type Photo } from "./photos";

// A gallery in a browser window that demos itself: the real gallery designs, switching albums, playing a
// video. Visitors can jump to a feature with the buttons below it. Reduced motion: no autoplay, buttons work.

// Captures of the real Wedding designs from the host page's Design section, rendered with a sample couple.
const designs = [
    { id: "hero", name: "Midnight Hero" },
    { id: "royal", name: "Royal Emerald" },
    { id: "portrait", name: "Sunlit Portrait" },
    { id: "classic", name: "Classic White" },
    { id: "confetti", name: "Confetti Circle" },
    { id: "periwinkle", name: "Periwinkle Script" },
];

// Midnight Hero's colours (src/app/midnight-hero.css), the design galleries get by default.
const mh = { ink: "#060a18", velvet: "#0d1430", ivory: "#f5efe2", mist: "#aeb6cc", gold: "#ca9c69" };

// Haldi has two wide crowd photos, so its tiles show different parts of them.
const albums: { name: string; tiles: { photo: Photo; position?: string }[] }[] = [
    {
        name: "Wedding",
        tiles: [{ photo: photos.couple }, { photo: photos.mandap }, { photo: photos.matched4 }, { photo: photos.matched3 }, { photo: photos.matched1 }, { photo: photos.selfie }],
    },
    {
        name: "Haldi",
        tiles: [
            { photo: photos.haldi, position: "25% 50%" },
            { photo: photos.celebration, position: "50% 40%" },
            { photo: photos.haldi, position: "75% 40%" },
            { photo: photos.celebration, position: "10% 50%" },
            { photo: photos.celebration, position: "90% 50%" },
            { photo: photos.haldi, position: "50% 70%" },
        ],
    },
    {
        name: "Portraits",
        tiles: [{ photo: photos.matched2 }, { photo: photos.matched1 }, { photo: photos.selfie }, { photo: photos.matched4 }, { photo: photos.couple }, { photo: photos.matched3 }],
    },
];

const features = [
    { label: "Designs", icon: Palette },
    { label: "Albums", icon: Images },
    { label: "Videos", icon: Play },
];

// One frame every STEP ms; each frame says which feature is showing and what it shows.
const STEP = 1400;
const frames = [
    ...designs.map((_, design) => ({ feature: 0, design, album: 0 })),
    { feature: 1, design: 0, album: 1 },
    { feature: 1, design: 0, album: 2 },
    { feature: 1, design: 0, album: 0 },
    ...Array.from({ length: 5 }, () => ({ feature: 2, design: 0, album: 1 })),
];
const firstFrame = (feature: number) => frames.findIndex((frame) => frame.feature === feature);
const framesIn = (feature: number) => frames.filter((frame) => frame.feature === feature).length;

// Data Saver on, or a 2G/3G connection: the film is skipped and its poster shown instead.
function isLightDataConnection() {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    return !!connection && (connection.saveData === true || ["slow-2g", "2g", "3g"].includes(connection.effectiveType ?? ""));
}

// A short wedding clip (Pexels, free to use; under 1 MB), muted, with a progress bar that follows it. It is
// only fetched when this scene first shows, never with the page.
function EventFilm({ autoPlay }: { autoPlay: boolean }) {
    const [progress, setProgress] = useState(0);
    const [posterOnly] = useState(isLightDataConnection);
    const playing = autoPlay && !posterOnly;

    return (
        <>
            {posterOnly ? (
                <Image src="/home/event-film-poster.jpg" alt="" fill sizes="(min-width: 1024px) 45vw, 95vw" className="object-cover" />
            ) : (
                <video
                    src="/home/event-film.mp4"
                    poster="/home/event-film-poster.jpg"
                    autoPlay={playing}
                    muted
                    loop
                    playsInline
                    preload="none"
                    onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime / (event.currentTarget.duration || 1))}
                    className="absolute inset-0 h-full w-full object-cover"
                />
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-10">
                <div className="flex items-center gap-3 text-white">
                    {playing ? <Pause className="h-4 w-4 fill-current" aria-hidden /> : <Play className="h-4 w-4 fill-current" aria-hidden />}
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
                        <div className="h-full origin-left rounded-full bg-white" style={{ transform: `scaleX(${progress})` }} />
                    </div>
                    <span className="text-[11px] text-white/80">Wedding film</span>
                </div>
            </div>
        </>
    );
}

export default function HeroShowcase() {
    const reducedMotion = useReducedMotion();
    const [frameIndex, setFrameIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const frame = frames[frameIndex];
    const design = designs[frame.design];
    const album = albums[frame.album];

    useEffect(() => {
        if (reducedMotion || paused) return;
        const timer = setInterval(() => setFrameIndex((index) => (index + 1) % frames.length), STEP);
        return () => clearInterval(timer);
    }, [reducedMotion, paused]);

    const fade = {
        initial: reducedMotion ? false : { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.3, ease: homeEase } },
        exit: { opacity: 0, transition: { duration: 0.3 } },
    } as const;

    return (
        <div onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
            {/* Thin gold frame around the browser window */}
            <div className="rounded-2xl bg-[image:var(--home-gold)] p-px shadow-2xl shadow-black/50">
                <div
                    role="img"
                    aria-label="An EveBash gallery showing its designs, switching albums and playing a wedding film"
                    className="overflow-hidden rounded-[15px] bg-[#0E1318]"
                >
                    {/* Browser bar */}
                    <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
                        <div className="flex gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                        </div>
                        <div className="flex-1 truncate rounded-md bg-white/5 px-3 py-1 text-xs text-white/50">evebash.com/events/isha-and-vihaan</div>
                    </div>

                    {/* The page, at a desktop browser's proportions; anything below the fold is cut off. */}
                    <div className="relative aspect-[1280/860] overflow-hidden" style={{ background: mh.ink, color: mh.ivory }}>
                        <AnimatePresence initial={false}>
                            {frame.feature === 0 ? (
                                <motion.div key={design.id} className="absolute inset-0" {...fade}>
                                    <Image
                                        src={`/home/designs/${design.id}.jpg`}
                                        alt=""
                                        fill
                                        sizes="(min-width: 1024px) 45vw, 95vw"
                                        className="object-cover object-top"
                                        priority={frame.design === 0}
                                    />
                                    <span className="absolute right-3 top-3 rounded-full bg-black/65 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
                                        {design.name}
                                    </span>
                                </motion.div>
                            ) : (
                                <motion.div key="gallery" className="absolute inset-0" {...fade}>
                                    <div className="relative h-[34%] overflow-hidden">
                                        <Image src={photos.couple.src} alt="" fill sizes="(min-width: 1024px) 45vw, 95vw" className="object-cover object-[center_35%]" />
                                        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${mh.ink}, transparent 80%)` }} />
                                        <div className="absolute inset-x-0 bottom-0 px-5 pb-2">
                                            <p className={cn(playfair.className, "text-xl sm:text-2xl")}>
                                                Isha <span style={{ color: mh.gold }}>weds</span> Vihaan
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-3 px-5 py-2.5">
                                        <div className="flex gap-1.5">
                                            {albums.map(({ name }, index) => (
                                                <span
                                                    key={name}
                                                    className="rounded-full border px-3 py-1 text-[11px] font-medium transition-colors duration-300"
                                                    style={
                                                        index === frame.album
                                                            ? { background: mh.gold, borderColor: mh.gold, color: mh.ink }
                                                            : { borderColor: `${mh.mist}55`, color: mh.mist }
                                                    }
                                                >
                                                    {name}
                                                </span>
                                            ))}
                                        </div>
                                        <span className="hidden items-center gap-1.5 text-[11px] sm:flex" style={{ color: mh.mist }}>
                                            <Download className="h-3.5 w-3.5" aria-hidden />
                                            Download all
                                        </span>
                                    </div>

                                    <div className="relative grid grid-cols-3 gap-1.5 px-1.5">
                                        {album.tiles.map(({ photo, position }, index) => (
                                            <div key={index} className="relative aspect-square overflow-hidden rounded-md" style={{ background: mh.velvet }}>
                                                <AnimatePresence initial={false}>
                                                    <motion.div
                                                        key={`${photo.src}-${position}`}
                                                        className="absolute inset-0"
                                                        initial={reducedMotion ? false : { opacity: 0, scale: 1.04 }}
                                                        animate={{ opacity: 1, scale: 1, transition: { duration: 0.3, delay: index * 0.04, ease: homeEase } }}
                                                        exit={{ opacity: 0, transition: { duration: 0.2 } }}
                                                    >
                                                        <Image src={photo.src} alt="" fill sizes="(min-width: 1024px) 14vw, 30vw" className="object-cover" style={{ objectPosition: position }} />
                                                    </motion.div>
                                                </AnimatePresence>
                                                {index === 0 && (
                                                    <span className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur">
                                                        <Play className="h-3 w-3 fill-current" aria-hidden />
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* The video player, over the album */}
                                    <AnimatePresence>
                                        {frame.feature === 2 && (
                                            <motion.div
                                                className="absolute inset-x-1.5 bottom-1.5 top-[calc(34%+3rem)] overflow-hidden rounded-md bg-black"
                                                initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
                                                animate={{ opacity: 1, scale: 1, transition: { duration: 0.3, ease: homeEase } }}
                                                exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.2 } }}
                                            >
                                                <EventFilm autoPlay={!reducedMotion} />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Which feature is playing; tap to jump to one. */}
            <div className="mt-4 grid grid-cols-3 gap-2">
                {features.map(({ label, icon: Icon }, index) => {
                    const active = frame.feature === index;
                    return (
                        <button
                            key={label}
                            type="button"
                            onClick={() => setFrameIndex(firstFrame(index))}
                            aria-pressed={active}
                            className={cn(
                                "home-btn-glass relative flex items-center justify-center gap-2 overflow-hidden rounded-full px-3 py-2.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-accent)] sm:text-sm",
                                active ? "text-[var(--site-text)]" : "text-[var(--site-muted)] hover:text-[var(--site-text)]"
                            )}
                        >
                            {active && (
                                <motion.span
                                    key={`${index}-${paused}`}
                                    aria-hidden
                                    className="absolute inset-0 origin-left bg-royal-gold/15"
                                    initial={{ scaleX: reducedMotion || paused ? 1 : 0 }}
                                    animate={{ scaleX: 1, transition: { duration: reducedMotion || paused ? 0 : ((framesIn(index) - (frameIndex - firstFrame(index))) * STEP) / 1000, ease: "linear" } }}
                                />
                            )}
                            <Icon className="relative h-4 w-4 text-[var(--home-accent)]" aria-hidden />
                            <span className="relative">{label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
