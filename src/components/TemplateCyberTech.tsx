"use client";

import React from "react";
import Image from "next/image";
import { Event } from "@/lib/database";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

interface TemplateCyberTechProps {
    event: Event;
    children?: React.ReactNode;
}

export function TemplateCyberTech({ event, children }: TemplateCyberTechProps) {
    const scrollToContent = () => {
        const contentElement = document.getElementById("event-content");
        if (contentElement) {
            contentElement.scrollIntoView({ behavior: "smooth" });
        }
    };

    return (
        <div className="min-h-screen bg-[#05070c] text-[#e2eafc] font-mono selection:bg-[#00f0ff] selection:text-black relative overflow-x-hidden pb-32">
            {/* Custom Embedded CSS for targeting child Gallery components (SubEventsGrid & MasonryGrid) */}
            <style dangerouslySetInnerHTML={{ __html: `
                .cyber-tech-gallery-override a,
                .cyber-tech-gallery-override .break-inside-avoid {
                    border-radius: 0.5rem !important;
                    border: 1px solid rgba(0, 240, 255, 0.35) !important;
                    background: rgba(13, 21, 39, 0.8) !important;
                    backdrop-filter: blur(12px) !important;
                    box-shadow: 0 0 15px rgba(0, 240, 255, 0.12) !important;
                    transition: all 0.3s ease !important;
                }
                .cyber-tech-gallery-override a:hover,
                .cyber-tech-gallery-override .break-inside-avoid:hover {
                    border-color: #00f0ff !important;
                    box-shadow: 0 0 25px rgba(0, 240, 255, 0.4), inset 0 0 15px rgba(0, 240, 255, 0.15) !important;
                    transform: translateY(-4px) !important;
                }
                .cyber-tech-gallery-override h2,
                .cyber-tech-gallery-override h3 {
                    color: #00f0ff !important;
                    font-family: monospace, Courier, sans-serif !important;
                    font-weight: 800 !important;
                    letter-spacing: 0.1em !important;
                    text-transform: uppercase !important;
                }
                .cyber-tech-gallery-override p {
                    color: #8ea8db !important;
                }
            ` }} />

            {/* Matrix Gridlines Pattern Background */}
            <div className="fixed inset-0 pointer-events-none opacity-20 z-0"
                 style={{
                     backgroundImage: "radial-gradient(circle, rgba(0, 240, 255, 0.25) 1px, transparent 1px)",
                     backgroundSize: "28px 28px"
                 }}
            />

            {/* CRT Scanline Horizontal Micro-Lines Overlay */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0 bg-[linear-[#00f0ff]_1px,_transparent_1px)] bg-[length:100%_4px]" />

            {/* Hero Section */}
            <main className="pt-36 pb-20 px-4 max-w-5xl mx-auto flex flex-col items-center justify-center text-center relative z-10">
                
                {/* Cyber Terminal Status Header */}
                <ScrollReveal>
                    <div className="inline-flex items-center gap-3 bg-[#0d1527] border border-[#00f0ff]/40 px-5 py-2 rounded-lg mb-8 shadow-[0_0_20px_rgba(0,240,255,0.2)]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#00f0ff] animate-ping" />
                        <span className="text-xs font-bold tracking-[0.2em] text-[#00f0ff]">
                            &gt; SYSTEM_STATUS: ONLINE // HACKATHON_GALLERY
                        </span>
                    </div>
                </ScrollReveal>

                {/* Cyber Hero Title with Tech Brackets */}
                <ScrollReveal delay={0.15}>
                    <div className="relative inline-block mb-6">
                        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold uppercase tracking-widest text-white drop-shadow-[0_0_30px_rgba(0,240,255,0.5)]">
                            &lt;{event.title}&gt;
                        </h1>
                    </div>
                </ScrollReveal>

                {/* Terminal Log Description Box */}
                {event.description && (
                    <ScrollReveal delay={0.25}>
                        <div className="max-w-2xl mx-auto mb-12 p-6 rounded-lg bg-[#0d1527]/90 border border-[#00f0ff]/30 text-left shadow-[0_0_30px_rgba(0,240,255,0.15)] relative">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#00f0ff]/20 text-[10px] text-[#8ea8db]">
                                <span className="w-2 h-2 rounded-full bg-red-500" />
                                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                                <span className="w-2 h-2 rounded-full bg-green-500" />
                                <span className="ml-2">terminal_output.log</span>
                            </div>
                            <p className="text-sm md:text-base text-[#8ea8db] leading-relaxed">
                                &gt; {event.description}
                            </p>
                        </div>
                    </ScrollReveal>
                )}

                {/* Featured Cover Image with Cyber Cyan Corner Brackets */}
                {event.coverImage && (
                    <ScrollReveal delay={0.35} className="w-full max-w-4xl mx-auto mb-16 px-2">
                        <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden border-2 border-[#00f0ff]/60 shadow-[0_0_35px_rgba(0,240,255,0.3)] group bg-[#0d1527]">
                            <Image
                                src={event.coverImage}
                                alt={event.title}
                                fill
                                className="object-cover group-hover:scale-105 transition-transform duration-700 opacity-90 group-hover:opacity-100"
                                priority
                            />
                            {/* Tech Cyber Corner Markers */}
                            <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-[#00f0ff] pointer-events-none" />
                            <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-[#00f0ff] pointer-events-none" />
                            <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-[#00f0ff] pointer-events-none" />
                            <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-[#00f0ff] pointer-events-none" />
                        </div>
                    </ScrollReveal>
                )}

                {/* Cyber Cyan Action CTA */}
                <ScrollReveal delay={0.45}>
                    <button
                        onClick={scrollToContent}
                        className="px-10 py-4 rounded-md bg-[#00f0ff] hover:bg-[#33f3ff] text-black font-black uppercase tracking-[0.25em] text-xs md:text-sm shadow-[0_0_25px_rgba(0,240,255,0.5)] hover:shadow-[0_0_45px_rgba(0,240,255,0.8)] active:scale-95 transition-all duration-300 cursor-pointer"
                    >
                        [ EXECUTE_GALLERY_LOAD ] ➔
                    </button>
                </ScrollReveal>

            </main>

            {/* Gallery Content Section */}
            {children && (
                <section id="event-content" className="relative z-10 max-w-7xl mx-auto px-4 pb-20">
                    <div className="text-center mb-12">
                        <h2 className="text-xl md:text-3xl font-extrabold uppercase tracking-widest text-[#00f0ff] drop-shadow-[0_0_15px_rgba(0,240,255,0.5)]">
                            {"// GALLERY_DATA_STREAM"}
                        </h2>
                        <div className="w-20 h-0.5 mx-auto mt-3 bg-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.8)]" />
                    </div>

                    <div className="cyber-tech-gallery-override">
                        {children}
                    </div>
                </section>
            )}
        </div>
    );
}
