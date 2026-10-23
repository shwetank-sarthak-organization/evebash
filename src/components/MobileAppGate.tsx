"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { EveBashLogo } from "@/components/EveBashLogo";
import {
    APP_GATE_ATTRIBUTE,
    APP_GATE_OPEN_PATHS,
    APP_STORE_URL,
    PLAY_STORE_URL,
    shouldShowAppGate,
} from "@/lib/appGate";

function StoreButton({ url, store, cta }: { url: string; store: string; cta: string }) {
    if (!url) {
        return (
            <span className="block w-full rounded-full border border-[var(--site-border)] px-5 py-3 text-center text-sm font-semibold text-[var(--site-muted)]">
                {store}: coming soon
            </span>
        );
    }
    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-full bg-[#CA9C68] px-5 py-3 text-center text-sm font-semibold text-[#13191F] transition-colors hover:bg-[#d8ad7c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CA9C68]"
        >
            {cta}
        </a>
    );
}

/**
 * Full-screen "download the app" screen for phones and tablets (src/lib/appGate.ts).
 * Always in the HTML but hidden; the <head> script and this component turn it on with the
 * data-app-gate attribute, and globals.css then hides the rest of the page.
 * Must be a direct child of <body>.
 */
export function MobileAppGate() {
    const pathname = usePathname();

    // Client-side navigation doesn't rerun the <head> script
    useEffect(() => {
        const root = document.documentElement;
        if (shouldShowAppGate(navigator.userAgent, navigator.maxTouchPoints || 0, pathname, APP_GATE_OPEN_PATHS)) {
            root.setAttribute(APP_GATE_ATTRIBUTE, "");
        } else {
            root.removeAttribute(APP_GATE_ATTRIBUTE);
        }
    }, [pathname]);

    return (
        <div
            className="app-gate fixed inset-0 z-[1000] flex-col items-center justify-center overflow-y-auto bg-[#13191F] px-6 text-[var(--site-text)]"
            style={{ paddingTop: "max(2rem, env(safe-area-inset-top))", paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
        >
            <div className="flex w-full max-w-sm flex-col items-center text-center">
                <span className="flex h-20 w-20 items-center justify-center rounded-3xl border border-[var(--site-border)] bg-[var(--site-surface)] text-[#CA9C68]">
                    <EveBashLogo className="h-11 w-11" aria-hidden="true" />
                </span>
                <h1 className="mt-6 font-serif text-3xl font-semibold leading-tight">Get the EveBash app</h1>
                <p className="mt-3 text-sm leading-relaxed text-[var(--site-muted)]">
                    On phones and tablets, EveBash works in our app. Your events, galleries and photos are all there.
                </p>
                <div className="mt-8 flex w-full flex-col gap-3">
                    <StoreButton url={PLAY_STORE_URL} store="Google Play" cta="Get it on Google Play" />
                    <StoreButton url={APP_STORE_URL} store="App Store" cta="Download on the App Store" />
                </div>
                <div className="mt-10 w-full border-t border-[var(--site-border)] pt-6">
                    <p className="text-xs uppercase tracking-widest text-[var(--site-muted)]">Your account</p>
                    <div className="mt-4 flex justify-center gap-6 text-sm font-semibold">
                        <a href="/login" className="text-[#CA9C68] hover:text-[#d8ad7c]">
                            Log in
                        </a>
                        <a href="/profile?tab=plan" className="text-[#CA9C68] hover:text-[#d8ad7c]">
                            Activate a plan
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
