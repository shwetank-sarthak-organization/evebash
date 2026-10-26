"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { resolveEventCoverImage } from "@/lib/eventCovers";
import { MasonryGrid } from "@/components/ui/MasonryGrid";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import LoadingScreen from "@/components/LoadingScreen";
import { getEvent } from "@/lib/events"; // Static Data
import { getEventPhotosPaginated, getEventById, getSubEvents, visibleGalleries, mergeHomeMedia, Event, Photo as DatabasePhoto, getFavouritePhotosForEvents, getEventFavouritePhotos, openGallery, getPublicGalleryMedia, requestGalleryAccess, GalleryAccess, OpenedGallery, getGalleryVideo, type GalleryVideo } from "@/lib/database"; // Live Data
import { useAuth } from "@/context/AuthContext";
import { promptLogin } from "@/components/ui/LoginPrompt";
import { Loader2, Image as ImageIcon, ChevronLeft, ChevronDown, Share2, Check, Star, Lock, Clock, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useRef } from "react";
import { getWebTemplateComponent } from "@/components/templateRegistry";
import { RoyalGalleryHeader } from "@/components/royal/RoyalGalleryHeader";
import { MidnightGalleryHeader } from "@/components/midnight/MidnightGalleryHeader";
import { GalleryHighlightVideo } from "@/components/GalleryHighlightVideo";
import { getWebLightboxTheme, getWebTemplateChrome } from "@/lib/webTemplateTheme";
import { ClassicGalleryHeader } from "@/components/classic/ClassicGalleryHeader";
import { PortraitGalleryHeader } from "@/components/portrait/PortraitGalleryHeader";
import { supabase } from "@/lib/supabase";
import { uploadEventImage } from "@/lib/storage";
import { alertDialog } from "@/components/ui/Modal";

const PUBLIC_PAGE_SIZE = 60;

const isVideoMedia = (item: { mediaType?: string; resourceType?: string }) => item.mediaType === "video" || item.resourceType === "video";

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
    // The main event's title and category when this page is an album opened by its own link (Classic White's cover
    // shows them)
    const [parentInfo, setParentInfo] = useState<{ title?: string; category?: string }>({});
    const [subEvents, setSubEvents] = useState<Event[]>([]);
    const [photos, setPhotos] = useState<any[]>([]);
    const [mediaTotals, setMediaTotals] = useState({ photos: 0, videos: 0 });
    const [activeGallery, setActiveGallery] = useState<Event | null>(null);
    const [galleryMediaTab, setGalleryMediaTab] = useState<"photos" | "videos">("photos");
    const [showOnlyFavourites, setShowOnlyFavourites] = useState(false);
    const [favouriteMediaIds, setFavouriteMediaIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Pagination State
    const [photoPage, setPhotoPage] = useState(0);
    const [hasMorePhotos, setHasMorePhotos] = useState(false);
    const [loadingMorePhotos, setLoadingMorePhotos] = useState(false);
    // The next page loads on its own near the end of the grid; the button only shows if that fails
    // (or the browser can't watch the scroll position)
    const [loadMoreFailed, setLoadMoreFailed] = useState(false);
    const [canAutoLoad, setCanAutoLoad] = useState(true);
    const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

    // What this viewer may do with the link (open_gallery)
    const [access, setAccess] = useState<GalleryAccess | null>(null);
    const [gateTitle, setGateTitle] = useState("");
    const [requestingAccess, setRequestingAccess] = useState(false);
    const isPublicView = access === "public_view";
    const canUseRealtime = access === "manage" || access === "member";
    // Guests whose host turned on "Allow Photo Uploads" can add photos here (hosts upload from their dashboard)
    const [canGuestUpload, setCanGuestUpload] = useState(false);
    const [guestUpload, setGuestUpload] = useState<{ done: number; total: number } | null>(null);
    const [guestUploadError, setGuestUploadError] = useState("");
    const guestFileInputRef = useRef<HTMLInputElement | null>(null);


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

    // The cinematic highlight video the host chose for the gallery on screen (host page > Cinematic Highlight Video),
    // shown at the top of the gallery in every theme
    const shownGallery: Event | null = activeGallery || event;
    const shownGalleryId = shownGallery?.id as string | undefined;
    // null: the gallery's row says it has none; undefined: not known (read-only public view), so ask
    const wantsGalleryVideo = !!shownGalleryId && shownGallery?.galleryVideoId !== null;
    const [loadedGalleryVideo, setLoadedGalleryVideo] = useState<{ galleryId: string; video: GalleryVideo | null } | null>(null);
    useEffect(() => {
        if (!wantsGalleryVideo || !shownGalleryId) return;
        let cancelled = false;
        void getGalleryVideo(shownGalleryId).then(video => {
            if (!cancelled) setLoadedGalleryVideo({ galleryId: shownGalleryId, video });
        });
        return () => { cancelled = true; };
    }, [wantsGalleryVideo, shownGalleryId, shownGallery?.galleryVideoId]);
    const galleryVideo = wantsGalleryVideo && loadedGalleryVideo?.galleryId === shownGalleryId ? loadedGalleryVideo.video : null;

    // A gallery with videos but no photos opens on Videos. Decided once per gallery, after its media has loaded,
    // so a guest who then picks Photos keeps their choice.
    const mediaTabChosenFor = useRef<string | null>(null);
    useEffect(() => {
        if (loading || !shownGalleryId || mediaTabChosenFor.current === shownGalleryId) return;
        const loadedVideos = photos.filter(isVideoMedia).length;
        const photoTotal = mediaTotals.photos || photos.length - loadedVideos;
        const videoTotal = mediaTotals.videos || loadedVideos;
        // Public galleries have no totals; wait until every page has loaded if the first one is only videos
        const countsKnown = mediaTotals.photos + mediaTotals.videos > 0 || !hasMorePhotos;
        if (photoTotal + videoTotal === 0 || !countsKnown) return;
        mediaTabChosenFor.current = shownGalleryId;
        if (photoTotal === 0 && videoTotal > 0) setGalleryMediaTab("videos");
    }, [loading, shownGalleryId, photos, mediaTotals, hasMorePhotos]);

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
            // Stars are saved under the main event (older app versions saved them under the album)
            const favouriteRows = await getEventFavouritePhotos([gallery.id, gallery.parentId || "", event?.id || ""]);
            setFavouriteMediaIds(new Set(favouriteRows.map(row => row.photoId)));
        }
        const currentMainEvent = gallery.type === 'main' ? gallery : event;
        const subEventList = overrideSubEvents || subEvents;

        // Home (Primary Gallery): the host's favourites first, then what was uploaded to Home itself (pages of 20)
        if (!gallery.parentId && (currentMainEvent || gallery.type === 'main')) {
            const rootId = gallery.type === 'main' ? gallery.id : currentMainEvent?.id;
            const eventIds = Array.from(new Set([
                rootId,
                gallery.legacyId,
                currentMainEvent?.legacyId,
                ...subEventList.flatMap(s => [s.id, s.legacyId]),
            ].filter(Boolean) as string[]));
            const homeIds = new Set([gallery.id, gallery.legacyId].filter(Boolean) as string[]);
            const own = await getEventPhotosPaginated(gallery.id, gallery.legacyId, page, 20);
            const ownPhotos = transformPhotos(own.photos as DatabasePhoto[]);
            if (page === 0) {
                // Only favourites from galleries this viewer sees (not from sub-galleries hidden from guests)
                const favPhotos = eventIds.length > 0
                    ? transformPhotos((await getFavouritePhotosForEvents(eventIds)).filter(photo => eventIds.includes(photo.eventId)) as DatabasePhoto[])
                    : [];
                setFavouriteMediaIds(new Set(favPhotos.map(photo => photo.id).filter(Boolean)));
                setPhotos(mergeHomeMedia(favPhotos, ownPhotos));
                // Home uploads that are also favourites are counted once
                const extraFavourites = favPhotos.filter(photo => !homeIds.has(photo.eventId || ""));
                setMediaTotals({
                    photos: own.totalPhotos + extraFavourites.filter(p => !isVideoMedia(p)).length,
                    videos: own.totalVideos + extraFavourites.filter(isVideoMedia).length,
                });
            } else {
                setPhotos(prev => mergeHomeMedia(prev, ownPhotos));
            }
            setPhotoPage(page);
            setHasMorePhotos(own.hasMore);
            return;
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
        const eventData = { ...opened.event!, coverImage: resolveEventCoverImage(opened.event!.coverImage, 'preview', opened.event!.category) };
        setEvent(eventData);
        setSubEvents(opened.subEvents.map(sub => ({
            ...sub,
            coverImage: resolveEventCoverImage(sub.coverImage, 'thumbnail', sub.category || eventData.category)
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
            setCanGuestUpload(opened.access === "member" && opened.canUpload);

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

            // A sub-gallery hidden from guests opens only in the Host section, for everyone (the database also
            // refuses it to anyone but the event's managers)
            if (eventData && eventData.parentId && eventData.isHidden) {
                eventData = null;
            }

            if (!eventData) {
                setEvent(null);
                setLoading(false);
                return;
            }

            // Sub-gallery links inherit the parent event's current visibility.
            let parentCategory: string | undefined;
            let mainTitle: string | undefined;
            if (eventData.parentId) {
                const parentEvent = await getEventById(eventData.parentId, true);
                eventData.isPublic = !!parentEvent?.isPublic;
                parentCategory = parentEvent?.category;
                mainTitle = parentEvent?.title;
            }
            setParentInfo({ title: mainTitle, category: parentCategory });

            // Resolve event cover image to preview format
            const eventCategory = eventData.category || parentCategory;
            eventData.coverImage = resolveEventCoverImage(eventData.coverImage, 'preview', eventCategory);

            setEvent(eventData);

            // 2. Branch logic based on Event Type
            if (eventData.type === 'main') {
                // Fetch Home gallery media and sub-galleries so web follows the same structure as mobile.
                console.log(`[EventPage] Main event detected. Fetching home gallery and sub-events for: ${eventData.id}`);
                const data = visibleGalleries(await getSubEvents(eventData.id, eventData.legacyId));
                const resolvedSubEvents = data.map(sub => ({
                    ...sub,
                    coverImage: resolveEventCoverImage(sub.coverImage, 'thumbnail', sub.category || eventCategory)
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
                            pEvent.coverImage = resolveEventCoverImage(pEvent.coverImage, 'preview', pEvent.category);
                            const siblings = visibleGalleries(await getSubEvents(pEvent.id, pEvent.legacyId));
                            const resolvedSiblings = siblings.map(sub => ({
                                ...sub,
                                coverImage: resolveEventCoverImage(sub.coverImage, 'thumbnail', sub.category || pEvent.category)
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
            void alertDialog({ title: "Request not sent", message: "We couldn't send your request. Please try again." });
        } finally {
            setRequestingAccess(false);
        }
    };

    const handleGuestUpload = async (files: FileList | null) => {
        const target = activeGallery || event;
        if (!files?.length || !target || !user) return;
        const images = Array.from(files).filter(file => file.type.startsWith("image/"));
        setGuestUploadError(images.length < files.length ? "Only photos can be added here. Videos are added by the host." : "");
        if (!images.length) return;
        setGuestUpload({ done: 0, total: images.length });
        try {
            for (const [index, file] of images.entries()) {
                await uploadEventImage(file, target.id, user.uid);
                setGuestUpload({ done: index + 1, total: images.length });
            }
            await loadGalleryPhotos(target, 0, false);
        } catch (err) {
            setGuestUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
        } finally {
            setGuestUpload(null);
            if (guestFileInputRef.current) guestFileInputRef.current.value = "";
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
            setLoadMoreFailed(false);
        } catch (error) {
            console.error("Error loading more photos:", error);
            setLoadMoreFailed(true);
        } finally {
            setLoadingMorePhotos(false);
        }
    };

    // Load the next page about two screens before the guest reaches the end, so it's usually there in time.
    // Re-armed after every page (photos.length), so a short page that leaves the end in view loads the next one too.
    const loadMorePhotosRef = useRef(loadMorePhotos);
    loadMorePhotosRef.current = loadMorePhotos;
    useEffect(() => {
        if (typeof IntersectionObserver === "undefined") {
            setCanAutoLoad(false);
            return;
        }
        const sentinel = loadMoreSentinelRef.current;
        if (!sentinel || !hasMorePhotos || loadMoreFailed) return;
        const observer = new IntersectionObserver(
            (entries) => { if (entries.some((entry) => entry.isIntersecting)) void loadMorePhotosRef.current(); },
            { rootMargin: "0px 0px 1600px 0px" }
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMorePhotos, loadMoreFailed, photos.length]);

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
    const videoItems = photos.filter(isVideoMedia);
    const selectedMediaItems = galleryMediaTab === "videos" ? videoItems : photoItems;
    const isPrimaryGalleryView = !activeGallery;
    const isFavouriteFilterActive = !isPrimaryGalleryView && !isPublicView && showOnlyFavourites;
    const activeGalleryItems = isFavouriteFilterActive
        ? selectedMediaItems.filter(photo => favouriteMediaIds.has(photo.id))
        : selectedMediaItems;
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

    // Royal Emerald draws its own gallery header (crest, title, welcome plaque, Back / Share, Photos / Videos)
    const isRoyalGallery = displayEvent.templateId === "royal";
    // Classic White shows the gallery message in its own gallery header and styles the shared buttons itself (classic-white.css).
    // Sunlit Portrait, Confetti Circle and Periwinkle Script use the same gallery section below their cover.
    const isClassicGallery = displayEvent.templateId === "classic" || displayEvent.templateId === "portrait" || displayEvent.templateId === "confetti" || displayEvent.templateId === "periwinkle";
    // Midnight Hero (the default theme) draws its own gallery header (event name, star, title, count, film, Photos / Videos)
    const isMidnightGallery = (displayEvent.templateId || "hero") === "hero";
    // A new main gallery gets "Main Event: <title>" as its description; that isn't a message for guests
    const midnightMessage = activeGalleryMessage?.trim() === `Main Event: ${event.title}` ? "" : activeGalleryMessage;
    const ownHeader = isRoyalGallery || isClassicGallery || isMidnightGallery;
    const goBack = () => {
        router.push(event?.parentId ? `/events/${event.parentId}${isShared ? "?shared=true" : ""}` : "/dashboard");
    };

    const renderContent = () => (
        <div className={cn("contents themed-gallery-content", isRoyalGallery && "royal-gallery-content")}>
            {!ownHeader && (
            <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                    onClick={goBack}
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
            )}

            <div className={cn(!ownHeader && "mt-12")}>
                {isRoyalGallery ? (
                    <RoyalGalleryHeader
                        title={activeGallery ? activeGalleryTitle : "Home Gallery"}
                        message={activeGalleryMessage}
                        coupleTitle={event?.parentId ? undefined : event?.title}
                        backLabel={event?.parentId ? "Back to Event" : "Back to Gallery"}
                        onBack={goBack}
                        onShare={handleShare}
                        copied={copied}
                        photoCountLabel={displayedPhotoCount}
                        videoCountLabel={displayedVideoCount}
                        activeTab={galleryMediaTab}
                        onTabChange={setGalleryMediaTab}
                        video={galleryVideo ? { src: galleryVideo.streamUrl, mediaId: galleryVideo.id, poster: galleryVideo.posterUrl } : null}
                    />
                ) : isMidnightGallery ? (
                    <MidnightGalleryHeader
                        title={activeGallery ? activeGalleryTitle : "Home Gallery"}
                        eventTitle={event.parentId ? parentInfo.title || undefined : event.title}
                        message={midnightMessage}
                        backLabel={event?.parentId ? "Back to Event" : "Back to Gallery"}
                        onBack={goBack}
                        onShare={handleShare}
                        copied={copied}
                        photoCountLabel={displayedPhotoCount}
                        videoCountLabel={displayedVideoCount}
                        activeTab={galleryMediaTab}
                        onTabChange={setGalleryMediaTab}
                        video={galleryVideo ? { src: galleryVideo.streamUrl, mediaId: galleryVideo.id, poster: galleryVideo.posterUrl } : null}
                    />
                ) : displayEvent.templateId === "portrait" ? (
                    <PortraitGalleryHeader
                        // The gallery's own name; the event's title is on the cover
                        title={activeGallery ? activeGalleryTitle : event.parentId ? event.title || "Home" : "Home"}
                        details={[displayEvent.date?.trim(), typeof displayEvent.location === "string" ? displayEvent.location.trim() : ""].filter(Boolean).join(" · ")}
                        message={activeGalleryMessage}
                        backLabel={event?.parentId ? "Back to Event" : "Back to Gallery"}
                        onBack={goBack}
                        onShare={handleShare}
                        copied={copied}
                        photoCountLabel={displayedPhotoCount}
                        videoCountLabel={displayedVideoCount}
                        activeTab={galleryMediaTab}
                        onTabChange={setGalleryMediaTab}
                        video={galleryVideo ? { src: galleryVideo.streamUrl, mediaId: galleryVideo.id, poster: galleryVideo.posterUrl } : null}
                    />
                ) : isClassicGallery ? (
                    <ClassicGalleryHeader
                        // The gallery's own name; the event's title is on the cover
                        title={activeGallery ? activeGalleryTitle : event.parentId ? event.title || "Home" : "Home"}
                        details={[displayEvent.date?.trim(), typeof displayEvent.location === "string" ? displayEvent.location.trim() : ""].filter(Boolean).join(" · ")}
                        // Periwinkle Script shows the message in the card on its cover
                        message={displayEvent.templateId === "periwinkle" ? "" : activeGalleryMessage}
                        backLabel={event?.parentId ? "Back to Event" : "Back to Gallery"}
                        onBack={goBack}
                        onShare={handleShare}
                        copied={copied}
                        photoCountLabel={displayedPhotoCount}
                        videoCountLabel={displayedVideoCount}
                        activeTab={galleryMediaTab}
                        onTabChange={setGalleryMediaTab}
                        video={galleryVideo ? { src: galleryVideo.streamUrl, mediaId: galleryVideo.id, poster: galleryVideo.posterUrl } : null}
                    />
                ) : (
                    <>
                        <SectionHeader
                            title={activeGallery ? activeGalleryTitle : "Home Gallery"}
                            subtitle={`${displayedPhotoCount} Photos · ${displayedVideoCount} Videos`}
                        />

                        {activeGalleryMessage && !isClassicGallery && (
                            <p className="mx-auto mt-5 max-w-3xl text-center font-sans text-sm font-semibold leading-7 text-stone-600 md:text-base">
                                {activeGalleryMessage}
                            </p>
                        )}

                        {galleryVideo && (
                            <GalleryHighlightVideo
                                video={{ src: galleryVideo.streamUrl, mediaId: galleryVideo.id, poster: galleryVideo.posterUrl }}
                                title={activeGallery ? activeGalleryTitle : "Home Gallery"}
                            />
                        )}
                    </>
                )}

                {canGuestUpload && (activeGallery || subEvents.length === 0 ? (
                    <div className={cn("flex flex-col gap-2", isClassicGallery ? "mt-10 items-start" : "mt-6 items-center")}>
                        <input
                            ref={guestFileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => void handleGuestUpload(e.target.files)}
                        />
                        <button
                            type="button"
                            disabled={!!guestUpload}
                            onClick={() => guestFileInputRef.current?.click()}
                            className={isRoyalGallery
                                ? "royal-button"
                                : isMidnightGallery
                                ? "midnight-gh-button"
                                : isClassicGallery
                                ? "classic-button"
                                : "inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-60"}
                        >
                            {guestUpload ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            {guestUpload ? `Uploading ${guestUpload.done}/${guestUpload.total}` : "Add photos"}
                        </button>
                        {guestUploadError && <p className={cn("max-w-md text-center text-xs font-semibold", isRoyalGallery ? "royal-error" : "text-rose-600")}>{guestUploadError}</p>}
                    </div>
                ) : (
                    <p className={cn("mt-6 text-xs font-semibold", isClassicGallery ? "text-left" : "text-center", isRoyalGallery ? "royal-muted" : "text-stone-500")}>Open an album to add your photos.</p>
                ))}

                {/* Photos / Videos on the left; Favourites only (in albums, for logged-in guests) on the right, below on phones */}
                <div className={cn("mt-10 flex flex-wrap items-center gap-4", ownHeader ? "justify-end" : "justify-between")}>
                {!ownHeader && (
                <div data-royal-control="segments" className="inline-flex rounded-2xl border border-stone-200 bg-white p-1 shadow-sm">
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
                )}
                <div className="w-full sm:w-auto">
                    {isPrimaryGalleryView || isPublicView ? null : (
                    <button
                        type="button"
                        role="switch"
                        aria-checked={showOnlyFavourites}
                        onClick={() => setShowOnlyFavourites(current => !current)}
                        className={cn(
                            "flex h-[50px] w-full items-center gap-2.5 rounded-2xl border pl-1.5 pr-3 text-left shadow-sm transition-colors sm:w-auto",
                            isRoyalGallery
                                ? "royal-switch"
                                : showOnlyFavourites
                                    ? "border-slate-900 bg-slate-900"
                                    : "border-stone-200 bg-white hover:border-stone-400"
                        )}
                    >
                        {/* Royal Emerald styles the parts itself (royal-switch in royal-emerald.css), by aria-checked */}
                        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", isRoyalGallery ? "royal-switch__icon" : showOnlyFavourites ? "bg-white text-slate-900" : "bg-stone-100 text-stone-600")}>
                            <Star className={cn("h-4 w-4", showOnlyFavourites && "fill-current")} aria-hidden="true" />
                        </span>
                        <span className={cn("min-w-0 flex-1 whitespace-nowrap text-xs font-black uppercase tracking-widest", isRoyalGallery ? "royal-switch__label" : showOnlyFavourites ? "text-white" : "text-stone-800")}>
                            Favourites only
                        </span>
                        <span
                            title={`${activeFavouriteCount} in ${galleryMediaTab === "videos" ? "Videos" : "Photos"}`}
                            className={cn("min-w-7 rounded-lg px-2 py-0.5 text-center text-xs font-bold", isRoyalGallery ? "royal-switch__count" : showOnlyFavourites ? "bg-white/20 text-white" : "bg-stone-100 text-stone-600")}
                        >
                            {activeFavouriteCount}
                        </span>
                        <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", isRoyalGallery ? "royal-switch__track" : showOnlyFavourites ? "bg-white/35" : "bg-stone-200")}>
                            <span className={cn("absolute top-0.5 h-5 w-5 rounded-full shadow-sm transition-transform", isRoyalGallery ? "royal-switch__knob" : "bg-white", showOnlyFavourites ? "translate-x-5" : "translate-x-0.5")} />
                        </span>
                    </button>
                    )}
                </div>
                </div>

                {activeGalleryItems.length > 0 ? (
                    <div className="mt-8">
                        <MasonryGrid
                            photos={activeGalleryItems}
                            eventSlug={slug}
                            disableDownload={isPublicView || (isShared && !user)}
                            readOnly={isPublicView}
                            onRequireLogin={isPublicView && !user ? promptLogin : undefined}
                            lightboxTheme={getWebLightboxTheme((activeGallery || event).templateId || event.templateId)}
                            templateId={(activeGallery || event).templateId || event.templateId}
                            layout={isClassicGallery || isMidnightGallery ? "justified" : undefined}
                        />
                    </div>
                ) : (
                    <div className={cn("text-center py-32", isRoyalGallery ? "royal-empty" : isClassicGallery ? "classic-empty" : "opacity-50")}>
                        <ImageIcon className={cn("w-16 h-16 mx-auto mb-6", !isRoyalGallery && "text-stone-600")} />
                        {error === "permissions" ? (
                            <>
                                <h2 className={cn("text-2xl font-serif italic mb-2", !isRoyalGallery && "text-stone-600")}>Moments restricted...</h2>
                                <p className={cn("font-sans text-sm", !isRoyalGallery && "text-stone-600")}>You don&apos;t have access to these photos yet. Ask the host to share the gallery with you.</p>
                            </>
                        ) : (
                            <>
                                <h2 className={cn("text-2xl font-serif italic mb-2", !isRoyalGallery && "text-stone-600")}>
                                    {isFavouriteFilterActive
                                        ? `No favourite ${galleryMediaTab === "videos" ? "videos" : "photos"} in this gallery yet.`
                                        : galleryMediaTab === "videos" ? "No videos yet." : "No photos yet."}
                                </h2>
                                <p className={cn("font-sans text-sm", !isRoyalGallery && "text-stone-600")}>Check back soon to see the captured memories.</p>
                            </>
                        )}
                    </div>
                )}

                {/* More photos load on their own as the guest nears this point; the button is the fallback */}
                {hasMorePhotos && photos.length > 0 && (
                    <div ref={loadMoreSentinelRef} className="flex justify-center mt-16 mb-8 w-full min-h-14" aria-live="polite">
                        {canAutoLoad && !loadMoreFailed ? (
                            loadingMorePhotos && (
                                <span className={cn("inline-flex items-center gap-2 text-sm", !isRoyalGallery && "text-stone-500")}>
                                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                                    Loading more…
                                </span>
                            )
                        ) : (
                        <button
                            onClick={loadMorePhotos}
                            disabled={loadingMorePhotos}
                            className={isRoyalGallery
                                ? "royal-button royal-button--large"
                                : isClassicGallery
                                ? "classic-button classic-button--large"
                                : "px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-full font-bold shadow-xl flex items-center space-x-3 transition-all hover:scale-105 active:scale-95"}
                        >
                            {loadingMorePhotos ? (
                                <Loader2 className={cn("w-5 h-5 animate-spin", !isRoyalGallery && !isClassicGallery && "text-white/70")} />
                            ) : (
                                <ChevronDown className={cn("w-5 h-5", !isRoyalGallery && !isClassicGallery && "text-white/70")} />
                            )}
                            <span className="tracking-widest uppercase text-sm">
                                {loadingMorePhotos ? "Loading..." : "Load More Media"}
                            </span>
                        </button>
                        )}
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
                // Classic White keeps the main event's title (and its theme line) on the cover in every album
                mainTitle={activeGallery || !event.parentId ? event.title : parentInfo.title || event.title}
                mainCategory={activeGallery || !event.parentId ? event.category : parentInfo.category || event.category}
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
