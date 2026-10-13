"use client";

import React, { useEffect, useMemo, useState } from "react";
import { resolveEventCoverImage } from "@/lib/eventCovers";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
    DashboardEventStats,
    Event,
    getApprovedSharedEventsForUser,
    getDashboardEventStats,
    getUserEvents,
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

const DEFAULT_EVENT_COVER_IMAGE = "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop";
const MEMORIES_CARD_IMAGE = "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=2071&auto=format&fit=crop";

// font-serif is aliased to Inter in tailwind.config.ts, so headings use the Playfair variable directly.
const SERIF: React.CSSProperties = { fontFamily: "var(--font-playfair)" };

type DashboardTab = "all" | "attended" | "hosted";
const DASHBOARD_TABS: { key: DashboardTab; label: string }[] = [
    { key: "all", label: "All Events" },
    { key: "attended", label: "Attended Memories" },
    { key: "hosted", label: "Hosted Galleries" },
];

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
    const [hostedIds, setHostedIds] = useState<Set<string>>(new Set());
    const [eventStats, setEventStats] = useState<Record<string, DashboardEventStats>>({});
    const [activeTab, setActiveTab] = useState<DashboardTab>("all");
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
            setHostedIds(new Set(hostedEvents.map((event) => event.id)));

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

    const tabEvents = useMemo(() => {
        if (activeTab === "hosted") return events.filter((event) => hostedIds.has(event.id));
        if (activeTab === "attended") return events.filter((event) => !hostedIds.has(event.id));
        return events;
    }, [events, hostedIds, activeTab]);

    const attendedCount = events.length - events.filter((event) => hostedIds.has(event.id)).length;
    const statsLoaded = Object.keys(eventStats).length > 0;
    const totalPhotos = events.reduce((sum, event) => sum + (eventStats[event.id]?.photos || 0), 0);

    const visibleEvents = useMemo(() => (
        showAllEvents ? tabEvents : tabEvents.slice(0, 3)
    ), [tabEvents, showAllEvents]);

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
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-[#CA9C68]">
                                <CollectionsIcon className="h-6 w-6" aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="truncate font-brand text-2xl font-normal leading-tight tracking-wide text-[#F5EFE6] sm:text-4xl">
                                    Collections <span className="text-[#CA9C68]">|</span> {user.name || user.email || "My Dashboard"}
                                </h1>
                                <p className="font-sans text-sm text-slate-400">Memories curated for you</p>
                            </div>
                        </div>
                        <div className="-mx-1 flex w-fit max-w-full overflow-x-auto rounded-full border border-[#273034] bg-[#0E141A] p-1">
                            {DASHBOARD_TABS.map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setActiveTab(tab.key)}
                                    className={cn(
                                        "shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors sm:px-5",
                                        activeTab === tab.key
                                            ? "bg-[#CA9C68] font-bold uppercase text-[#13191F]"
                                            : "text-slate-300 hover:text-white"
                                    )}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#273034] bg-[#0E141A] px-6 py-5">
                            <span className="text-sm font-medium text-slate-400">Total Memories</span>
                            <span className="text-2xl text-[#CA9C68]" style={SERIF}>
                                {statsLoaded ? totalPhotos.toLocaleString("en-US") : "—"} {totalPhotos === 1 ? "Photo" : "Photos"} ✨
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#273034] bg-[#0E141A] px-6 py-5">
                            <span className="text-sm font-medium text-slate-400">Events Joined</span>
                            <span className="text-2xl text-white" style={SERIF}>
                                {attendedCount} {attendedCount === 1 ? "Celebration" : "Celebrations"}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowJoinModal(true)}
                            className="inline-flex min-h-[4.5rem] items-center sm:col-span-2 lg:col-span-1 justify-center gap-2 rounded-2xl bg-[#CA9C68] px-6 py-5 text-sm font-bold uppercase tracking-[0.12em] text-[#13191F] transition-transform hover:bg-[#D6AA78] active:scale-[0.98]"
                        >
                            <Plus className="h-4 w-4" />
                            <span>Join Event with Code</span>
                        </button>
                    </div>

                    {isLoadingEvents ? (
                        <div className="flex justify-center py-16">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2B2F2E] border-t-[#CA9C68]" />
                        </div>
                    ) : (
                        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                            {visibleEvents.map((event) => {
                                const coverImage = resolveEventCoverImage(event.coverImage, 'thumbnail');
                                const guests = eventStats[event.id]?.guests;
                                return (
                                    <button
                                        key={event.id}
                                        type="button"
                                        onClick={() => window.open(`/events/${event.id}?mode=visitor`, "_blank", "noopener,noreferrer")}
                                        className="group flex flex-col rounded-2xl border border-[#273034] bg-[#0E141A] p-3 text-left transition-all hover:-translate-y-1 hover:border-[#CA9C68]/40"
                                    >
                                        <div className="relative w-full overflow-hidden rounded-xl bg-[#0E141A]" style={{ aspectRatio: "16 / 10" }}>
                                            <img
                                                src={coverImage}
                                                alt=""
                                                className="absolute inset-0 h-full w-full object-cover opacity-30 blur-xl"
                                            />
                                            <img
                                                src={coverImage}
                                                alt={event.title}
                                                className="absolute inset-0 h-full w-full transition-transform duration-700 group-hover:scale-105"
                                                style={getCoverImageStyle(event)}
                                            />
                                            {event.category && (
                                                <div className="absolute left-3 top-3 rounded-full border border-[#CA9C68]/30 bg-black/65 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#CA9C68] backdrop-blur-sm">
                                                    {event.category}
                                                </div>
                                            )}
                                        </div>
                                        <div className="px-1 pb-1 pt-4">
                                            <h3 className="truncate text-xl leading-tight text-white" style={SERIF}>{event.title}</h3>
                                            <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                                                <span className="truncate text-slate-400">{event.date}</span>
                                                {guests != null && (
                                                    <span className="shrink-0 font-medium text-[#CA9C68]">{guests} {guests === 1 ? "Guest" : "Guests"}</span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}

                            {tabEvents.length === 0 ? (
                                <div className="col-span-full rounded-2xl border border-dashed border-[#CA9C68]/25 p-10 text-center text-slate-400">
                                    <p className="text-2xl text-white" style={SERIF}>No events yet</p>
                                    <p className="mt-2 text-sm font-medium">Join an event or create your first hosted collection.</p>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setShowAllEvents(prev => !prev)}
                                    className="group relative min-h-64 overflow-hidden rounded-2xl border border-dashed border-[#CA9C68]/35 bg-[#0E141A] text-center transition-colors hover:border-[#CA9C68]/60"
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
                                            {tabEvents.length} {tabEvents.length === 1 ? "Collection" : "Collections"}
                                        </div>
                                        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#CA9C68] px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#13191F]">
                                            <span>{showAllEvents ? "Show Less" : "Explore All"}</span>
                                            <ArrowRight className="h-4 w-4" />
                                        </div>
                                    </div>
                                </button>
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
