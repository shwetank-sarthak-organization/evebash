"use client";

import { useEffect, useId, useRef, useState } from "react";
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
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#CA9C68]/40 text-[#CA9C68] transition-colors hover:bg-[#CA9C68]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CA9C68]/60"
            >
                <Info className="h-4 w-4" aria-hidden="true" />
            </button>
            <div
                id={panelId}
                role="note"
                className={cn(
                    "absolute left-0 top-full z-[100] mt-2 w-[min(22rem,calc(100vw-3rem))] rounded-2xl border border-[#CA9C68]/30 bg-[#13191F] p-4 text-left text-sm leading-6 text-slate-300 shadow-2xl shadow-black/50 transition-opacity duration-200",
                    open ? "visible opacity-100" : "invisible opacity-0 group-hover/info:visible group-hover/info:opacity-100 group-focus-within/info:visible group-focus-within/info:opacity-100"
                )}
            >
                <p className="font-semibold text-[#E8C9A0]">Home (Primary Gallery)</p>
                <p>
                    Your event&apos;s home page, and the first thing guests see. It shows the photos and videos you
                    mark as favourites (⭐) from any gallery, followed by anything you upload to Home itself. Every
                    event has one, and it can&apos;t be deleted.
                </p>
                <p className="mt-3 font-semibold text-[#E8C9A0]">Sub-galleries</p>
                <p>
                    Chapters of your event, such as Haldi, Wedding or Reception. Each has its own photos, videos,
                    cover and message, and guests find them under Collections in the event menu. You can add as many
                    as you like, and delete them.
                </p>
            </div>
        </div>
    );
}
