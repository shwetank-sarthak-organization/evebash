"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ArrowLeftRight, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatStorageSize } from "@/lib/planLimits";
import { eventTransfers, formatTransferExpiry, type EventTransferStatus } from "@/lib/eventTransfers";
import { ModalHeader, modalStyles } from "@/components/ui/Modal";

/** Host > event > Permissions, next to the visibility box; keyed by event. Shows nothing unless the backend says this user can transfer the event. */
export function TransferOwnershipCard({ eventId, className }: { eventId: string; className?: string }) {
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

    const close = useCallback(() => {
        if (busy) return;
        setOpen(false);
        setError("");
    }, [busy]);

    useEffect(() => {
        if (!open) return;
        const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, close]);

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
    const pendingName = pending ? pending.toName || pending.toEmail || "the new owner" : "";

    return (
        <div className={className}>
            <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => setOpen(true)}
                className={cn(
                    "flex h-full w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-gold)]/60",
                    pending
                        ? "border-[var(--site-gold)]/70 bg-[var(--site-gold)]/10"
                        : "border-[var(--site-border)] bg-[var(--site-surface)]/45 hover:border-[var(--site-gold)]/45 hover:bg-[var(--site-surface)]/70"
                )}
            >
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", pending ? "bg-[var(--site-gold)] text-[var(--site-on-gold)]" : "bg-[var(--site-surface-2)] text-[var(--site-subtle)]")}>
                    <ArrowLeftRight className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-[var(--site-muted)]">Ownership</span>
                    <span className={cn("block text-sm font-bold", pending ? "text-[var(--site-gold-text)]" : "text-[var(--site-text)]")}>{pending ? "Transfer pending" : "Transfer ownership"}</span>
                    <span className="mt-0.5 block text-xs text-[var(--site-muted)]">{pending ? `Waiting for ${pendingName} to accept.` : "Hand this event to another EveBash user."}</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-[var(--site-muted)]" aria-hidden="true" />
            </button>

            {open && typeof document !== "undefined" && createPortal(
                <div className={modalStyles.overlay} onMouseDown={close}>
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="transfer-ownership-title"
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className={cn(modalStyles.panel, "my-8")}
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        {pending ? (
                            <>
                                <ModalHeader
                                    title="Transfer pending"
                                    subtitle={`Waiting for ${pendingName}.`}
                                    titleId="transfer-ownership-title"
                                    onClose={close}
                                    closeDisabled={busy}
                                    closeLabel="Close transfer ownership"
                                    className="mb-3"
                                />
                                <p className={modalStyles.body}>
                                    Uploads to this event are paused until they accept or decline. The request expires on {formatTransferExpiry(pending.expiresAt)}.
                                    {!pending.receiverReady && " Their plan can't take this event yet, so they need to free up space or upgrade first."}
                                </p>
                                {error && <p role="alert" className={cn(modalStyles.error, "mt-5")}>{error}</p>}
                                <div className={modalStyles.actions}>
                                    <button type="button" disabled={busy} onClick={close} className={modalStyles.secondary}>Close</button>
                                    <button type="button" disabled={busy} onClick={() => run(() => eventTransfers.cancelTransfer(pending.id))} className={modalStyles.danger}>
                                        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                                        {busy ? "Cancelling…" : "Cancel transfer"}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <ModalHeader
                                    title="Transfer ownership"
                                    subtitle={`Hand this event to another EveBash user. It uses ${size}.`}
                                    titleId="transfer-ownership-title"
                                    onClose={close}
                                    closeDisabled={busy}
                                    closeLabel="Close transfer ownership"
                                />
                                <form
                                    className="space-y-5"
                                    onSubmit={(submit) => {
                                        submit.preventDefault();
                                        if (!busy && email.trim()) void run(() => eventTransfers.startTransfer(eventId, email.trim(), keepAdmin));
                                    }}
                                >
                                    <p className={modalStyles.body}>
                                        They have 7 days to accept, and need {size} free on their plan. When they accept, the event and its sub-galleries become theirs, and the space comes off your plan and counts on theirs. Uploads to the event pause until then.
                                    </p>
                                    <label className="block">
                                        <span className={modalStyles.label}>New owner&apos;s email</span>
                                        <input
                                            type="email"
                                            required
                                            autoFocus
                                            autoComplete="off"
                                            value={email}
                                            onChange={(change) => setEmail(change.target.value)}
                                            placeholder="name@example.com"
                                            className={modalStyles.input}
                                        />
                                    </label>
                                    <label className="flex items-center gap-3 text-sm font-bold text-[var(--site-text)]">
                                        <input type="checkbox" checked={keepAdmin} onChange={(change) => setKeepAdmin(change.target.checked)} className="h-4 w-4 accent-[var(--site-gold)]" />
                                        Keep the current owner on as an admin
                                    </label>
                                    {error && <p role="alert" className={modalStyles.error}>{error}</p>}
                                    <div className={modalStyles.actions}>
                                        <button type="button" disabled={busy} onClick={close} className={modalStyles.secondary}>Cancel</button>
                                        <button type="submit" disabled={busy || !email.trim()} className={modalStyles.primary}>
                                            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                                            Send request
                                        </button>
                                    </div>
                                </form>
                            </>
                        )}
                    </motion.div>
                </div>,
                document.body
            )}
        </div>
    );
}
