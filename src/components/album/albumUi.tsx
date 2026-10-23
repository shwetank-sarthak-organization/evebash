"use client";

import { cn } from "@/lib/utils";
import type { AlbumComment, AlbumPageStatus, AlbumStatus } from "@/lib/albumApi";

export const ALBUM_GOLD = "#CA9C68";

const PAGE_STATUS: Record<AlbumPageStatus, { label: string; className: string }> = {
    draft: { label: "Not sent", className: "border-slate-600 bg-slate-800/80 text-slate-300" },
    pending: { label: "Waiting for review", className: "border-[#CA9C68]/40 bg-[#CA9C68]/10 text-[#E8C9A0]" },
    approved: { label: "Approved", className: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" },
    changes_requested: { label: "Changes requested", className: "border-rose-400/40 bg-rose-400/10 text-rose-200" },
};

const ALBUM_STATUS: Record<AlbumStatus, { label: string; className: string }> = {
    draft: { label: "Draft", className: PAGE_STATUS.draft.className },
    in_review: { label: "In review", className: PAGE_STATUS.pending.className },
    changes_requested: { label: "Changes requested", className: PAGE_STATUS.changes_requested.className },
    approved: { label: "Approved for print", className: PAGE_STATUS.approved.className },
};

const chip = "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]";

export function PageStatusChip({ status, className }: { status: AlbumPageStatus; className?: string }) {
    return <span className={cn(chip, PAGE_STATUS[status].className, className)}>{PAGE_STATUS[status].label}</span>;
}

export function AlbumStatusChip({ status, className }: { status: AlbumStatus; className?: string }) {
    return <span className={cn(chip, ALBUM_STATUS[status].className, className)}>{ALBUM_STATUS[status].label}</span>;
}

export function ProgressBar({ value, total, className }: { value: number; total: number; className?: string }) {
    const percent = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
        <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/10", className)} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-emerald-400 transition-[width] duration-500" style={{ width: `${percent}%` }} />
        </div>
    );
}

/** Numbered pins follow the order requests were made on the page, so "pin 3" means the same thing to everyone. */
export function pinNumbers(comments: AlbumComment[]) {
    const numbers = new Map<string, number>();
    comments
        .filter((c) => !c.parentId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .forEach((c, i) => numbers.set(c.id, i + 1));
    return numbers;
}

export function formatSeconds(seconds: number) {
    const s = Math.max(0, Math.round(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export const albumButton = {
    primary: "inline-flex items-center justify-center gap-2 rounded-2xl bg-[#CA9C68] px-4 py-3 text-xs font-black uppercase tracking-widest text-[#13191F] transition-colors hover:bg-[#D7AE7D] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
    secondary: "inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-200 transition-colors hover:border-[#CA9C68]/50 hover:bg-white/5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
    ghost: "inline-flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50",
};
