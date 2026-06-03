"use client";

import React, { useEffect, useState, Suspense } from "react";
import { MasonryGrid } from "@/components/ui/MasonryGrid";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import LoadingScreen from "@/components/LoadingScreen";
import { getEvent } from "@/lib/events"; // Static Data
import { getEventPhotos, getEventById, getSubEvents, logGuestLogin, onGuestStatusChange, Event, Photo as FirestorePhoto } from "@/lib/firestore"; // Live Data
import { EventNavbar } from "@/components/EventNavbar";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Image as ImageIcon, ChevronLeft, Share2, Check, Pencil } from "lucide-react";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { cn, formatEventDate } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useRef } from "react";
import { TemplateHero } from "@/components/TemplateHero";
import { TemplateClassic } from "@/components/TemplateClassic";
import { TemplateRoyal } from "@/components/TemplateRoyal";
import { TemplateEditorial } from "@/components/TemplateEditorial";
import { TemplateBohemian } from "@/components/TemplateBohemian";
import { TemplatePolaroid } from "@/components/TemplatePolaroid";
import { TemplateCinematic } from "@/components/TemplateCinematic";
import { TemplateMuseum } from "@/components/TemplateMuseum";
import { TemplateScrapbook } from "@/components/TemplateScrapbook";
import { TemplateBrutalist } from "@/components/TemplateBrutalist";
import { navigateWithModifierClick } from "@/lib/navigation";

const TEMPLATES: Record<string, React.ComponentType<any>> = {
    hero: TemplateHero,
    classic: TemplateClassic,
    royal: TemplateRoyal,
    editorial: TemplateEditorial,
    bohemian: TemplateBohemian,
    polaroid: TemplatePolaroid,
    cinematic: TemplateCinematic,
    museum: TemplateMuseum,
    scrapbook: TemplateScrapbook,
    brutalist: TemplateBrutalist
};

function EventPageContent() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const slug = params.slug as string;
    const isShared = searchParams.get("shared") === "true";
    const { user, loading: authLoading, login, signup, authWithPhone } = useAuth();

    const [event, setEvent] = useState<Event | any | null>(null);
    const [subEvents, setSubEvents] = useState<Event[]>([]);
    const [photos, setPhotos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Guest Tracking State
    const [showGuestModal, setShowGuestModal] = useState(false);
    const [guestStatus, setGuestStatus] = useState<'idle' | 'pending' | 'approved' | 'rejected'>('idle');
    const [guestName, setGuestName] = useState("");
    const [guestPhone, setGuestPhone] = useState("");
    const [isLogging, setIsLogging] = useState(false);
    const [hasCheckedSession, setHasCheckedSession] = useState(false);
    const [stableIdentifier, setStableIdentifier] = useState<string | null>(null);
    const [entryMode, setEntryMode] = useState<'phone' | 'email'>('phone');
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [authError, setAuthError] = useState("");


    // Parallax logic
    const containerRef = useRef(null);

    useEffect(() => {
        if (!authLoading && slug) {
            loadEventData();
        }
    }, [authLoading, slug]);

    // Initial session check
    useEffect(() => {
        if (typeof window !== 'undefined' && !hasCheckedSession) {
            const saved = sessionStorage.getItem("wedding_guest_details");
            if (saved) {
                const details = JSON.parse(saved);
                setGuestName(details.name);
                setGuestPhone(details.phone);
                setStableIdentifier(details.phone);
            }
            setHasCheckedSession(true);
        }
    }, [hasCheckedSession]);

    // Check for guest details or user approval if shared link
    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

        if (isShared && !authLoading && hasCheckedSession) {
            // --- VIP BYPASS CHECK ---
            const isVIP = user && event && (
                user.role === 'admin' ||
                user.uid === event.createdBy ||
                (user.delegatedBy === event.createdBy && user.roleType === 'primary') ||
                user.assignedEvents?.includes(event.id) ||
                (event.parentId && user.assignedEvents?.includes(event.parentId))
            );

            if (isVIP) {
                console.log("[EventPage] VIP Access Granted. Bypassing guest logs.");
                setGuestStatus('approved');
                setShowGuestModal(false);
                return;
            }

            // Priority 1: Logged in user
            // Priority 2: Stable guest identifier (from session or submission)
            const ident = user ? (user.email || user.uid) : stableIdentifier;
            const dispName = user ? (user.name || "Logged User") : (guestName || "Guest");

            if (ident) {
                const logId = `${ident}_${slug}`;
                console.log(`[EventPage] Identification found: ${logId}. Starting listener...`);

                // 1. Listen for Current Event Status
                unsubscribe = onGuestStatusChange(logId, (status: any) => {
                    const currentStatus = status || 'pending';
                    console.log(`[EventPage] Listener update for ${logId}: ${currentStatus}`);

                    if (currentStatus === 'approved') {
                        setGuestStatus('approved');
                        setShowGuestModal(false);
                        return;
                    }

                    // 2. If not approved here, but we have a parent, check parent
                    if (event?.parentId) {
                        const parentLogId = `${ident}_${event.parentId}`;
                        onGuestStatusChange(parentLogId, (parentStatus: any) => {
                            if (parentStatus === 'approved') {
                                setGuestStatus('approved');
                                setShowGuestModal(false);
                            } else {
                                setGuestStatus(currentStatus);
                                setShowGuestModal(currentStatus !== 'approved');
                            }
                        });
                    } else {
                        setGuestStatus(currentStatus);
                        setShowGuestModal(currentStatus !== 'approved');
                    }
                });

                // Proactively log access for newly logged in users
                if (user && event && !loading && guestStatus === 'idle') {
                    logGuestAccess(dispName, ident);
                }
            } else if (guestStatus === 'idle') {
                // No ID found and not logged in - show the entry modal
                setShowGuestModal(true);
            }
        } else if (!isShared && !authLoading) {
            setGuestStatus('approved');
            setShowGuestModal(false);
        }

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [isShared, user, authLoading, slug, event?.id, loading, hasCheckedSession, event?.parentId, stableIdentifier]);

    const logGuestAccess = async (name: string, identifier: string) => {
        if (!slug || !event) return;
        try {
            await logGuestLogin(
                name,
                identifier,
                slug,
                event.parentId || event.id, // Pass self as parent if main event
                event.title || "Shared Event",
                event.createdBy // Pass the owner ID
            );
        } catch (error) {
            console.error("Failed to log guest access:", error);
        }
    };

    const getPhoneLoginEmail = (phoneNumber: string) => `${phoneNumber.replace(/\D/g, "")}@phone-login.local`;

    const handleGuestAuthSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError("");

        const isPhoneMode = entryMode === 'phone';
        const identifier = isPhoneMode ? guestPhone.trim() : email.trim();

        if (!identifier || !password.trim()) {
            setAuthError(isPhoneMode ? "Please enter phone number and password." : "Please enter email and password.");
            return;
        }

        if (password.length < 6) {
            setAuthError("Password should be at least 6 characters.");
            return;
        }

        if (isSignUp) {
            if (!guestName.trim()) {
                setAuthError("Please enter your name.");
                return;
            }

            if (password !== confirmPassword) {
                setAuthError("Passwords do not match.");
                return;
            }
        }

        setIsLogging(true);
        try {
            let success = false;
            let stableId = identifier;

            if (isSignUp) {
                success = isPhoneMode
                    ? await authWithPhone(guestName, guestPhone, password)
                    : await signup(email, password, guestName);
            } else {
                const loginId = isPhoneMode ? getPhoneLoginEmail(guestPhone) : email;
                stableId = loginId;
                success = await login(loginId, password);
            }

            if (success) {
                const sessionDetails = {
                    name: guestName || email || guestPhone,
                    phone: stableId
                };

                sessionStorage.setItem("wedding_guest_details", JSON.stringify(sessionDetails));
                setStableIdentifier(stableId);
                setShowGuestModal(false);
            } else {
                setAuthError(isSignUp ? "Failed to create account. Please check your details." : "Invalid login details.");
            }
        } catch (err) {
            console.error("Guest auth failed:", err);
            setAuthError("Something went wrong. Please try again.");
        } finally {
            setIsLogging(false);
        }
    };

    const [parentEvent, setParentEvent] = useState<Event | null>(null);

    // ... (keep existing state)

    const loadEventData = async () => {
        setLoading(true);
        console.log(`[EventPage] Loading event for slug: ${slug}, isShared: ${isShared}`);

        try {
            // 1. Get Event Details
            let eventData: Event | null = null;
            try {
                eventData = await getEventById(slug);
            } catch (e: any) {
                console.error("[EventPage] Error fetching from Firestore:", e);
                if (e.message?.includes("permissions")) {
                    setError("permissions");
                }
            }

            // Fallback to Static Data
            if (!eventData && !error) {
                console.log("[EventPage] Event not found in Firestore, checking static data...");
                eventData = getEvent(slug);
            }

            if (!eventData) {
                setEvent(null);
                setLoading(false);
                return;
            }

            setEvent(eventData);

            // 2. Branch logic based on Event Type
            if (eventData.type === 'main') {
                // Fetch Sub-events (Categories)
                console.log(`[EventPage] Main event detected. Fetching sub-events for: ${eventData.id}`);
                const data = await getSubEvents(eventData.id, eventData.legacyId);
                setSubEvents(data);
            } else {
                // Fetch Photos (Sub-event or single gallery)
                console.log(`[EventPage] Sub-view detected. Fetching photos for: ${eventData.id}`);

                // NEW: Fetch Parent & Siblings for Navbar
                if (eventData.parentId) {
                    try {
                        const pEvent = await getEventById(eventData.parentId);
                        if (pEvent) {
                            setParentEvent(pEvent);
                            const siblings = await getSubEvents(pEvent.id, pEvent.legacyId);
                            setSubEvents(siblings);
                        }
                    } catch (err) {
                        console.error("Error fetching parent event context:", err);
                    }
                }


                // 1. Fetch from Firestore CLIENT-SIDE (Authenticated / Rules-friendly)
                const firestorePhotos = await getEventPhotos(eventData.id, eventData.legacyId);

                const transformedPhotos = (firestorePhotos as FirestorePhoto[]).map(p => ({
                    id: p.id,
                    src: p.url || "",
                    thumbnailUrl: p.thumbnailUrl || undefined,
                    storageKey: p.storageKey || "",
                    width: p.width || 800,
                    height: p.height || 600,
                    filename: p.storageKey ? p.storageKey.split('/').pop() : 'photo'
                }));
                setPhotos(transformedPhotos);
            }
        } catch (err: any) {
            console.error("[EventPage] Critical error:", err);
            setError(err.message || "An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    const handleShare = () => {
        const shareUrl = `${window.location.origin}/events/${slug}?shared=true`;
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (authLoading || loading) {
        return <LoadingScreen message="Loading your gallery" />;
    }

    if (!event) {
        return (
            <main className="relative" ref={containerRef}>
                {notFound()}
            </main>
        );
    }

    if (error === "permissions" && !user && !isShared) {
        return (
            <main className="min-h-screen flex flex-col items-center justify-center bg-stone-50 px-4 text-center relative" ref={containerRef}>
                <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
                <p className="text-stone-700 mb-8 max-w-md">
                    This gallery is private. Please log in to view your memories.
                </p>
                <button
                    onClick={() => window.location.href = "/login"}
                    className="px-8 py-3 bg-slate-900 text-white rounded-full font-bold shadow-lg hover:bg-slate-800 transition-all"
                >
                    Log In
                </button>
            </main>
        );
    }

    const renderContent = () => (
        <div className="contents">
            <div className="mb-12 flex items-center justify-between">
                <button
                    onClick={() => {
                        const backUrl = event?.parentId ? `/events/${event.parentId}` : "/gallery";
                        router.push(`${backUrl}${isShared ? "?shared=true" : ""}`);
                    }}
                    className="text-stone-700 hover:text-stone-900 transition-colors text-sm font-bold tracking-widest uppercase flex items-center group"
                >
                    <ChevronLeft className="w-5 h-5 mr-1 group-hover:-translate-x-1 transition-transform" />
                    {event?.parentId ? "Back to Event" : "Back to Gallery"}
                </button>

                <div className="flex items-center space-x-4">
                    {(user?.uid === event?.createdBy || user?.role === 'admin') && (
                        <button
                            onClick={() => router.push(`/dashboard?view=manage&eventId=${event.id}`)}
                            className="flex items-center space-x-2 px-6 py-3 bg-slate-900 text-white border border-slate-900 rounded-full text-sm font-bold hover:bg-slate-800 transition-all shadow-md active:scale-95 group"
                        >
                            <Pencil className="w-4 h-4" />
                            <span>Manage Event</span>
                        </button>
                    )}

                    <button
                        onClick={handleShare}
                        className="flex items-center space-x-2 px-6 py-3 bg-white border border-stone-200 text-stone-600 rounded-full text-sm font-bold hover:bg-stone-50 transition-all shadow-sm hover:shadow-md group active:scale-95"
                    >
                        <AnimatePresence mode="wait">
                            {copied ? (
                                <motion.div
                                    key="check"
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.5 }}
                                    className="flex items-center space-x-2 text-green-600"
                                >
                                    <Check className="w-4 h-4" />
                                    <span>Link Copied!</span>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="share"
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.5 }}
                                    className="flex items-center space-x-2 group-hover:text-stone-900"
                                >
                                    <Share2 className="w-4 h-4" />
                                    <span>Share Event</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </button>
                </div>
            </div>

            {event.type === 'main' ? (
                <div className="mt-12">
                    <SectionHeader title="Event Highlights" subtitle={`${subEvents.length} Unique Galleries`} />

                    {subEvents.length === 0 ? (
                        <div className="py-40 text-center opacity-40">
                            <ImageIcon className="w-16 h-16 mx-auto mb-6 text-stone-600" />
                            {error === "permissions" ? (
                                <>
                                    <h2 className="text-2xl font-serif italic text-stone-600 mb-2">Access restricted...</h2>
                                    <p className="font-sans text-stone-600">If you are the owner, please ensure your Firestore Security Rules allow public reads for events and photos.</p>
                                </>
                            ) : (
                                <>
                                    <h2 className="text-2xl font-serif italic text-stone-600 mb-2">Glimpses are being curated...</h2>
                                    <p className="font-sans text-stone-600">Galleries for this event will appear here soon.</p>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
                            {subEvents.map((sub, index) => (
                                <ScrollReveal
                                    key={sub.id}
                                    delay={index * 0.1}
                                    className="w-full"
                                >
                                    <div
                                        onClick={(e) => navigateWithModifierClick(e, `/events/${sub.id}${isShared ? "?shared=true" : ""}`, router.push)}
                                        className="group relative block w-full aspect-[3/4] overflow-hidden rounded-[2.5rem] shadow-sm hover:shadow-2xl transition-all duration-500 cursor-pointer bg-stone-100"
                                    >
                                        <Image
                                            src={sub.coverImage || '/placeholder-event.jpg'}
                                            alt={sub.title}
                                            fill
                                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                                            className="object-cover transition-transform duration-700 group-hover:scale-110"
                                            priority={index < 3}
                                        />

                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300"></div>

                                        <div className="absolute bottom-0 left-0 p-8 w-full transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                                            <p className="text-royal-gold text-[10px] font-bold uppercase tracking-[0.2em] mb-2">
                                                {formatEventDate(sub.date) || "Gallery"}
                                            </p>
                                            <h3 className="text-3xl font-serif text-white mb-2 italic tracking-tight">{sub.title}</h3>
                                            <div className="h-[1px] w-0 bg-white/50 group-hover:w-full transition-all duration-700 ease-in-out"></div>
                                        </div>
                                    </div>
                                </ScrollReveal>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="contents">
                    <SectionHeader title="Gallery Collection" subtitle={`${photos.length} Precious Moments`} />

                    {photos.length > 0 ? (
                        <div className="mt-12">
                            <MasonryGrid photos={photos} eventSlug={slug} disableDownload={isShared && !user} />
                        </div>
                    ) : (
                        <div className="text-center py-40 opacity-40">
                            <ImageIcon className="w-16 h-16 mx-auto mb-6 text-stone-600" />
                            {error === "permissions" ? (
                                <>
                                    <h2 className="text-2xl font-serif italic text-stone-600 mb-2">Moments restricted...</h2>
                                    <p className="font-sans text-stone-600 text-sm">Owner: Check Firestore rules to enable shared access.</p>
                                </>
                            ) : (
                                <>
                                    <h2 className="text-2xl font-serif italic text-stone-600 mb-2">Moments are being developed...</h2>
                                    <p className="font-sans text-stone-600 text-sm">Check back soon to see the captured memories.</p>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    const TemplateComponent = TEMPLATES[event.templateId] || TemplateHero;

    // Determine Navbar Props
    const navMainTitle = parentEvent ? parentEvent.title : event.title;
    const navMainId = event.parentId || event.id;

    return (
        <main className="min-h-screen relative" ref={containerRef}>
            <EventNavbar
                mainEventTitle={navMainTitle}
                mainEventId={navMainId}
                subEvents={subEvents}
                isShared={isShared}
                basePath={`/events/${navMainId}`}
            />
            <TemplateComponent
                event={event}
                subEvents={subEvents}
                photos={photos}
                isShared={isShared}
                user={user}
                onBack={() => {
                    const backUrl = event?.parentId ? `/events/${event.parentId}` : "/gallery";
                    router.push(`${backUrl}${isShared ? "?shared=true" : ""}`);
                }}
                onShare={handleShare}
                canManage={user?.uid === event?.createdBy || user?.role === 'admin'}
                onManage={() => router.push(`/dashboard?view=manage&eventId=${event.id}`)}
                hasParent={!!event?.parentId}
                copied={copied}
                error={error}
            >
                {renderContent()}
            </TemplateComponent>
            {/* Guest Entry Modal */}
            <AnimatePresence>
                {showGuestModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20"
                        >
                            <div className="p-10 text-center">
                                <div className="w-20 h-20 bg-royal-gold/10 rounded-full flex items-center justify-center mx-auto mb-6 text-royal-gold">
                                    {guestStatus === 'pending' ? <Loader2 className="w-10 h-10 animate-spin" /> : <ImageIcon size={40} />}
                                </div>

                                {guestStatus === 'pending' ? (
                                    <>
                                        <h2 className="text-3xl font-bold mb-3 font-serif text-slate-800">Hang Tight, {guestName.split(' ')[0]}! ✨</h2>
                                        <p className="text-slate-700 mb-8 font-sans leading-relaxed">
                                            We have sent your request to the event admin. You will be admitted as soon as they grant access.
                                        </p>
                                        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100 flex items-center justify-center space-x-3">
                                            <div className="w-2 h-2 rounded-full bg-royal-gold animate-pulse" />
                                            <span className="text-xs font-bold uppercase tracking-widest text-stone-600">Waiting for approval</span>
                                        </div>
                                    </>
                                ) : guestStatus === 'rejected' ? (
                                    <>
                                        <h2 className="text-3xl font-bold mb-3 font-serif text-slate-800">Access Restricted</h2>
                                        <p className="text-slate-700 mb-8 font-sans leading-relaxed">
                                            The admin has declined this access request. Please contact the host for support.
                                        </p>
                                        <button
                                            onClick={() => setGuestStatus('idle')}
                                            className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold uppercase tracking-widest transition-all active:scale-95 shadow-xl"
                                        >
                                            Try Again
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex p-1 bg-stone-100 rounded-2xl mb-8">
                                            <button
                                                onClick={() => {
                                                    setEntryMode('phone');
                                                    setAuthError("");
                                                }}
                                                className={cn(
                                                    "flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                                                    entryMode === 'phone' ? "bg-white text-slate-800 shadow-sm" : "text-stone-600 hover:text-stone-600"
                                                )}
                                            >
                                                Phone Login
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setEntryMode('email');
                                                    setAuthError("");
                                                }}
                                                className={cn(
                                                    "flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                                                    entryMode === 'email' ? "bg-white text-slate-800 shadow-sm" : "text-stone-600 hover:text-stone-600"
                                                )}
                                            >
                                                Email Login
                                            </button>
                                        </div>

                                        <h2 className="text-3xl font-bold mb-3 font-serif text-slate-800">
                                            {isSignUp ? "Create Account" : "Welcome Back"}
                                        </h2>
                                        <p className="text-slate-700 mb-8 font-sans leading-relaxed text-sm">
                                            {isSignUp ? "Sign up to request access to this private event." : "Log in to request access to this private event."}
                                        </p>

                                        <form onSubmit={handleGuestAuthSubmit} className="space-y-6">
                                            <div className="space-y-4 text-left">
                                                {isSignUp && (
                                                    <div className="relative group">
                                                        <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest ml-1 mb-2 block">Name</label>
                                                        <input
                                                            type="text"
                                                            placeholder="Your Name"
                                                            required
                                                            value={guestName}
                                                            onChange={(e) => setGuestName(e.target.value)}
                                                            className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-royal-gold/20 focus:border-royal-gold transition-all font-sans"
                                                        />
                                                    </div>
                                                )}

                                                {entryMode === 'phone' ? (
                                                    <div className="relative group">
                                                        <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest ml-1 mb-2 block">Phone Number</label>
                                                        <input
                                                            type="tel"
                                                            placeholder="10-digit number"
                                                            required
                                                            value={guestPhone}
                                                            onChange={(e) => setGuestPhone(e.target.value)}
                                                            className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-royal-gold/20 focus:border-royal-gold transition-all font-sans"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="relative group">
                                                        <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest ml-1 mb-2 block">Email Address</label>
                                                        <input
                                                            type="email"
                                                            placeholder="name@email.com"
                                                            required
                                                            value={email}
                                                            onChange={(e) => setEmail(e.target.value)}
                                                            className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-royal-gold/20 focus:border-royal-gold transition-all font-sans"
                                                        />
                                                    </div>
                                                )}

                                                <div className="relative group">
                                                    <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest ml-1 mb-2 block">Password</label>
                                                    <input
                                                        type="password"
                                                        placeholder="••••••••"
                                                        required
                                                        value={password}
                                                        onChange={(e) => setPassword(e.target.value)}
                                                        className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-royal-gold/20 focus:border-royal-gold transition-all font-sans"
                                                    />
                                                </div>

                                                {isSignUp && (
                                                    <div className="relative group">
                                                        <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest ml-1 mb-2 block">Confirm Password</label>
                                                        <input
                                                            type="password"
                                                            placeholder="••••••••"
                                                            required
                                                            value={confirmPassword}
                                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                                            className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-royal-gold/20 focus:border-royal-gold transition-all font-sans"
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {authError && (
                                                <div className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-2xl border border-red-100">
                                                    {authError}
                                                </div>
                                            )}

                                            <button
                                                type="submit"
                                                disabled={isLogging}
                                                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 shadow-xl flex items-center justify-center space-x-3"
                                            >
                                                {isLogging ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>{isSignUp ? "Sign Up & Access" : "Login & Access"}</span>}
                                            </button>
                                        </form>

                                        <div className="mt-8 text-center pt-6 border-t border-stone-100">
                                            <p className="text-slate-700 text-sm">
                                                {isSignUp ? "Already have an account?" : "Do not have an account?"}
                                                <button
                                                    onClick={() => {
                                                        setIsSignUp(!isSignUp);
                                                        setAuthError("");
                                                    }}
                                                    className="ml-2 font-bold text-sky-600 hover:text-sky-800 transition-colors underline decoration-2 underline-offset-4"
                                                >
                                                    {isSignUp ? "Login here" : "Sign Up"}
                                                </button>
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}

export default function EventPage() {
    return (
        <Suspense fallback={<LoadingScreen message="Loading your gallery" />}>
            <EventPageContent />
        </Suspense>
    );
}
