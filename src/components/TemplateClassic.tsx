"use client";

import Image from "next/image";
import { Event } from "@/lib/database";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

interface TemplateClassicProps {
    event: Event;
    children?: React.ReactNode;
}

/** Applies the host's cover settings (focus point, zoom, fit), as the dashboard cards do. */
function coverImageStyle(event: Event): React.CSSProperties {
    if (event.coverMode === "fit") return { objectFit: "contain" };
    const x = Math.max(0, Math.min(100, 50 + (event.coverOffsetX || 0)));
    const y = Math.max(0, Math.min(100, 50 + (event.coverOffset || 0)));
    return { objectFit: "cover", objectPosition: `${x}% ${y}%`, transform: `scale(${event.coverScale || 1})` };
}

/** Sage line, dot, line (the same divider as the app's Classic White) */
function ClassicDivider({ className }: { className?: string }) {
    return (
        <div className={`flex items-center justify-center gap-3 ${className || ""}`} aria-hidden="true">
            <span className="h-px w-12 bg-[#8B9A6E]/50 md:w-16" />
            <span className="h-1.5 w-1.5 rotate-45 bg-[#8B9A6E]" />
            <span className="h-px w-12 bg-[#8B9A6E]/50 md:w-16" />
        </div>
    );
}

// Colours come from the Classic White palette (src/lib/webTemplateTheme.ts): ivory #F7F2EB, white mat,
// dark green text #2C352E, muted #596653, sage #8B9A6E (lines only: too light for text).
export function TemplateClassic({ event, children }: TemplateClassicProps) {
    const location = "location" in event && typeof event.location === "string" ? event.location.trim() : "";
    const details = [event.date?.trim(), location].filter(Boolean).join(" · ");
    const description = event.description?.trim();

    const scrollToContent = () => {
        document.getElementById("event-content")?.scrollIntoView({ behavior: "smooth" });
    };

    return (
        <div className="classic-template min-h-screen bg-[#F7F2EB] text-[#2C352E] font-sans selection:bg-[#8B9A6E]/30">
            <main className="px-4 pt-28 pb-16 sm:px-6 md:pt-32 md:pb-20 lg:px-8">
                {/* The title shows straight away (it's the page's largest text), the rest fades in */}
                <div className="mx-auto max-w-4xl text-center">
                    {details && (
                        <p className="mb-5 text-xs font-semibold uppercase tracking-[0.3em] text-[#596653] md:text-sm">
                            {details}
                        </p>
                    )}
                    <h1 className="font-serif text-[clamp(2.5rem,7vw,5.5rem)] leading-[1.08] tracking-tight text-[#2C352E] break-words [text-wrap:balance]">
                        {event.title}
                    </h1>

                    <ScrollReveal delay={0.1}>
                        <ClassicDivider className="mt-8" />
                    </ScrollReveal>

                    {description && (
                        <ScrollReveal delay={0.2}>
                            <p className="mx-auto mt-8 max-w-2xl whitespace-pre-line font-serif text-lg italic leading-relaxed text-[#596653] md:text-xl">
                                {description}
                            </p>
                        </ScrollReveal>
                    )}
                </div>

                {/* Cover in a thin white mat, kept modest so the gallery stays close */}
                {event.coverImage && (
                    <ScrollReveal delay={0.3} direction="up">
                        <div className="mx-auto mt-10 w-full max-w-2xl bg-white p-1.5 shadow-[0_14px_40px_-22px_rgba(44,53,46,0.4)] md:mt-12 md:p-2">
                            <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#F7F2EB] sm:aspect-[3/2]">
                                <Image
                                    src={event.coverImage}
                                    alt={event.title}
                                    fill
                                    sizes="(min-width: 720px) 672px, 100vw"
                                    style={coverImageStyle(event)}
                                    priority
                                />
                            </div>
                        </div>
                    </ScrollReveal>
                )}

                {children && (
                    <ScrollReveal delay={0.4}>
                        <div className="mt-12 text-center md:mt-14">
                            <button
                                onClick={scrollToContent}
                                className="group inline-flex items-center gap-3 rounded-full bg-[#596653] px-8 py-4 text-white shadow-md transition-colors duration-300 hover:bg-[#2C352E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2C352E]"
                            >
                                <span className="text-sm font-medium uppercase tracking-widest">Open Gallery</span>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5 transition-transform group-hover:translate-y-0.5" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
                                </svg>
                            </button>
                        </div>
                    </ScrollReveal>
                )}
            </main>

            {/* Full width with the page's side padding, like the navbar. The gallery's header comes from the event page */}
            {children && (
                <section id="event-content" className="classic-gallery-content border-t border-[#EAE2D6] py-16 md:py-20">
                    <div className="w-full px-4 sm:px-6 lg:px-8">
                        {children}
                    </div>
                </section>
            )}
        </div>
    );
}
