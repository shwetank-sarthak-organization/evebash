"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ChevronRight, ChevronDown, User, LogOut, Camera, ScanFace, Download, Loader2 } from "lucide-react";
import { Event } from "@/lib/database";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { ProfileIcon } from "@/components/ProfileIcon";
import { royalDisplay } from "@/components/royal/royalFonts";
import { midnightScript } from "@/components/midnight/midnightFonts";
import { portraitDisplay } from "@/components/portrait/portraitFonts";
import { confettiDisplay } from "@/components/confetti/confettiFonts";
import { displayCoupleTitle } from "../../shared/text/coupleNames";

interface EventNavbarProps {
    mainEventTitle: string;
    mainEventId: string;
    subEvents: Event[];
    isShared?: boolean;
    basePath: string;
    activeGalleryId?: string;
    activePage?: "gallery" | "find-you" | "event-partners";
    onSelectGallery?: (gallery: Event | null) => void;
    onFindYou?: () => void;
    onDownloadZip?: () => void;
    isZipping?: boolean;
    zipProgress?: number;
    chromeBackgroundColor?: string;
    chromeTextColor?: string;
    chromeAccentColor?: string;
    chromeBorderColor?: string;
    /** "royal": floating gold-edged bar for the Royal Emerald design (styles in src/app/royal-emerald.css).
     *  "classic": Classic White, full width between two thin sage lines (styles in src/app/classic-white.css)
     *  "midnight": Midnight Hero, script title on the photo and the links in a glass pill (styles in src/app/midnight-hero.css)
     *  "portrait": Sunlit Portrait, Classic White's links in white on the cover photo, then a soft white bar once the guest
     *  scrolls (styles in src/app/sunlit-portrait.css)
     *  "confetti": Confetti Circle, Classic White's links on a frosted white bar over the cover photo, solid once the guest
     *  scrolls (styles in src/app/confetti-circle.css) */
    variant?: "royal" | "classic" | "midnight" | "portrait" | "confetti";
}

type EventNavLink = {
    name: string;
    href: string;
    gallery: Event | null;
    isGallery: boolean;
    isFindYou?: boolean;
    isEventPartners?: boolean;
};

export function EventNavbar({
    mainEventTitle,
    mainEventId,
    subEvents,
    isShared,
    basePath,
    activeGalleryId,
    activePage,
    onSelectGallery,
    onFindYou,
    onDownloadZip,
    isZipping,
    zipProgress,
    chromeBackgroundColor,
    chromeTextColor,
    chromeAccentColor,
    chromeBorderColor,
    variant
}: EventNavbarProps) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [collectionsOpen, setCollectionsOpen] = useState(false);
    const [guestDetails, setGuestDetails] = useState<{name: string, phone: string} | null>(null);
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const [scrolledPastTop, setScrolledPastTop] = useState(false);

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

    // Royal Emerald: the bar sits between the hero's top corners until the guest scrolls.
    // Midnight Hero and Sunlit Portrait: the bar has no background over the cover photo until the guest scrolls.
    useEffect(() => {
        // Confetti Circle: the bar is frosted over the cover photo until the guest scrolls.
        if (variant !== "royal" && variant !== "midnight" && variant !== "portrait" && variant !== "confetti") return;
        const update = () => setScrolledPastTop(window.scrollY > 40);
        const frame = window.requestAnimationFrame(update);
        window.addEventListener("scroll", update, { passive: true });
        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener("scroll", update);
        };
    }, [variant]);

    useEffect(() => {
        if (!collectionsOpen) return;

        const closeCollections = () => setCollectionsOpen(false);
        window.addEventListener("click", closeCollections);

        return () => window.removeEventListener("click", closeCollections);
    }, [collectionsOpen]);

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
    const hasTemplateChrome = Boolean(chromeBackgroundColor);
    const isRoyal = variant === "royal";
    const isPortrait = variant === "portrait";
    const isConfetti = variant === "confetti";
    // Sunlit Portrait and Confetti Circle have Classic White's links and menu; only the bar itself differs (their CSS files)
    const isClassic = variant === "classic" || isPortrait || isConfetti;
    const isMidnight = variant === "midnight";
    // Royal Emerald, Classic White and Midnight Hero draw their own colours from CSS classes instead of the inline theme colours
    const useInlineChrome = !isRoyal && !isClassic && !isMidnight && hasTemplateChrome;
    // These three write a couple's joiner ("and", "AND", "weds", "+") as "&", like their titles
    const navTitle = isRoyal || isClassic || isMidnight ? displayCoupleTitle(mainEventTitle) : mainEventTitle;
    const royalLinkClass = (isActive: boolean) => cn("royal-nav__link", isActive && "royal-nav__link--active");
    const midnightLinkClass = (isActive: boolean) => cn("midnight-nav__link", isActive && "midnight-nav__link--active");
    const navTextColor = chromeTextColor || "#0f172a";
    const navAccentColor = chromeAccentColor || "#0f172a";
    const navBorderColor = chromeBorderColor || "rgba(255,255,255,0.16)";
    const activeTextColor = "#ffffff";
    const activeBgColor = (navAccentColor.toLowerCase() === "#ffffff" || navAccentColor.toLowerCase() === "#fafafa") ? "#111827" : navAccentColor;

    const primaryDesktopLinks: EventNavLink[] = [
        { name: "Home", href: `${basePath}${sharedQuery}`, gallery: null, isGallery: true },
    ];

    const collectionLinks: EventNavLink[] = subEvents.map(sub => ({
        name: sub.title || sub.id,
        href: `/events/${sub.id}${sharedQuery}`,
        gallery: sub,
        isGallery: true
    }));

    const utilityDesktopLinks: EventNavLink[] = [
        // Event Partners is hidden until Phase 2 (it comes with EB Business and EB Network). To restore, uncomment:
        // { name: "Event Partners", href: `${basePath}/event-partners${sharedQuery}`, gallery: null, isGallery: false, isEventPartners: true },
        { name: "Find You", href: `${basePath}/find-you`, gallery: null, isGallery: false, isFindYou: true },
    ];

    // Mobile keeps every gallery visible. Desktop groups sub-events into Collections.
    const navLinks: EventNavLink[] = [
        ...primaryDesktopLinks,
        ...collectionLinks,
        ...utilityDesktopLinks,
    ];

    if (user?.role === "admin") {
        navLinks.push({ name: "Admin", href: `/host?view=manage&level=event-details&eventId=${mainEventId}`, gallery: null, isGallery: false });
    }

    const isLinkActive = (href: string, isFindYou?: boolean) => {
        if (isFindYou) return activePage === "find-you";
        if (activePage === "event-partners") return href.split('?')[0].endsWith("/event-partners");
        if (activePage === "find-you") return false;
        const cleanPathname = pathname.split('?')[0];
        const linkPath = href.split('?')[0];
        return cleanPathname === linkPath;
    };

    const isGalleryActive = (gallery: Event | null) => activePage === "gallery" && (activeGalleryId || mainEventId) === (gallery?.id || mainEventId);
    const isCollectionsActive = collectionLinks.some((link) => isGalleryActive(link.gallery));

    const renderDesktopNavItem = (link: EventNavLink) => {
        const isActive = link.isGallery && onSelectGallery
                ? isGalleryActive(link.gallery)
                : isLinkActive(link.href, link.isFindYou);
        const className = isRoyal ? royalLinkClass(isActive) : isMidnight ? midnightLinkClass(isActive) : isClassic ? cn("classic-nav__link", isActive && "classic-nav__link--active") : cn(
            "px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-1.5",
            isActive
                ? "bg-slate-900 text-white shadow-md"
                : hasTemplateChrome
                    ? "hover:bg-white/10"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        );
        const style = useInlineChrome ? {
            backgroundColor: isActive ? activeBgColor : "transparent",
            color: isActive ? activeTextColor : navTextColor,
        } : undefined;

        if (link.isFindYou && onFindYou) {
            return (
                <button
                    key={link.name}
                    type="button"
                    onClick={onFindYou}
                    className={className}
                    style={style}
                >
                    <ScanFace className="w-3.5 h-3.5" />
                    {link.name}
                </button>
            );
        }

        if (link.isGallery && onSelectGallery) {
            return (
                <button
                    key={link.name}
                    type="button"
                    onClick={() => onSelectGallery(link.gallery)}
                    className={className}
                    style={style}
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
                style={style}
            >
                {link.name}
            </Link>
        );
    };

    return (
        <>
            <motion.nav
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                className={isRoyal ? cn("royal-nav", scrolledPastTop && "royal-nav--scrolled", royalDisplay.variable)
                    : isPortrait ? cn("portrait-nav", (scrolledPastTop || mobileMenuOpen) && "portrait-nav--solid", portraitDisplay.variable)
                    : isConfetti ? cn("confetti-nav", (scrolledPastTop || mobileMenuOpen) && "confetti-nav--solid", confettiDisplay.variable)
                    : isClassic ? cn("classic-nav", scrolledPastTop && "classic-nav--scrolled")
                    : isMidnight ? cn("midnight-nav", scrolledPastTop && "midnight-nav--scrolled", midnightScript.variable)
                    : cn(
                    "fixed top-0 inset-x-0 z-50 transition-all duration-300 px-6 py-3 backdrop-blur-md shadow-sm border-b",
                    hasTemplateChrome ? "bg-transparent" : "bg-white/95 border-stone-100"
                )}
                style={useInlineChrome ? {
                    backgroundColor: `${chromeBackgroundColor}f2`,
                    borderColor: navBorderColor,
                    color: navTextColor,
                } : undefined}
            >
                <div className={cn("flex items-center justify-between gap-4", isPortrait ? "portrait-nav__bar" : isConfetti ? "confetti-nav__bar" : isClassic ? "classic-nav__bar" : isRoyal || isMidnight ? "w-full" : "max-w-7xl mx-auto")}>
                    {/* Left: Main Event Title */}
                    <Link
                        href={`${basePath}${sharedQuery}`}
                        onClick={(e) => {
                            if (onSelectGallery) {
                                e.preventDefault();
                                onSelectGallery(null);
                            }
                        }}
                        title={isRoyal || isMidnight ? navTitle : undefined}
                        className={isRoyal ? cn(
                            "royal-nav__title",
                            // Smaller capitals for long titles; anything still too long ends in "…" with the full title on hover
                            navTitle.length > 36 ? "royal-nav__title--xlong" : navTitle.length > 24 && "royal-nav__title--long"
                        ) : isClassic ? "classic-nav__title" : isMidnight ? cn("midnight-nav__title", navTitle.length > 24 && "midnight-nav__title--long") : cn(
                            "text-2xl font-serif font-bold italic tracking-tight transition-colors z-50 relative",
                            hasTemplateChrome ? "" : "text-slate-900"
                        )}
                        style={useInlineChrome ? { color: navTextColor } : undefined}
                    >
                        {/* Confetti Circle writes the couple's "&" as a pink heart */}
                        {isConfetti && navTitle.includes(" & ") ? (
                            <>
                                {navTitle.split(" & ")[0]}
                                <span className="confetti-nav__heart" aria-label="and">♥</span>
                                {navTitle.split(" & ").slice(1).join(" & ")}
                            </>
                        ) : navTitle}
                    </Link>

                    {/* Right: Desktop Navigation */}
                    <div className={cn("hidden md:flex items-center", isRoyal ? "gap-1" : isClassic ? "classic-nav__links" : isMidnight ? "midnight-nav__links" : "space-x-2")}>
                        {primaryDesktopLinks.map(renderDesktopNavItem)}

                        {collectionLinks.length > 0 && (
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setCollectionsOpen((open) => !open);
                                    }}
                                    className={isRoyal ? royalLinkClass(isCollectionsActive) : isMidnight ? midnightLinkClass(isCollectionsActive) : isClassic ? cn("classic-nav__link", isCollectionsActive && "classic-nav__link--active") : cn(
                                        "px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-1.5",
                                        isCollectionsActive
                                            ? "bg-slate-900 text-white shadow-md"
                                            : hasTemplateChrome
                                                ? "hover:bg-white/10"
                                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                    )}
                                    style={useInlineChrome ? {
                                        backgroundColor: isCollectionsActive ? activeBgColor : "transparent",
                                        color: isCollectionsActive ? activeTextColor : navTextColor,
                                    } : undefined}
                                    aria-expanded={collectionsOpen}
                                >
                                    Collections
                                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", collectionsOpen && "rotate-180")} />
                                </button>

                                <AnimatePresence>
                                    {collectionsOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 8, scale: 0.98 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 8, scale: 0.98 }}
                                            transition={{ duration: 0.16 }}
                                            onClick={(event) => event.stopPropagation()}
                                            className={cn(
                                                "absolute right-0 top-full mt-3 w-64 overflow-hidden rounded-2xl border p-2 shadow-xl backdrop-blur-md",
                                                hasTemplateChrome ? "" : "border-stone-200 bg-white/95"
                                            )}
                                            style={hasTemplateChrome ? {
                                                backgroundColor: `${chromeBackgroundColor}f5`,
                                                borderColor: navBorderColor,
                                            } : undefined}
                                        >
                                            {collectionLinks.map((link) => {
                                                const isActive = isGalleryActive(link.gallery);
                                                const className = isRoyal ? cn(royalLinkClass(isActive), "royal-nav__menu-item") : isMidnight ? cn(midnightLinkClass(isActive), "midnight-nav__menu-item") : cn(
                                                    "block w-full rounded-xl px-4 py-3 text-left text-xs font-bold uppercase tracking-widest transition-all",
                                                    isActive
                                                        ? "bg-slate-900 text-white"
                                                        : hasTemplateChrome
                                                            ? "hover:bg-white/10"
                                                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                                );
                                                const style = !isRoyal && !isMidnight && hasTemplateChrome ? {
                                                    backgroundColor: isActive ? activeBgColor : "transparent",
                                                    color: isActive ? activeTextColor : navTextColor,
                                                } : undefined;

                                                if (onSelectGallery) {
                                                    return (
                                                        <button
                                                            key={link.name}
                                                            type="button"
                                                            onClick={() => {
                                                                onSelectGallery(link.gallery);
                                                                setCollectionsOpen(false);
                                                            }}
                                                            className={className}
                                                            style={style}
                                                        >
                                                            {link.name}
                                                        </button>
                                                    );
                                                }

                                                return (
                                                    <Link
                                                        key={link.name}
                                                        href={link.href}
                                                        onClick={() => setCollectionsOpen(false)}
                                                        className={className}
                                                        style={style}
                                                    >
                                                        {link.name}
                                                    </Link>
                                                );
                                            })}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                        {utilityDesktopLinks.map(renderDesktopNavItem)}

                        {onDownloadZip && (
                            <button
                                type="button"
                                onClick={onDownloadZip}
                                disabled={isZipping}
                                className={isRoyal ? "royal-nav__link" : isMidnight ? "midnight-nav__link midnight-nav__link--outline" : isPortrait ? "classic-nav__link portrait-nav__cta" : isConfetti ? "classic-nav__link confetti-nav__cta" : isClassic ? "classic-nav__link" : cn(
                                    "px-3.5 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-1.5 border disabled:opacity-50",
                                    hasTemplateChrome
                                        ? "hover:opacity-85 hover:shadow-sm"
                                        : "border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-900 hover:text-white"
                                )}
                                style={useInlineChrome ? {
                                    borderColor: `${navAccentColor}80`,
                                    backgroundColor: `${navAccentColor}18`,
                                    color: navTextColor,
                                } : undefined}
                            >
                                {isZipping ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span>Zipping {zipProgress}%</span>
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Download All</span>
                                    </>
                                )}
                            </button>
                        )}

                        {user?.role === "admin" && renderDesktopNavItem({ name: "Admin", href: `/host?view=manage&level=event-details&eventId=${mainEventId}`, gallery: null, isGallery: false })}

                        {/* No profile button for signed-in visitors (the small-screen menu still has My Profile); guests keep logout */}
                        {activeName && !user && (
                            <button
                                onClick={handleLogout}
                                className={isRoyal ? "royal-nav__avatar" : isMidnight ? "midnight-nav__avatar" : "ml-4 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-all hover:bg-slate-50"}
                                aria-label="Logout"
                            >
                                <LogOut className="h-5 w-5" />
                            </button>
                        )}
                    </div>

                    {/* Mobile Menu Toggle */}
                    <div className="md:hidden z-50 relative flex items-center gap-2">
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="p-2 rounded-full active:scale-95 transition-transform"
                            // Sunlit Portrait: white on the photo, dark on the solid bar (sunlit-portrait.css)
                            style={hasTemplateChrome && !isPortrait ? { color: navTextColor } : undefined}
                            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                            aria-expanded={mobileMenuOpen}
                        >
                            {mobileMenuOpen ? (
                                <X className={hasTemplateChrome ? "" : "text-slate-900"} />
                            ) : (
                                <Menu className={hasTemplateChrome ? "" : "text-slate-900"} />
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
                        className={cn(
                            "fixed inset-0 z-40 backdrop-blur-xl md:hidden flex flex-col pt-24 px-8",
                            hasTemplateChrome ? "" : "bg-white/95",
                            isClassic && "classic-nav__menu"
                        )}
                        style={hasTemplateChrome ? {
                            backgroundColor: `${chromeBackgroundColor}f7`,
                            color: navTextColor,
                        } : undefined}
                    >
                        <div className="space-y-6">
                            <div className={cn("pb-6 border-b", hasTemplateChrome ? "" : "border-stone-100")} style={hasTemplateChrome ? { borderColor: navBorderColor } : undefined}>
                                <p
                                    className={cn("text-xs font-bold uppercase tracking-widest mb-4", hasTemplateChrome ? "" : "text-stone-600")}
                                    style={hasTemplateChrome ? { color: navAccentColor } : undefined}
                                >
                                    Main Event
                                </p>
                                <Link
                                    href={`${basePath}${sharedQuery}`}
                                    onClick={(e) => {
                                        if (onSelectGallery) {
                                            e.preventDefault();
                                            onSelectGallery(null);
                                        }
                                        setMobileMenuOpen(false);
                                    }}
                                    className={cn(
                                        "text-3xl font-serif font-bold italic flex items-center justify-between group",
                                        hasTemplateChrome ? "" : "text-slate-900"
                                    )}
                                    style={hasTemplateChrome ? { color: navTextColor } : undefined}
                                >
                                    <span>{navTitle}</span>
                                    <ChevronRight className={cn("transition-colors", hasTemplateChrome ? "" : "text-stone-600 group-hover:text-slate-900")} />
                                </Link>
                            </div>

                            <div>
                                <p
                                    className={cn("text-xs font-bold uppercase tracking-widest mb-6", hasTemplateChrome ? "" : "text-stone-600")}
                                    style={hasTemplateChrome ? { color: navAccentColor } : undefined}
                                >
                                    Menu
                                </p>
                                <div className="space-y-4">
                                    {navLinks.map((link) => {
                                        const isActive = link.isGallery && onSelectGallery
                                                ? isGalleryActive(link.gallery)
                                                : isLinkActive(link.href, link.isFindYou);
                                        const className = cn(
                                            "flex items-center gap-3 w-full p-4 rounded-2xl text-left text-lg font-bold transition-all border border-transparent",
                                            isActive
                                                ? "bg-slate-900 text-white shadow-sm"
                                                : hasTemplateChrome
                                                    ? "hover:bg-white/10"
                                                    : "hover:bg-stone-50 text-slate-600"
                                        );
                                        const style = hasTemplateChrome ? {
                                            backgroundColor: isActive ? activeBgColor : "transparent",
                                            color: isActive ? activeTextColor : navTextColor,
                                        } : undefined;

                                        if (link.isFindYou && onFindYou) {
                                            return (
                                                <button
                                                    key={link.name}
                                                    type="button"
                                                    onClick={() => { onFindYou(); setMobileMenuOpen(false); }}
                                                    className={className}
                                                    style={style}
                                                >
                                                    <ScanFace className="w-5 h-5" />
                                                    {link.name}
                                                </button>
                                            );
                                        }

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
                                                    style={style}
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
                                                style={style}
                                            >
                                                {link.name}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>

                            {activeName && (
                                <div className={cn("mt-8 pt-8 border-t", hasTemplateChrome ? "" : "border-stone-100")} style={hasTemplateChrome ? { borderColor: navBorderColor } : undefined}>
                                    <div className="flex items-center space-x-4 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-royal-gold text-white flex items-center justify-center font-bold">
                                            {activeName.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className={cn("text-sm font-bold", hasTemplateChrome ? "" : "text-slate-900")} style={hasTemplateChrome ? { color: navTextColor } : undefined}>{activeName}</p>
                                            <p className={cn("text-[10px] uppercase tracking-widest", hasTemplateChrome ? "" : "text-stone-500")} style={hasTemplateChrome ? { color: navAccentColor } : undefined}>{activeIdentifier || activeRole}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        {user && (
                                            <>
                                                {!isRoyal && (
                                                    <Link
                                                        href="/profile"
                                                        onClick={() => setMobileMenuOpen(false)}
                                                        className="flex items-center space-x-3 w-full p-4 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-stone-50 rounded-2xl transition-all border border-transparent"
                                                    >
                                                        <ProfileIcon className="w-5 h-5" />
                                                        <span>My Profile</span>
                                                    </Link>
                                                )}
                                                <Link
                                                    href="/dashboard"
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
