"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Loader2, RotateCw } from "lucide-react";

type PageSize = { width: number; height: number };

// The screen sizes the guest page is drawn at before it is shrunk: a common phone and a laptop
const PHONE_PAGE: PageSize = { width: 390, height: 844 };
const COMPUTER_PAGE: PageSize = { width: 1280, height: 800 };
const PHONE_SCREEN_WIDTH = 195;

const noSubscription = () => () => {};
// The address bar shows the site the preview loads from (staging.evebash.com on staging)
const currentHost = () => window.location.host;
const defaultHost = () => "evebash.com";

interface GuestPagePreviewProps {
    eventId: string;
    /** Changes after the host saves a design change, so the page loads again with it */
    refreshKey?: number;
}

// The guest page itself (not a sketch), drawn at a phone's and a computer's size and shrunk to fit: each theme's own
// layout, fonts and photos, with the phone cover in the phone frame and the computer cover in the browser (issue #64).
// It opens with ?preview=1 (no edit mode, no "Open in app" banner) and takes no clicks, so nothing can be liked or
// uploaded from here. The iframes keep the host's sign-in (same site), so private galleries open.
// Phone visitors to the website get the "Get the EveBash app" screen instead (src/lib/appGate.ts); the frames load
// with the host's computer browser, so they show the page itself.
export function GuestPagePreview({ eventId, refreshKey = 0 }: GuestPagePreviewProps) {
    const [reloads, setReloads] = useState(0);
    const [computerWidth, setComputerWidth] = useState(0);
    const computerRef = useRef<HTMLDivElement>(null);
    const siteHost = useSyncExternalStore(noSubscription, currentHost, defaultHost);
    const frameKey = `${eventId}:${refreshKey}:${reloads}`;

    useEffect(() => {
        const element = computerRef.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => setComputerWidth(Math.floor(entry.contentRect.width)));
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    return (
        <div>
            <div className="mb-5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <h5 className="text-lg font-black text-[var(--site-text)]">Guest Home Preview</h5>
                    <p className="text-xs font-bold text-[var(--site-muted)]">Your real guest page at a phone&apos;s and a computer&apos;s size. Use Preview Guest Theme to scroll and click around.</p>
                </div>
                <button
                    type="button"
                    onClick={() => setReloads((count) => count + 1)}
                    aria-label="Reload preview"
                    title="Reload preview"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--site-border)] text-[var(--site-muted)] transition-colors hover:border-[var(--site-gold)]/50 hover:text-[var(--site-gold-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-gold)]/60"
                >
                    <RotateCw className="h-4 w-4" />
                </button>
            </div>

            <div className="grid items-start gap-6 md:grid-cols-12">
                <figure className="flex flex-col items-center gap-3 md:col-span-4">
                    <div className="shrink-0 rounded-[2.4rem] border border-white/15 bg-[#050505] p-[7px] shadow-2xl shadow-black/60">
                        <div className="overflow-hidden rounded-[2rem]">
                            <PageFrame key={frameKey} eventId={eventId} title="Guest page on a phone" page={PHONE_PAGE} width={PHONE_SCREEN_WIDTH} />
                        </div>
                    </div>
                    <figcaption className="text-[10px] font-black uppercase tracking-widest text-[var(--site-muted)]">Phone</figcaption>
                </figure>

                <figure className="flex min-w-0 flex-col items-center gap-3 md:col-span-8">
                    <div className="w-full overflow-hidden rounded-xl border border-white/10 bg-[#1c1c1f] shadow-2xl shadow-black/60">
                        <div className="flex items-center gap-3 border-b border-white/5 px-3 py-2">
                            <div className="flex shrink-0 gap-1.5">
                                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                            </div>
                            <div className="min-w-0 flex-1 truncate rounded-md bg-black/40 px-3 py-1 text-center text-[10px] font-medium text-slate-400">
                                {siteHost}/events/{eventId}
                            </div>
                            <div className="w-[42px] shrink-0" />
                        </div>
                        <div ref={computerRef}>
                            {computerWidth > 0 && (
                                <PageFrame key={frameKey} eventId={eventId} title="Guest page on a computer" page={COMPUTER_PAGE} width={computerWidth} />
                            )}
                        </div>
                    </div>
                    <figcaption className="text-[10px] font-black uppercase tracking-widest text-[var(--site-muted)]">Computer</figcaption>
                </figure>
            </div>
        </div>
    );
}

// One page in an iframe at its real size, scaled down to `width`
function PageFrame({ eventId, title, page, width }: { eventId: string; title: string; page: PageSize; width: number }) {
    const [loaded, setLoaded] = useState(false);
    const scale = width / page.width;

    return (
        <div aria-hidden="true" className="relative overflow-hidden bg-[#0b0b0c]" style={{ width, height: Math.round(page.height * scale) }}>
            <iframe
                src={`/events/${encodeURIComponent(eventId)}?preview=1`}
                title={title}
                tabIndex={-1}
                loading="lazy"
                sandbox="allow-scripts allow-same-origin"
                onLoad={() => setLoaded(true)}
                className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
                style={{ width: page.width, height: page.height, transform: `scale(${scale})` }}
            />
            {!loaded && (
                <div className="absolute inset-0 grid place-items-center">
                    <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
                </div>
            )}
        </div>
    );
}
