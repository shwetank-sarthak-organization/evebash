"use client";

import { useLayoutEffect, type RefObject } from "react";

/**
 * Keeps a title on one line (Sunlit Portrait cover names and gallery names): starts from the size its CSS gives it and,
 * when the text is wider than its box, shrinks it just enough to fit. Runs again when the box is resized and once the
 * web font has loaded. The element needs `white-space: nowrap` and a width of its own (not shrink-to-fit).
 */
export function useFitOneLine(ref: RefObject<HTMLElement | null>, text: string) {
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;

        let frame = 0;
        const fit = () => {
            el.style.fontSize = "";
            const available = el.clientWidth;
            const needed = el.scrollWidth;
            if (!available || needed <= available) return;
            const size = parseFloat(getComputedStyle(el).fontSize);
            // A little under the exact ratio so rounding never leaves the last letter clipped
            el.style.fontSize = `${Math.floor(size * (available / needed) * 0.98)}px`;
        };
        const schedule = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(fit);
        };

        fit();
        const observer = new ResizeObserver(schedule);
        observer.observe(el);
        void document.fonts?.ready.then(schedule);
        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
        };
    }, [ref, text]);
}
