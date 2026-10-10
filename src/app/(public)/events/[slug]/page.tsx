"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { resolveEventCoverImage } from "@/lib/eventCovers";
import { MasonryGrid } from "@/components/ui/MasonryGrid";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import LoadingScreen from "@/components/LoadingScreen";
import { getEvent } from "@/lib/events"; // Static Data
import { getEventPhotosPaginated, getEventById, getSubEvents, Event, Photo as DatabasePhoto, getFavouritePhotosForEvents, getEventFavouritePhotos, openGallery, getPublicGalleryMedia, requestGalleryAccess, GalleryAccess, OpenedGallery } from "@/lib/database"; // Live Data
import { useAuth } from "@/context/AuthContext";
import { Loader2, Image as ImageIcon, ChevronLeft, ChevronDown, Share2, Check, Star, Layers3, Lock, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useRef } from "react";
import { getWebTemplateComponent } from "@/components/templateRegistry";
import { getWebLightboxTheme, getWebTemplateChrome } from "@/lib/webTemplateTheme";
import { supabase } from "@/lib/supabase";

const PUBLIC_PAGE_SIZE = 60;

type GateState = "login_required" | "none" | "pending" | "rejected" | "error";

const isGateAccess = (access: GalleryAccess | null): access is Exclude<GateState, "error"> =>
    access === "login_required" || access === "none" || access === "pending" || access === "rejected";

const GATE_COPY: Record<GateState, { heading: string; body: string }> = {
    login_required: { heading: "This gallery is private", body: "Log in or create an account to ask the host for access." },
    none: { heading: "This gallery is private", body: "Ask the host to let you in. You'll see the photos as soon as they approve." },
    pending: { heading: "Waiting for the host", body: "Your request has been sent. You can open the gallery once the host approves it." },
    rejected: { heading: "Access not granted", body: "The host hasn't given you access to this gallery. Contact them if you think this is a mistake." },
    error: { heading: "We couldn't open this gallery", body: "Check your connection and try again." },
};

function GalleryAccessGate({ gate, title, returnTo, requesting, onRequestAccess, onRetry }: {
    gate: GateState;
    title: string;
    returnTo: string;
    requesting: boolean;
    onRequestAccess: () => void;
    onRetry: () => void;
}) {
    const loginHref = `/login?returnTo=${encodeURIComponent(returnTo)}`;
    const Icon = gate === "pending" ? Clock : gate === "error" ? ImageIcon : Lock;
    const primaryButton = "px-8 py-3 bg-slate-900 text-white rounded-full font-bold shadow-lg hover:bg-slate-800 transition-all disabled:opacity-50";
    const secondaryButton = "px-8 py-3 bg-white border border-stone-300 text-slate-900 rounded-full font-bold hover:bg-stone-100 transition-all";

    return (
        <main className="min-h-screen flex flex-col items-center justify-center bg-stone-50 px-4 text-center">
            <div className="w-16 h-16 mb-6 rounded-full bg-stone-200/70 text-stone-700 flex items-center justify-center">
                <Icon className="w-7 h-7" aria-hidden="true" />
            </div>
            {title && gate !== "error" && (
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-stone-500">{title}</p>
            )}
            <h1 className="text-2xl font-bold mb-3 text-slate-900">{GATE_COPY[gate].heading}</h1>
            <p className="text-stone-700 mb-8 max-w-md">{GATE_COPY[gate].body}</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
                {gate === "login_required" && (
                    <>
                        <Link href={loginHref} className={primaryButton}>Log in</Link>
                        <Link href={`${loginHref}&mode=signup`} className={secondaryButton}>Create account</Link>
                    </>
                )}
                {gate === "none" && (
                    <button type="button" onClick={onRequestAccess} disabled={requesting} className={primaryButton}>
                        {requesting ? "Sending request..." : "Request access"}
                    </button>
                )}
                {(gate === "pending" || gate === "error") && (
                    <button type="button" onClick={onRetry} className={primaryButton}>
                        {gate === "pending" ? "Check again" : "Try again"}
                    </button>
                )}
                {gate === "rejected" && (
                    <Link href="/dashboard" className={secondaryButton}>Back to your galleries</Link>
                )}
            </div>
        </main>
    );
}

function EventPageContent() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const slug = params.slug as string;
    const isShared = searchParams.get("shared") === "true";
    const { user, loading: authLoading } = useAuth();

    const [event, setEvent] = useState<Event | any | null>(null);
    const [subEvents, setSubEvents] = useState<Event[]>([]);
    const [photos, setPhotos] = useState<any[]>([]);
    const [mediaTotals, setMediaTotals] = useState({ photos: 0, videos: 0 });
    const [activeGallery, setActiveGallery] = useState<Event | null>(null);
    const [galleryMediaTab, setGalleryMediaTab] = useState<"photos" | "videos">("photos");
    const [showOnlyFavourites, setShowOnlyFavourites] = useState(false);
    const [favouriteMediaIds, setFavouriteMediaIds] = useState<Set<string>>(new Set());
    const [sourceGalleryFilter, setSourceGalleryFilter] = useState("all");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Pagination State
    const [photoPage, setPhotoPage] = useState(0);
    const [hasMorePhotos, setHasMorePhotos] = useState(false);
    const [loadingMorePhotos, setLoadingMorePhotos] = useState(false);

    // What this viewer may do with the link (open_gallery)
    const [access, setAccess] = useState<GalleryAccess | null>(null);
    const [gateTitle, setGateTitle] = useState("");
    const [requestingAccess, setRequestingAccess] = useState(false);
    const isPublicView = access === "public_view";
    const canUseRealtime = access === "manage" || access === "member";


    // Parallax logic
    const containerRef = useRef(null);

    useEffect(() => {
        if (!authLoading && slug) {
            loadEventData();
        }
    }, [authLoading, slug]);

    // Real-time photo grid updates (syncing uploads and background resizing updates)
    useEffect(() => {
        if (!event?.id || !canUseRealtime) return;

        const eventIds = Array.from(new Set([event.id, ...subEvents.map(s => s.id)].filter(Boolean)));
        const subscriptionSeed = Date.now();
        const channels = eventIds.map((id, index) => {
            return supabase
                .channel(`rt-photos-event-${id}-${subscriptionSeed}-${index}`)
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'photos', filter: `event_id=eq.${id}` },
                    (payload) => {
                        console.log(`[Realtime] Received DB change on photos table for event ${id}:`, payload);
                        
                        if (payload.eventType === 'INSERT') {
                            loadGalleryPhotos(activeGallery || event, 0, false);
                        } else if (payload.eventType === 'UPDATE') {
                            setPhotos(prev => prev.map(p => {
                                if (p.id === payload.new.id) {
                                    return {
                                        ...p,
                                        thumbnailUrl: payload.new.thumbnail_url,
                                        width: payload.new.width || p.width,
                                        height: payload.new.height || p.height,
                                        src: payload.new.url || p.src,
                                    };
                                }
                                return p;
                            }));
                        } else if (payload.eventType === 'DELETE') {
                            setPhotos(prev => prev.filter(p => p.id !== payload.old.id));
                        }
                    }
                )
                .subscribe();
        });

        return () => {
            channels.forEach(ch => supabase.removeChannel(ch));
        };
    }, [event?.id, subEvents, activeGallery, canUseRealtime]);

    useEffect(() => {
        const ownerEventId = event?.parentId || event?.id;
        if (!ownerEventId || !canUseRealtime) return;
        const channel = supabase.channel(`event-visibility-${ownerEventId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${ownerEventId}` }, payload => {
                const isPublic = payload.new.is_public === true;
                setEvent((previous: Event | null) => previous ? { ...previous, isPublic } : previous);
            }).subscribe();
        return () => { void supabase.removeChannel(channel); };
    }, [event?.id, event?.parentId, canUseRealtime]);

    const transformPhotos = (databasePhotos: DatabasePhoto[]) => databasePhotos.map(p => ({
        id: p.id,
        eventId: p.eventId,
        src: p.url || "",
        storageKey: p.storageKey || "",
        width: p.width || 800,
        height: p.height || 600,
        filename: p.storageKey ? p.storageKey.split('/').pop() : 'photo',
        thumbnailUrl: p.thumbnailUrl || p.url || "",
        mediaType: p.mediaType,
        resourceType: p.resourceType
    }));

    const loadGalleryPhotos = async (gallery: Event, page = 0, append = false, overrideSubEvents?: Event[]) => {
        if (!append) {
            const favouriteRows = await getEventFavouritePhotos(gallery.id);
            setFavouriteMediaIds(new Set(favouriteRows.map(row => row.photoId)));
        }
        const currentMainEvent = gallery.type === 'main' ? gallery : event;
        const subEventList = overrideSubEvents || subEvents;

        if (!gallery.parentId && (currentMainEvent || gallery.type === 'main')) {
            const rootId = gallery.type === 'main' ? gallery.id : currentMainEvent?.id;
            const eventIds = Array.from(new Set([
                rootId,
                gallery.legacyId,
                currentMainEvent?.legacyId,
                ...subEventList.flatMap(s => [s.id, s.legacyId]),
            ].filter(Boolean) as string[]));
            if (eventIds.length > 0) {
                const favPhotos = await getFavouritePhotosForEvents(eventIds);
                if (favPhotos.length > 0) {
                    const transformedFavs = transformPhotos(favPhotos as DatabasePhoto[]);
                    setFavouriteMediaIds(new Set(transformedFavs.map(photo => photo.id).filter(Boolean)));
                    setPhotos(prev => append ? [...prev, ...transformedFavs] : transformedFavs);
                    const photoCount = transformedFavs.filter(p => p.mediaType !== "video" && p.resourceType !== "video").length;
                    const videoCount = transformedFavs.filter(p => p.mediaType === "video" || p.resourceType === "video").length;
                    setMediaTotals({ photos: photoCount, videos: videoCount });
                    setHasMorePhotos(false);
                    return;
                }
            }
        }

        const { photos: databasePhotos, hasMore, totalPhotos, totalVideos } = await getEventPhotosPaginated(gallery.id, gallery.legacyId, page, 20);
        const transformedPhotos = transformPhotos(databasePhotos as DatabasePhoto[]);

        setPhotos(prev => append ? [...prev, ...transformedPhotos] : transformedPhotos);
        setMediaTotals({ photos: totalPhotos, videos: totalVideos });
        setPhotoPage(page);
        setHasMorePhotos(hasMore);
    };

    // Logged out, public gallery: previews and video streams only, never originals
    const loadPublicPhotos = async (gallery: Event, page = 0, append = false) => {
        const media = await getPublicGalleryMedia(gallery.id, PUBLIC_PAGE_SIZE, page * PUBLIC_PAGE_SIZE);
        const transformedPhotos = transformPhotos(media);

        setPhotos(prev => append ? [...prev, ...transformedPhotos] : transformedPhotos);
        // Totals aren't known up front, so the counts follow what has loaded
        setMediaTotals({ photos: 0, videos: 0 });
        setPhotoPage(page);
        setHasMorePhotos(media.length === PUBLIC_PAGE_SIZE);
    };

    const showPublicGallery = async (opened: OpenedGallery) => {
        const eventData = { ...opened.event!, coverImage: resolveEventCoverImage(opened.event!.coverImage, 'preview') };
        setEvent(eventData);
        setSubEvents(opened.subEvents.map(sub => ({
            ...sub,
            coverImage: resolveEventCoverImage(sub.coverImage, 'thumbnail')
        })));
        setActiveGallery(eventData.parentId ? eventData : null);
        setGalleryMediaTab("photos");
        setFavouriteMediaIds(new Set());
        await loadPublicPhotos(eventData, 0, false);
    };

    const loadEventData = async () => {
        setLoading(true);
        setError(null);
        console.log(`[EventPage] Loading event for slug: ${slug}`);
        let redirecting = false;

        try {
            // 0. What this viewer may do with the link. Logged-in viewers of a public gallery join it here.
            let opened: OpenedGallery;
            try {
                opened = await openGallery(slug);
            } catch (e) {
                console.error("[EventPage] Could not open gallery link:", e);
                setAccess(null);
                setEvent(null);
                setError("open_failed");
                return;
            }

            // Join codes and legacy ids continue on the gallery's own URL, which the rest of the page relies on
            if (opened.eventId && opened.eventId !== decodeURIComponent(slug)) {
                redirecting = true;
                const query = searchParams.toString();
                router.replace(`/events/${encodeURIComponent(opened.eventId)}${query ? `?${query}` : ""}`);
                return;
            }

            setAccess(opened.access);
            setGateTitle(opened.title || "");

            if (opened.access === "public_view" && opened.event) {
                await showPublicGallery(opened);
                return;
            }

            // Private gallery the viewer can't see yet: nothing of it is loaded, the gate screen explains why
            if (opened.access !== "manage" && opened.access !== "member" && opened.access !== "not_found") {
                setEvent(null);
                return;
            }

            // 1. Get Event Details (members and managers; unknown links can only be the built-in demo galleries)
            let eventData: Event | null = null;
            if (opened.access !== "not_found") {
                try {
                    eventData = await getEventById(slug, true);
                } catch (e: any) {
                    console.error("[EventPage] Error fetching from Supabase database:", e);
                    if (e.message?.includes("permissions")) {
                        setError("permissions");
                    }
                }
            }

            // Fallback to Static Data
            if (!eventData && !error) {
                console.log("[EventPage] Event not found in Supabase database, checking static data...");
                eventData = getEvent(slug);
            }

            if (!eventData) {
                setEvent(null);
                setLoading(false);
                return;
            }

            // Sub-gallery links inherit the parent event's current visibility.
            if (eventData.parentId) {
                const parentEvent = await getEventById(eventData.parentId, true);
                eventData.isPublic = !!parentEvent?.isPublic;
            }

            // Resolve event cover image to preview format
            eventData.coverImage = resolveEventCoverImage(eventData.coverImage, 'preview');

            setEvent(eventData);

            // 2. Branch logic based on Event Type
            if (eventData.type === 'main') {
                // Fetch Home gallery media and sub-galleries so web follows the same structure as mobile.
                console.log(`[EventPage] Main event detected. Fetching home gallery and sub-events for: ${eventData.id}`);
                const data = await getSubEvents(eventData.id, eventData.legacyId);
                const resolvedSubEvents = data.map(sub => ({
                    ...sub,
                    coverImage: resolveEventCoverImage(sub.coverImage, 'thumbnail')
                }));
                setSubEvents(resolvedSubEvents);
                setActiveGallery(null);
                setGalleryMediaTab("photos");
                await loadGalleryPhotos(eventData, 0, false, resolvedSubEvents);
            } else {
                // Fetch Photos (Sub-event or single gallery)
                console.log(`[EventPage] Sub-view detected. Fetching photos for: ${eventData.id}`);

                // NEW: Fetch Parent & Siblings for Navbar
                if (eventData.parentId) {
                    try {
                        const pEvent = await getEventById(eventData.parentId);
                        if (pEvent) {
                            pEvent.coverImage = resolveEventCoverImage(pEvent.coverImage, 'preview');
                            const siblings = await getSubEvents(pEvent.id, pEvent.legacyId);
                            const resolvedSiblings = siblings.map(sub => ({
                                ...sub,
                                coverImage: resolveEventCoverImage(sub.coverImage, 'thumbnail')
                            }));
                            setSubEvents(resolvedSiblings);
                        }
                    } catch (err) {
                        console.error("Error fetching parent event context:", err);
                    }
                }

                setActiveGallery(eventData);
                setGalleryMediaTab("photos");
                await loadGalleryPhotos(eventData, 0, false);
            }
        } catch (err: any) {
            console.error("[EventPage] Critical error:", err);
            setError(err.message || "An unexpected error occurred");
        } finally {
            if (!redirecting) setLoading(false);
        }
    };

    const handleRequestAccess = async () => {
        if (requestingAccess) return;
        setRequestingAccess(true);
        try {
            const status = await requestGalleryAccess(slug);
            if (status === "pending") {
                setAccess("pending");
            } else {
                await loadEventData();
            }
        } catch (err) {
            console.error("[EventPage] Access request failed:", err);
            window.alert("We couldn't send your request. Please try again.");
        } finally {
            setRequestingAccess(false);
        }
    };

    const loadMorePhotos = async () => {
        const currentGallery = activeGallery || event;
        if (!currentGallery || loadingMorePhotos || !hasMorePhotos) return;

        setLoadingMorePhotos(true);
        try {
            const nextPage = photoPage + 1;
            if (isPublicView) {
                await loadPublicPhotos(currentGallery, nextPage, true);
            } else {
                await loadGalleryPhotos(currentGallery, nextPage, true);
            }
        } catch (error) {
            console.error("Error loading more photos:", error);
        } finally {
            setLoadingMorePhotos(false);
        }
    };

    const handleShare = () => {
        const shareUrl = `${window.location.origin}/events/${slug}?shared=true`;
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (authLoading || loading) {
        return <LoadingScreen message="Loading your gallery" />;
    }

    const gate: GateState | null = error === "open_failed" ? "error" : isGateAccess(access) ? access : null;
    if (gate) {
        return (
            <GalleryAccessGate
                gate={gate}
                title={gateTitle}
                returnTo={`/events/${slug}`}
                requesting={requestingAccess}
                onRequestAccess={handleRequestAccess}
                onRetry={loadEventData}
            />
        );
    }

    if (!event) {
        return (
            <main className="relative" ref={containerRef}>
                {notFound()}
            </main>
        );
    }

    const photoItems = photos.filter(photo => photo.mediaType !== "video" && photo.resourceType !== "video" && !!(photo.thumbnailUrl || photo.src));
    const videoItems = photos.filter(photo => photo.mediaType === "video" || photo.resourceType === "video");
    const selectedMediaItems = galleryMediaTab === "videos" ? videoItems : photoItems;
    const isPrimaryGalleryView = !activeGallery;
    const sourceGalleryOptions = [event, ...subEvents]
        .filter((gallery): gallery is Event => !!gallery)
        .map(gallery => ({
            id: gallery.id,
            label: gallery.id === event.id ? "Main event" : gallery.title,
            legacyId: gallery.legacyId,
            count: selectedMediaItems.filter(photo => photo.eventId === gallery.id || (!!gallery.legacyId && photo.eventId === gallery.legacyId)).length,
        }))
        .filter(option => option.count > 0);
    const effectiveSourceGalleryFilter = sourceGalleryOptions.some(option => option.id === sourceGalleryFilter)
        ? sourceGalleryFilter
        : "all";
    const isFavouriteFilterActive = !isPrimaryGalleryView && !isPublicView && showOnlyFavourites;
    const sourceFilteredMediaItems = isPrimaryGalleryView && effectiveSourceGalleryFilter !== "all"
        ? selectedMediaItems.filter(photo => {
            const source = sourceGalleryOptions.find(option => option.id === effectiveSourceGalleryFilter);
            return photo.eventId === source?.id || (!!source?.legacyId && photo.eventId === source.legacyId);
        })
        : selectedMediaItems;
    const activeGalleryItems = isFavouriteFilterActive
        ? sourceFilteredMediaItems.filter(photo => favouriteMediaIds.has(photo.id))
        : sourceFilteredMediaItems;
    const activeFavouriteCount = selectedMediaItems.filter(photo => favouriteMediaIds.has(photo.id)).length;
    // Public view pages through media without totals, so show "60+" while more can load
    const countSuffix = isPublicView && hasMorePhotos ? "+" : "";
    const displayedPhotoCount = `${mediaTotals.photos || photoItems.length}${countSuffix}`;
    const displayedVideoCount = `${mediaTotals.videos || videoItems.length}${countSuffix}`;
    const activeGalleryTitle = activeGallery?.title || event.title || "Home";
    const displayEvent = activeGallery
        ? {
            ...event,
            title: activeGallery.title || event.title,
            date: activeGallery.date || event.date,
            description: activeGallery.description || "",
            coverImage: activeGallery.coverImage || event.coverImage,
            templateId: activeGallery.templateId || event.templateId,
        }
        : event;
    const activeGalleryMessage = activeGallery ? activeGallery.description : event.description;

    const renderContent = () => (
        <div className={cn("contents themed-gallery-content", displayEvent.templateId === "royal" && "royal-gallery-content")}>
            <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                    onClick={() => {
                        router.push(event?.parentId ? `/events/${event.parentId}${isShared ? "?shared=true" : ""}` : "/dashboard");
                    }}
                    className="text-stone-700 hover:text-stone-900 transition-colors text-sm font-bold tracking-widest uppercase flex items-center group"
                >
                    <ChevronLeft className="w-5 h-5 mr-1 group-hover:-translate-x-1 transition-transform" />
                    {event?.parentId ? "Back to Event" : "Back to Gallery"}
                </button>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={handleShare}
                        data-royal-control="share"
                        className="flex items-center space-x-2 px-6 py-3 bg-white border border-stone-200 text-stone-600 rounded-full text-sm font-bold hover:bg-stone-50 transition-all shadow-sm hover:shadow-md group active:scale-95"
                    >
                        <AnimatePresence mode="wait">
                            {copied ? (
                                <motion.div
                                    key="check"
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.5 }}
                                    className="flex items-center space-x-2 text-green-600"
                                >
                                    <Check className="w-4 h-4" />
                                    <span>Link Copied!</span>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="share"
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.5 }}
                                    className="flex items-center space-x-2 group-hover:text-stone-900"
                                >
                                    <Share2 className="w-4 h-4" />
                                    <span>Share Event</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </button>
                </div>
            </div>

            <div className="mt-12">
                <SectionHeader
                    title={activeGallery ? activeGalleryTitle : "Home Gallery"}
                    subtitle={`${displayedPhotoCount} Photos · ${displayedVideoCount} Videos`}
                />

                {activeGalleryMessage && (
                    <p className="mx-auto mt-5 max-w-3xl text-center font-sans text-sm font-semibold leading-7 text-stone-600 md:text-base">
                        {activeGalleryMessage}
                    </p>
                )}

                <div data-royal-control="segments" className="mt-10 inline-flex rounded-2xl border border-stone-200 bg-white p-1 shadow-sm">
                    {([
                        { id: "photos", label: `Photos (${displayedPhotoCount})` },
                        { id: "videos", label: `Videos (${displayedVideoCount})` },
                    ] as const).map((item) => (
                        <button
                            key={item.id}
                            aria-pressed={galleryMediaTab === item.id}
                            type="button"
                            onClick={() => setGalleryMediaTab(item.id)}
                            className={cn(
                                "rounded-xl px-5 py-3 text-xs font-black uppercase tracking-widest transition-all",
                                galleryMediaTab === item.id
                                    ? "bg-slate-900 text-white shadow-sm"
                                    : "text-stone-500 hover:text-stone-900"
                            )}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
                <div className="mt-4">
                    {isPrimaryGalleryView ? (
                    <label data-royal-control="source" className="flex w-full max-w-md items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-left shadow-sm">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-stone-100 text-stone-700">
                            <Layers3 className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold text-stone-800">Source gallery</span>
                            <span className="mt-0.5 block text-xs text-stone-500">Show media selected from</span>
                        </span>
                        <select
                            value={effectiveSourceGalleryFilter}
                            onChange={(event) => setSourceGalleryFilter(event.target.value)}
                            className="max-w-[13rem] rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-800 outline-none focus:border-slate-700"
                            aria-label="Filter by source gallery"
                        >
                            <option value="all">All galleries ({selectedMediaItems.length})</option>
                            {sourceGalleryOptions.map(option => (
                                <option key={option.id} value={option.id}>{option.label} ({option.count})</option>
                            ))}
                        </select>
                    </label>
                    ) : isPublicView ? null : (
                    <button
                        type="button"
                        role="switch"
                        aria-checked={showOnlyFavourites}
                        onClick={() => setShowOnlyFavourites(current => !current)}
                        className={cn(
                            "flex w-full max-w-md items-center gap-3 rounded-xl border px-4 py-3 text-left shadow-sm transition-colors",
                            showOnlyFavourites
                                ? "border-slate-900 bg-slate-900"
                                : "border-stone-200 bg-white hover:border-stone-400"
                        )}
                    >
                        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", showOnlyFavourites ? "bg-white text-slate-900" : "bg-stone-100 text-stone-600")}>
                            <Star className={cn("h-4 w-4", showOnlyFavourites && "fill-current")} />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className={cn("block text-sm font-bold", showOnlyFavourites ? "text-white" : "text-stone-800")}>Favourites only</span>
                            <span className={cn("mt-0.5 block text-xs", showOnlyFavourites ? "text-slate-300" : "text-stone-500")}>{activeFavouriteCount} in {galleryMediaTab === "videos" ? "Videos" : "Photos"}</span>
                        </span>
                        <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", showOnlyFavourites ? "bg-white/35" : "bg-stone-200")}>
                            <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform", showOnlyFavourites ? "translate-x-5" : "translate-x-0.5")} />
                        </span>
                    </button>
                    )}
                </div>

                {activeGalleryItems.length > 0 ? (
                    <div className="mt-8">
                        <MasonryGrid
                            photos={activeGalleryItems}
                            eventSlug={slug}
                            disableDownload={isPublicView || (isShared && !user)}
                            readOnly={isPublicView}
                            lightboxTheme={getWebLightboxTheme((activeGallery || event).templateId || event.templateId)}
                            templateId={(activeGallery || event).templateId || event.templateId}
                        />
                    </div>
                ) : (
                    <div className="text-center py-32 opacity-50">
                        <ImageIcon className="w-16 h-16 mx-auto mb-6 text-stone-600" />
                        {error === "permissions" ? (
                            <>
                                <h2 className="text-2xl font-serif italic text-stone-600 mb-2">Moments restricted...</h2>
                                <p className="font-sans text-stone-600 text-sm">Owner: Check Supabase database rules to enable shared access.</p>
                            </>
                        ) : (
                            <>
                                <h2 className="text-2xl font-serif italic text-stone-600 mb-2">
                                    {isFavouriteFilterActive
                                        ? `No favourite ${galleryMediaTab === "videos" ? "videos" : "photos"} in this gallery yet.`
                                        : galleryMediaTab === "videos" ? "No videos yet." : "No photos yet."}
                                </h2>
                                <p className="font-sans text-stone-600 text-sm">Check back soon to see the captured memories.</p>
                            </>
                        )}
                    </div>
                )}

                {/* LOAD MORE BUTTON */}
                {hasMorePhotos && photos.length > 0 && (
                    <div className="flex justify-center mt-16 mb-8 w-full">
                        <button
                            onClick={loadMorePhotos}
                            disabled={loadingMorePhotos}
                            className="px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-full font-bold shadow-xl flex items-center space-x-3 transition-all hover:scale-105 active:scale-95"
                        >
                            {loadingMorePhotos ? (
                                <Loader2 className="w-5 h-5 animate-spin text-white/70" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-white/70" />
                            )}
                            <span className="tracking-widest uppercase text-sm">
                                {loadingMorePhotos ? "Loading..." : "Load More Media"}
                            </span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    const TemplateComponent = getWebTemplateComponent(displayEvent.templateId);
    const templateChrome = getWebTemplateChrome(displayEvent.templateId);

    return (
        <main
            className="event-template-shell min-h-screen relative"
            ref={containerRef}
            style={{
                "--event-template-primary": templateChrome.background,
                "--event-template-panel": templateChrome.panel,
                "--event-template-on-accent": templateChrome.onAccent,
                "--event-template-text": templateChrome.text,
                "--event-template-muted": templateChrome.muted,
                "--event-template-accent": templateChrome.accent,
                "--event-template-border": templateChrome.border,
            } as React.CSSProperties}
        >
            <TemplateComponent
                event={displayEvent}
                subEvents={[]}
                photos={[]}
                isShared={isShared}
                user={user}
                onBack={() => {
                    router.push(event?.parentId ? `/events/${event.parentId}${isShared ? "?shared=true" : ""}` : "/dashboard");
                }}
                onShare={handleShare}
                canManage={false}
                hasParent={!!event?.parentId}
                copied={copied}
                error={error}
            >
                {renderContent()}
            </TemplateComponent>
        </main>
    );
}

export default function EventPage() {
    return (
        <Suspense fallback={<LoadingScreen message="Loading your gallery" />}>
            <EventPageContent />
        </Suspense>
    );
}
