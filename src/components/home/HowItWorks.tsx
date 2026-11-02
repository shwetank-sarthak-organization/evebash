"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { displayFont, Reveal, SectionHeader } from "./HomeUI";
import { cn } from "@/lib/utils";

const steps = [
    {
        title: "Create your event",
        text: "Sign up free, name your event and pick a gallery design.",
    },
    {
        title: "Upload and organize",
        text: "Add photos and videos, and sort them into albums like Day 1, Stage or Awards night.",
    },
    {
        title: "Share by link or QR code",
        text: "Send the link on WhatsApp, or print the QR code for the venue.",
    },
    {
        title: "Guests view and download",
        text: "Clients and guests browse the gallery, find their own photos with a selfie, and save them.",
    },
];

// The line runs from the first dot's centre to the last one's; each dot lights up as the fill reaches it.
// Large screens centre each dot above its step.
function StepDot({ index, progress }: { index: number; progress: MotionValue<number> }) {
    const at = Math.min(Math.max(index / (steps.length - 1), 0.02), 0.98);
    const lit = useTransform(progress, [at - 0.03, at], [0, 1]);
    return (
        <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full lg:left-1/2 lg:-translate-x-1/2 border border-[var(--site-border)] bg-[var(--site-surface)] text-sm font-semibold text-[var(--site-muted)]">
            {index + 1}
            <motion.span style={{ opacity: lit }} className="absolute inset-0 flex items-center justify-center rounded-full bg-[image:var(--home-gold)] text-[#13191F]">
                {index + 1}
            </motion.span>
        </div>
    );
}

export default function HowItWorks() {
    const ref = useRef<HTMLOListElement>(null);
    const reducedMotion = useReducedMotion();
    const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 55%"] });
    const done = useMotionValue(1);
    // Reduced motion: the whole line is filled and every step lit from the start.
    const progress = reducedMotion ? done : scrollYProgress;
    // Small screens: the vertical line stops at the last dot, so measure where that step starts.
    const [lastStepTop, setLastStepTop] = useState(0);

    useLayoutEffect(() => {
        const list = ref.current;
        if (!list) return;
        const measure = () => setLastStepTop((list.lastElementChild as HTMLElement | null)?.offsetTop ?? 0);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(list);
        return () => observer.disconnect();
    }, []);

    // Large screens: dots are centred in four columns with 2rem gaps, so the line starts and ends half a column in.
    const across = { left: "calc((100% - 6rem) / 8)", right: "calc((100% - 6rem) / 8)" };
    const down = { top: "1.25rem", height: lastStepTop };

    return (
        <section className="relative before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,rgba(220,181,121,0.45),transparent)] bg-[var(--site-surface)] py-16 md:py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <Reveal>
                    <SectionHeader title="Live in four steps" />
                </Reveal>

                <ol ref={ref} className="relative mt-14 grid gap-12 lg:grid-cols-4 lg:gap-8">
                    {/* The line: down the left on small screens, across the top on large ones, dot 1 to dot 4. */}
                    <div aria-hidden style={down} className="absolute left-5 w-px bg-[var(--site-border)] lg:hidden" />
                    <motion.div aria-hidden style={{ ...down, scaleY: progress }} className="absolute left-5 w-0.5 origin-top -translate-x-px bg-[image:var(--home-gold)] lg:hidden" />
                    <div aria-hidden style={across} className="absolute top-5 hidden h-px bg-[var(--site-border)] lg:block" />
                    <motion.div aria-hidden style={{ ...across, scaleX: progress }} className="absolute top-5 hidden h-0.5 origin-left -translate-y-px bg-[image:var(--home-gold)] lg:block" />

                    {steps.map(({ title, text }, index) => (
                        <li key={title} className="relative pl-16 lg:pl-0 lg:pt-16 lg:text-center">
                            <StepDot index={index} progress={progress} />
                            <h3 className={cn(displayFont.className, "text-[1.375rem] font-semibold leading-snug text-[var(--site-text)]")}>{title}</h3>
                            <p className="mt-3 max-w-xs leading-relaxed text-[var(--site-subtle)] lg:mx-auto">{text}</p>
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    );
}
