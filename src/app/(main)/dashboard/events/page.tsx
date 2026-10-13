"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { DashboardEventStats, Event, getDashboardEventStats } from "@/lib/database";
import {
    ALL_EVENT_TYPES,
    EVENT_SORT_OPTIONS,
    EventSortKey,
    filterEvents,
    getEventTypes,
    sortEvents,
} from "@/lib/eventSort";
import {
    DashboardEventCard,
    DashboardTab,
    DashboardTabs,
    SERIF,
    filterEventsByTab,
    loadDashboardEvents,
    parseDashboardTab,
} from "@/components/dashboard/DashboardEvents";

// Every event the user hosts or joined, opened from the dashboard's "Your memories" card.
// The website version of the app's Gallery screen (apps/mobile/app/(tabs)/your-events.tsx).

const controlClass = "h-12 rounded-xl border border-[#273034] bg-[#0E141A] px-4 text-sm text-white outline-none transition-colors focus:border-[#CA9C68]/60";

function Spinner() {
    return (
        <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2B2F2E] border-t-[#CA9C68]" />
        </div>
    );
}

function YourEvents() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const activeTab = parseDashboardTab(searchParams.get("tab"));

    const [events, setEvents] = useState<Event[]>([]);
    const [hostedIds, setHostedIds] = useState<Set<string>>(new Set());
    const [eventStats, setEventStats] = useState<Record<string, DashboardEventStats>>({});
    const [isLoadingEvents, setIsLoadingEvents] = useState(true);
    const [loadError, setLoadError] = useState(false);

    const [searchQuery, setSearchQuery] = useState("");
    const [sortKey, setSortKey] = useState<EventSortKey>("recent");
    const [typeFilter, setTypeFilter] = useState(ALL_EVENT_TYPES);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    // Bumped on every fetch so a slower, older request can't overwrite newer results
    const fetchSeq = useRef(0);

    const fetchData = async () => {
        if (!user) return;
        const seq = ++fetchSeq.current;

        setIsLoadingEvents(true);
        try {
            const { events: visibleEvents, hostedIds: hosted } = await loadDashboardEvents(user);
            if (seq !== fetchSeq.current) return;

            setEvents(visibleEvents);
            setHostedIds(hosted);
            setLoadError(false);

            // Counts load after the cards so they never hold the grid back
            getDashboardEventStats(visibleEvents.map((event) => event.id))
                .then((stats) => { if (seq === fetchSeq.current) setEventStats(stats); })
                .catch((err) => console.error("Error fetching dashboard stats:", err));
        } catch (err) {
            if (seq === fetchSeq.current) {
                console.error("Error fetching your events:", err);
                setLoadError(true);
            }
        } finally {
            if (seq === fetchSeq.current) setIsLoadingEvents(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const setTab = (tab: DashboardTab) => {
        router.replace(tab === "all" ? "/dashboard/events" : `/dashboard/events?tab=${tab}`, { scroll: false });
    };

    const tabEvents = useMemo(() => filterEventsByTab(events, hostedIds, activeTab), [events, hostedIds, activeTab]);

    // Only offer the types the tab's events actually have; a type that no longer exists falls back to All
    const availableTypes = useMemo(() => getEventTypes(tabEvents), [tabEvents]);
    const activeType = availableTypes.some((t) => t.toLowerCase() === typeFilter.toLowerCase()) ? typeFilter : ALL_EVENT_TYPES;
    const filtersActive = sortKey !== "recent" || activeType !== ALL_EVENT_TYPES || searchQuery.trim() !== "";

    const shownEvents = useMemo(
        () => sortEvents(filterEvents(tabEvents, searchQuery, activeType), sortKey),
        [tabEvents, searchQuery, activeType, sortKey]
    );

    const clearFilters = () => {
        setSortKey("recent");
        setTypeFilter(ALL_EVENT_TYPES);
        setSearchQuery("");
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#0E141A]">
                <Spinner />
            </div>
        );
    }

    if (!user) return null;

    const renderContent = () => {
        if (isLoadingEvents && events.length === 0) return <Spinner />;

        if (loadError && events.length === 0) {
            return (
                <div className="mt-8 rounded-2xl border border-dashed border-[#CA9C68]/25 p-10 text-center text-slate-400">
                    <p className="text-2xl text-white" style={SERIF}>Couldn&apos;t load your events</p>
                    <button
                        type="button"
                        onClick={fetchData}
                        className="mt-6 rounded-full border border-[#CA9C68]/40 px-5 py-2 text-xs font-bold uppercase tracking-widest text-[#CA9C68] transition-colors hover:bg-[#CA9C68]/10"
                    >
                        Try again
                    </button>
                </div>
            );
        }

        if (tabEvents.length === 0) {
            return (
                <div className="mt-8 rounded-2xl border border-dashed border-[#CA9C68]/25 p-10 text-center text-slate-400">
                    <p className="text-2xl text-white" style={SERIF}>No events yet</p>
                    <p className="mt-2 text-sm font-medium">
                        {activeTab === "hosted"
                            ? "Galleries you host will appear here."
                            : activeTab === "attended"
                                ? "Events you join will appear here."
                                : "Events you host or join will appear here."}
                    </p>
                    <Link
                        href="/dashboard"
                        className="mt-6 inline-block rounded-full border border-[#CA9C68]/40 px-5 py-2 text-xs font-bold uppercase tracking-widest text-[#CA9C68] transition-colors hover:bg-[#CA9C68]/10"
                    >
                        Join an Event
                    </Link>
                </div>
            );
        }

        if (shownEvents.length === 0) {
            return (
                <div className="mt-8 rounded-2xl border border-dashed border-[#CA9C68]/25 p-10 text-center text-slate-400">
                    <p className="text-2xl text-white" style={SERIF}>No matches</p>
                    <p className="mt-2 text-sm font-medium">No events match your search or filters.</p>
                    <button
                        type="button"
                        onClick={clearFilters}
                        className="mt-6 rounded-full border border-[#CA9C68]/40 px-5 py-2 text-xs font-bold uppercase tracking-widest text-[#CA9C68] transition-colors hover:bg-[#CA9C68]/10"
                    >
                        Clear filters
                    </button>
                </div>
            );
        }

        return (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {shownEvents.map((event) => (
                    <DashboardEventCard key={event.id} event={event} guests={eventStats[event.id]?.guests} />
                ))}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#0E141A] font-sans text-white">
            <main className="relative z-20 mx-auto max-w-7xl px-4 pt-24 pb-24 sm:px-6 lg:px-8">
                <section className="rounded-[2rem] border border-[#273034] bg-[#121820] p-5 shadow-2xl shadow-black/25 sm:p-8 lg:p-10">
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition-colors hover:text-[#CA9C68]"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Dashboard</span>
                    </Link>

                    <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                            <h1 className="text-3xl text-white sm:text-4xl" style={SERIF}>Your memories</h1>
                            <p className="mt-1 text-sm text-slate-400">
                                {isLoadingEvents && events.length === 0
                                    ? "Loading your collections…"
                                    : `${tabEvents.length} ${tabEvents.length === 1 ? "Collection" : "Collections"}`}
                            </p>
                        </div>
                        <DashboardTabs active={activeTab} onChange={setTab} />
                    </div>

                    {tabEvents.length > 0 && (
                        <div className="mt-8 flex flex-col gap-3 md:flex-row">
                            <label className="relative flex-1">
                                <span className="sr-only">Search events</span>
                                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="search"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search events..."
                                    className={`${controlClass} w-full pl-11 placeholder:text-slate-500`}
                                />
                            </label>
                            <div className="flex gap-3">
                                <label className="flex-1 md:flex-none">
                                    <span className="sr-only">Sort by</span>
                                    <select
                                        value={sortKey}
                                        onChange={(e) => setSortKey(e.target.value as EventSortKey)}
                                        className={`${controlClass} w-full md:w-auto`}
                                    >
                                        {EVENT_SORT_OPTIONS.map((option) => (
                                            <option key={option.key} value={option.key}>{option.label}</option>
                                        ))}
                                    </select>
                                </label>
                                {availableTypes.length > 0 && (
                                    <label className="flex-1 md:flex-none">
                                        <span className="sr-only">Event type</span>
                                        <select
                                            value={activeType}
                                            onChange={(e) => setTypeFilter(e.target.value)}
                                            className={`${controlClass} w-full md:w-auto`}
                                        >
                                            <option value={ALL_EVENT_TYPES}>All types</option>
                                            {availableTypes.map((type) => (
                                                <option key={type} value={type}>{type}</option>
                                            ))}
                                        </select>
                                    </label>
                                )}
                            </div>
                            {filtersActive && (
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="h-12 shrink-0 rounded-xl px-4 text-sm font-semibold text-[#CA9C68] transition-colors hover:bg-[#CA9C68]/10"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    )}

                    {renderContent()}
                </section>
            </main>
        </div>
    );
}

export default function YourEventsPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#0E141A]" />}>
            <YourEvents />
        </Suspense>
    );
}
