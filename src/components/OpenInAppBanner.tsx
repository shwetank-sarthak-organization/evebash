"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { EveBashLogo } from "@/components/EveBashLogo";

// Off unless NEXT_PUBLIC_OPEN_IN_APP_BANNER=true at build time
const BANNER_ENABLED = process.env.NEXT_PUBLIC_OPEN_IN_APP_BANNER === "true";
const DISMISSED_KEY = "evebash:open-in-app-banner-dismissed";

/** evebash:// link for the event page being viewed; the app resolves the ref itself (apps/mobile/lib/deepLinks.ts). */
function appLinkForPage(pathname: string, search: string): string | null {
    const match = /^\/events\/([^/]+)(\/find-you)?/.exec(pathname);
    if (!match) return null;
    return `evebash://events/${match[1]}${match[2] ?? ""}${search ? `?${search}` : ""}`;
}

// Android phones only for now: an iPhone needs Universal Links or the Smart App Banner first (issue #67)
function isAndroidPhone(userAgent: string): boolean {
    return /Android/i.test(userAgent) && /Mobile/i.test(userAgent);
}

function wasDismissed(): boolean {
    try {
        return window.localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
        return false;
    }
}

// Read once on the client; the server render and hydration see "don't show"
const noSubscription = () => () => {};
const canShowOnThisDevice = () => isAndroidPhone(navigator.userAgent) && !wasDismissed();
const neverOnServer = () => false;

function rememberDismissed() {
    try {
        window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
        // Private mode or blocked storage: it just shows again next visit
    }
}

/** "Open in app" bar for event pages on Android phones. If the app isn't installed, tapping Open does nothing. */
export function OpenInAppBanner() {
    if (!BANNER_ENABLED) return null;
    return <OpenInAppBar />;
}

function OpenInAppBar() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const canShow = useSyncExternalStore(noSubscription, canShowOnThisDevice, neverOnServer);
    const [dismissed, setDismissed] = useState(false);
    const visible = canShow && !dismissed;
    const barRef = useRef<HTMLElement>(null);
    const appLink = appLinkForPage(pathname, searchParams.toString());

    // Room under the page so the bar never covers the footer
    useEffect(() => {
        if (!visible || !appLink || !barRef.current) return;
        const body = document.body;
        const previous = body.style.paddingBottom;
        body.style.paddingBottom = `${barRef.current.offsetHeight + 12}px`;
        return () => {
            body.style.paddingBottom = previous;
        };
    }, [visible, appLink]);

    if (!visible || !appLink) return null;

    return (
        <aside
            ref={barRef}
            aria-label="Open in the EveBash app"
            className="lightbox-hide-ui fixed inset-x-0 bottom-0 z-[39] px-3 pt-2"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
            <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] py-2.5 pl-3 pr-1.5 text-[var(--site-text)] shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--site-bg)] text-[#CA9C68]">
                    <EveBashLogo className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold leading-tight">EveBash app</span>
                    <span className="mt-0.5 block text-xs leading-snug text-[var(--site-muted)]">Continue in the app</span>
                </span>
                <a
                    href={appLink}
                    className="shrink-0 rounded-full bg-[#CA9C68] px-4 py-2 text-sm font-semibold text-[#13191F] transition-colors hover:bg-[#d8ad7c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CA9C68]"
                >
                    Open
                </a>
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
