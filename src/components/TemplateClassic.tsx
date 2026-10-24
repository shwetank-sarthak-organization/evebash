"use client";

import { Event } from "@/lib/database";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { ClassicCoverPrint } from "@/components/classic/ClassicCoverPrint";

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
            {/* The first screen is exactly the window height (at least 640px) on every computer: navbar space, title,
                message card and cover print, "Open Gallery", with the gallery header starting right below. The print
                takes whatever height is left (ClassicCoverPrint). */}
            <main className="flex h-[max(100svh,640px)] flex-col px-4 pt-[108px] pb-[clamp(20px,4svh,48px)] sm:px-6 lg:px-8">
                {/* The title shows straight away (it's the page's largest text), the rest fades in */}
                <div className="mx-auto w-full max-w-4xl shrink-0 text-center">
                    {details && (
                        <p className="mb-[clamp(10px,2svh,20px)] text-xs font-semibold uppercase tracking-[0.3em] text-[#596653] md:text-sm">
                            {details}
                        </p>
                    )}
                    <h1 className="font-serif text-[clamp(2.25rem,min(6.5vw,8svh),5.5rem)] leading-[1.08] tracking-tight text-[#2C352E] break-words [text-wrap:balance]">
                        {event.title}
                    </h1>

                    <ScrollReveal delay={0.1}>
                        <ClassicDivider className="mt-[clamp(14px,3svh,32px)]" />
                    </ScrollReveal>
                </div>

                {/* Cover as a print in a white mount with the message card on its top edge; fills the space left */}
                {event.coverImage || description ? (
                    <ClassicCoverPrint coverImage={event.coverImage} alt={event.title} message={description} imageStyle={coverImageStyle(event)} />
                ) : (
                    <div className="flex-1" />
                )}

                {children && (
                    <div className="mt-[clamp(16px,3.5svh,40px)] shrink-0 text-center">
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
