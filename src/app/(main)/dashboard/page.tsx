"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
    Event,
    getApprovedSharedEventsForUser,
    getEventByJoinId,
    getUserEvents,
    logGuestLogin,
} from "@/lib/database";
import {
    ArrowRight,
    Bell,
    Calendar,
    MessageCircle,
    Play,
    Plus,
    QrCode,
    X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

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
            const event = await getEventByJoinId(finalCode);

            if (!event) {
                setJoinMessageType("error");
                setJoinMessage("Invalid Join ID. Please check the code and try again.");
                return;
            }

            const guestName = user.name || "Anonymous Guest";
            const guestId = user.phone || user.email || user.uid;

            if (!guestId) {
                throw new Error("User identifier not found.");
            }

            const success = await logGuestLogin(
                guestName,
                guestId,
                event.id,
                event.parentId || undefined,
                event.title || "Untitled Event",
                event.createdBy || undefined,
                "pending"
            );

            if (success) {
                setJoinMessageType("success");
                setJoinMessage("Request sent. You will see the event in your collections once approved.");
                setTimeout(() => {
                    setShowJoinModal(false);
                    setJoinCode("");
                    setJoinMessage("");
                    fetchData();
                }, 2500);
            } else {
                setJoinMessageType("error");
                setJoinMessage("Request could not be submitted. Please try again.");
            }
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
        <div className="min-h-screen bg-slate-950 pb-24 font-sans text-white">
            <header className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 pb-16 pt-8 sm:px-6 lg:px-8">
                <div
                    className="absolute inset-0 opacity-10"
                    style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "32px 32px" }}
                />
                <div className="relative z-10 mx-auto flex max-w-7xl items-center justify-between">
                    <button
                        type="button"
                        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-amber-300 transition-colors hover:bg-slate-800"
                        aria-label="Notifications"
                    >
                        <Bell className="h-5 w-5" />
                    </button>

                    <div className="text-center">
                        <h1 className="text-2xl font-black tracking-tight">EveBash</h1>
                        <p className="mt-1 text-xs font-bold tracking-wide text-amber-300">Let's capture moments</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => router.push("/customer-chats")}
                            className="hidden h-11 w-11 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-amber-300 transition-colors hover:bg-slate-800 sm:flex"
                            aria-label="Chats"
                        >
                            <MessageCircle className="h-5 w-5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push("/profile")}
                            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-sm font-black text-white transition-colors hover:bg-slate-700"
                            aria-label="Profile"
                        >
                            {user.name?.charAt(0).toUpperCase() || "U"}
                        </button>
                    </div>
                </div>
            </header>

            <main className="relative z-20 mx-auto -mt-8 max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
                <section className="rounded-[2rem] border border-slate-800 bg-slate-950 p-5 shadow-2xl shadow-black/20 sm:p-8">
                    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-300">Events</p>
                            <h2 className="mt-1 text-2xl font-black">Memories curated for you</h2>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowJoinModal(true)}
                            className="inline-flex w-fit items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-sm font-black text-slate-950 transition-transform active:scale-95"
                        >
                            <Plus className="h-4 w-4" />
                            <span>Join Event</span>
                        </button>
                    </div>

                    {isLoadingEvents ? (
                        <div className="flex justify-center py-16">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-amber-400" />
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {visibleEvents.map((event) => {
                                const coverImage = event.coverImage || DEFAULT_EVENT_COVER_IMAGE;
                                return (
                                    <button
                                        key={event.id}
                                        type="button"
                                        onClick={() => router.push(`/events/${event.id}?mode=visitor`)}
                                        className="group relative h-64 overflow-hidden rounded-[1.5rem] border border-slate-800 bg-slate-900 text-left shadow-xl shadow-black/10 transition-transform hover:-translate-y-1"
                                    >
                                        <div className="absolute inset-0 overflow-hidden bg-slate-950">
                                            <img
                                                src={coverImage}
                                                alt=""
                                                className="absolute inset-0 h-full w-full object-cover opacity-35 blur-xl"
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
                                            <div className="absolute left-4 top-4 rounded-lg border border-amber-300/30 bg-black/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-300 backdrop-blur-sm">
                                                {event.category}
                                            </div>
                                        )}
                                        <div className="absolute bottom-0 left-0 right-0 bg-black p-5 text-white">
                                            <h3 className="truncate text-lg font-black leading-tight text-white">{event.title}</h3>
                                            <div className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-400">
                                                <Calendar className="h-3.5 w-3.5 text-amber-300" />
                                                <span>{event.date}</span>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}

                            <button
                                type="button"
                                onClick={() => setShowAllEvents(prev => !prev)}
                                className="group relative h-full min-h-64 overflow-hidden rounded-[1.5rem] border border-slate-800 bg-slate-900 text-center shadow-xl shadow-black/10"
                            >
                                <img
                                    src={MEMORIES_CARD_IMAGE}
                                    alt=""
                                    className="absolute inset-0 h-full w-full object-cover opacity-45 transition-transform duration-700 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/20" />
                                <div className="relative z-10 flex h-full min-h-64 flex-col items-center justify-center p-6">
                                    <h3 className="text-xl font-black">Your memories</h3>
                                    <div className="mt-3 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black">
                                        {events.length} Collections
                                    </div>
                                    <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-950">
                                        <span>{showAllEvents ? "Show Less" : "Explore All"}</span>
                                        <ArrowRight className="h-4 w-4" />
                                    </div>
                                </div>
                            </button>

                            {events.length === 0 && (
                                <div className="col-span-full rounded-[1.5rem] border border-dashed border-slate-800 p-10 text-center text-slate-400">
                                    <p className="text-lg font-black text-white">No events yet</p>
                                    <p className="mt-2 text-sm font-semibold">Join an event or create your first hosted collection.</p>
                                </div>
                            )}
                        </div>
                    )}
                </section>

                <section
                    onClick={() => router.push("/host")}
                    className="group relative cursor-pointer overflow-hidden rounded-[2rem] bg-gradient-to-br from-amber-400 to-yellow-700 p-8 shadow-xl shadow-amber-950/20"
                >
                    <div className="absolute right-0 top-0 h-64 w-64 -translate-y-1/2 translate-x-1/4 rounded-full bg-white/10 blur-3xl" />
                    <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
                        <div className="max-w-md">
                            <div className="mb-4 inline-block rounded-lg bg-black/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-950">
                                For Hosts
                            </div>
                            <h2 className="text-3xl font-black text-white">Host an Event</h2>
                            <p className="mt-2 font-semibold text-white/80">Create a stunning private gallery for weddings, parties or corporate meets.</p>
                        </div>
                        <div className="flex w-fit items-center rounded-xl border border-white/30 bg-white/20 px-5 py-3 font-black text-white backdrop-blur-md transition-colors group-hover:bg-white/30">
                            <span>Create Now</span>
                            <ArrowRight className="ml-2 h-5 w-5" />
                        </div>
                    </div>
                </section>

                <section
                    onClick={() => window.open("https://www.youtube.com/@EveBashApp", "_blank")}
                    className="group relative cursor-pointer overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-900 to-indigo-950 p-8 shadow-xl shadow-indigo-950/20"
                >
                    <div className="absolute right-0 top-0 h-64 w-64 -translate-y-1/2 translate-x-1/4 rounded-full bg-indigo-500/20 blur-3xl" />
                    <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
                        <div className="max-w-md">
                            <div className="mb-4 inline-block rounded-lg bg-indigo-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-200">
                                How To Host
                            </div>
                            <h2 className="text-3xl font-black text-white">Host Your Perfect Event</h2>
                            <p className="mt-2 font-semibold text-indigo-200">Watch our step-by-step tutorials and host your event like a pro.</p>
                        </div>
                        <div className="flex w-fit items-center rounded-xl border border-indigo-300/30 bg-indigo-500/20 px-5 py-3 font-black text-white backdrop-blur-md transition-colors group-hover:bg-indigo-500/40">
                            <Play className="mr-2 h-5 w-5 fill-current" />
                            <span>Watch on YouTube</span>
                        </div>
                    </div>
                </section>
            </main>

            <AnimatePresence>
                {showJoinModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowJoinModal(false)}
                            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900 shadow-2xl"
                        >
                            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 p-6">
                                <h3 className="text-xl font-black text-white">Join Event</h3>
                                <button
                                    type="button"
                                    onClick={() => setShowJoinModal(false)}
                                    className="rounded-full bg-slate-800 p-2 text-slate-400 transition-colors hover:text-white"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <form onSubmit={handleJoinEvent} className="p-6 sm:p-8">
                                <div className="mb-6">
                                    <label className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Enter Join ID</label>
                                    <input
                                        type="text"
                                        value={joinCode}
                                        onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                                        className="w-full rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-4 text-center text-2xl font-black tracking-[0.2em] text-white outline-none transition-all placeholder:text-slate-600 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20"
                                        placeholder="A1B2C3"
                                        maxLength={6}
                                    />
                                </div>

                                {joinMessage && (
                                    <div className={`mb-6 rounded-xl border p-4 text-center text-sm font-bold ${
                                        joinMessageType === "error"
                                            ? "border-rose-500/30 bg-rose-950/40 text-rose-300"
                                            : "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
                                    }`}>
                                        {joinMessage}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isJoining}
                                    className="flex w-full items-center justify-center rounded-xl bg-amber-400 py-4 text-[15px] font-black text-slate-950 transition-all disabled:opacity-70"
                                >
                                    {isJoining ? (
                                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
                                    ) : (
                                        "Join with Code"
                                    )}
                                </button>

                                <div className="mt-6 flex items-center">
                                    <div className="flex-1 border-t border-slate-800" />
                                    <span className="px-4 text-xs font-black tracking-widest text-slate-500">OR</span>
                                    <div className="flex-1 border-t border-slate-800" />
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setJoinMessageType("error");
                                        setJoinMessage("QR scanning is available on the mobile app. Please enter your Join ID here.");
                                    }}
                                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-4 text-[15px] font-black text-white transition-colors hover:bg-slate-700"
                                >
                                    <QrCode className="h-5 w-5 text-amber-300" />
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
