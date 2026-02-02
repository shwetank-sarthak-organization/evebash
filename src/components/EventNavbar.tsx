"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ChevronRight, User } from "lucide-react";
import { Event } from "@/lib/firestore";
import { cn } from "@/lib/utils";

interface EventNavbarProps {
    mainEventTitle: string;
    mainEventId: string;
    subEvents: Event[];
    isShared?: boolean;
}

export function EventNavbar({ mainEventTitle, mainEventId, subEvents, isShared }: EventNavbarProps) {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const sharedQuery = isShared ? "?shared=true" : "";

    return (
        <>
            <motion.nav
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                className={cn(
                    "fixed top-0 inset-x-0 z-50 transition-all duration-300 px-6 py-4",
                    scrolled
                        ? "bg-white/80 backdrop-blur-md shadow-sm py-3"
                        : "bg-transparent py-5"
                )}
            >
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    {/* Left: Main Event Title */}
                    <Link
                        href={`/events/${mainEventId}${sharedQuery}`}
                        className={cn(
                            "text-2xl font-serif font-bold italic tracking-tight transition-colors z-50 relative",
                            scrolled ? "text-slate-900" : "text-slate-900 mix-blend-difference text-white"
                        )}
                    >
                        {mainEventTitle}
                    </Link>

                    {/* Right: Desktop Navigation */}
                    <div className="hidden md:flex items-center space-x-1">
                        {subEvents.map((sub) => {
                            const isActive = pathname === `/events/${sub.id}`;
                            return (
                                <Link
                                    key={sub.id}
                                    href={`/events/${sub.id}${sharedQuery}`}
                                    className={cn(
                                        "px-4 py-2 rounded-full text-sm font-bold uppercase tracking-widest transition-all",
                                        isActive
                                            ? "bg-royal-gold text-white shadow-md"
                                            : scrolled
                                                ? "text-slate-600 hover:bg-slate-100"
                                                : "text-white/80 hover:bg-white/10 hover:text-white"
                                    )}
                                >
                                    {sub.title}
                                </Link>
                            );
                        })}

                        {/* Profile Icon (Desktop) - Links to Profile Page */}
                        <Link
                            href="/profile"
                            className={cn(
                                "ml-2 p-2 rounded-full transition-all",
                                scrolled
                                    ? "text-slate-600 hover:bg-slate-100"
                                    : "text-white/80 hover:bg-white/10 hover:text-white"
                            )}
                        >
                            <User className="w-5 h-5" />
                        </Link>
                    </div>

                    {/* Mobile Menu Toggle */}
                    <div className="md:hidden z-50 relative flex items-center gap-2">
                        {/* Profile Icon (Mobile) - Links to Profile Page */}
                        <Link
                            href="/profile"
                            className={cn(
                                "p-2 rounded-full transition-transform active:scale-95",
                                scrolled ? "text-slate-900" : "text-white mix-blend-difference"
                            )}
                        >
                            <User className="w-6 h-6" />
                        </Link>

                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="p-2 rounded-full active:scale-95 transition-transform"
                        >
                            {mobileMenuOpen ? (
                                <X className={scrolled ? "text-slate-900" : "text-white mix-blend-difference"} />
                            ) : (
                                <Menu className={scrolled ? "text-slate-900" : "text-white mix-blend-difference"} />
                            )}
                        </button>
                    </div>
                </div>
            </motion.nav>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, x: "100%" }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: "100%" }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="fixed inset-0 z-40 bg-white/95 backdrop-blur-xl md:hidden flex flex-col pt-24 px-8"
                    >
                        <div className="space-y-6">
                            <div className="pb-6 border-b border-stone-100">
                                <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Main Event</p>
                                <Link
                                    href={`/events/${mainEventId}${sharedQuery}`}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="text-3xl font-serif font-bold italic text-slate-900 flex items-center justify-between group"
                                >
                                    <span>{mainEventTitle}</span>
                                    <ChevronRight className="text-stone-300 group-hover:text-royal-gold transition-colors" />
                                </Link>
                            </div>

                            <div>
                                <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-6">Galleries</p>
                                <div className="space-y-4">
                                    {subEvents.map((sub) => (
                                        <Link
                                            key={sub.id}
                                            href={`/events/${sub.id}${sharedQuery}`}
                                            onClick={() => setMobileMenuOpen(false)}
                                            className={cn(
                                                "block p-4 rounded-2xl text-lg font-bold transition-all border border-transparent",
                                                pathname === `/events/${sub.id}`
                                                    ? "bg-stone-50 border-royal-gold/20 text-royal-gold shadow-sm"
                                                    : "hover:bg-stone-50 text-slate-600"
                                            )}
                                        >
                                            {sub.title}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
