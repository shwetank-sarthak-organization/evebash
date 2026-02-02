"use client";

import React from "react";
import Image from "next/image";
import { Event } from "@/lib/firestore";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

interface TemplatePolaroidProps {
    event: Event;
    children?: React.ReactNode;
}

export function TemplatePolaroid({ event, children }: TemplatePolaroidProps) {
    return (
        <div className="min-h-screen bg-stone-200 text-stone-800 font-sans selection:bg-rose-200">
            {/* Background Patterns (Corkboard / Texture) */}
            <div className="fixed inset-0 opacity-10 pointer-events-none z-0" style={{ backgroundImage: 'radial-gradient(#444 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>

            <header className="relative w-full py-24 px-4 flex flex-col items-center">
                <ScrollReveal>
                    <div className="relative bg-white p-4 pb-16 shadow-lg rotate-[-2deg] max-w-2xl mx-auto transform hover:rotate-0 transition-transform duration-500">
                        {/* Tape Effect */}
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-32 h-10 bg-yellow-100/80 backdrop-blur-sm rotate-2 shadow-sm" />

                        {event.coverImage ? (
                            <div className="relative aspect-[4/3] w-full bg-stone-100 overflow-hidden grayscale-[20%] sepia-[30%]">
                                <Image src={event.coverImage} alt={event.title} fill className="object-cover" />
                            </div>
                        ) : (
                            <div className="aspect-[4/3] w-full bg-stone-100 flex items-center justify-center text-stone-400">
                                No Preview
                            </div>
                        )}

                        <h1 className="absolute bottom-4 left-0 right-0 text-center font-cursive text-4xl md:text-5xl text-stone-800" style={{ fontFamily: '"Comic Sans MS", "Chalkboard SE", "Marker Felt", sans-serif' }}>
                            {event.title}
                        </h1>
                    </div>
                </ScrollReveal>

                <div className="mt-12 text-center max-w-lg mx-auto relative">
                    {/* Sticker */}
                    <div className="absolute -right-10 top-0 w-20 h-20 bg-rose-400 rounded-full flex items-center justify-center -rotate-12 shadow-md animate-pulse">
                        <span className="text-white font-bold text-xs uppercase tracking-widest text-center">Since<br />{new Date().getFullYear()}</span>
                    </div>

                    <ScrollReveal delay={0.2}>
                        <p className="font-serif italic text-xl text-stone-600">
                            "{event.description}"
                        </p>
                    </ScrollReveal>
                </div>
            </header>

            {children && (
                <main className="max-w-7xl mx-auto px-4 py-12 relative z-10">
                    <div className="bg-white/50 backdrop-blur-md rounded-3xl p-8 md:p-12 shadow-xl border border-white/60">
                        {children}
                    </div>
                </main>
            )}

            <footer className="py-12 text-center text-stone-500 font-mono text-xs">
                Captured on Film
            </footer>
        </div>
    );
}
