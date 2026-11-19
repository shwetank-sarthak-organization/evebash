"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "i" next to the host's Galleries heading: what the Primary Gallery is and how it differs from sub-galleries.
 * Opens on hover or keyboard focus, and on tap for touch screens (tap again or outside to close).
 */
export function GalleryTypesInfo() {
    const [open, setOpen] = useState(false);
    const panelId = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    // Moves the open box left so it stays on a narrow screen (issue #252); set on the element, it never re-renders
    useLayoutEffect(() => {
        const panel = panelRef.current;
        if (!panel) return;
        panel.style.left = "";
        if (!open) return;
        const rect = panel.getBoundingClientRect();
        const margin = 16;
        const overflow = rect.right - (window.innerWidth - margin);
        if (overflow > 0) panel.style.left = `${-Math.min(overflow, Math.max(0, rect.left - margin))}px`;
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const close = (event: Event) => {
            if (event instanceof KeyboardEvent ? event.key === "Escape" : !rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener("pointerdown", close);
        document.addEventListener("keydown", close);
        return () => {
            document.removeEventListener("pointerdown", close);
            document.removeEventListener("keydown", close);
        };
    }, [open]);

    return (
        <div ref={rootRef} className="group/info relative inline-flex">
            <button
                type="button"
                onClick={() => setOpen(value => !value)}
                aria-label="Home (Primary Gallery) and sub-galleries: what's the difference?"
                aria-expanded={open}
                aria-controls={panelId}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--site-gold)]/40 text-[var(--site-gold-text)] transition-colors hover:bg-[var(--site-gold)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-gold)]/60"
            >
                <Info className="h-4 w-4" aria-hidden="true" />
            </button>
            <div
                ref={panelRef}
                id={panelId}
                role="note"
                className={cn(
                    "absolute left-0 top-full z-[100] mt-2 w-[min(22rem,calc(100vw-3rem))] rounded-2xl border border-[var(--site-gold)]/30 bg-[var(--site-bg)] p-4 text-left text-sm leading-6 text-[var(--site-subtle)] shadow-2xl shadow-black/50 light:shadow-(color:--home-shadow-strong) transition-opacity duration-200",
                    // Closed, it is out of the layout (display none), not only invisible: an invisible 22rem box still
                    // made the host page scroll sideways on phones (issue #252)
                    open ? "block opacity-100" : "hidden group-hover/info:block group-focus-within/info:block"
                )}
            >
                <p className="font-semibold text-[var(--site-gold-light-text)]">Home (Primary Gallery)</p>
                <p>
                    Your event&apos;s home page, and the first thing guests see. It shows the photos and videos you
                    mark as favourites (⭐) from any gallery, followed by anything you upload to Home itself. Every
                    event has one, and it can&apos;t be deleted.
                </p>
                <p className="mt-3 font-semibold text-[var(--site-gold-light-text)]">Sub-galleries</p>
                <p>
                    Chapters of your event, such as Haldi, Wedding or Reception. Each has its own photos, videos,
                    cover and message, and guests find them under Collections in the event menu. You can add as many
                    as you like, and delete them.
                </p>
            </div>
        </div>
    );
}
