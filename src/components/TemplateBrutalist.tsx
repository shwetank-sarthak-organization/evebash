"use client";

import React from "react";
import Image from "next/image";
import { Event } from "@/lib/firestore";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

interface TemplateBrutalistProps {
    event: Event;
    children?: React.ReactNode;
}

export function TemplateBrutalist({ event, children }: TemplateBrutalistProps) {
    return (
        <div className="min-h-screen bg-zinc-900 text-lime-400 font-mono selection:bg-lime-400 selection:text-black">

            {/* Grid Lines Overlay */}
            <div className="fixed inset-0 z-0 pointer-events-none opacity-20"
                style={{ backgroundImage: 'linear-gradient(to right, #333 1px, transparent 1px), linear-gradient(to bottom, #333 1px, transparent 1px)', backgroundSize: '40px 40px' }}
            />

            <header className="relative w-full min-h-screen flex flex-col justify-between p-4 md:p-12 border-b border-lime-400/50">

                {/* Top Bar */}
                <div className="flex justify-between items-start">
                    <div className="border border-lime-400 p-2 text-xs uppercase">
                        <p>System: Wedding_OS</p>
                        <p>Status: Online</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] uppercase">ID: {event.id}</p>
                        <p className="text-[10px] uppercase">DATE: {event.date || "Unknown"}</p>
                    </div>
                </div>

                {/* Middle Hero */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-lime-400">
                    <div className="p-8 border-r border-lime-400 flex flex-col justify-center bg-zinc-900 z-10">
                        <ScrollReveal>
                            <h1 className="text-6xl md:text-8xl font-bold uppercase tracking-tighter leading-[0.85] mb-8 text-white mix-blend-difference">
                                {event.title}
                            </h1>
                        </ScrollReveal>
                        <ScrollReveal delay={0.2}>
                            <p className="text-sm md:text-base border-l-2 border-lime-400 pl-4 max-w-sm uppercase">
                                {event.description}
                            </p>
                        </ScrollReveal>
                    </div>

                    <div className="relative aspect-square md:aspect-auto h-full border-b md:border-b-0 border-lime-400 overflow-hidden grayscale hover:grayscale-0 transition-all duration-300">
                        {event.coverImage && (
                            <>
                                <Image src={event.coverImage} fill className="object-cover" alt="" />
                                <div className="absolute inset-0 bg-lime-400/20 mix-blend-overlay" />
                            </>
                        )}
                        <div className="absolute bottom-0 left-0 bg-lime-400 text-black px-2 py-1 text-xs font-bold uppercase">
                            Fig. 1.0 // Cover
                        </div>
                    </div>
                </div>

                {/* Bottom Marquee */}
                <div className="overflow-hidden whitespace-nowrap py-4 bg-lime-400 text-black font-bold uppercase text-2xl tracking-widest mt-8">
                    <p className="animate-marquee">
                        Celebrating {event.title} /// Celebrating {event.title} /// Celebrating {event.title} ///
                    </p>
                </div>
            </header>

            {/* Content */}
            {children && (
                <main className="border-x border-lime-400/30 max-w-[95%] mx-auto min-h-screen">
                    <div className="grid grid-cols-12 border-b border-lime-400/30">
                        <div className="col-span-1 border-r border-lime-400/30 p-4 hidden md:block text-[10px] uppercase [writing-mode:vertical-rl]">
                            Gallery Index
                        </div>
                        <div className="col-span-12 md:col-span-11 p-4 md:p-12">
                            {children}
                        </div>
                    </div>
                </main>
            )}

            <footer className="p-12 border-t border-lime-400 bg-zinc-950 text-lime-400/50 text-xs uppercase font-bold text-center">
                [ End of Stream ]
            </footer>
        </div>
    );
}
