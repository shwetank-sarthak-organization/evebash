"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Loader2, RotateCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isGuestPreviewPictureOutOfDate, readGuestPreviewPicture, type GuestPreviewPicture } from "../../shared/themes/guestPreviewPicture";

type PageSize = { width: number; height: number };
/** The app's picture and the event's template now (null: none yet, undefined: still loading) */
type AppPicture = { picture: GuestPreviewPicture | null; templateId: string | null } | undefined;

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

// What guests see, small. The app: a picture of its guest home, taken when a host last had it open with Preview Guest
// Theme in the app (todo #31; the app's guest view can't be drawn in a browser). The website: the guest page itself
// (not a sketch), drawn at a phone's and a computer's size and shrunk to fit, with each theme's own layout, fonts and
// photos, the phone cover in the phone frame and the computer cover in the browser (issue #64).
// The pages open with ?preview=1 (no edit mode, no "Open in app" banner) and take no clicks, so nothing can be liked
// or uploaded from here. The iframes keep the host's sign-in (same site), so private galleries open.
// When the website's phone app screen is switched on (NEXT_PUBLIC_MOBILE_APP_GATE, src/lib/appGate.ts), phone
// visitors get "Get the EveBash app" instead of the page; while it is off they see the page as in the phone frame.
// The frames load with the host's computer browser, so they always show the page itself.
export function GuestPagePreview({ eventId, refreshKey = 0 }: GuestPagePreviewProps) {
    const [reloads, setReloads] = useState(0);
    const [computerWidth, setComputerWidth] = useState(0);
    const [appPicture, setAppPicture] = useState<AppPicture>(undefined);
    const computerRef = useRef<HTMLDivElement>(null);
    const siteHost = useSyncExternalStore(noSubscription, currentHost, defaultHost);
    const frameKey = `${eventId}:${refreshKey}:${reloads}`;

    // The template is read with the picture, so "out of date" compares two saved values
    useEffect(() => {
        let active = true;
        const settle = (value: AppPicture) => { if (active) setAppPicture(value); };
        supabase.from("events").select("guest_preview_picture, template_id").eq("id", eventId).maybeSingle()
            .then(({ data, error }) => {
                const row = error ? null : data as { guest_preview_picture?: unknown; template_id?: string | null } | null;
                settle({ picture: readGuestPreviewPicture(row?.guest_preview_picture), templateId: row?.template_id ?? null });
            }, () => settle({ picture: null, templateId: null }));
        return () => { active = false; };
    }, [eventId, refreshKey, reloads]);

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
                    <p className="text-xs font-bold text-[var(--site-muted)]">What guests see in the EveBash app, and on the website on a phone and a computer. Use Preview Guest Theme to scroll and click around.</p>
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

            <div className="flex flex-wrap items-start justify-center gap-x-6 gap-y-8">
                <figure className="flex w-[211px] shrink-0 flex-col items-center gap-3">
                    <PhoneBezel>
                        <AppScreen appPicture={appPicture} />
                    </PhoneBezel>
                    <figcaption className="text-[10px] font-black uppercase tracking-widest text-[var(--site-muted)]">App</figcaption>
                    <AppPictureNote appPicture={appPicture} />
                </figure>

                <figure className="flex w-[211px] shrink-0 flex-col items-center gap-3">
                    <PhoneBezel>
                        <PageFrame key={frameKey} eventId={eventId} title="Guest page on a phone" page={PHONE_PAGE} width={PHONE_SCREEN_WIDTH} />
                    </PhoneBezel>
                    <figcaption className="text-[10px] font-black uppercase tracking-widest text-[var(--site-muted)]">Website on a phone</figcaption>
                </figure>

                <figure className="flex min-w-[min(100%,26rem)] flex-1 basis-[26rem] flex-col items-center gap-3">
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
                    <figcaption className="text-[10px] font-black uppercase tracking-widest text-[var(--site-muted)]">Website on a computer</figcaption>
                </figure>
            </div>
        </div>
    );
}

function PhoneBezel({ children }: { children: ReactNode }) {
    return (
        <div className="shrink-0 rounded-[2.4rem] border border-white/15 bg-[#050505] p-[7px] shadow-2xl shadow-black/60">
            <div className="overflow-hidden rounded-[2rem]">{children}</div>
        </div>
    );
}

// The app's picture at the phone frame's size; it is taken at the phone's own shape, so it is cropped from the top
function AppScreen({ appPicture }: { appPicture: AppPicture }) {
    const outOfDate = !!appPicture?.picture && isGuestPreviewPictureOutOfDate(appPicture.picture, appPicture.templateId);
    const height = Math.round(PHONE_PAGE.height * (PHONE_SCREEN_WIDTH / PHONE_PAGE.width));

    return (
        <div className="relative grid place-items-center overflow-hidden bg-[#0b0b0c]" style={{ width: PHONE_SCREEN_WIDTH, height }}>
            {appPicture === undefined ? (
                <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
            ) : appPicture.picture ? (
                // A picture from the media domain at a fixed small size; next/image would need the domain configured
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={appPicture.picture.url}
                    alt="The app's guest home"
                    className={`absolute inset-0 h-full w-full object-cover object-top ${outOfDate ? "opacity-[0.45]" : ""}`}
                />
            ) : (
                <p className="px-5 text-center text-[11px] font-semibold leading-relaxed text-slate-400">
                    Open Preview Guest Theme in the EveBash app once to see the app here.
                </p>
            )}
        </div>
    );
}

function AppPictureNote({ appPicture }: { appPicture: AppPicture }) {
    const picture = appPicture?.picture;
    if (!picture) return null;
    const outOfDate = isGuestPreviewPictureOutOfDate(picture, appPicture.templateId);
    const takenAt = new Date(picture.takenAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

    return (
        <p className={`text-center text-[11px] font-semibold leading-relaxed ${outOfDate ? "text-[var(--site-gold-text)]" : "text-[var(--site-muted)]"}`}>
            {outOfDate
                ? "The theme changed since this picture. Open Preview Guest Theme in the app to update it."
                : `Picture from ${takenAt}. Preview Guest Theme in the app updates it.`}
        </p>
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
