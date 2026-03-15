"use client";

import React from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { Event } from "@/lib/firestore";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { cn } from "@/lib/utils";

interface TemplateRoyalProps {
    event: Event;
    children?: React.ReactNode;
}

export function TemplateRoyal({ event, children }: TemplateRoyalProps) {
    return (
        <div className="min-h-screen bg-slate-950 text-amber-50 font-serif selection:bg-amber-900 selection:text-white">
            {/* Ornate Border Frame */}
            <div className="fixed inset-4 border border-amber-500/20 z-0 pointer-events-none" />
            <div className="fixed inset-6 border border-amber-500/10 z-0 pointer-events-none" />

            {/* Header / Hero */}
            <header className="relative w-full py-32 flex flex-col items-center justify-center text-center px-4 overflow-hidden">
                {/* Background Texture/Gradient */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black z-[-1]" />

                <ScrollReveal>
                    <div className="mb-6">
                        <span className="inline-block py-1 px-3 border-b border-amber-500/50 text-amber-500 text-xs tracking-[0.3em] uppercase">
                            {event.date || "The Wedding"}
                        </span>
                    </div>
                </ScrollReveal>

                <ScrollReveal delay={0.2}>
                    <h1 className="text-5xl md:text-8xl lg:text-9xl font-bold bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 bg-clip-text text-transparent mb-8 drop-shadow-sm font-serif italic tracking-tight">
                        {event.title}
                    </h1>
                </ScrollReveal>

                <ScrollReveal delay={0.3}>
                    <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent mb-8" />
                </ScrollReveal>

                <ScrollReveal delay={0.4}>
                    <p className="max-w-2xl text-amber-100/60 text-lg md:text-xl font-light leading-relaxed italic">
                        {event.description}
                    </p>
                </ScrollReveal>

                {/* Decorative Element */}
                <div className="absolute top-10 pointer-events-none opacity-20">
                    <Image src="/pattern-flourish.png" alt="" width={400} height={100} className="w-full max-w-xs" />
                    {/* Note: This image might not exist, using generic shapes or just CSS borders is safer if no assets */}
                </div>
            </header>

            {/* Featured Image */}
            {event.coverImage && (
                <ScrollReveal delay={0.5} className="w-full max-w-5xl mx-auto px-6 mb-24 relative z-10">
                    <div className="relative aspect-[16/9] md:aspect-[21/9] rounded-t-full overflow-hidden border-b-4 border-amber-600/40 shadow-2xl shadow-amber-900/20">
                        <Image
                            src={event.coverImage}
                            alt={event.title}
                            fill
                            className="object-contain bg-slate-900"
                            priority
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
                    </div>
                </ScrollReveal>
            )}

            {/* Content Area */}
            {children && (
                <main className="relative z-10 bg-slate-950 min-h-screen">
                    <div className="max-w-7xl mx-auto px-4 py-12">
                        <div className="text-center mb-16">
                            <h2 className="text-2xl font-serif text-amber-500 tracking-widest uppercase mb-2">The Collection</h2>
                            <div className="mx-auto w-px h-16 bg-gradient-to-b from-amber-500 to-transparent" />
                        </div>
                        {children}
                    </div>
                </main>
            )}

            <footer className="py-20 text-center border-t border-amber-900/20">
                <p className="text-amber-700 text-xs tracking-[0.2em] uppercase">Elegantly Captured</p>
            </footer>
        </div>
    );
}
