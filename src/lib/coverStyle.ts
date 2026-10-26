import type React from "react";
import type { Event } from "@/lib/database";

/** Applies the host's cover settings (focus point, zoom, fit), as the dashboard cards do.
 *  Used by the Midnight Hero, Royal Emerald and Classic White guest pages. */
export function coverImageStyle(event: Event): React.CSSProperties {
    if (event.coverMode === "fit") return { objectFit: "contain" };
    const x = Math.max(0, Math.min(100, 50 + (event.coverOffsetX || 0)));
    const y = Math.max(0, Math.min(100, 50 + (event.coverOffset || 0)));
    return { objectFit: "cover", objectPosition: `${x}% ${y}%`, transform: `scale(${event.coverScale || 1})` };
}
