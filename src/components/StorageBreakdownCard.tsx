"use client";

import { useState } from "react";
import { BookOpen, CalendarDays, ChevronDown, HardDrive, Image as ImageIcon, Lock, Mic, Video } from "lucide-react";
import { formatStorageSize, getUsagePercent } from "@/lib/planLimits";
import type { StorageBreakdown } from "@/lib/database";
import { cn } from "@/lib/utils";

interface StorageBreakdownCardProps {
    usage: StorageBreakdown;
    planBytes: number;
    planLabel: string;
    loading?: boolean;
}

// Events and EB Vault draw from the same plan storage, so both are shown against one limit.
export function StorageBreakdownCard({ usage, planBytes, planLabel, loading }: StorageBreakdownCardProps) {
    const unlimited = planBytes === Infinity;
    const percent = getUsagePercent(usage.total, planBytes);
    const overLimit = !unlimited && usage.total > planBytes;
    const remaining = unlimited ? Infinity : Math.max(planBytes - usage.total, 0);
    const eventShare = usage.total > 0 ? (usage.events / usage.total) * percent : 0;
    const vaultShare = usage.total > 0 ? (usage.vault / usage.total) * percent : 0;

    const [eventsOpen, setEventsOpen] = useState(false);
    const parts = usage.eventParts;
    // Album designs only exist with album proofing, so that line shows up only once there are some.
    const eventParts = parts ? [
        { icon: ImageIcon, label: "Photos", bytes: parts.photos },
        { icon: Video, label: "Videos", bytes: parts.videos },
        { icon: Mic, label: "Voice notes", bytes: parts.voiceNotes },
        ...(parts.albumDesigns > 0 ? [{ icon: BookOpen, label: "Album designs", bytes: parts.albumDesigns }] : []),
    ] : [];

    return (
        <div className="rounded-2xl bg-slate-900 p-4">
            <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                    <HardDrive className="h-3.5 w-3.5" aria-hidden />
                    Storage
                </p>
                <p className="text-[11px] font-bold text-slate-500">{planLabel} plan</p>
            </div>

            <p className="mt-2 text-xl font-black text-white">
                {loading ? "…" : formatStorageSize(usage.total)}
                <span className="text-sm font-bold text-slate-400"> of {unlimited ? "Unlimited" : planLabel} used</span>
            </p>

            {!unlimited && (
                <div
                    className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-800"
                    role="progressbar"
                    aria-label="Storage used"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(percent)}
                >
                    <div className="h-full bg-[#CA9C68]" style={{ width: `${eventShare}%` }} />
                    <div className="h-full bg-[#7FA38C]" style={{ width: `${vaultShare}%` }} />
                </div>
            )}

            <ul className="mt-4 space-y-2.5">
                <li>
                    {eventParts.length > 0 ? (
                        <button
                            type="button"
                            onClick={() => setEventsOpen((open) => !open)}
                            aria-expanded={eventsOpen}
                            className="flex w-full items-center justify-between gap-3 text-left text-sm"
                        >
                            <EventStorageLabel />
                            <span className="flex items-center gap-1.5 font-black text-white">
                                {loading ? "…" : formatStorageSize(usage.events)}
                                <ChevronDown className={cn("h-4 w-4 text-slate-500 transition-transform", eventsOpen && "rotate-180")} aria-hidden />
                            </span>
                        </button>
                    ) : (
                        <div className="flex items-center justify-between gap-3 text-sm">
                            <EventStorageLabel />
                            <span className="font-black text-white">{loading ? "…" : formatStorageSize(usage.events)}</span>
                        </div>
                    )}
                    {eventsOpen && eventParts.length > 0 && (
                        <ul className="mt-2 space-y-2 border-l border-slate-800 pl-4 ml-1">
                            {eventParts.map(({ icon: Icon, label, bytes }) => (
                                <li key={label} className="flex items-center justify-between gap-3 text-xs">
                                    <span className="flex items-center gap-2 font-semibold text-slate-400">
                                        <Icon className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                                        {label}
                                    </span>
                                    <span className="font-bold text-slate-200">{formatStorageSize(bytes)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </li>
                <li className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 font-semibold text-slate-300">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#7FA38C]" aria-hidden />
                        <Lock className="h-4 w-4 text-slate-500" aria-hidden />
                        Vault Storage
                    </span>
                    <span className="font-black text-white">{loading ? "…" : formatStorageSize(usage.vault)}</span>
                </li>
            </ul>

            <p className={cn("mt-3 text-[11px] font-medium", overLimit ? "text-rose-300" : "text-slate-500")}>
                {overLimit
                    ? "You're over your plan's storage. Existing files are safe, but new uploads are paused until you free up space or upgrade."
                    : unlimited
                        ? "Events and EB Vault share your plan storage."
                        : `${formatStorageSize(remaining)} free · Events and EB Vault share your plan storage.`}
            </p>
        </div>
    );
}

function EventStorageLabel() {
    return (
        <span className="flex items-center gap-2 font-semibold text-slate-300">
            <span className="h-2.5 w-2.5 rounded-full bg-[#CA9C68]" aria-hidden />
            <CalendarDays className="h-4 w-4 text-slate-500" aria-hidden />
            Event Storage
        </span>
    );
}
