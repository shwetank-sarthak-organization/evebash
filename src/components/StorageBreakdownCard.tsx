import { CalendarDays, HardDrive, Lock } from "lucide-react";
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

    const rows = [
        { icon: CalendarDays, label: "Event Storage", bytes: usage.events, swatch: "bg-[#CA9C68]" },
        { icon: Lock, label: "Vault Storage", bytes: usage.vault, swatch: "bg-[#7FA38C]" },
    ];

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
                {rows.map(({ icon: Icon, label, bytes, swatch }) => (
                    <li key={label} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2 font-semibold text-slate-300">
                            <span className={cn("h-2.5 w-2.5 rounded-full", swatch)} aria-hidden />
                            <Icon className="h-4 w-4 text-slate-500" aria-hidden />
                            {label}
                        </span>
                        <span className="font-black text-white">{loading ? "…" : formatStorageSize(bytes)}</span>
                    </li>
                ))}
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
