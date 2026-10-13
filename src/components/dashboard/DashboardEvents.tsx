"use client";

import React from "react";
import { resolveEventCoverImage } from "@/lib/eventCovers";
import { Event, getApprovedSharedEventsForUser, getUserEvents } from "@/lib/database";
import { getCreatedTime } from "@/lib/eventSort";
import { cn } from "@/lib/utils";

// Shared by the dashboard (src/app/(main)/dashboard/page.tsx) and its full events list (dashboard/events/page.tsx).

// font-serif is aliased to Inter in tailwind.config.ts, so headings use the Playfair variable directly.
export const SERIF: React.CSSProperties = { fontFamily: "var(--font-playfair)" };

export type DashboardTab = "all" | "attended" | "hosted";
export const DASHBOARD_TABS: { key: DashboardTab; label: string }[] = [
    { key: "all", label: "All Events" },
    { key: "attended", label: "Attended Memories" },
    { key: "hosted", label: "Hosted Galleries" },
];

export function parseDashboardTab(value: string | null | undefined): DashboardTab {
    return DASHBOARD_TABS.some((tab) => tab.key === value) ? (value as DashboardTab) : "all";
}

export function filterEventsByTab(events: Event[], hostedIds: Set<string>, tab: DashboardTab): Event[] {
    if (tab === "hosted") return events.filter((event) => hostedIds.has(event.id));
    if (tab === "attended") return events.filter((event) => !hostedIds.has(event.id));
    return events;
}

/** The user's hosted galleries plus the shared ones they were approved for, newest first. */
export async function loadDashboardEvents(user: { uid: string; email?: string | null; phone?: string | null }) {
    const ownIdentifiers = [user.uid];
    if (user.email) ownIdentifiers.push(user.email);
    if (user.phone) ownIdentifiers.push(user.phone);

    const [hostedEvents, approvedSharedEvents] = await Promise.all([
        getUserEvents(ownIdentifiers, "main"),
        getApprovedSharedEventsForUser(ownIdentifiers),
    ]);

    const events = Array.from(
        new Map([...hostedEvents, ...approvedSharedEvents].map((event) => [event.id, event])).values()
    ).sort((a, b) => getCreatedTime(b) - getCreatedTime(a));

    return { events, hostedIds: new Set(hostedEvents.map((event) => event.id)) };
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

export function DashboardTabs({ active, onChange }: { active: DashboardTab; onChange: (tab: DashboardTab) => void }) {
    return (
        <div className="-mx-1 flex w-fit max-w-full overflow-x-auto rounded-full border border-[#273034] bg-[#0E141A] p-1">
            {DASHBOARD_TABS.map((tab) => (
                <button
                    key={tab.key}
                    type="button"
                    onClick={() => onChange(tab.key)}
                    className={cn(
                        "shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors sm:px-5",
                        active === tab.key
                            ? "bg-[#CA9C68] font-bold uppercase text-[#13191F]"
                            : "text-slate-300 hover:text-white"
                    )}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

export function DashboardEventCard({ event, guests }: { event: Event; guests?: number | null }) {
    const coverImage = resolveEventCoverImage(event.coverImage, "thumbnail");
    return (
        <button
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
}
