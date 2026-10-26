"use client";

import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { onPhotoInteractions, toggleLike } from "@/lib/database";
import { useAuth } from "@/context/AuthContext";
import { Heart, MessageCircle, Download, Play } from "lucide-react";
import type { LightboxTheme } from "./Lightbox";
import { getGridSrcSet, getGridThumbnail, getImageUrl, GRID_HIRES_ENABLED } from "@/lib/imageUrl";
import { PageFlipViewer, type GalleryMediaItem, type PageFlipTheme, type ViewerLayout } from "@/components/page-flip/PageFlipViewer";
import { getPageFlipThemeForTemplateId } from "@/components/page-flip/pageFlipThemes";
import { getOriginalMediaUrl } from "@/lib/zipDownload";

interface Photo {
    id: string;
    src: string;
    thumbnailUrl?: string;
    previewUrl?: string;
    storageKey?: string;
    alt?: string;
    height?: number;
    width?: number;
    filename?: string;
    mediaType?: "photo" | "video";
    resourceType?: "image" | "video" | string;
}

interface MasonryGridProps {
    photos: Photo[];
    className?: string;
    eventSlug?: string;
    disableDownload?: boolean;
    /** Logged-out public view: no likes, comments or downloads, and no reads of likes/comments */
    readOnly?: boolean;
    gridClassName?: string;
    itemClassName?: string;
    lightboxClassName?: string;
    lightboxTheme?: LightboxTheme;
    pageFlipTheme?: PageFlipTheme;
    viewerLayout?: ViewerLayout;
    commentsMode?: "overlay" | "side-panel";
    templateId?: string;
    /** "justified": rows of equal height edge to edge, each photo keeps its shape (Classic White). Default: columns */
    layout?: "columns" | "justified";
    showPageFlipThumbnails?: boolean;
    onLikeChange?: () => void;
    /** Read-only visitors who could join by logging in: like, comment and download show and call this instead */
    onRequireLogin?: () => void;
}

interface PhotoCardProps {
    photo: Photo;
    index: number;
    eventSlug?: string;
    disableDownload?: boolean;
    readOnly?: boolean;
    itemClassName?: string;
    onViewPhoto: (photo: Photo) => void;
    onLikeChange?: () => void;
    onRequireLogin?: () => void;
    justified?: boolean;
}

type PhotoLike = {
    userId: string;
};

function PhotoCard({
    photo,
    index,
    eventSlug,
    disableDownload = false,
    readOnly = false,
    itemClassName,
    onViewPhoto,
    onLikeChange,
    onRequireLogin,
    justified = false
}: PhotoCardProps) {
    const { user } = useAuth();
    const [likes, setLikes] = useState<PhotoLike[]>([]);
    const [commentsCount, setCommentsCount] = useState(0);
    const [isLiking, setIsLiking] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const getIdentity = () => {
        if (user) {
            return {
                id: user.uid,
                name: user.name || user.email?.split('@')[0] || "User"
            };
        }
        if (typeof window !== "undefined") {
            const saved = sessionStorage.getItem("wedding_guest_details");
            if (saved) {
                const { name, phone } = JSON.parse(saved);
                return { id: phone, name };
            }
        }
        return { id: "anonymous", name: "Guest" };
    };

    const identity = getIdentity();
    const isLiked = likes.some(l => l.userId === identity.id);
    const isVideo = photo.mediaType === "video" || photo.resourceType === "video";
    const [imageSrc, setImageSrc] = useState(photo.thumbnailUrl || (photo.src ? getGridThumbnail(photo.src) : ""));
    const [measuredRatio, setMeasuredRatio] = useState<number | null>(null);
    const aspectRatio = photo.width && photo.height ? photo.width / photo.height : measuredRatio || (isVideo ? 16 / 9 : 3 / 2);

    // Big screens may pick the 1000 px grid image instead of the thumbnail (issue #121); dropped again if it fails to
    // load (photos uploaded before grid images existed have none)
    const [hiResFailed, setHiResFailed] = useState(false);
    const hiResSrcSet = GRID_HIRES_ENABLED && justified && !isVideo && !hiResFailed && imageSrc
        ? getGridSrcSet(imageSrc, photo.width, photo.height)
        : "";

    useEffect(() => {
        setImageSrc(photo.thumbnailUrl || (photo.src ? getGridThumbnail(photo.src) : ""));
        setHiResFailed(false);
    }, [photo.src, photo.thumbnailUrl]);

    useEffect(() => {
        if (readOnly) return;
        const unsubscribe = onPhotoInteractions(photo.id, (data) => {
            setLikes(data.likes);
            setCommentsCount(data.comments.length);
        });
        return () => unsubscribe();
    }, [photo.id, readOnly]);

    const handleToggleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isLiking) return;
        setIsLiking(true);
        try {
            await toggleLike(photo.id, identity.id, identity.name);
            onLikeChange?.();
        } catch (err) {
            console.error("Like failed", err);
        } finally {
            setIsLiking(false);
        }
    };

    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (disableDownload) return;
        setIsDownloading(true);
        try {
            // Videos: the uploaded file, not the streaming playlist
            const downloadUrl = getOriginalMediaUrl(photo.src);

            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', photo.filename || 'wedding-photo');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Download failed", error);
        } finally {
            setIsDownloading(false);
        }
    };

    const reducedMotion = useReducedMotion();

    return (
        <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: reducedMotion ? 0 : 0.4, delay: reducedMotion ? 0 : Math.min(index, 5) * 0.04, ease: "easeOut" }}
            onClick={() => onViewPhoto(photo)}
            // Justified rows size each card by its shape (--ar, styles in gallery-refinements.css); unknown sizes are read on load
            style={justified ? { "--ar": aspectRatio } as React.CSSProperties : undefined}
            className={cn(
                "gallery-media-card break-inside-avoid overflow-hidden group relative mb-4 shadow-md hover:shadow-xl transition-all duration-500 bg-white border border-stone-150 rounded-2xl cursor-pointer flex flex-col",
                itemClassName
            )}
        >
            {/* Tinted until the image arrives, so an empty card still reads as a photo slot */}
            <button type="button" aria-label={`Open ${isVideo ? "video" : "photo"}: ${photo.alt || photo.filename || "Event memory"}`} className="relative block w-full overflow-hidden bg-[rgba(127,127,127,0.12)] text-left">
                {isVideo ? (
                    <div className="relative aspect-[4/5] w-full bg-slate-950 overflow-hidden" style={{ aspectRatio: photo.width && photo.height ? `${photo.width} / ${photo.height}` : "16 / 9" }}>
                        {photo.thumbnailUrl ? (
                            <img
                                src={photo.thumbnailUrl}
                                alt={photo.alt || "Video preview"}
                                className="h-full w-full object-cover transform transition-all duration-700 group-hover:scale-[1.02]"
                                loading="lazy"
                            />
                        ) : (
                            <video
                                src={photo.src}
                                className="h-full w-full object-cover transform transition-all duration-700 group-hover:scale-[1.02]"
                                muted
                                playsInline
                                preload="metadata"
                            />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20 group-hover:bg-slate-950/10 transition-colors">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-black/60 text-white shadow-xl backdrop-blur-sm group-hover:scale-110 transition-transform">
                                <Play className="h-5 w-5 fill-current ml-0.5" />
                            </div>
                        </div>
                    </div>
                ) : imageSrc ? (() => {
                    const image = (
                        <img
                            src={imageSrc}
                            alt={photo.alt || "Event Photo"}
                            onError={() => {
                                if (hiResSrcSet) setHiResFailed(true);
                                else setImageSrc("");
                            }}
                            onLoad={justified && !(photo.width && photo.height) ? (e) => {
                                const { naturalWidth, naturalHeight } = e.currentTarget;
                                if (naturalWidth && naturalHeight) setMeasuredRatio(naturalWidth / naturalHeight);
                            } : undefined}
                            className="w-full h-auto object-cover transform transition-all duration-700 group-hover:scale-[1.02]"
                            // Holds the photo's shape before it loads, so the columns don't jump as images arrive
                            style={photo.width && photo.height ? { aspectRatio: `${photo.width} / ${photo.height}` } : undefined}
                            loading="lazy"
                        />
                    );
                    // From 1024 px wide the browser chooses thumbnail or preview by the tile's real size; smaller screens keep the thumbnail
                    return hiResSrcSet ? (
                        <picture>
                            <source media="(min-width: 1024px)" srcSet={hiResSrcSet} sizes="auto, 50vw" />
                            {image}
                        </picture>
                    ) : image;
                })() : (
                    <div className="flex aspect-[4/5] w-full items-center justify-center bg-stone-100 text-xs font-bold uppercase tracking-widest text-stone-400">
                        Image unavailable
                    </div>
                )}
            </button>

            {/* Actions sit on the photo over a soft fade. With a mouse they appear on hover (or keyboard focus) and only
                the like/comment counts stay visible; on touch screens, which can't hover, they're always shown. */}
            {!readOnly && (
            <>
                {(likes.length > 0 || commentsCount > 0) && (
                    <div aria-hidden="true" className="gallery-card-counts pointer-events-none absolute bottom-3 left-3 hidden items-center gap-3 rounded-full bg-black/45 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-0 group-focus-within:opacity-0 [@media(hover:hover)]:flex">
                        {likes.length > 0 && (
                            <span className="flex items-center gap-1">
                                <Heart size={13} className={cn(isLiked ? "fill-rose-500 text-rose-500" : "text-white")} />
                                {likes.length}
                            </span>
                        )}
                        {commentsCount > 0 && (
                            <span className="flex items-center gap-1">
                                <MessageCircle size={13} />
                                {commentsCount}
                            </span>
                        )}
                    </div>
                )}
                <div className="gallery-card-overlay absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 pb-2.5 pt-12 text-white transition-opacity duration-300 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
                    <div className="flex items-center gap-1">
                        {/* Like Option */}
                        <button
                            type="button"
                            onClick={handleToggleLike}
                            className="flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full px-2 transition-colors hover:bg-white/15 group/like"
                            aria-label={isLiked ? "Unlike photo" : "Like photo"}
                            aria-pressed={isLiked}
                        >
                            <Heart
                                size={20}
                                className={cn(
                                    "drop-shadow transition-all duration-300",
                                    isLiked
                                        ? "fill-rose-500 text-rose-500 scale-110"
                                        : "text-white group-hover/like:scale-110"
                                )}
                            />
                            {likes.length > 0 && (
                                <span className="text-xs font-bold tracking-wider drop-shadow">
                                    {likes.length}
                                </span>
                            )}
                        </button>

                        {/* Comment Option (opens the viewer, where comments are) */}
                        <button type="button"
                            className="flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full px-2 transition-colors hover:bg-white/15 group/comment"
                            aria-label={commentsCount > 0 ? `${commentsCount} comments` : "Comments"}
                        >
                            <MessageCircle
                                size={20}
                                className="drop-shadow transition-transform duration-300 group-hover/comment:scale-110"
                            />
                            {commentsCount > 0 && (
                                <span className="text-xs font-bold tracking-wider drop-shadow">
                                    {commentsCount}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Save (Download) Option */}
                    {eventSlug && photo.filename && !disableDownload && (
                        <button
                            type="button"
                            onClick={handleDownload}
                            disabled={isDownloading}
                            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/15 disabled:opacity-50"
                            title="Download Original"
                            aria-label="Download original"
                        >
                            {isDownloading ? (
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <Download size={19} className="drop-shadow" />
                            )}
                        </button>
                    )}
                </div>
            </>
            )}

            {/* Logged-out visitors of a public gallery: the same buttons, which ask them to log in */}
            {readOnly && onRequireLogin && (
                <div className="gallery-card-overlay absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 pb-2.5 pt-12 text-white transition-opacity duration-300 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
                    <div className="flex items-center gap-1">
                        {([
                            { label: "Like photo", Icon: Heart },
                            { label: "Comments", Icon: MessageCircle },
                        ] as const).map(({ label, Icon }) => (
                            <button
                                key={label}
                                type="button"
                                onClick={(event) => { event.stopPropagation(); onRequireLogin(); }}
                                className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/15"
                                aria-label={label}
                            >
                                <Icon size={20} className="drop-shadow" />
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); onRequireLogin(); }}
                        className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/15"
                        aria-label="Download original"
                        title="Download Original"
                    >
                        <Download size={19} className="drop-shadow" />
                    </button>
                </div>
            )}
        </motion.div>
    );
}

/**
 * How many columns the theme's CSS gives the grid (CSS columns, which differ by theme and screen width) and the gap
 * between them; null until measured. Re-read when the grid's size or photo count changes (some themes cap the
 * column count by the number of photos).
 */
function useCssColumns(ref: React.RefObject<HTMLDivElement | null>, enabled: boolean, photoCount: number) {
    const [columns, setColumns] = useState<{ count: number; gap: number } | null>(null);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!enabled || !el) return;
        const read = () => {
            const style = getComputedStyle(el);
            const count = parseInt(style.columnCount, 10);
            const gap = parseFloat(style.columnGap);
            const next = { count: Number.isFinite(count) && count > 0 ? count : 1, gap: Number.isFinite(gap) ? gap : 16 };
            setColumns((prev) => (prev && prev.count === next.count && prev.gap === next.gap ? prev : next));
        };
        read();
        if (typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(read);
        observer.observe(el);
        return () => observer.disconnect();
    }, [ref, enabled, photoCount]);
    return columns;
}

/** Height / width of a card's media, for placing it in the shortest column; unknown sizes count as square */
function mediaHeightRatio(photo: Photo) {
    if (photo.width && photo.height) return photo.height / photo.width;
    const isVideo = photo.mediaType === "video" || photo.resourceType === "video";
    return isVideo ? 9 / 16 : 1;
}

export function MasonryGrid({
    photos,
    className,
    eventSlug,
    disableDownload = false,
    readOnly = false,
    gridClassName,
    itemClassName,
    lightboxClassName,
    pageFlipTheme,
    viewerLayout,
    commentsMode = "side-panel",
    templateId,
    layout = "columns",
    showPageFlipThumbnails = true,
    onLikeChange,
    onRequireLogin
}: MasonryGridProps) {
    // Track which photo is currently being viewed in the Lightbox
    const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);
    const viewingIndex = photos.findIndex((photo) => photo.id === viewingPhoto?.id);
    const resolvedViewerLayout = viewerLayout || "cover-flow";
    const viewerItems: GalleryMediaItem[] = photos.map((photo) => {
        const isVideo = photo.mediaType === "video" || photo.resourceType === "video";
        const previewUrl = isVideo
            ? photo.src
            : photo.previewUrl || (photo.src ? getImageUrl(photo.src, { width: 1400, quality: 78, format: "webp" }) : "");
        return {
            id: photo.id,
            type: isVideo ? "video" : "image",
            previewUrl,
            originalUrl: photo.src,
            thumbnailUrl: photo.thumbnailUrl || (isVideo ? undefined : getGridThumbnail(photo.src)),
            alt: photo.alt,
            filename: photo.filename,
            width: photo.width,
            height: photo.height,
        };
    });
    const resolvedPageFlipTheme = pageFlipTheme || getPageFlipThemeForTemplateId(templateId);

    // Columns layout: each photo goes into the shortest column in order, so photos added by the next page only extend
    // the columns at the bottom. (Plain CSS columns re-balance the whole grid, moving photos the guest is looking at.)
    const gridRef = useRef<HTMLDivElement | null>(null);
    const cssColumns = useCssColumns(gridRef, layout !== "justified", photos.length);
    const columnItems = useMemo(() => {
        if (!cssColumns) return null;
        const columns: { photo: Photo; index: number }[][] = Array.from({ length: cssColumns.count }, () => []);
        const heights = new Array(cssColumns.count).fill(0);
        photos.forEach((photo, index) => {
            const shortest = heights.indexOf(Math.min(...heights));
            columns[shortest].push({ photo, index });
            heights[shortest] += mediaHeightRatio(photo);
        });
        return columns;
    }, [cssColumns, photos]);

    const renderCard = (photo: Photo, index: number) => (
        <PhotoCard
            key={photo.id}
            photo={photo}
            index={index}
            eventSlug={eventSlug}
            disableDownload={disableDownload}
            readOnly={readOnly}
            itemClassName={itemClassName}
            onViewPhoto={setViewingPhoto}
            onLikeChange={onLikeChange}
            onRequireLogin={onRequireLogin}
            justified={layout === "justified"}
        />
    );

    return (
        <div className={cn("gallery-masonry container mx-auto px-4 py-8", templateId === "royal" && "royal-masonry", className)} style={{ "--gallery-count": Math.max(1, photos.length), "--royal-count": Math.max(1, photos.length <= 3 ? photos.length : Math.ceil(photos.length / 2)) } as React.CSSProperties}>
            <div ref={gridRef} className={cn(layout === "justified" ? "gallery-justified" : "columns-1 sm:columns-2 md:columns-3 gap-4", gridClassName)}>
                {columnItems ? (
                    // The grid keeps its CSS columns (read above); this row spans them and holds the placed columns
                    <div className="flex items-start" style={{ columnSpan: "all", gap: cssColumns?.gap }}>
                        {columnItems.map((items, column) => (
                            <div key={column} className="min-w-0 flex-1">
                                {items.map(({ photo, index }) => renderCard(photo, index))}
                            </div>
                        ))}
                    </div>
                ) : (
                    photos.map((photo, index) => renderCard(photo, index))
                )}
                {/* Keeps the last justified row at its natural height instead of stretching it across */}
                {layout === "justified" && <div aria-hidden="true" className="gallery-justified__end" />}
            </div>

            {viewingPhoto && viewingIndex >= 0 && (
                <div className={lightboxClassName}>
                    <PageFlipViewer
                        items={viewerItems}
                        initialIndex={viewingIndex}
                        theme={resolvedPageFlipTheme}
                        loop
                        showThumbnails={showPageFlipThumbnails}
                        showDownload={!disableDownload && !readOnly}
                        showLikes={!readOnly}
                        onRequireLogin={onRequireLogin}
                        showComments={!readOnly}
                        viewerLayout={resolvedViewerLayout}
                        commentsMode={readOnly ? "overlay" : commentsMode}
                        onClose={() => setViewingPhoto(null)}
                        onIndexChange={(index) => setViewingPhoto(photos[index] || null)}
                    />
                </div>
            )}
        </div>
    );
}
