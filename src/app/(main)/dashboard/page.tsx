"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
    DashboardEventStats,
    Event,
    getDashboardEventStats,
    openGallery,
    requestGalleryAccess,
} from "@/lib/database";
import {
    ArrowLeft,
    ArrowRight,
    Play,
    Plus,
    QrCode,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { ModalHeader, modalStyles } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import { CollectionsIcon } from "@/components/CollectionsIcon";
import {
    DashboardEventCard,
    SERIF,
    loadDashboardEvents,
} from "@/components/dashboard/DashboardEvents";

const DEFAULT_EVENT_COVER_IMAGE = "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop";
// The two stat boxes and the Join button share one size. The height is inline so it never depends on a newly
// generated Tailwind class.
const STAT_BOX = "flex min-w-0 flex-col justify-center rounded-2xl border border-[#273034] bg-[#0E141A] px-5 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:px-6";
const STAT_BOX_SIZE: React.CSSProperties = { height: 74 };

const MEMORIES_CARD_IMAGE = "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=2071&auto=format&fit=crop";

export default function DashboardHub() {
    const { user, loading } = useAuth();
    const router = useRouter();

    const [events, setEvents] = useState<Event[]>([]);
    const [hostedIds, setHostedIds] = useState<Set<string>>(new Set());
    const [eventStats, setEventStats] = useState<Record<string, DashboardEventStats>>({});
    const [isLoadingEvents, setIsLoadingEvents] = useState(true);

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
            const { events: visibleEvents, hostedIds: hosted } = await loadDashboardEvents(user);

            setEvents(visibleEvents);
            setHostedIds(hosted);

            // Counts load after the cards so they never hold the grid back
            getDashboardEventStats(visibleEvents.map((event) => event.id))
                .then(setEventStats)
                .catch((err) => console.error("Error fetching dashboard stats:", err));
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


    const attendedCount = events.length - events.filter((event) => hostedIds.has(event.id)).length;
    const statsLoaded = Object.keys(eventStats).length > 0;
    const totalPhotos = events.reduce((sum, event) => sum + (eventStats[event.id]?.photos || 0), 0);
    const totalVideos = events.reduce((sum, event) => sum + (eventStats[event.id]?.videos || 0), 0);

    // The full list lives on /dashboard/events (the "Your memories" card opens it)
    const visibleEvents = events.slice(0, 3);

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
            <main className="relative z-20 mx-auto max-w-7xl space-y-8 px-4 pt-24 pb-24 sm:px-6 lg:px-8">
                <section className="rounded-[2rem] border border-[#273034] bg-[#121820] p-5 shadow-2xl shadow-black/25 sm:p-8 lg:p-10">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-[#CA9C68]">
                                <CollectionsIcon className="h-6 w-6" aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="truncate font-brand font-normal tracking-wide text-[#F5EFE6]" style={{ fontSize: 28, lineHeight: "30px" }}>
                                    Collections <span className="text-[#CA9C68]">|</span> {user.name || user.email || "My Dashboard"}
                                </h1>
                                <p className="truncate font-sans text-slate-400" style={{ fontSize: 12, lineHeight: "18px" }}>Memories curated for you</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowJoinModal(true)}
                            className="flex h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-[#CA9C68] px-4 font-sans text-sm font-black text-slate-950 transition-colors hover:bg-[#D7AE7D] sm:px-5"
                            aria-label="Join Event"
                        >
                            <Plus className="h-4 w-4" />
                            <span className="sm:hidden">Join</span>
                            <span className="hidden sm:inline">Join Event</span>
                        </button>
                    </div>

                    <div className="mt-8 grid gap-4 sm:grid-cols-3">
                        <div className={STAT_BOX} style={STAT_BOX_SIZE}>
                            <span className="shrink-0 text-sm font-medium text-slate-400">Total Memories</span>
                            <span className="truncate text-xl text-[#CA9C68] lg:text-2xl" style={SERIF}>
                                {statsLoaded ? totalPhotos.toLocaleString("en-US") : "—"} {totalPhotos === 1 ? "Photo" : "Photos"} ✨
                            </span>
                        </div>
                        <div className={STAT_BOX} style={STAT_BOX_SIZE}>
                            <span className="shrink-0 text-sm font-medium text-slate-400">Videos</span>
                            <span className="truncate text-xl text-[#CA9C68] lg:text-2xl" style={SERIF}>
                                {statsLoaded ? totalVideos.toLocaleString("en-US") : "—"} {totalVideos === 1 ? "Video" : "Videos"}
                            </span>
                        </div>
                        <div className={STAT_BOX} style={STAT_BOX_SIZE}>
                            <span className="shrink-0 text-sm font-medium text-slate-400">Events Joined</span>
                            <span className="truncate text-xl text-white lg:text-2xl" style={SERIF}>
                                {attendedCount} {attendedCount === 1 ? "Celebration" : "Celebrations"}
                            </span>
                        </div>
                    </div>

                    {isLoadingEvents ? (
                        <div className="flex justify-center py-16">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2B2F2E] border-t-[#CA9C68]" />
                        </div>
                    ) : (
                        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                            {visibleEvents.map((event) => (
                                <DashboardEventCard key={event.id} event={event} guests={eventStats[event.id]?.guests} />
                            ))}

                            {events.length === 0 ? (
                                <div className="col-span-full rounded-2xl border border-dashed border-[#CA9C68]/25 p-10 text-center text-slate-400">
                                    <p className="text-2xl text-white" style={SERIF}>No events yet</p>
                                    <p className="mt-2 text-sm font-medium">Join an event or create your first hosted collection.</p>
                                </div>
                            ) : (
                                <Link
                                    href="/dashboard/events"
                                    className="group relative block min-h-64 overflow-hidden rounded-2xl border border-dashed border-[#CA9C68]/35 bg-[#0E141A] text-center transition-colors hover:border-[#CA9C68]/60"
                                >
                                    <img
                                        src={MEMORIES_CARD_IMAGE}
                                        alt=""
                                        className="absolute inset-0 h-full w-full object-cover opacity-25 transition-transform duration-700 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#0E141A] via-[#0E141A]/75 to-[#0E141A]/40" />
                                    <div className="relative z-10 flex h-full min-h-64 flex-col items-center justify-center p-6">
                                        <h3 className="text-2xl text-white" style={SERIF}>Your memories</h3>
                                        <div className="mt-3 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold">
                                            {events.length} {events.length === 1 ? "Collection" : "Collections"}
                                        </div>
                                        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#CA9C68] px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#13191F]">
                                            <span>Explore All</span>
                                            <ArrowRight className="h-4 w-4" />
                                        </div>
                                    </div>
                                </Link>
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
