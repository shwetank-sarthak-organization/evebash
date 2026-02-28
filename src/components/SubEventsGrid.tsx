"use client";

import Link from "next/link";
import Image from "next/image";
import { Event } from "@/lib/firestore";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { ArrowUpRight } from "lucide-react";

interface SubEventsGridProps {
    subEvents: Event[];
    basePath: string;
}

export function SubEventsGrid({ subEvents, basePath }: SubEventsGridProps) {
    if (!subEvents || subEvents.length === 0) {
        return (
            <div className="text-center py-20 opacity-50 italic font-serif">
                No galleries available yet.
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {subEvents.map((sub, index) => (
                <ScrollReveal key={sub.id} delay={index * 0.1}>
                    <Link href={`${basePath}/events/${sub.id}`} className="group block relative aspect-[4/5] overflow-hidden rounded-2xl bg-stone-100 shadow-sm border border-black/5 hover:border-black/20 transition-all duration-500">
                        {sub.coverImage ? (
                            <Image
                                src={sub.coverImage}
                                alt={sub.title}
                                fill
                                className="object-cover grayscale-[0.2] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700 ease-out"
                            />
                        ) : (
                            <div className="w-full h-full bg-stone-200" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500" />

                        <div className="absolute inset-x-0 bottom-0 p-6 text-white flex justify-between items-end">
                            <div>
                                <h3 className="text-2xl font-serif font-bold italic mb-1 group-hover:-translate-y-1 transition-transform duration-300">{sub.title}</h3>
                                <p className="text-sm font-mono tracking-widest uppercase opacity-80 group-hover:-translate-y-1 transition-transform duration-300 delay-75">{sub.date || "Gallery"}</p>
                            </div>
                            <div className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center backdrop-blur-sm group-hover:bg-white group-hover:text-black transition-colors duration-300 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100">
                                <ArrowUpRight className="w-5 h-5" />
                            </div>
                        </div>
                    </Link>
                </ScrollReveal>
            ))}
        </div>
    );
}
