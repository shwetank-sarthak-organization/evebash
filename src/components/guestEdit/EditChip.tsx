"use client";

import React, { createContext, useContext } from "react";
import { Pencil, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { openGuestEditPanel, useGuestEditState } from "./guestEditStore";

// The pencils a theme puts on its own content in Preview Guest Theme's edit mode (todo #11): on the cover, the
// title, the message... Each opens that field's panel in the edit bar. A theme places them inside its own elements;
// for guests (and while the host views the page as a guest) they render nothing.

/** Given by the guest page only while the event's manager edits it: the gallery on screen */
export const GuestEditSpots = createContext<{ galleryId: string } | null>(null);

/** True while the page is being edited with the bar showing: a theme can then show places to add missing content */
export function useGuestEditSpots(): boolean {
    const spots = useContext(GuestEditSpots);
    const editState = useGuestEditState();
    return !!spots && !editState.viewingAsGuest;
}

export function EditChip({ field, part, label, galleryId, adding = false, style, className }: {
    /** The field's key in the theme's edit list (shared/themes/editableFields.ts) */
    field: string;
    /** The part of the field's panel to show first (the couple's "left" or "right" side) */
    part?: string;
    label: string;
    /** Leave out for the gallery on screen */
    galleryId?: string;
    /** Nothing there yet: the chip invites to add it ("Add message") */
    adding?: boolean;
    /** Where it sits inside the theme's element (absolute); leave out to place it in the flow */
    style?: React.CSSProperties;
    className?: string;
}) {
    const spots = useContext(GuestEditSpots);
    const editState = useGuestEditState();
    if (!spots || editState.viewingAsGuest) return null;
    const target = galleryId || spots.galleryId;
    const Icon = adding ? Plus : Pencil;

    return (
        <button
            type="button"
            onClick={(event) => {
                event.stopPropagation();
                openGuestEditPanel({ galleryId: target, key: field, part });
            }}
            aria-label={adding ? label : `Edit ${label.toLowerCase()}`}
            style={style ? { position: "absolute", zIndex: 30, ...style } : undefined}
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-sans text-xs font-bold normal-case tracking-normal shadow-lg shadow-black/30 transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CA9C68]",
                adding
                    ? "border-2 border-dashed border-[#CA9C68] bg-[#13191F]/80 text-[#F5E7D4]"
                    : "bg-[#CA9C68] text-[#13191F]",
                className,
            )}
        >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {label}
        </button>
    );
}
