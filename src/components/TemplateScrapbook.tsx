"use client";

import React from "react";
import Image from "next/image";
import { Event } from "@/lib/firestore";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

interface TemplateScrapbookProps {
    event: Event;
    children?: React.ReactNode;
}

export function TemplateScrapbook({ event, children }: TemplateScrapbookProps) {
    return (
        <div className="min-h-screen bg-yellow-50 text-slate-800 font-sans selection:bg-orange-200 overflow-x-hidden">

            {/* Background Doodles */}
            <div className="fixed top-20 left-10 w-32 h-32 border-4 border-dashed border-sky-300 rounded-full opacity-50 pointer-events-none -rotate-12" />
            <div className="fixed bottom-40 right-10 w-32 h-32 border-4 border-orange-300 pointer-events-none rotate-45 transform" />

            {/* Header */}
            <header className="relative w-full py-32 px-4 text-center">
                <ScrollReveal>
                    <div className="inline-block relative">
                        <div className="absolute -inset-2 bg-pink-200 transform -rotate-2 rounded-lg" />
                        <h1 className="relative text-5xl md:text-7xl font-bold text-slate-800 transform rotate-1">
                            {event.title}
                        </h1>
                    </div>
                </ScrollReveal>

                <ScrollReveal delay={0.2} className="mt-8">
                    <div className="inline-block bg-white p-4 shadow-md rotate-2 border border-slate-200 max-w-lg transform">
                        <div className="w-4 h-4 rounded-full bg-slate-200 mx-auto mb-2" />
                        <p className="font-handwriting text-xl text-slate-600 italic leading-relaxed" style={{ fontFamily: 'cursive' }}>
                            {event.description}
                        </p>
                    </div>
                </ScrollReveal>

                {/* Tape */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[120%] w-32 h-8 bg-yellow-200/80 backdrop-blur-sm -rotate-3 opacity-80" />
            </header>

            {/* Hero Image Collage */}
            {event.coverImage && (
                <section className="relative w-full max-w-4xl mx-auto mb-24 h-[50vh]">
                    <div className="absolute inset-0 bg-blue-100 transform -rotate-3 rounded-3xl" />
                    <div className="absolute inset-0 bg-orange-100 transform rotate-2 rounded-3xl" />
                    <div className="absolute inset-2 bg-white p-4 shadow-xl rounded-2xl transform rotate-1">
                        <div className="relative w-full h-full rounded-xl overflow-hidden">
                            <Image src={event.coverImage} fill className="object-contain bg-stone-50" alt="" />
                        </div>
                    </div>

                    {/* Sticker */}
                    <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg transform rotate-12">
                        <span className="font-bold text-white text-sm uppercase">Love It!</span>
                    </div>
                </section>
            )}

            {/* Content */}
            {children && (
                <main className="max-w-7xl mx-auto px-4 pb-32">
                    <div className="relative py-12 px-8 bg-white border-2 border-slate-100 rounded-[3rem] shadow-sm">
                        {children}
                    </div>
                </main>
            )}

            <footer className="text-center py-12 font-bold text-slate-400 uppercase tracking-widest text-xs">
                Handmade with ❤️
            </footer>
        </div>
    );
}
