"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

const PANEL_CLASS =
    "z-[100] rounded-2xl border border-[var(--site-gold)]/30 bg-[var(--site-bg)] p-4 text-left text-sm leading-6 text-[var(--site-subtle)] shadow-2xl shadow-black/50 light:shadow-(color:--home-shadow-strong)";

function PanelText() {
    return (
        <>
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
        </>
    );
}

/**
 * "i" next to the host's Galleries heading: what the Primary Gallery is and how it differs from sub-galleries.
 * Opens on hover or keyboard focus, and on tap for touch screens (tap again or outside to close).
 *
 * Issue #252: on phone-size screens (under 640 px) the box opened from the button ran off the right edge, and while
 * closed it still made the page scroll sideways. Now, closed, it is out of the layout (display none); opened on a
 * phone it is drawn at the top of the page (a portal into <body>, which holds the site colours) and pinned to the
 * screen, 16 px from each side, just under the button. Scrolling closes it. Larger screens keep the box under the
 * button. (Measuring and shifting the box did not work on Android Chrome, which widens the page to fit whatever
 * sticks out, so the box seemed to fit.)
 */
export function GalleryTypesInfo() {
    const [open, setOpen] = useState(false);
    // Screen position for the phone box, taken when it is tapped open; null = the box opens under the button
    const [pinnedTop, setPinnedTop] = useState<number | null>(null);
    const panelId = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const pinnedRef = useRef<HTMLDivElement>(null);
    const pinned = open && pinnedTop !== null;

    useEffect(() => {
        if (!open) return;
        const close = (event: Event) => {
            if (event instanceof KeyboardEvent) {
                if (event.key === "Escape") setOpen(false);
                return;
            }
            const target = event.target as Node;
            if (!rootRef.current?.contains(target) && !pinnedRef.current?.contains(target)) setOpen(false);
        };
        document.addEventListener("pointerdown", close);
        document.addEventListener("keydown", close);
        return () => {
            document.removeEventListener("pointerdown", close);
            document.removeEventListener("keydown", close);
        };
    }, [open]);

    // A box pinned to the screen would stay put while the page moves under it, so scrolling closes it
    useEffect(() => {
        if (!pinned) return;
        const close = () => setOpen(false);
        window.addEventListener("scroll", close, { passive: true });
        window.addEventListener("resize", close);
        return () => {
            window.removeEventListener("scroll", close);
            window.removeEventListener("resize", close);
        };
    }, [pinned]);

    const toggle = (button: HTMLButtonElement) => {
        if (open) {
            setOpen(false);
            return;
        }
        const onPhone = window.matchMedia("(max-width: 639px)").matches;
        setPinnedTop(onPhone ? Math.round(button.getBoundingClientRect().bottom + 8) : null);
        setOpen(true);
    };

    return (
        <div ref={rootRef} className="group/info relative inline-flex">
            <button
                type="button"
                onClick={event => toggle(event.currentTarget)}
                aria-label="Home (Primary Gallery) and sub-galleries: what's the difference?"
                aria-expanded={open}
                aria-controls={panelId}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--site-gold)]/40 text-[var(--site-gold-text)] transition-colors hover:bg-[var(--site-gold)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-gold)]/60"
            >
                <Info className="h-4 w-4" aria-hidden="true" />
            </button>
            {/* Under the button: larger screens, on hover, focus or click. Never shown on phones (it would stick out). */}
            <div
                id={pinned ? undefined : panelId}
                role="note"
                className={cn(
                    PANEL_CLASS,
                    "absolute left-0 top-full mt-2 w-[min(22rem,calc(100vw-3rem))]",
                    open && !pinned
                        ? "block"
                        : "hidden sm:group-hover/info:block sm:group-focus-within/info:block"
                )}
            >
                <PanelText />
            </div>
            {pinned && createPortal(
                <div
                    ref={pinnedRef}
                    id={panelId}
                    role="note"
                    className={cn(PANEL_CLASS, "fixed left-4 right-4 overflow-y-auto")}
                    style={{ top: pinnedTop ?? 0, maxHeight: `calc(100dvh - ${(pinnedTop ?? 0) + 16}px)` }}
                >
                    <PanelText />
                </div>,
                document.body
            )}
        </div>
    );
}
