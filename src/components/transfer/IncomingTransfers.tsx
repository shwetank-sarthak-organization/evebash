"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatStorageSize } from "@/lib/planLimits";
import { eventTransfers, formatTransferExpiry, type IncomingTransfer } from "@/lib/eventTransfers";

/** Dashboard: events someone wants to hand to this user. Nothing shows when there are none. */
export function IncomingTransfers({ onAccepted }: { onAccepted: () => void }) {
    const [requests, setRequests] = useState<IncomingTransfer[]>([]);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const load = useCallback(async () => {
        setRequests(await eventTransfers.fetchIncomingTransfers());
    }, []);

    useEffect(() => {
        let active = true;
        void eventTransfers.fetchIncomingTransfers().then((next) => {
            if (active) setRequests(next);
        });
        return () => {
            active = false;
        };
    }, []);

    if (requests.length === 0) return null;

    const decide = async (id: string, work: (id: string) => ReturnType<typeof eventTransfers.acceptTransfer>, accepted: boolean) => {
        setBusyId(id);
        setErrors((current) => ({ ...current, [id]: "" }));
        const result = await work(id);
        if (result.ok) {
            await load();
            if (accepted) onAccepted();
        } else {
            setErrors((current) => ({ ...current, [id]: result.error }));
            await load();
        }
        setBusyId(null);
    };

    return (
        <section aria-label="Event transfers waiting for you" className="space-y-3">
            {requests.map((request) => (
                <div key={request.id} className="rounded-[1.5rem] border border-[var(--site-gold)]/40 bg-[var(--site-surface)] p-5">
                    <h2 className="text-base font-black text-[var(--site-text)]">{request.fromName} wants to transfer &ldquo;{request.eventTitle}&rdquo; to you</h2>
                    <p className="mt-1 text-sm text-[var(--site-muted)]">
                        This event needs {formatStorageSize(request.sizeBytes)}.
                        {request.freeBytes !== null && ` You have ${formatStorageSize(request.freeBytes)} free.`}
                        {request.keepOldOwnerAsAdmin && " They stay on as an admin."}
                        {` Expires on ${formatTransferExpiry(request.expiresAt)}.`}
                    </p>
                    {!request.canAccept && <p className="mt-2 text-sm font-bold text-amber-400 light:text-amber-700">{request.blockMessage}</p>}
                    {errors[request.id] && <p role="alert" className="mt-2 text-sm text-rose-400 light:text-rose-700">{errors[request.id]}</p>}
                    <div className="mt-4 flex flex-wrap gap-2">
                        {request.canAccept ? (
                            <button
                                type="button"
                                disabled={busyId === request.id}
                                onClick={() => decide(request.id, eventTransfers.acceptTransfer, true)}
                                className="rounded-full home-btn-gold px-5 py-2 text-sm font-black disabled:opacity-60"
                            >
                                Accept
                            </button>
                        ) : (
                            <Link href="/pricing" className="rounded-full home-btn-gold px-5 py-2 text-sm font-black">
                                {request.block === "plan_expired" ? "Renew plan" : "Upgrade plan"}
                            </Link>
                        )}
                        <button
                            type="button"
                            disabled={busyId === request.id}
                            onClick={() => decide(request.id, eventTransfers.declineTransfer, false)}
                            className="rounded-full border border-[var(--site-line)] px-5 py-2 text-sm font-black text-[var(--site-text)] transition-colors hover:border-[var(--site-gold)] disabled:opacity-60"
                        >
                            Decline
                        </button>
                    </div>
                </div>
            ))}
        </section>
    );
}
