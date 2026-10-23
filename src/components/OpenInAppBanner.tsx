"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { EveBashLogo } from "@/components/EveBashLogo";

// Off unless NEXT_PUBLIC_OPEN_IN_APP_BANNER=true at build time
const BANNER_ENABLED = process.env.NEXT_PUBLIC_OPEN_IN_APP_BANNER === "true";
// Store pages, empty until the app is published (issue #67); read at build time
const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? "";
const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL ?? "";
const DISMISSED_KEY = "evebash:open-in-app-banner-dismissed";
const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000;

type Platform = "android" | "ios";

/** evebash:// link for the event page being viewed; the app resolves the ref itself (apps/mobile/lib/deepLinks.ts). */
function appLinkForPage(pathname: string, search: string): string | null {
    const match = /^\/events\/([^/]+)(\/find-you)?/.exec(pathname);
    if (!match) return null;
    return `evebash://events/${match[1]}${match[2] ?? ""}${search ? `?${search}` : ""}`;
}

// Phones and tablets. iPadOS Safari reports itself as a Mac, so a touch screen tells them apart.
function platformOf(userAgent: string, maxTouchPoints: number): Platform | null {
    if (/Android/i.test(userAgent)) return "android";
    if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
    if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";
    return null;
}

function wasDismissed(): boolean {
    try {
        const value = window.localStorage.getItem(DISMISSED_KEY);
        if (!value) return false;
        // "1" came from the first version, which hid the bar for good
        if (value === "1") return true;
        return Date.now() - Number(value) < DISMISS_FOR_MS;
    } catch {
        return false;
    }
}

// Read once on the client; the server render and hydration see "don't show"
const noSubscription = () => () => {};
const platformToShow = () => (wasDismissed() ? null : platformOf(navigator.userAgent, navigator.maxTouchPoints));
const neverOnServer = () => null;

function rememberDismissed() {
    try {
        window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
        // Private mode or blocked storage: it just shows again next visit
    }
}

/** "Get the app" bar for phones and tablets. Hidden for a week once dismissed. */
export function OpenInAppBanner() {
    if (!BANNER_ENABLED) return null;
    return <OpenInAppBar />;
}

function OpenInAppBar() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const platform = useSyncExternalStore(noSubscription, platformToShow, neverOnServer);
    const [dismissed, setDismissed] = useState(false);
    const visible = platform !== null && !dismissed;
    const barRef = useRef<HTMLElement>(null);
    // Only Android gets Open: on iPhone, evebash:// shows an error when the app isn't installed
    const appLink = platform === "android" ? appLinkForPage(pathname, searchParams.toString()) : null;
    const storeUrl = platform === "ios" ? APP_STORE_URL : PLAY_STORE_URL;
    const storeName = platform === "ios" ? "the App Store" : "Google Play";

    // Room under the page so the bar never covers the footer
    useEffect(() => {
        if (!visible || !barRef.current) return;
        const body = document.body;
        const previous = body.style.paddingBottom;
        body.style.paddingBottom = `${barRef.current.offsetHeight + 12}px`;
        return () => {
            body.style.paddingBottom = previous;
        };
    }, [visible]);

    if (!visible) return null;

    const primaryClass =
        "shrink-0 rounded-full bg-[#CA9C68] px-4 py-2 text-sm font-semibold text-[#13191F] transition-colors hover:bg-[#d8ad7c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CA9C68]";
    const secondaryClass =
        "shrink-0 rounded-full border border-[#CA9C68]/60 px-3.5 py-2 text-sm font-semibold text-[#CA9C68] transition-colors hover:bg-[#CA9C68]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CA9C68]";

    return (
        <aside
            ref={barRef}
            aria-label="Get the EveBash app"
            className="lightbox-hide-ui fixed inset-x-0 bottom-0 z-[39] px-3 pt-2"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
            <div className="mx-auto flex max-w-md items-center gap-2.5 rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] py-2.5 pl-3 pr-1.5 text-[var(--site-text)] shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--site-bg)] text-[#CA9C68]">
                    <EveBashLogo className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold leading-tight">EveBash app</span>
                    <span className="mt-0.5 block truncate text-xs leading-snug text-[var(--site-muted)]">
                        {storeUrl ? `Get it on ${storeName}` : `Coming soon to ${storeName}`}
                    </span>
                </span>
                {appLink && (
                    <a href={appLink} className={primaryClass}>
                        Open
                    </a>
                )}
                {storeUrl && (
                    <a href={storeUrl} target="_blank" rel="noopener noreferrer" className={appLink ? secondaryClass : primaryClass}>
                        Get
                    </a>
                )}
                <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={() => {
                        rememberDismissed();
                        setDismissed(true);
                    }}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--site-muted)] transition-colors hover:text-[var(--site-text)] focus-visible:outline-2 focus-visible:outline-[#CA9C68]"
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </button>
            </div>
        </aside>
    );
}
