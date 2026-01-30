"use client";

import React, { useEffect, useState, Suspense } from "react";
import { MasonryGrid } from "@/components/ui/MasonryGrid";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import { getEvent } from "@/lib/events"; // Static Data
import { getEventPhotos, getEventById, getSubEvents, logGuestLogin, onGuestStatusChange, Event, Photo as FirestorePhoto } from "@/lib/firestore"; // Live Data
import { syncCloudinaryToFirestore } from "@/app/actions/sync";
import Navbar from "@/components/Navbar";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Image as ImageIcon, ChevronLeft, Share2, Check, Phone, ArrowRight, Pencil } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { cn } from "@/lib/utils";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { useRef } from "react";

function EventPageContent() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const slug = params.slug as string;
    const isShared = searchParams.get("shared") === "true";
    const { user, loading: authLoading, logout } = useAuth();

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
    const [entryMode, setEntryMode] = useState<'guest' | 'email'>('guest');
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const { login: authLogin } = useAuth();

    // Parallax logic
    const containerRef = useRef(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end start"]
    });

    const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
    const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

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

    const handleGuestSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!guestName || !guestPhone) return;

        setIsLogging(true);
        try {
            sessionStorage.setItem("wedding_guest_details", JSON.stringify({
                name: guestName,
                phone: guestPhone
            }));
            await logGuestAccess(guestName, guestPhone);
            setStableIdentifier(guestPhone); // This triggers the listener effect
            setGuestStatus('pending'); // Immediately set to pending after submission
        } catch (err) {
            console.error("Error logging guest:", err);
        } finally {
            setIsLogging(false);
        }
    };

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;

        setIsLogging(true);
        try {
            const success = await authLogin(email, password);
            if (success) {
                // Log access immediately since state might not update fast enough for useEffect
                await logGuestAccess(email.split('@')[0], email);
                setStableIdentifier(email);
                setGuestStatus('pending');
            }
        } catch (err) {
            console.error("Login failed:", err);
            alert("Login failed. Please check your credentials.");
        } finally {
            setIsLogging(false);
        }
    };

    const loadEventData = async () => {
        setLoading(true);
        console.log(`[EventPage] Loading event for slug: ${slug}, isShared: ${isShared}`);

        try {
            // 1. Get Event Details
            // Try Firestore first (Dynamic events)
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

                // 1. Fetch from Firestore CLIENT-SIDE (Authenticated / Rules-friendly)
                let firestorePhotos = await getEventPhotos(eventData.id, eventData.legacyId);

                // 2. If Empty, trigger server-side Sync fallback
                if (firestorePhotos.length === 0) {
                    console.log("[EventPage] No photos found. Triggering resilient sync...");
                    const syncResult = await syncCloudinaryToFirestore(eventData.id, eventData.createdBy, eventData.legacyId);
                    if (syncResult.success && (syncResult.count || 0) > 0) {
                        firestorePhotos = await getEventPhotos(eventData.id, eventData.legacyId);
                    }
                }

                const transformedPhotos = (firestorePhotos as FirestorePhoto[]).map(p => ({
                    id: p.id,
                    src: p.url || "",
                    cloudinaryPublicId: p.cloudinaryPublicId || "",
                    width: p.width || 800,
                    height: p.height || 600,
                    filename: p.cloudinaryPublicId ? p.cloudinaryPublicId.split('/').pop() : 'photo'
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
        return (
            <main className="min-h-screen flex items-center justify-center bg-stone-50 relative" ref={containerRef}>
                <Loader2 className="w-8 h-8 animate-spin text-royal-gold" />
            </main>
        );
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
                <p className="text-stone-500 mb-8 max-w-md">
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

    return (
        <main className="min-h-screen bg-stone-50 relative" ref={containerRef}>
            {/* Premium Parallax Hero */}
            <div className="relative h-[80vh] w-full overflow-hidden">
                <motion.div style={{ y: heroY, opacity: heroOpacity }} className="absolute inset-0 h-[120%] -top-[10%]">
                    <Image
                        src={event.coverImage || "/placeholder-event.jpg"}
                        alt={event.title}
                        fill
                        className="object-cover"
                        priority
                    />
                </motion.div>
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>

                <div className="absolute inset-0 flex flex-col justify-end items-center text-center px-4 pb-20">
                    <ScrollReveal direction="up" delay={0.3}>
                        <h1 className="text-4xl md:text-7xl font-serif text-white drop-shadow-xl mb-6 tracking-tight">
                            {event.title}
                        </h1>
                    </ScrollReveal>
                    <ScrollReveal direction="up" delay={0.5}>
                        <p className="text-white/90 text-lg md:text-xl max-w-2xl font-light drop-shadow-lg tracking-wide italic">
                            {event.description || "A celebration of love and new beginnings."}
                        </p>
                    </ScrollReveal>
                </div>

                {/* Floating Sign Out if user logged in */}
                {user && (
                    <nav className="absolute top-8 right-8 z-20">
                        <button
                            onClick={logout}
                            className="px-6 py-2.5 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-full hover:bg-white/20 transition-all text-sm font-bold shadow-xl"
                        >
                            Sign Out
                        </button>
                    </nav>
                )}
            </div>

            <section className="relative z-10 -mt-12 bg-stone-50 rounded-t-[3rem] py-20 shadow-2xl shadow-black/10">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="mb-12 flex items-center justify-between">
                        <button
                            onClick={() => {
                                const backUrl = event?.parentId ? `/events/${event.parentId}` : "/gallery";
                                router.push(`${backUrl}${isShared ? "?shared=true" : ""}`);
                            }}
                            className="text-stone-500 hover:text-stone-900 transition-colors text-sm font-bold tracking-widest uppercase flex items-center group"
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
                                    <ImageIcon className="w-16 h-16 mx-auto mb-6 text-stone-300" />
                                    {error === "permissions" ? (
                                        <>
                                            <h2 className="text-2xl font-serif italic text-stone-600 mb-2">Access restricted...</h2>
                                            <p className="font-sans text-stone-400">If you are the owner, please ensure your Firestore Security Rules allow public reads for events and photos.</p>
                                        </>
                                    ) : (
                                        <>
                                            <h2 className="text-2xl font-serif italic text-stone-600 mb-2">Glimpses are being curated...</h2>
                                            <p className="font-sans text-stone-400">Galleries for this event will appear here soon.</p>
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
                                                onClick={() => router.push(`/events/${sub.id}${isShared ? "?shared=true" : ""}`)}
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
                                                        {sub.date || "Gallery"}
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
                                    <ImageIcon className="w-16 h-16 mx-auto mb-6 text-stone-300" />
                                    {error === "permissions" ? (
                                        <>
                                            <h2 className="text-2xl font-serif italic text-stone-600 mb-2">Moments restricted...</h2>
                                            <p className="font-sans text-stone-400 text-sm">Owner: Check Firestore rules to enable shared access.</p>
                                        </>
                                    ) : (
                                        <>
                                            <h2 className="text-2xl font-serif italic text-stone-600 mb-2">Moments are being developed...</h2>
                                            <p className="font-sans text-stone-400 text-sm">Check back soon to see the captured memories.</p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </section>

            <footer className="bg-stone-900 text-stone-400 py-12 text-center text-sm">
                <p>© 2026 Wedding Album.</p>
            </footer>
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
                                        <p className="text-slate-500 mb-8 font-sans leading-relaxed">
                                            We've sent your request to the event admin. You'll be admitted as soon as they grant access.
                                        </p>
                                        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100 flex items-center justify-center space-x-3">
                                            <div className="w-2 h-2 rounded-full bg-royal-gold animate-pulse" />
                                            <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Waiting for approval</span>
                                        </div>
                                    </>
                                ) : guestStatus === 'rejected' ? (
                                    <>
                                        <h2 className="text-3xl font-bold mb-3 font-serif text-slate-800">Access Restricted</h2>
                                        <p className="text-slate-500 mb-8 font-sans leading-relaxed">
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
                                                onClick={() => setEntryMode('guest')}
                                                className={cn(
                                                    "flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                                                    entryMode === 'guest' ? "bg-white text-slate-800 shadow-sm" : "text-stone-400 hover:text-stone-600"
                                                )}
                                            >
                                                Guest Access
                                            </button>
                                            <button
                                                onClick={() => setEntryMode('email')}
                                                className={cn(
                                                    "flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                                                    entryMode === 'email' ? "bg-white text-slate-800 shadow-sm" : "text-stone-400 hover:text-stone-600"
                                                )}
                                            >
                                                Email Login
                                            </button>
                                        </div>

                                        <h2 className="text-3xl font-bold mb-3 font-serif text-slate-800">
                                            {entryMode === 'guest' ? "Welcome Guest" : "Member Login"}
                                        </h2>
                                        <p className="text-slate-500 mb-8 font-sans leading-relaxed text-sm">
                                            {entryMode === 'guest'
                                                ? "Share details to request private access."
                                                : "Login to your account to view this event."}
                                        </p>

                                        {entryMode === 'guest' ? (
                                            <form onSubmit={handleGuestSubmit} className="space-y-6">
                                                <div className="space-y-4 text-left">
                                                    <div className="relative group">
                                                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1 mb-2 block">Name</label>
                                                        <input
                                                            type="text"
                                                            placeholder="Guest Name"
                                                            required
                                                            value={guestName}
                                                            onChange={(e) => setGuestName(e.target.value)}
                                                            className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-royal-gold/20 focus:border-royal-gold transition-all font-sans"
                                                        />
                                                    </div>
                                                    <div className="relative group">
                                                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1 mb-2 block">Phone</label>
                                                        <input
                                                            type="tel"
                                                            placeholder="10-digit number"
                                                            required
                                                            value={guestPhone}
                                                            onChange={(e) => setGuestPhone(e.target.value)}
                                                            className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-royal-gold/20 focus:border-royal-gold transition-all font-sans"
                                                        />
                                                    </div>
                                                </div>

                                                <button
                                                    type="submit"
                                                    disabled={isLogging}
                                                    className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 shadow-xl flex items-center justify-center space-x-3"
                                                >
                                                    {isLogging ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Request Access</span>}
                                                </button>
                                            </form>
                                        ) : (
                                            <form onSubmit={handleEmailSubmit} className="space-y-6">
                                                <div className="space-y-4 text-left">
                                                    <div className="relative group">
                                                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1 mb-2 block">Email Address</label>
                                                        <input
                                                            type="email"
                                                            placeholder="name@email.com"
                                                            required
                                                            value={email}
                                                            onChange={(e) => setEmail(e.target.value)}
                                                            className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-royal-gold/20 focus:border-royal-gold transition-all font-sans"
                                                        />
                                                    </div>
                                                    <div className="relative group">
                                                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1 mb-2 block">Password</label>
                                                        <input
                                                            type="password"
                                                            placeholder="••••••••"
                                                            required
                                                            value={password}
                                                            onChange={(e) => setPassword(e.target.value)}
                                                            className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-royal-gold/20 focus:border-royal-gold transition-all font-sans"
                                                        />
                                                    </div>
                                                </div>

                                                <button
                                                    type="submit"
                                                    disabled={isLogging}
                                                    className="w-full py-5 bg-sky-600 text-white rounded-2xl font-bold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 shadow-xl flex items-center justify-center space-x-3"
                                                >
                                                    {isLogging ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Login & Access</span>}
                                                </button>
                                            </form>
                                        )}
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
        <Suspense fallback={
            <main className="min-h-screen flex items-center justify-center bg-stone-50">
                <Loader2 className="w-8 h-8 animate-spin text-royal-gold" />
            </main>
        }>
            <EventPageContent />
        </Suspense>
    );
}
