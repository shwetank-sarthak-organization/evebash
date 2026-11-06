"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatStorageSize } from "@/lib/planLimits";
import { eventTransfers, formatTransferExpiry, type EventTransferStatus } from "@/lib/eventTransfers";

/** Host > event > Permissions; keyed by event. Shows nothing unless the backend says this user can transfer the event. */
export function TransferOwnershipCard({ eventId }: { eventId: string }) {
    const [status, setStatus] = useState<EventTransferStatus | null>(null);
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState("");
    const [keepAdmin, setKeepAdmin] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setStatus(await eventTransfers.fetchEventTransfer(eventId));
    }, [eventId]);

    useEffect(() => {
        let active = true;
        void eventTransfers.fetchEventTransfer(eventId).then((next) => {
            if (active) setStatus(next);
        });
        return () => {
            active = false;
        };
    }, [eventId]);

    if (!status) return null;

    const run = async (work: () => ReturnType<typeof eventTransfers.cancelTransfer>) => {
        setBusy(true);
        setError("");
        const result = await work();
        if (result.ok) {
            setEmail("");
            await load();
        } else {
            setError(result.error);
        }
        setBusy(false);
    };

    const size = formatStorageSize(status.sizeBytes);
    const { pending } = status;

    return (
        <section className="rounded-[1.5rem] border border-[var(--site-line)] bg-[var(--site-surface)] p-4">
            {pending ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <h5 className="text-sm font-black text-[var(--site-text)]">Transfer waiting for {pending.toName || pending.toEmail || "the new owner"}</h5>
                        <p className="mt-1 text-xs font-bold text-[var(--site-muted)]">
                            Uploads to this event are paused until they accept or decline. The request expires on {formatTransferExpiry(pending.expiresAt)}.
                            {!pending.receiverReady && " Their plan can't take this event yet, so they need to free up space or upgrade first."}
                        </p>
                    </div>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(() => eventTransfers.cancelTransfer(pending.id))}
                        className="shrink-0 rounded-full border border-[var(--site-line)] px-4 py-2 text-xs font-black text-[var(--site-text)] transition-colors hover:border-[var(--site-gold)] disabled:opacity-60"
                    >
                        {busy ? "Cancelling…" : "Cancel transfer"}
                    </button>
                </div>
            ) : (
                <>
                    <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setOpen((value) => !value)}
                        className="flex w-full items-center justify-between gap-3 text-left"
                    >
                        <span className="min-w-0">
                            <span className="block text-sm font-black text-[var(--site-text)]">Transfer ownership</span>
                            <span className="mt-0.5 block text-xs font-bold text-[var(--site-muted)]">Hand this event to another EveBash user. It uses {size}.</span>
                        </span>
                        <ChevronDown className={cn("h-4 w-4 shrink-0 text-[var(--site-muted)] transition-transform", open && "rotate-180")} aria-hidden="true" />
                    </button>
                    {open && (
                        <form
                            className="mt-4 space-y-3"
                            onSubmit={(submit) => {
                                submit.preventDefault();
                                if (!busy && email.trim()) void run(() => eventTransfers.startTransfer(eventId, email.trim(), keepAdmin));
                            }}
                        >
                            <p className="text-xs font-bold text-[var(--site-muted)]">
                                They have 7 days to accept, and need {size} free on their plan. When they accept, the event and its sub-galleries become theirs, and the space comes off your plan and counts on theirs. Uploads to the event pause until then.
                            </p>
                            <label className="block">
                                <span className="mb-1 block text-xs font-black text-[var(--site-text)]">New owner&apos;s email</span>
                                <input
                                    type="email"
                                    required
                                    autoComplete="off"
                                    value={email}
                                    onChange={(change) => setEmail(change.target.value)}
                                    placeholder="name@example.com"
                                    className="w-full rounded-xl border border-[var(--site-line)] bg-[var(--site-bg)] px-3 py-2 text-sm text-[var(--site-text)] outline-none focus:border-[var(--site-gold)]"
                                />
                            </label>
                            <label className="flex items-center gap-2 text-xs font-bold text-[var(--site-text)]">
                                <input type="checkbox" checked={keepAdmin} onChange={(change) => setKeepAdmin(change.target.checked)} className="h-4 w-4 accent-[var(--site-gold)]" />
                                Keep the current owner on as an admin
                            </label>
                            <button
                                type="submit"
                                disabled={busy || !email.trim()}
                                className="inline-flex items-center gap-2 rounded-full home-btn-gold px-4 py-2 text-xs font-black disabled:opacity-60"
                            >
                                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                                Send transfer request
                            </button>
                        </form>
                    )}
                </>
            )}
            {error && <p role="alert" className="mt-2 text-xs text-rose-400 light:text-rose-700">{error}</p>}
        </section>
    );
}
