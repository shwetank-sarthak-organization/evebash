import type React from "react";

export function navigateWithModifierClick(
    event: React.MouseEvent,
    href: string,
    navigate: (href: string) => void
) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
        window.open(href, "_blank", "noopener,noreferrer");
        return;
    }

    navigate(href);
}
