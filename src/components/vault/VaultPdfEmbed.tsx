"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { PdfPreview } from "./PdfPreview";

declare global {
    interface Window {
        /** Set by the mobile app before the page loads, so the signed link never appears in a URL or server log. */
        __EVEBASH_VAULT_PDF__?: { url?: string };
        ReactNativeWebView?: { postMessage: (message: string) => void };
    }
}

/** Only signed links to Backblaze storage are rendered; anything else is ignored. */
function readTrustedUrl(): string | null {
    const raw = typeof window === "undefined" ? undefined : window.__EVEBASH_VAULT_PDF__?.url;
    if (!raw) return null;
    try {
        const url = new URL(raw);
        return url.protocol === "https:" && url.hostname.endsWith(".backblazeb2.com") ? url.toString() : null;
    } catch {
        return null;
    }
}

const subscribe = () => () => {};

export function VaultPdfEmbed() {
    const url = useSyncExternalStore(subscribe, readTrustedUrl, () => null);
    const [error, setError] = useState<string | null>(null);
    const fail = useCallback((message: string) => {
        setError(message);
        window.ReactNativeWebView?.postMessage(JSON.stringify({ type: "error", message }));
    }, []);

    if (error || !url) {
        return (
            <p className="px-6 py-24 text-center text-sm text-slate-300">
                {error ?? "This PDF couldn't be opened. You can still save or share it."}
            </p>
        );
    }
    return (
        <main className="px-3 py-3">
            <PdfPreview url={url} onError={fail} />
        </main>
    );
}
