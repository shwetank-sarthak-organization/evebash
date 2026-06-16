"use client";

import React from "react";
import Image from "next/image";
import { Event } from "@/lib/database";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

interface TemplateEditorialProps {
    event: Event;
    children?: React.ReactNode;
}

export function TemplateEditorial({ event, children }: TemplateEditorialProps) {
    return (
        <div className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white">
            {/* Header */}
            <header className="relative w-full pt-32 pb-12 border-b-4 border-black">
                <div className="max-w-[90rem] mx-auto px-6 grid grid-cols-12 gap-8 items-end">

                    <div className="col-span-12 md:col-span-8">
                        <ScrollReveal>
                            <h1 className="text-[12vw] leading-[0.8] font-black tracking-tighter uppercase mb-4">
                                {event.title.split(' ')[0]}
                                <br />
                                <span className="outline-text text-transparent stroke-black stroke-2" style={{ WebkitTextStroke: '2px black' }}>
                                    {event.title.split(' ').slice(1).join(' ') || "Event"}
                                </span>
                            </h1>
                        </ScrollReveal>
                    </div>

                    <div className="col-span-12 md:col-span-4 flex flex-col justify-end items-start md:items-end mb-4">
                        <ScrollReveal delay={0.2}>
                            <p className="font-serif text-2xl italic mb-4 max-w-xs md:text-right">
                                {event.description}
                            </p>
                            <div className="bg-black text-white px-4 py-2 text-sm font-bold uppercase tracking-widest inline-block transform -rotate-2">
                                {event.date || "Edition 01"}
                            </div>
                        </ScrollReveal>
                    </div>
                </div>
            </header>

            {/* Hero Image Band */}
            {event.coverImage && (
                <section className="w-full h-[60vh] md:h-[80vh] relative overflow-hidden border-b-4 border-black">
                    <Image
                        src={event.coverImage}
                        alt={event.title}
                        fill
                        className="object-contain bg-white grayscale hover:grayscale-0 transition-all duration-700"
                        priority
                    />
                    <div className="absolute inset-0 bg-black/10" />

                    <div className="absolute bottom-8 left-8 bg-white/90 backdrop-blur p-4 border border-black max-w-sm">
                        <p className="text-xs font-mono uppercase tracking-tight">
                            Featured Collection • {new Date().getFullYear()} • Vol. 1
                        </p>
                    </div>
                </section>
            )}

            {/* Main Content */}
            {children && (
                <main className="py-20 px-4 md:px-8">
                    <div className="max-w-[90rem] mx-auto">
                        <div className="flex items-center justify-between border-b border-black pb-4 mb-12">
                            <h2 className="text-4xl font-bold uppercase tracking-tighter">Galleries</h2>
                            <span className="font-mono text-xl">(08)</span>
                        </div>
                        {children}
                    </div>
                </main>
            )}

            <footer className="bg-black text-white py-16 px-8">
                <div className="max-w-[90rem] mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div>
                        <h3 className="text-6xl font-serif italic mb-4">The End.</h3>
                    </div>
                    <div className="flex flex-col justify-end items-start md:items-end font-mono text-sm opacity-60 uppercase">
                        <p>{event.title} © {new Date().getFullYear()}</p>
                        <p>Editorial Template</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
