"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ChevronRight, User, LogOut, Camera } from "lucide-react";
import { Event } from "@/lib/database";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

interface EventNavbarProps {
    mainEventTitle: string;
    mainEventId: string;
    subEvents: Event[];
    isShared?: boolean;
    basePath: string;
    activeGalleryId?: string;
    onSelectGallery?: (gallery: Event | null) => void;
}

export function EventNavbar({ mainEventTitle, mainEventId, subEvents, isShared, basePath, activeGalleryId, onSelectGallery }: EventNavbarProps) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [guestDetails, setGuestDetails] = useState<{name: string, phone: string} | null>(null);
    const pathname = usePathname();
    const { user, logout } = useAuth();

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem("wedding_guest_details");
            if (saved) {
                try {
                    // eslint-disable-next-line react-hooks/set-state-in-effect
                    setGuestDetails(JSON.parse(saved));
                } catch {}
            }
        }
    }, []);

    const activeName = user ? (user.name || user.email) : guestDetails?.name;
    const activeRole = user ? (user.role || 'User') : 'Guest';
    const activeIdentifier = user ? user.email : guestDetails?.phone;

    const handleLogout = async () => {
        if (user && logout) {
            await logout();
        }
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem("wedding_guest_details");
            window.location.reload();
        }
    };

    const sharedQuery = isShared ? "?shared=true" : "";

    // Generate core links
    const navLinks: Array<{ name: string; href: string; gallery: Event | null; isGallery: boolean }> = [
        { name: "Home", href: `${basePath}${sharedQuery}`, gallery: null, isGallery: true },
        ...subEvents.map(sub => ({
            name: sub.title || sub.id,
            href: onSelectGallery ? `/events/${sub.id}${sharedQuery}` : `${basePath}/events/${sub.id}${sharedQuery}`,
            gallery: sub,
            isGallery: true
        })),
        { name: "Event Partners", href: `${basePath}/event-partners${sharedQuery}`, gallery: null, isGallery: false }
    ];

    if (user?.role === "admin") {
        navLinks.push({ name: "Admin", href: `${basePath}/admin`, gallery: null, isGallery: false });
    }

    const isLinkActive = (href: string) => {
        const cleanPathname = pathname.split('?')[0];
        const linkPath = href.split('?')[0];
        return cleanPathname === linkPath;
    };

    const isGalleryActive = (gallery: Event | null) => (activeGalleryId || mainEventId) === (gallery?.id || mainEventId);

    return (
        <>
            <motion.nav
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                className="fixed top-0 inset-x-0 z-50 transition-all duration-300 px-6 py-3 bg-white/95 backdrop-blur-md shadow-sm border-b border-stone-100"
            >
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    {/* Left: Main Event Title */}
                    <Link
                        href={`${basePath}${sharedQuery}`}
                        onClick={(e) => {
                            if (onSelectGallery) {
                                e.preventDefault();
                                onSelectGallery(null);
                            }
                        }}
                        className="text-2xl font-serif font-bold italic tracking-tight transition-colors z-50 relative text-slate-900"
                    >
                        {mainEventTitle}
                    </Link>

                    {/* Right: Desktop Navigation */}
                    <div className="hidden md:flex items-center space-x-2">
                        {navLinks.map((link) => {
                            const isActive = link.isGallery && onSelectGallery ? isGalleryActive(link.gallery) : isLinkActive(link.href);
                            const className = cn(
                                "px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all",
                                isActive
                                    ? "bg-slate-900 text-white shadow-md"
                                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            );

                            if (link.isGallery && onSelectGallery) {
                                return (
                                    <button
                                        key={link.name}
                                        type="button"
                                        onClick={() => onSelectGallery(link.gallery)}
                                        className={className}
                                    >
                                        {link.name}
                                    </button>
                                );
                            }

                            return (
                                <Link
                                    key={link.name}
                                    href={link.href}
                                    className={className}
                                >
                                    {link.name}
                                </Link>
                            );
                        })}

                        {activeName && (
                            user ? (
                                <Link
                                    href="/profile"
                                    aria-label="Profile"
                                    title="Profile"
                                    className="ml-4 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white text-slate-700 transition-all hover:bg-slate-50"
                                >
                                    {user.profileImage ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={user.profileImage} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                        <User className="h-5 w-5" />
                                    )}
                                </Link>
                            ) : (
                                <button
                                    onClick={handleLogout}
                                    className="ml-4 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-all hover:bg-slate-50"
                                    aria-label="Logout"
                                >
                                    <LogOut className="h-5 w-5" />
                                </button>
                            )
                        )}
                    </div>

                    {/* Mobile Menu Toggle */}
                    <div className="md:hidden z-50 relative flex items-center gap-2">
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="p-2 rounded-full active:scale-95 transition-transform"
                        >
                            {mobileMenuOpen ? (
                                <X className="text-slate-900" />
                            ) : (
                                <Menu className="text-slate-900" />
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
                                <p className="text-xs font-bold text-stone-600 uppercase tracking-widest mb-4">Main Event</p>
                                <Link
                                    href={`${basePath}${sharedQuery}`}
                                    onClick={(e) => {
                                        if (onSelectGallery) {
                                            e.preventDefault();
                                            onSelectGallery(null);
                                        }
                                        setMobileMenuOpen(false);
                                    }}
                                    className="text-3xl font-serif font-bold italic text-slate-900 flex items-center justify-between group"
                                >
                                    <span>{mainEventTitle}</span>
                                    <ChevronRight className="text-stone-600 group-hover:text-slate-900 transition-colors" />
                                </Link>
                            </div>

                            <div>
                                <p className="text-xs font-bold text-stone-600 uppercase tracking-widest mb-6">Menu</p>
                                <div className="space-y-4">
                                    {navLinks.map((link) => {
                                        const isActive = link.isGallery && onSelectGallery ? isGalleryActive(link.gallery) : isLinkActive(link.href);
                                        const className = cn(
                                            "block w-full p-4 rounded-2xl text-left text-lg font-bold transition-all border border-transparent",
                                            isActive
                                                ? "bg-slate-900 text-white shadow-sm"
                                                : "hover:bg-stone-50 text-slate-600"
                                        );

                                        if (link.isGallery && onSelectGallery) {
                                            return (
                                                <button
                                                    key={link.name}
                                                    type="button"
                                                    onClick={() => {
                                                        onSelectGallery(link.gallery);
                                                        setMobileMenuOpen(false);
                                                    }}
                                                    className={className}
                                                >
                                                    {link.name}
                                                </button>
                                            );
                                        }

                                        return (
                                            <Link
                                                key={link.name}
                                                href={link.href}
                                                onClick={() => setMobileMenuOpen(false)}
                                                className={className}
                                            >
                                                {link.name}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>

                            {activeName && (
                                <div className="mt-8 pt-8 border-t border-stone-100">
                                    <div className="flex items-center space-x-4 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-royal-gold text-white flex items-center justify-center font-bold">
                                            {activeName.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900">{activeName}</p>
                                            <p className="text-[10px] text-stone-500 uppercase tracking-widest">{activeIdentifier || activeRole}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        {user && (
                                            <>
                                                <Link
                                                    href="/profile"
                                                    onClick={() => setMobileMenuOpen(false)}
                                                    className="flex items-center space-x-3 w-full p-4 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-stone-50 rounded-2xl transition-all border border-transparent"
                                                >
                                                    <User className="w-5 h-5" />
                                                    <span>My Profile</span>
                                                </Link>
                                                <Link
                                                    href={user.role === "admin" && !user.delegatedBy ? "/admin/dashboard" : "/dashboard"}
                                                    onClick={() => setMobileMenuOpen(false)}
                                                    className="flex items-center space-x-3 w-full p-4 text-sm font-bold text-sky-600 hover:text-sky-700 hover:bg-sky-50 rounded-2xl transition-all border border-transparent"
                                                >
                                                    <Camera className="w-5 h-5" />
                                                    <span>{user.role === "admin" && !user.delegatedBy ? "Admin Dashboard" : "Manage Galleries"}</span>
                                                </Link>
                                            </>
                                        )}
                                        <button
                                            onClick={handleLogout}
                                            className="flex items-center space-x-3 w-full p-4 text-sm font-bold text-rose-500 hover:bg-rose-50 rounded-2xl transition-all border border-transparent"
                                        >
                                            <LogOut className="w-5 h-5" />
                                            <span>Logout</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
