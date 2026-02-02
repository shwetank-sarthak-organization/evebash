"use client";

import React from "react";
import Image from "next/image";
import { Event } from "@/lib/firestore";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

interface TemplateCinematicProps {
    event: Event;
    children?: React.ReactNode;
}

export function TemplateCinematic({ event, children }: TemplateCinematicProps) {
    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-purple-500 selection:text-white overflow-x-hidden">

            {/* Background Glows */}
            <div className="fixed top-0 left-0 w-[500px] h-[500px] bg-purple-900/20 rounded-full blur-[128px] pointer-events-none" />
            <div className="fixed bottom-0 right-0 w-[600px] h-[600px] bg-blue-900/10 rounded-full blur-[128px] pointer-events-none" />

            {/* Hero */}
            <header className="relative w-full h-screen flex flex-col justify-end p-8 md:p-16">
                {/* Fullscreen Video/Image Background */}
                <div className="absolute inset-0 z-0">
                    {event.coverImage && (
                        <Image
                            src={event.coverImage}
                            alt={event.title}
                            fill
                            className="object-cover opacity-60"
                            priority
                        />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                </div>

                <div className="relative z-10 max-w-4xl">
                    <ScrollReveal delay={0.2}>
                        <p className="text-purple-400 font-bold tracking-[0.3em] uppercase mb-4 text-sm animate-pulse">
                            Now Showing
                        </p>
                    </ScrollReveal>

                    <ScrollReveal>
                        <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-6 leading-none">
                            {event.title}
                        </h1>
                    </ScrollReveal>

                    <ScrollReveal delay={0.4}>
                        <p className="text-xl md:text-2xl text-gray-300 font-light max-w-2xl leading-relaxed">
                            {event.description}
                        </p>
                    </ScrollReveal>

                    <div className="mt-12 flex space-x-4">
                        <div className="h-1 w-20 bg-purple-500 rounded-full shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
                        <div className="h-1 w-4 bg-gray-700 rounded-full" />
                        <div className="h-1 w-4 bg-gray-700 rounded-full" />
                    </div>
                </div>
            </header>

            {/* Content Stream */}
            {children && (
                <main className="relative z-10 py-20 px-4">
                    <div className="max-w-[90rem] mx-auto">
                        <div className="flex items-center space-x-4 mb-12 opacity-50">
                            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Featured Scenes</span>
                            <div className="h-px bg-gray-800 flex-1" />
                        </div>
                        {children}
                    </div>
                </main>
            )}

            <footer className="bg-black py-20 text-center text-gray-600 border-t border-gray-900">
                <p className="text-xs font-mono uppercase tracking-widest">Directed by {event.title}</p>
            </footer>
        </div>
    );
}
