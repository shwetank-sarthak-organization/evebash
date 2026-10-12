"use client";

import React, { useEffect, useMemo, useState } from "react";
import { resolveEventCoverImage } from "@/lib/eventCovers";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
    Event,
    getApprovedSharedEventsForUser,
    getUserEvents,
    openGallery,
    requestGalleryAccess,
} from "@/lib/database";
import {
    ArrowLeft,
    ArrowRight,
    Calendar,
    Play,
    Plus,
    QrCode,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { ModalHeader, modalStyles } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

const DEFAULT_EVENT_COVER_IMAGE = "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop";
const MEMORIES_CARD_IMAGE = "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=2071&auto=format&fit=crop";

function getCreatedTime(event: Event) {
    const createdAt = event.createdAt as any;
    if (!createdAt) return 0;
    if (typeof createdAt === "string" || typeof createdAt === "number") {
        return new Date(createdAt).getTime() || 0;
    }
    if (createdAt.seconds) {
        return createdAt.seconds * 1000;
    }
    if (createdAt.toDate) {
        return createdAt.toDate().getTime();
    }
    return 0;
}

function getCoverImageStyle(event?: Event): React.CSSProperties {
    const coverMode = event?.coverMode || "fill";
    if (coverMode === "fit") {
        return { objectFit: "contain", backgroundColor: "#050505" };
    }

    const x = 50 + (event?.coverOffsetX || 0);
    const y = 50 + (event?.coverOffset || 0);
    return {
        objectFit: "cover",
        objectPosition: `${Math.max(0, Math.min(100, x))}% ${Math.max(0, Math.min(100, y))}%`,
        transform: `scale(${event?.coverScale || 1})`,
    };
}

export default function DashboardHub() {
    const { user, loading } = useAuth();
    const router = useRouter();

    const [events, setEvents] = useState<Event[]>([]);
    const [isLoadingEvents, setIsLoadingEvents] = useState(true);
    const [showAllEvents, setShowAllEvents] = useState(false);

    const [showJoinModal, setShowJoinModal] = useState(false);
    const [joinCode, setJoinCode] = useState("");
    const [isJoining, setIsJoining] = useState(false);
    const [joinMessage, setJoinMessage] = useState("");
    const [joinMessageType, setJoinMessageType] = useState<"success" | "error">("success");

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    const fetchData = async () => {
        if (!user) return;

        setIsLoadingEvents(true);
        try {
            const ownIdentifiers = [user.uid];
            if (user.email) ownIdentifiers.push(user.email);
            if (user.phone) ownIdentifiers.push(user.phone);

            const [hostedEvents, approvedSharedEvents] = await Promise.all([
                getUserEvents(ownIdentifiers, "main"),
                getApprovedSharedEventsForUser(ownIdentifiers),
            ]);

            const visibleEvents = Array.from(
                new Map([...hostedEvents, ...approvedSharedEvents].map((event) => [event.id, event])).values()
            ).sort((a, b) => getCreatedTime(b) - getCreatedTime(a));

            setEvents(visibleEvents);
        } catch (err) {
            console.error("Error fetching dashboard data:", err);
        } finally {
            setIsLoadingEvents(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user]);

    const handleJoinEvent = async (e?: React.FormEvent) => {
        e?.preventDefault();

        const finalCode = joinCode.trim().toUpperCase();
        if (!finalCode) return;

        if (!user) {
            setJoinMessageType("error");
            setJoinMessage("You must be logged in to join an event.");
            return;
        }

        setIsJoining(true);
        setJoinMessage("");

        try {
            // The join code is resolved by open_gallery (the events table isn't readable to non-members once RLS is
            // on). Public galleries are joined right here; private ones need a request the host approves.
            const opened = await openGallery(finalCode);

            if (opened.access === "not_found") {
                setJoinMessageType("error");
                setJoinMessage("Invalid Join ID. Please check the code and try again.");
                return;
            }

            let status: string = opened.access === "manage" || opened.access === "member" ? "approved" : opened.access;
            if (status === "none") {
                status = await requestGalleryAccess(finalCode);
            }

            setJoinMessageType("success");
            setJoinMessage(status === "approved"
                ? "You're in. The event is now in your collections."
                : "Request sent. You will see the event in your collections once approved.");
            setTimeout(() => {
                setShowJoinModal(false);
                setJoinCode("");
                setJoinMessage("");
                fetchData();
            }, 2500);
        } catch (err) {
            console.error("[Join] Error:", err);
            setJoinMessageType("error");
            setJoinMessage("An error occurred while joining. Please try again later.");
        } finally {
            setIsJoining(false);
        }
    };

    const visibleEvents = useMemo(() => (
        showAllEvents ? events : events.slice(0, 3)
    ), [events, showAllEvents]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="min-h-screen bg-[#0E141A] font-sans text-white">
            {/* Dashboard Sub-Navbar */}
            <div className="border-b border-[#273034] bg-[#0E141A]/95 pt-24 pb-4">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between">
                    {/* Left: Greeting / Workspace */}
                    <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-[#CA9C68]" />
                        <span className="text-xs font-black tracking-wide text-white uppercase">Collections</span>
                        <span className="text-[#3A534D]">|</span>
                        <span className="text-xs font-bold text-slate-400">{user.name || user.email || "My Dashboard"}</span>
                    </div>

                </div>
            </div>

            <main className="relative z-20 mx-auto max-w-7xl space-y-8 px-4 pt-8 pb-24 sm:px-6 lg:px-8">
                <section className="rounded-[2rem] border border-[#CA9C68]/20 bg-[#151B21] p-5 shadow-2xl shadow-black/25 sm:p-8">
                    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#CA9C68]">Event Gallery</p>
                            <h2 className="mt-1 text-2xl font-black text-white">Memories curated for you</h2>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowJoinModal(true)}
                            className="inline-flex w-fit items-center gap-2 rounded-full bg-[#CA9C68] px-4 py-2 text-sm font-black text-[#13191F] transition-transform active:scale-95"
                        >
                            <Plus className="h-4 w-4" />
                            <span>Join Event</span>
                        </button>
                    </div>

                    {isLoadingEvents ? (
                        <div className="flex justify-center py-16">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2B2F2E] border-t-[#CA9C68]" />
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {visibleEvents.map((event) => {
                                const coverImage = resolveEventCoverImage(event.coverImage, 'thumbnail');
                                return (
                                    <button
                                        key={event.id}
                                        type="button"
                                        onClick={() => window.open(`/events/${event.id}?mode=visitor`, "_blank", "noopener,noreferrer")}
                                        className="group relative h-64 overflow-hidden rounded-[1.75rem] border border-[#CA9C68]/15 bg-[#10161C] text-left shadow-xl shadow-black/15 transition-transform hover:-translate-y-1"
                                    >
                                        <div className="absolute inset-0 overflow-hidden bg-[#0E141A]">
                                            <img
                                                src={coverImage}
                                                alt=""
                                                className="absolute inset-0 h-full w-full object-cover opacity-30 blur-xl"
                                            />
                                            <img
                                                src={coverImage}
                                                alt={event.title}
                                                className="relative h-full w-full transition-transform duration-700 group-hover:scale-105"
                                                style={getCoverImageStyle(event)}
                                            />
                                        </div>
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                                        {event.category && (
                                            <div className="absolute left-4 top-4 rounded-full border border-[#CA9C68]/30 bg-black/65 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#CA9C68] backdrop-blur-sm">
                                                {event.category}
                                            </div>
                                        )}
                                        <div className="absolute bottom-0 left-0 right-0 border-t border-[#CA9C68]/10 bg-[#0E141A]/78 p-5 text-white backdrop-blur-md">
                                            <h3 className="truncate text-lg font-black leading-tight text-white">{event.title}</h3>
                                            <div className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-400">
                                                <Calendar className="h-3.5 w-3.5 text-[#CA9C68]" />
                                                <span>{event.date}</span>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}

                            <button
                                type="button"
                                onClick={() => setShowAllEvents(prev => !prev)}
                                className="group relative h-full min-h-64 overflow-hidden rounded-[1.75rem] border border-[#CA9C68]/20 bg-[#10161C] text-center shadow-xl shadow-black/10"
                            >
                                <img
                                    src={MEMORIES_CARD_IMAGE}
                                    alt=""
                                    className="absolute inset-0 h-full w-full object-cover opacity-45 transition-transform duration-700 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0E141A] via-[#0E141A]/72 to-[#0E141A]/25" />
                                <div className="relative z-10 flex h-full min-h-64 flex-col items-center justify-center p-6">
                                    <h3 className="text-xl font-black text-white">Your memories</h3>
                                    <div className="mt-3 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black">
                                        {events.length} Collections
                                    </div>
                                    <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#CA9C68] px-4 py-2 text-xs font-black uppercase tracking-widest text-[#13191F]">
                                        <span>{showAllEvents ? "Show Less" : "Explore All"}</span>
                                        <ArrowRight className="h-4 w-4" />
                                    </div>
                                </div>
                            </button>

                            {events.length === 0 && (
                                <div className="col-span-full rounded-[1.5rem] border border-dashed border-[#CA9C68]/20 p-10 text-center text-slate-400">
                                    <p className="text-lg font-black text-white">No events yet</p>
                                    <p className="mt-2 text-sm font-semibold">Join an event or create your first hosted collection.</p>
                                </div>
                            )}
                        </div>
                    )}
                </section>

                <div className="grid gap-6 md:grid-cols-2">
                    <section
                        onClick={() => router.push("/host")}
                        className="group relative flex min-h-[220px] cursor-pointer flex-col justify-between overflow-hidden rounded-[2rem] border border-[#CA9C68]/20 bg-[#151B21] p-6 shadow-xl shadow-black/20 sm:p-8"
                    >
                        <div className="relative z-10 flex flex-col gap-4">
                            <div className="w-fit rounded-full border border-[#CA9C68]/20 bg-[#CA9C68]/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#CA9C68]">
                                For Hosts
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white">Host an Event</h2>
                                <p className="mt-2 text-sm font-semibold text-slate-400">Create a private gallery for weddings, parties or corporate meets.</p>
                            </div>
                        </div>
                        <div className="relative z-10 mt-6 flex w-fit items-center rounded-xl border border-[#CA9C68]/30 bg-[#CA9C68]/10 px-4 py-2.5 text-xs font-black text-[#CA9C68] backdrop-blur-md transition-colors group-hover:bg-[#CA9C68]/15">
                            <span>Create Now</span>
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </div>
                    </section>

                    <section
                        onClick={() => window.open("https://www.youtube.com/@EveBashApp", "_blank")}
                        className="group relative flex flex-col justify-between cursor-pointer overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-900 to-indigo-950 p-6 sm:p-8 shadow-xl shadow-indigo-950/20 min-h-[220px]"
                    >
                        <div className="absolute right-0 top-0 h-48 w-48 -translate-y-1/2 translate-x-1/4 rounded-full bg-indigo-500/20 blur-2xl" />
                        <div className="relative z-10 flex flex-col gap-4">
                            <div className="w-fit rounded-lg bg-indigo-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-200">
                                How To Host
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white">Host Your Perfect Event</h2>
                                <p className="mt-2 text-sm font-semibold text-indigo-200">Watch our step-by-step tutorials and host your event like a pro.</p>
                            </div>
                        </div>
                        <div className="relative z-10 mt-6 flex w-fit items-center rounded-xl border border-indigo-300/30 bg-indigo-500/20 px-4 py-2.5 text-xs font-black text-white backdrop-blur-md transition-colors group-hover:bg-indigo-500/40">
                            <Play className="mr-2 h-4 w-4 fill-current" />
                            <span>Watch on YouTube</span>
                        </div>
                    </section>
                </div>
            </main>

            <AnimatePresence>
                {showJoinModal && (
                    <div className={cn(modalStyles.overlay, "z-[100] bg-transparent backdrop-blur-none")}>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowJoinModal(false)}
                            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className={cn(modalStyles.panel, "z-10")}
                        >
                            <ModalHeader title="Join Event" onClose={() => setShowJoinModal(false)} />

                            <form onSubmit={handleJoinEvent}>
                                <div className="mb-6">
                                    <label className={modalStyles.label}>Enter Join ID</label>
                                    <input
                                        type="text"
                                        value={joinCode}
                                        onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                                        className={cn(modalStyles.input, "text-center text-2xl font-black tracking-[0.2em]")}
                                        placeholder="A1B2-C3D4"
                                        maxLength={12}
                                    />
                                </div>

                                {joinMessage && (
                                    <div className={cn(joinMessageType === "error" ? modalStyles.error : modalStyles.success, "mb-6")}>
                                        {joinMessage}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isJoining}
                                    className={cn(modalStyles.primary, "w-full py-4")}
                                >
                                    {isJoining ? (
                                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
                                    ) : (
                                        "Join with Code"
                                    )}
                                </button>

                                <div className="mt-6 flex items-center">
                                    <div className="flex-1 border-t border-[var(--site-border)]" />
                                    <span className="px-4 text-xs font-black tracking-widest text-[var(--site-muted)]">OR</span>
                                    <div className="flex-1 border-t border-[var(--site-border)]" />
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setJoinMessageType("error");
                                        setJoinMessage("QR scanning is available on the mobile app. Please enter your Join ID here.");
                                    }}
                                    className={cn(modalStyles.secondary, "mt-6 w-full py-4")}
                                >
                                    <QrCode className="h-5 w-5 text-[#CA9C68]" />
                                    <span>Scan QR Code</span>
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
