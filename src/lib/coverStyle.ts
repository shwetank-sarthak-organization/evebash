import type React from "react";
import { coverFocus, type CoverPosition } from "../../shared/themes/coverFocus";

/** Applies the host's cover settings (focus point, zoom, fit; shared/themes/coverFocus.ts): the photo fills the frame
 *  with the focus point in view, zoomed around it. Used by the guest pages, the dashboard cards and the host page. */
export function coverImageStyle(event: CoverPosition & { coverMode?: "fit" | "fill" | null }): React.CSSProperties {
    if (event.coverMode === "fit") return { objectFit: "contain" };
    const { x, y, zoom } = coverFocus(event);
    return { objectFit: "cover", objectPosition: `${x}% ${y}%`, transform: `scale(${zoom})`, transformOrigin: `${x}% ${y}%` };
}
