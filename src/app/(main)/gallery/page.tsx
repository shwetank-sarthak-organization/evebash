"use client";

import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { getUserById, getUserEvents, Event } from "@/lib/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, ArrowRight, Loader2, Image as ImageIcon, Share2 } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { Tooltip } from "@/components/Tooltip";
import { navigateWithModifierClick } from "@/lib/navigation";
import { formatEventDate } from "@/lib/utils";

type EventOwnerProfile = {
    id?: string;
    email?: string;
    name?: string;
};

export default function GalleryPage() {
    const { user, loading, logout } = useAuth();
    const router = useRouter();

    const [events, setEvents] = useState<Event[]>([]);
    const [workspaceOwner, setWorkspaceOwner] = useState<EventOwnerProfile | null>(null);
    const [eventOwners, setEventOwners] = useState<Record<string, { email?: string; name?: string }>>({});
    const [loadingEvents, setLoadingEvents] = useState(true);

    const containerRef = useRef(null);

    useEffect(() => {
        if (user) {
            fetchEvents();
        } else if (!loading) {
            setLoadingEvents(false);
        }
    }, [user, loading]);

    useEffect(() => {
        const fetchWorkspaceOwner = async () => {
            if (user?.delegatedBy) {
                const owner = await getUserById(user.delegatedBy);
                setWorkspaceOwner(owner);
            } else {
                setWorkspaceOwner(null);
            }
        };

        if (user) fetchWorkspaceOwner();
    }, [user]);

    useEffect(() => {
        if (workspaceOwner?.email) {
            fetchEvents();
        }
    }, [workspaceOwner?.email]);

    useEffect(() => {
        const fetchEventOwners = async () => {
            const ownerIds = Array.from(new Set(
                events
                    .map(event => event.createdBy)
                    .filter((ownerId): ownerId is string => !!ownerId && !ownerId.includes("@"))
            ));

            if (ownerIds.length === 0) {
                setEventOwners({});
                return;
            }

            const ownerEntries = await Promise.all(
                ownerIds.map(async (ownerId) => {
                    const owner = await getUserById(ownerId);
                    return [ownerId, { email: owner?.email, name: owner?.name }] as const;
                })
            );

            setEventOwners(Object.fromEntries(ownerEntries));
        };

        fetchEventOwners();
    }, [events]);

    const fetchEvents = async () => {
        if (!user || !user.uid) return;
        setLoadingEvents(true);
        try {
            const ownIdentifiers = [user.uid];
            if (user.email) ownIdentifiers.push(user.email);

            const ownerIdentifiers: string[] = [];
            if (user.delegatedBy) ownerIdentifiers.push(user.delegatedBy);
            if (workspaceOwner?.email) ownerIdentifiers.push(workspaceOwner.email);

            const identifiers = user.delegatedBy
                ? [...ownIdentifiers, ...ownerIdentifiers]
                : ownIdentifiers;

            // Fetch main events using the same logic as the dashboard oversight
            const rawEvents = await getUserEvents(identifiers, "main");

            // Event managers see their own events plus only assigned owner events.
            let visibleEvents = [...rawEvents];
            if (user.roleType === 'event') {
                const assignedEvents = user.assignedEvents || [];
                visibleEvents = rawEvents.filter(e =>
                    (e.createdBy && ownIdentifiers.includes(e.createdBy)) ||
                    assignedEvents.includes(e.id)
                );
            }

            setEvents(visibleEvents);
        } catch (error) {
            console.error("Error fetching events:", error);
        } finally {
            setLoadingEvents(false);
        }
    };

    const ownEventIdentifiers = new Set([user?.uid, user?.email].filter(Boolean) as string[]);
    const createdEvents = events.filter(event => event.createdBy && ownEventIdentifiers.has(event.createdBy));
    const sharedEvents = events.filter(event => !event.createdBy || !ownEventIdentifiers.has(event.createdBy));

    const getEventOwnerEmail = (event: Event) => {
        if (!event.createdBy) return "Unknown owner";
        if (event.createdBy.includes("@")) return event.createdBy;
        return eventOwners[event.createdBy]?.email || workspaceOwner?.email || event.createdBy;
    };

    const getSharedAccessLabel = (event: Event) => {
        const ownerId = event.createdBy;
        const isFullManager = !!ownerId && user?.roleType === "primary" && (
            user.delegatedBy === ownerId ||
            user.delegatedBy === eventOwners[ownerId]?.email ||
            user.delegatedBy === workspaceOwner?.id
        );

        return isFullManager ? "Full Manager" : "Event Manager";
    };

    const renderEventCard = (event: Event, index: number) => {
        const isSharedEvent = !event.createdBy || !ownEventIdentifiers.has(event.createdBy);

        return (
            <ScrollReveal key={event.id} delay={index * 0.1}>
                <div
                    onClick={(e) => {
                        console.log(`[GalleryPage] Event clicked. Title: "${event.title}", ID: "${event.id}"`);
                        navigateWithModifierClick(e, `/events/${event.id}`, router.push);
                    }}
                    className="group block relative aspect-[4/5] rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 border border-stone-100 cursor-pointer bg-white"
                >
                    <Image
                        src={event.coverImage || '/placeholder-event.jpg'}
                        alt={event.title}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                        priority={index < 3}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent group-hover:via-black/40 transition-all duration-500" />

                    <div className="absolute bottom-0 left-0 p-8 w-full text-left flex items-end justify-between">
                        <div>
                            {isSharedEvent && (
                                <div className="mb-3 space-y-1">
                                    <div className="inline-flex max-w-full items-center px-2 py-1 bg-white/20 backdrop-blur-md rounded text-[9px] font-bold uppercase tracking-widest border border-white/20 text-white">
                                        <span className="truncate">Owner: {getEventOwnerEmail(event)}</span>
                                    </div>
                                    <div className="w-fit px-2 py-1 bg-black/30 backdrop-blur-md rounded text-[9px] font-bold uppercase tracking-widest border border-white/10 text-white/90">
                                        {getSharedAccessLabel(event)}
                                    </div>
                                </div>
                            )}
                            <p className="text-royal-gold text-xs font-bold uppercase tracking-widest mb-3">
                                {formatEventDate(event.date)}
                            </p>
                            <h3 className="text-2xl font-bold text-white mb-4 italic tracking-tight">
                                {event.title}
                            </h3>
                            <div className="flex items-center text-white text-xs font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                                View Galleries
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </div>
                        </div>

                        <div className="relative">
                            <Tooltip text="Share Event">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const url = `${window.location.origin}/events/${event.id}?shared=true`;
                                        navigator.clipboard.writeText(url);
                                        alert("Link copied to clipboard!");
                                    }}
                                    className="p-3 bg-white/10 backdrop-blur-md rounded-2xl text-white hover:bg-royal-gold hover:text-white transition-all active:scale-95 border border-white/20 group/share"
                                >
                                    <Share2 className="w-4 h-4" />
                                </button>
                            </Tooltip>
                        </div>
                    </div>
                </div>
            </ScrollReveal>
        );
    };

    const renderEventSection = (title: string, items: Event[], groupByOwner = false) => {
        if (items.length === 0) return null;

        const groupedItems = groupByOwner
            ? Object.entries(items.reduce<Record<string, Event[]>>((groups, event) => {
                const ownerEmail = getEventOwnerEmail(event);
                if (!groups[ownerEmail]) groups[ownerEmail] = [];
                groups[ownerEmail].push(event);
                return groups;
            }, {}))
            : [["", items] as [string, Event[]]];

        return (
            <section className="space-y-6">
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-slate-800 italic tracking-tight">{title}</h2>
                    <div className="w-12 h-1 bg-royal-gold/30 rounded-full mt-2"></div>
                </div>
                {groupedItems.map(([ownerEmail, ownerEvents]) => (
                    <div key={ownerEmail || title} className="space-y-6">
                        {groupByOwner && (
                            <div className="px-1 pt-2">
                                <h3 className="text-sm font-bold text-slate-800 font-sans uppercase tracking-[0.2em]">{ownerEmail}</h3>
                                <p className="text-[10px] text-stone-600 font-bold uppercase tracking-widest mt-1">
                                    {ownerEvents.length} shared {ownerEvents.length === 1 ? "event" : "events"}
                                </p>
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                            {ownerEvents.map(renderEventCard)}
                        </div>
                    </div>
                ))}
            </section>
        );
    };

    if (loading || loadingEvents) {
        return (
            <main className="min-h-screen flex items-center justify-center bg-royal-cream relative" ref={containerRef}>
                <Loader2 className="w-8 h-8 animate-spin text-royal-gold" />
            </main>
        );
    }

    // Default Main Events View
    return (
        <main className="min-h-screen bg-royal-cream font-serif text-slate-800 selection:bg-royal-gold/30" ref={containerRef}>
            <DashboardHeader
                user={user}
                breadcrumbs={[
                    ...(user ? [{ label: "Dashboard", onClick: () => router.push("/dashboard") }] : []),
                    { label: "View Gallery" }
                ]}
                onBack={() => router.push("/dashboard")}
                showChevron={true}
                logout={logout}
                icon={ImageIcon}
            />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
                <header className="mb-20 text-center">
                    <ScrollReveal direction="up">
                        <div className="inline-flex items-center space-x-3 px-4 py-2 bg-royal-gold/10 rounded-full text-royal-gold text-xs font-bold uppercase tracking-widest mb-6 border border-royal-gold/20">
                            <Camera className="w-4 h-4" />
                            <span>Your Collection</span>
                        </div>
                    </ScrollReveal>
                    
                    <ScrollReveal direction="up" delay={0.1}>
                        <h1 className="text-5xl md:text-7xl font-bold text-slate-900 mb-8 italic tracking-tight">
                            Your <span className="text-royal-gold">Memories</span>
                        </h1>
                    </ScrollReveal>
                    
                    <ScrollReveal direction="up" delay={0.2}>
                        <p className="text-slate-700 font-sans text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
                            A private collection of your most cherished moments, beautifully organized and captured forever.
                        </p>
                    </ScrollReveal>
                </header>

                {events.length === 0 ? (
                    <div className="bg-white rounded-[3rem] p-16 text-center border border-stone-100 shadow-xl shadow-black/5 max-w-2xl mx-auto">
                        <div className="w-24 h-24 bg-royal-cream rounded-full flex items-center justify-center mx-auto mb-8 border border-royal-gold/10 shadow-inner">
                            <Camera className="w-10 h-10 text-royal-gold" />
                        </div>
                        <h2 className="text-3xl font-bold mb-4 text-slate-900 italic tracking-tight">No events yet</h2>
                        <p className="text-slate-700 mb-10 font-sans text-lg">
                            Start by creating an event in your dashboard and uploading some photos.
                        </p>
                        <Link
                            href="/dashboard"
                            className="inline-flex items-center space-x-3 px-10 py-5 bg-slate-900 text-white rounded-full font-bold hover:bg-slate-800 transition-all shadow-xl active:scale-95"
                        >
                            <span>Go to Dashboard</span>
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-20">
                        {renderEventSection("Your Created Events", createdEvents)}
                        {renderEventSection("Shared Events", sharedEvents, true)}
                    </div>
                )}
            </div>

            <footer className="py-20 text-center text-slate-600 font-sans text-sm">
                <p>© 2026 WedAlbum. Elegant Memories, Forever Preserved.</p>
            </footer>
        </main>
    );
}
