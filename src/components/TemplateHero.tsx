"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { Event } from "@/lib/firestore";

interface TemplateHeroProps {
  event: Event;
  children?: React.ReactNode;
}

export function TemplateHero({ event, children }: TemplateHeroProps) {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  // Parallax effect
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const scrollToContent = () => {
    const contentElement = document.getElementById('event-content');
    if (contentElement) {
      contentElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 relative" ref={containerRef}>
      <section className="relative h-screen w-full overflow-hidden">
        <motion.div style={{ y, opacity }} className="absolute inset-0 z-0 h-[120%] -top-[10%]">
          {event.coverImage ? (
            <Image
              src={event.coverImage}
              alt={event.title}
              fill
              className="object-cover object-[50%_35%] opacity-90"
              priority
            />
          ) : (
            <div className="w-full h-full bg-slate-300" />
          )}
        </motion.div>

        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-900/60 to-transparent z-0"></div>

        <div className="relative z-10 flex flex-col justify-end items-center text-center px-4 pb-32 h-full max-w-5xl mx-auto">
          <ScrollReveal direction="down" delay={0.2}>
            <div className="inline-block border border-white/60 py-2 px-8 mb-6 bg-white/20 backdrop-blur-md rounded-full shadow-lg">
              <p className="text-sm md:text-lg text-white font-serif uppercase tracking-[0.2em]">
                {event.date || "Wedding Celebration"}
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.4}>
            <h1 className="text-5xl md:text-8xl font-serif text-white drop-shadow-md tracking-tight leading-tight mb-6">
              {event.title}
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={0.6}>
            <p className="text-lg md:text-xl text-white/90 font-light tracking-wide max-w-2xl mx-auto leading-relaxed drop-shadow-sm mb-12">
              {event.description || "Welcome to our wedding album. We are so happy to share our memories with you."}
            </p>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={0.8}>
            <button
              onClick={scrollToContent}
              className="inline-block px-8 py-4 bg-white text-slate-800 hover:bg-sky-50 transition-all duration-300 uppercase tracking-widest text-sm font-semibold rounded-lg shadow-xl hover:shadow-2xl hover:scale-105 transform"
            >
              View Gallery
            </button>
          </ScrollReveal>
        </div>
      </section>

      {children && (
        <section id="event-content" className="relative z-10 -mt-12 bg-slate-50 rounded-t-[3rem] py-20 shadow-2xl shadow-black/10 min-h-[50vh]">
          <div className="max-w-7xl mx-auto px-4">
            {children}
          </div>
        </section>
      )}

      <footer className="bg-stone-900 text-stone-600 py-12 text-center text-sm relative z-10">
        <p>© 2026 Wedding Album.</p>
      </footer>
    </div>
  );
}
