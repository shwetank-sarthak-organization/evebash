"use client";

import { VideoThumbnailPicker, VideoThumbnailActions } from "@/components/VideoThumbnailPicker";
import { GalleryVideoPanel } from "@/components/GalleryVideoPanel";
import { MoveToGalleryDialog } from "@/components/MoveToGalleryDialog";
import { FolderPickerDialog } from "@/components/vault/Dialogs";
import { vaultApi } from "@/lib/vaultApi";
import { GalleriesIcon, GalleryChaptersIcon } from "@/components/GalleriesIcon";
import { PermissionsIcon } from "@/components/PermissionsIcon";
import { DesignIcon } from "@/components/DesignIcon";
import { EventDesignPreview } from "@/components/EventDesignPreview";
import { PartnersIcon } from "@/components/PartnersIcon";
import { GalleryTypesInfo } from "@/components/GalleryTypesInfo";
import { HostIcon } from "@/components/HostIcon";
import { HostConsoleIcon } from "@/components/HostConsoleIcon";
import { DashboardEventCard, SERIF, formatShortEventDate } from "@/components/dashboard/DashboardEvents";
import { PrivateIcon } from "@/components/PrivateIcon";
import { PublicIcon } from "@/components/PublicIcon";
import React, { useState, useEffect, Suspense, useTransition, useRef, useCallback } from "react";
import LoadingScreen from "@/components/LoadingScreen";
import { useAuth } from "@/context/AuthContext";
import { useUploads, type UploadQueueItem } from "@/context/UploadContext";
import { useRouter, useSearchParams } from "next/navigation";
import { downloadGalleryAsZip } from "@/lib/zipDownload";
import {
    LayoutDashboard,
    Eye,
    EyeOff,
    Clapperboard,
    Settings,
    ShieldCheck,
    LogOut,
    ArrowRight,
    Camera,
    Plus,
    Upload,
    ChevronLeft,
    Image as ImageIcon,
    Loader2,
    MoreHorizontal,
    Pencil,
    Check,
    Trash2,
    X,
    Star,
    LayoutGrid,
    List,
    Users,
    Store,
    Share2,
    Maximize2,
    Minimize2,
    Phone,
    Globe,
    Calendar,
    RefreshCw,
    ChevronDown,
    ChevronRight,
    Info,
    MessageCircle,
    Sparkles,
    UserPlus,
    Play,
    Video,
    Home,
    Heart,
    Gift,
    Briefcase,
    GraduationCap,
    Download,
    Layers3,
    FolderInput,
    CheckSquare,
    Square,
    HardDrive,
    SlidersHorizontal
} from "lucide-react";
import { cn, formatEventDate } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
    createEvent,
    createUserProfile,
    getGuestProfile,
    getUserEvents,
    Event,
    Photo,
    deleteEvent,
    updateEvent,
    getEventPhotos,
    getEventPhotosPaginated,
    deletePhoto,
    rotatePhoto,
    getUserTotalStorage,
    getUserEventCount,
    getGuestLogs,
    getEventLogs,
    getSubEvents,
    getEventById,
    getUserById,
    getProfileCard,
    getApprovedSharedEventsForUser,
    saveCoverUsagePhoto,
    deleteCoverUsagePhoto,
    updatePhotosOrder,
    updateSubEventsOrder,
	    getEventFavouritePhotos,
	    toggleEventFavouritePhoto,
	    getFavouritePhotosForEvents,
	    generateEventJoinId,
	    openGallery,
	    movePhotosToGallery,
	    setGalleryHidden,
	    setGalleryVideo,
	    setMediaHidden,
	    mergeHomeMedia,
	getDashboardEventStats,
	type DashboardEventStats,
	} from "@/lib/database";
import { uploadEventImage, validateVideoFile } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { getApiUrl } from "@/lib/apiBase";
import { buildUploaderOptions, fetchUploaderDetails, uploaderOf, type UploaderDetails } from "@/lib/uploaders";
import { Tooltip } from "@/components/Tooltip";
import { navigateWithModifierClick } from "@/lib/navigation";
import { formatStorageSize, getPlanDetails, getUsagePercent } from "@/lib/planLimits";
import { getSubscriptionStatus } from "@/lib/subscriptionStatus";
import { v4 as uuidv4 } from "uuid";


import { Lightbox } from "@/components/ui/Lightbox";
import { alertDialog, choiceDialog, confirmDialog, ModalCloseButton, ModalHeader, modalStyles } from "@/components/ui/Modal";
import { fetchEntireEventZipItems, HOME_DOWNLOAD_DIALOG, toZipItem } from "@/lib/galleryDownload";
const GridMediaCell = ({
    photo,
    gridSrc,
    isVideo,
    shouldBlurMediaForPlan,
    onThumbnailLoaded
}: {
    photo: Photo;
    gridSrc: string;
    isVideo: boolean;
    shouldBlurMediaForPlan: boolean;
    onThumbnailLoaded?: (photoId: string, storageKey: string) => void;
}) => {
    const [loaded, setLoaded] = useState(!!photo.thumbnailUrl);
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        if (photo.thumbnailUrl) {
            setLoaded(true);
            if (onThumbnailLoaded) {
                onThumbnailLoaded(photo.id, photo.storageKey || "");
            }
        }
    }, [photo.thumbnailUrl, onThumbnailLoaded]);

    if (isVideo) {
        return (
            <div className="relative h-full w-full bg-slate-950">
                {photo.thumbnailUrl ? <img src={photo.thumbnailUrl} alt="Video thumbnail" className={cn("h-full w-full object-cover", shouldBlurMediaForPlan && "blur-[1.5px] scale-[1.02]")} /> : (
                <video
                    src={photo.url}
                    className={cn(
                        "h-full w-full object-cover transition-all duration-300",
                        shouldBlurMediaForPlan && "blur-[1.5px] scale-[1.02]"
                    )}
                    muted
                    playsInline
                    preload="metadata"
                />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#D4A770] text-slate-950 shadow-xl shadow-black/40 sm:h-12 sm:w-12">
                        <Play className="ml-0.5 h-5 w-5 fill-current" />
                    </div>
                </div>
                {photo.status === 'processing' && (
                    <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/90 text-slate-950 text-[10px] font-bold shadow-lg backdrop-blur-md">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Processing HLS...</span>
                    </div>
                )}
                {photo.status === 'failed' && (
                    <div 
                        className="absolute top-2 left-2 z-20 flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-600/90 text-white text-[10px] font-bold shadow-lg backdrop-blur-md"
                        title={photo.processingError || "Transcoding failed"}
                    >
                        <span>⚠️ Processing Failed</span>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="h-full w-full relative">
            {!loaded && (
                <div className="absolute inset-0 z-10 h-full w-full animate-pulse bg-slate-800/80 flex flex-col items-center justify-center space-y-1">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                    <span className="text-[8px] uppercase font-bold tracking-widest text-slate-500">Processing</span>
                </div>
            )}
            <img
                src={loaded ? gridSrc : `${photo.url}-thumbnail.webp?retry=${retryCount}`}
                alt="Gallery item"
                className={cn(
                    "w-full h-full object-cover transition-all duration-500 group-hover:scale-105",
                    shouldBlurMediaForPlan && "blur-[1.5px] scale-[1.02]",
                    !loaded && "invisible"
                )}
                onLoad={() => {
                    setLoaded(true);
                    if (onThumbnailLoaded) {
                        onThumbnailLoaded(photo.id, photo.storageKey || "");
                    }
                }}
                onError={() => {
                    if (!photo.thumbnailUrl) {
                        setTimeout(() => {
                            setRetryCount(prev => prev + 1);
                        }, 2500);
                    }
                }}
            />
        </div>
    );
};

import { resolveEventCoverImage } from "@/lib/eventCovers";


const PLACEHOLDER_IMAGES = [
    "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=2071&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1465495910483-34a170a7bb00?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1549413187-0521e7cebcba?q=80&w=2070&auto=format&fit=crop"
];
const DEFAULT_EVENT_COVER_IMAGE = PLACEHOLDER_IMAGES[0];
const FREE_PLAN_VIDEO_LIMIT_BYTES = 200 * 1024 * 1024;
const EVENT_TYPE_OPTIONS = [
    { name: "Wedding", icon: Heart },
    { name: "Birthday", icon: Gift },
    { name: "Anniversary", icon: Sparkles },
    { name: "Corporate", icon: Briefcase },
    { name: "Sports", icon: Play },
    { name: "College", icon: GraduationCap },
    { name: "Other", icon: MoreHorizontal },
];

const TEMPLATE_THEMES = [
    {
        "id": "royal",
        "category": "Wedding",
        "label": "Royal Emerald",
        "desc": "Deep imperial emerald & palace gold",
        "background": {
            "light": "#033026",
            "dark": "#02231c"
        },
        "accent": "#ca9c69"
    },
    {
        "id": "classic",
        "category": "Wedding",
        "label": "Classic White",
        "desc": "Vintage sage & warm silk ivory elegance",
        "background": {
            "light": "#F7F2EB",
            "dark": "#F7F2EB"
        },
        "accent": "#8B9A6E"
    },
    {
        "id": "hero",
        "category": "Wedding",
        "label": "Midnight Hero",
        "desc": "Big impact cinematic dark aesthetic",
        "background": {
            "light": "#000000",
            "dark": "#000000"
        },
        "accent": "#ca9c69"
    },
    {
        "id": "ethereal",
        "category": "Wedding",
        "label": "Ethereal Mist",
        "desc": "Vintage fine-art album & steel blue",
        "background": {
            "light": "#F8FAFC",
            "dark": "#F8FAFC"
        },
        "accent": "#4A6984"
    },
    {
        "id": "scrapbook",
        "category": "Birthday",
        "label": "Playful Scrapbook",
        "desc": "Soft modern keepsake aesthetic",
        "background": {
            "light": "#f8f5f0",
            "dark": "#151c1b"
        },
        "accent": "#d9826b"
    },
    {
        "id": "neon",
        "category": "Birthday",
        "label": "Neon Party",
        "desc": "Premium neon birthday album",
        "background": {
            "light": "#070611",
            "dark": "#070611"
        },
        "accent": "#ff3df2"
    },
    {
        "id": "pastel",
        "category": "Birthday",
        "label": "Pastel Dream",
        "desc": "Dreamy pastel memory journal",
        "background": {
            "light": "#fff7f4",
            "dark": "#fff7f4"
        },
        "accent": "#c9768b"
    },
    {
        "id": "pop",
        "category": "Birthday",
        "label": "Pop Art",
        "desc": "Comic poster birthday album",
        "background": {
            "light": "#ffe84a",
            "dark": "#ffe84a"
        },
        "accent": "#ef2b3a"
    },
    {
        "id": "golden_years",
        "category": "Anniversary",
        "label": "Golden Years",
        "desc": "Rich dark amber & chocolate golden legacy journal",
        "background": {
            "light": "#fbf4e6",
            "dark": "#160f09"
        },
        "accent": "#e5a93c"
    },
    {
        "id": "vintage",
        "category": "Anniversary",
        "label": "Vintage Noir",
        "desc": "Dark archival anniversary journal",
        "background": {
            "light": "#0F0E0B",
            "dark": "#0F0E0B"
        },
        "accent": "#B89145"
    },
    {
        "id": "rose",
        "category": "Anniversary",
        "label": "Rose Garden",
        "desc": "Luxurious velvet burgundy & rose gold editorial journal",
        "background": {
            "light": "#fff9f5",
            "dark": "#280a14"
        },
        "accent": "#d8a47f"
    },
    {
        "id": "minimal_love",
        "category": "Anniversary",
        "label": "Minimal Love",
        "desc": "Minimal romantic dark editorial journal",
        "background": {
            "light": "#f7efe4",
            "dark": "#1f1d1d"
        },
        "accent": "#ff5252"
    },
    {
        "id": "bohemian",
        "category": "Other",
        "label": "Bohemian Rhapsody",
        "desc": "Vintage retro cream & olive green festival theme",
        "background": {
            "light": "#f3e8d3",
            "dark": "#2f1b12"
        },
        "accent": "#73863a"
    },
    {
        "id": "diamond",
        "category": "Other",
        "label": "Diamond Shine",
        "desc": "Cool blues and sparkle",
        "background": {
            "light": "#f0f9ff",
            "dark": "#082f49"
        },
        "accent": "#0284c7"
    },
    {
        "id": "blush",
        "category": "Other",
        "label": "Blush & Bashful",
        "desc": "Velvet burgundy & rose gold luxury editorial journal",
        "background": {
            "light": "#f5dfdb",
            "dark": "#230a12"
        },
        "accent": "#d89c8a"
    },
    {
        "id": "garden",
        "category": "Other",
        "label": "Garden Path",
        "desc": "Misty botanical sage & leaf green natural theme",
        "background": {
            "light": "#e4ebe3",
            "dark": "#3f4f40"
        },
        "accent": "#7a9a6b"
    },
    {
        "id": "midnight_glam",
        "category": "Other",
        "label": "Midnight Glam",
        "desc": "Twilight indigo & deep violet nocturnal theme",
        "background": {
            "light": "#EFEBFB",
            "dark": "#1A1035"
        },
        "accent": "#6B5BBF"
    },
    {
        "id": "cinematic",
        "category": "Other",
        "label": "Cinematic Noir",
        "desc": "Vintage biker & dramatic crimson cinematic theme",
        "background": {
            "light": "#f5f5f5",
            "dark": "#0f0f12"
        },
        "accent": "#e62b3a"
    },
    {
        "id": "modern_lounge",
        "category": "Other",
        "label": "Modern Lounge",
        "desc": "Dark mood blue & sleek steel architecture",
        "background": {
            "light": "#F0F4F8",
            "dark": "#0D1117"
        },
        "accent": "#3D5F8A"
    },
    {
        "id": "elegant_night",
        "category": "Other",
        "label": "Elegant Night",
        "desc": "Sophisticated design",
        "background": {
            "light": "#fafafa",
            "dark": "#111111"
        },
        "accent": "#171717"
    },
    {
        "id": "museum",
        "category": "Corporate",
        "label": "Museum Gallery",
        "desc": "Luxury dark mood blue exhibition",
        "background": {
            "light": "#121820",
            "dark": "#0D1117"
        },
        "accent": "#3D5F8A"
    },
    {
        "id": "brutalist",
        "category": "Corporate",
        "label": "Brutalist Grid",
        "desc": "Modern architectural olive earth grid",
        "background": {
            "light": "#272921",
            "dark": "#171914"
        },
        "accent": "#988B71"
    },
    {
        "id": "tech_sleek",
        "category": "Corporate",
        "label": "Tech Sleek",
        "desc": "Deep ocean navy & electric cyan blue theme",
        "background": {
            "light": "#0a182b",
            "dark": "#040c1a"
        },
        "accent": "#00a2ff"
    },
    {
        "id": "executive",
        "category": "Corporate",
        "label": "Executive Suite",
        "desc": "Professional theme",
        "background": {
            "light": "#08111f",
            "dark": "#08111f"
        },
        "accent": "#d4b474"
    },
    {
        "id": "polaroid",
        "category": "Other",
        "label": "Vintage Polaroid",
        "desc": "Classic photo frames",
        "background": {
            "light": "#f8f3e7",
            "dark": "#1c1917"
        },
        "accent": "#b45309"
    },
    {
        "id": "editorial",
        "category": "Other",
        "label": "Editorial Mag",
        "desc": "Magazine layout style",
        "background": {
            "light": "#fafaf9",
            "dark": "#171717"
        },
        "accent": "#111827"
    },
    {
        "id": "vibrant",
        "category": "Other",
        "label": "Vibrant Energy",
        "desc": "Colorful and dynamic",
        "background": {
            "light": "#f5f3ff",
            "dark": "#4c1d95"
        },
        "accent": "#8b5cf6"
    },
    {
        "id": "zen",
        "category": "Other",
        "label": "Zen Garden",
        "desc": "Calm and peaceful",
        "background": {
            "light": "#f5f5f4",
            "dark": "#1c1917"
        },
        "accent": "#57534e"
    },
    {
        "id": "cyber_tech",
        "category": "College",
        "label": "Cyber Tech",
        "desc": "Neon cyber hackathon & coding terminal",
        "background": {
            "light": "#090d16",
            "dark": "#05070c"
        },
        "accent": "#00f0ff"
    },
    {
        "id": "retro_arcade",
        "category": "College",
        "label": "Retro Arcade",
        "desc": "Bold pop art & funky festival vibe",
        "background": {
            "light": "#ffde4a",
            "dark": "#ffe663"
        },
        "accent": "#ff3562"
    },
    {
        "id": "academic_editorial",
        "category": "College",
        "label": "Academic Editorial",
        "desc": "Clean minimalist journal & campus registry style",
        "background": {
            "light": "#FCFAF7",
            "dark": "#0B0E14"
        },
        "accent": "#800020"
    },
    {
        "id": "neon_carnival",
        "category": "College",
        "label": "Neon Carnival",
        "desc": "Glowing festival lights & concert stage",
        "background": {
            "light": "#0c0714",
            "dark": "#06030a"
        },
        "accent": "#d946ef"
    }
];


const getTemplateCategoryForEventCategory = (category?: string) => {
    if (category === 'Sports') return 'Other';
    return category || 'Wedding';
};

// Hidden from the theme pickers because they have no website design of their own yet
// (templateRegistry.tsx draws them with the generic makeUniversalTemplate layout). They are NOT
// deleted: events already using one keep showing it everywhere. To unhide a theme, remove it from
// this list AND from HIDDEN_TEMPLATE_IDS in apps/mobile/constants/templates.ts (keep both the same).
const HIDDEN_TEMPLATE_IDS = [
    "ethereal", "pastel", "golden_years", "vintage", "rose", "minimal_love", "diamond", "blush",
    "garden", "midnight_glam", "modern_lounge", "elegant_night", "vibrant", "zen", "tech_sleek",
    "executive", "retro_arcade", "academic_editorial", "neon_carnival",
];

const isTemplateHidden = (templateId?: string) => HIDDEN_TEMPLATE_IDS.includes(templateId || "");

// Anniversary has no visible themes of its own, so its picker shows the Wedding themes.
const getPickerTemplateCategoryForEventCategory = (category?: string) => {
    if (category === 'Anniversary') return 'Wedding';
    return getTemplateCategoryForEventCategory(category);
};

// Themes a host can pick for an event of this category (hidden themes left out).
// Pass the event's current theme so a hidden one still shows (first) as the current choice.
const getTemplatesForEventCategory = (category?: string, currentTemplateId?: string) => {
    const templateCategory = getPickerTemplateCategoryForEventCategory(category);
    const templates = TEMPLATE_THEMES.filter((theme) => theme.category === templateCategory && !isTemplateHidden(theme.id));
    const current = isTemplateHidden(currentTemplateId) ? TEMPLATE_THEMES.find((theme) => theme.id === currentTemplateId) : undefined;
    if (current) return [current, ...templates];
    return templates;
};

type EventDetailLog = {
    id: string;
    name?: string;
    phone?: string;
    email?: string;
    status?: string;
    loginAt?: { seconds?: number };
    canAdmin?: boolean;
    canUpload?: boolean;
    canComment?: boolean;
};

// A dropdown for the gallery Filter panel. Its list opens below the button, lined up with the right edge
// (a native <select> list opens wherever the OS puts it).
function FilterDropdown({ value, options, onChange, onOpen, ariaLabel }: {
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
    onOpen?: () => void;
    ariaLabel: string;
}) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const selected = options.find(option => option.value === value) ?? options[0];

    useEffect(() => {
        if (!open) return;
        const closeOnOutsideClick = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        // Escape closes only this list, not the whole Filter panel: catch it before the panel's listener
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") { event.stopPropagation(); setOpen(false); }
        };
        document.addEventListener("pointerdown", closeOnOutsideClick);
        window.addEventListener("keydown", closeOnEscape, true);
        return () => {
            document.removeEventListener("pointerdown", closeOnOutsideClick);
            window.removeEventListener("keydown", closeOnEscape, true);
        };
    }, [open]);

    return (
        <div ref={rootRef} className="relative min-w-0">
            <button
                type="button"
                aria-label={ariaLabel}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => { if (!open) onOpen?.(); setOpen(current => !current); }}
                className="flex h-8 min-w-0 max-w-[11rem] items-center gap-1 rounded-lg border border-slate-600 bg-slate-950 pl-2 pr-1 text-sm font-semibold text-white outline-none focus:border-[#CA9C68] sm:max-w-[14rem]"
            >
                <span className="truncate">{selected?.label}</span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
            </button>
            {open && (
                <div role="listbox" aria-label={ariaLabel} className="absolute right-0 top-full z-40 mt-1 max-h-72 min-w-full w-max max-w-[16rem] overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-1 shadow-2xl shadow-black/60">
                    {options.map(option => {
                        const isSelected = option.value === value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => { onChange(option.value); setOpen(false); }}
                                className={cn(
                                    "flex w-full items-center justify-end gap-2 rounded-lg px-3 py-2 text-right text-sm font-semibold transition-colors",
                                    isSelected ? "bg-[#CA9C68]/15 text-[#E2B77F]" : "text-slate-200 hover:bg-slate-800"
                                )}
                            >
                                <span className="truncate">{option.label}</span>
                                <Check className={cn("h-4 w-4 shrink-0", isSelected ? "text-[#CA9C68]" : "invisible")} />
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

const DATE_PICKER_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DATE_PICKER_ITEM_HEIGHT = 56;

function formatCreateEventDate(date: Date) {
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function createEventSlug(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
}

function DatePickerColumn({
    options,
    selectedValue,
    onSelect,
}: {
    options: Array<{ label: string; value: number }>;
    selectedValue: number;
    onSelect: (value: number) => void;
}) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const settleTimerRef = useRef<number | null>(null);
    const initialSelectedIndexRef = useRef(Math.max(0, options.findIndex(option => option.value === selectedValue)));

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            scrollRef.current?.scrollTo({
                top: initialSelectedIndexRef.current * DATE_PICKER_ITEM_HEIGHT,
                behavior: "auto",
            });
        }, 0);

        return () => window.clearTimeout(timeout);
    }, []);

    useEffect(() => () => {
        if (settleTimerRef.current) {
            window.clearTimeout(settleTimerRef.current);
        }
    }, []);

    return (
        <div className="relative min-w-0 flex-1">
            <div className="pointer-events-none absolute left-0 right-0 top-1/2 z-10 h-14 -translate-y-1/2 border-y border-[#CA9C68]/50" />
            <div
                ref={scrollRef}
                className="max-h-56 touch-pan-y snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-smooth px-1 py-20 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                onScroll={(event) => {
                    if (settleTimerRef.current) {
                        window.clearTimeout(settleTimerRef.current);
                    }

                    const scrollTop = event.currentTarget.scrollTop;
                    settleTimerRef.current = window.setTimeout(() => {
                        const index = Math.max(0, Math.min(options.length - 1, Math.round(scrollTop / DATE_PICKER_ITEM_HEIGHT)));
                        const option = options[index];
                        if (option && option.value !== selectedValue) {
                            onSelect(option.value);
                        }
                    }, 90);
                }}
            >
                {options.map((option) => {
                    const isSelected = option.value === selectedValue;

                    return (
                        <button
                            key={`${option.label}-${option.value}`}
                            type="button"
                            onClick={(event) => {
                                onSelect(option.value);
                                event.currentTarget.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
                            }}
                            className={cn(
                                "flex h-14 w-full snap-center items-center justify-center rounded-xl text-center text-xl font-medium transition-colors",
                                isSelected
                                    ? "font-black text-[#CA9C68]"
                                    : "text-[var(--site-muted)] hover:bg-white/5 hover:text-[var(--site-text)]"
                            )}
                        >
                            {option.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function DashboardContent() {
    const { user, loading, logout } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [view, setView] = useState<"main" | "manage">("main");
    const [manageMode, setManageMode] = useState<"list" | "add-event" | "add-image">("list");
    const [manageLevel, setManageLevel] = useState<"events" | "galleries" | "photos" | "event-details">("events");
    const [selectedMainEvent, setSelectedMainEvent] = useState<Event | null>(null);
    const [viewingPhoto, setViewingPhoto] = useState<any | null>(null);
    const [photoActionItem, setPhotoActionItem] = useState<Photo | null>(null);
    const [videoActionItem, setVideoActionItem] = useState<Photo | null>(null);
    const [thumbnailVideo, setThumbnailVideo] = useState<Photo | null>(null);
    const [galleryViewMode, setGalleryViewMode] = useState<"grid" | "list">("grid");
    const [galleryMediaTab, setGalleryMediaTab] = useState<"photos" | "videos">("photos");
    const [isSelectingMedia, setIsSelectingMedia] = useState(false);
    const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set());
    const [mediaToMove, setMediaToMove] = useState<Photo[] | null>(null);
    const [mediaToSave, setMediaToSave] = useState<Photo[] | null>(null);
    const [showOnlyFavourites, setShowOnlyFavourites] = useState(false);
    // The Filter menu next to the grid/list toggle (Source gallery or Favourites only, Uploaded by, Select)
    const [isGalleryFilterOpen, setIsGalleryFilterOpen] = useState(false);
    const galleryFilterMenuRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!isGalleryFilterOpen) return;
        const closeOnOutsideClick = (event: PointerEvent) => {
            if (!galleryFilterMenuRef.current?.contains(event.target as Node)) setIsGalleryFilterOpen(false);
        };
        const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setIsGalleryFilterOpen(false); };
        document.addEventListener("pointerdown", closeOnOutsideClick);
        document.addEventListener("keydown", closeOnEscape);
        return () => {
            document.removeEventListener("pointerdown", closeOnOutsideClick);
            document.removeEventListener("keydown", closeOnEscape);
        };
    }, [isGalleryFilterOpen]);
    const [sourceGalleryFilter, setSourceGalleryFilter] = useState("all");
    // "Uploaded by" filter: the person's user id, or "all"
    const [uploaderFilter, setUploaderFilter] = useState("all");
    // Names and roles per gallery (a person can be an admin of one event and a guest of another)
    const [uploaderDetails, setUploaderDetails] = useState<Record<string, Record<string, UploaderDetails>>>({});
    const [loadingAllMedia, setLoadingAllMedia] = useState(false);
    const [allMediaLoadedFor, setAllMediaLoadedFor] = useState<string | null>(null);
    const [isDraggingPhotos, setIsDraggingPhotos] = useState(false);
    const [galleryMessageText, setGalleryMessageText] = useState("");
    const [isNavigating, setIsNavigating] = useState(false);
    const [, startTransition] = useTransition();

    // Upload queue, panel and leave warning live in UploadProvider so they survive page changes
    const { uploadQueue, setUploadQueue, uploadControllers, showUploadPanel, onVideosReady } = useUploads();

    // Helper: show loading screen briefly, then navigate
    const navigateTo = (url: string, message?: string) => {
        setIsNavigating(true);
        setTimeout(() => {
            startTransition(() => {
                router.push(url);
            });
            // Hide loading after navigation settles
            setTimeout(() => setIsNavigating(false), 600);
        }, 400);
    };

    const goBackOr = (fallbackUrl: string) => {
        if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
            return;
        }

        router.push(fallbackUrl);
    };

    // Data State
    const [userEvents, setUserEvents] = useState<Event[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [activeTab, setActiveTab] = useState<'hosted' | 'shared' | 'request'>('hosted');
    const [sharedEvents, setSharedEvents] = useState<Event[]>([]);
    const [consoleEventStats, setConsoleEventStats] = useState<Record<string, DashboardEventStats>>({});
    // Guest counts for the Host / Shared cards; they load after the cards, like on the dashboard
    const consoleEventIdsKey = [...userEvents, ...sharedEvents].map((event) => event.id).join(",");
    useEffect(() => {
        if (!consoleEventIdsKey) return;
        let cancelled = false;
        getDashboardEventStats(consoleEventIdsKey.split(","))
            .then((stats) => { if (!cancelled) setConsoleEventStats(stats); })
            .catch((err) => console.error("Error fetching host card stats:", err));
        return () => { cancelled = true; };
    }, [consoleEventIdsKey]);
    const [currentEventPhotos, setCurrentEventPhotos] = useState<Photo[]>([]);
    const [currentEventMediaCounts, setCurrentEventMediaCounts] = useState({ photos: 0, videos: 0 });
    const [currentEventRetainedMediaIds, setCurrentEventRetainedMediaIds] = useState<Set<string>>(new Set());
    const [eventFavouritePhotoIds, setEventFavouritePhotoIds] = useState<Set<string>>(new Set());
    const [eventFavouritePreview, setEventFavouritePreview] = useState<Photo | null>(null);
    const [eventFavouriteCount, setEventFavouriteCount] = useState(0);
    const [loadingPhotos, setLoadingPhotos] = useState(false);
    const [photoPage, setPhotoPage] = useState(0);
    const [hasMorePhotos, setHasMorePhotos] = useState(false);

    const [isHostZipping, setIsHostZipping] = useState(false);
    const [hostZipProgress, setHostZipProgress] = useState(0);

    const handleHostDownloadZip = async () => {
        if (!selectedEventId || !currentEventPhotos || currentEventPhotos.length === 0) {
            void alertDialog({ title: "Nothing to download", message: "No photos or videos to download in this gallery." });
            return;
        }
        // On Home, ask: just what Home shows (with the filters), or the whole event (every gallery, no filters)
        const choice = isPrimaryGalleryView && selectedMainEvent ? await choiceDialog(HOME_DOWNLOAD_DIALOG) : "home";
        if (!choice) return;
        setIsHostZipping(true);
        setHostZipProgress(0);
        try {
            if (choice === "event" && selectedMainEvent) {
                const items = await fetchEntireEventZipItems(selectedMainEvent, eventDetailGalleries, { includeHidden: true });
                if (items.length === 0) {
                    void alertDialog({ title: "Nothing to download", message: "No photos or videos in this event yet." });
                    return;
                }
                const result = await downloadGalleryAsZip(selectedMainEvent.title || "Event", items, (percent) => setHostZipProgress(percent));
                if (result.failed > 0) {
                    void alertDialog({ title: "Some files were skipped", message: `${result.failed} of ${result.total} files couldn't be downloaded and aren't in the ZIP. Please try again.` });
                }
                return;
            }
            // What's shown, from the whole gallery rather than just the pages loaded on screen (the primary gallery's
            // favourites view is already complete): the Photos / Videos tab, then Source gallery, Favourites only and
            // Uploaded by, the same steps as the grid. Uploads in progress and unfinished videos are left out, as on screen.
            // Keeps what's loaded (on Home that includes the favourites) and adds the rest of the gallery's own media
            const all = hasMorePhotos ? mergeHomeMedia(currentEventPhotos, await fetchAllEventMedia(selectedEventId)) : currentEventPhotos;
            const isVideo = (p: Photo) => p.mediaType === "video" || p.resourceType === "video";
            let media = all.filter(p => galleryMediaTab === "videos" ? isVideo(p) && p.status === "processed" : !isVideo(p) && p.status !== "uploading");
            if (isPrimaryGalleryView && effectiveSourceGalleryFilter !== "all") {
                const source = sourceGalleryOptions.find(option => option.id === effectiveSourceGalleryFilter);
                media = media.filter(p => p.eventId === source?.id || (!!source?.legacyId && p.eventId === source.legacyId));
            }
            if (isFavouriteFilterActive) media = media.filter(p => eventFavouritePhotoIds.has(p.id));
            if (isUploaderFilterActive) media = media.filter(p => uploaderOf(p) === effectiveUploaderFilter);
            if (media.length === 0) {
                void alertDialog({ title: "Nothing to download", message: `No ${galleryMediaTab === "videos" ? "videos" : "photos"} to download with the current filters.` });
                return;
            }
            const result = await downloadGalleryAsZip(
                selectedEventName || "Gallery",
                media.map(p => toZipItem(p)),
                (percent) => setHostZipProgress(percent)
            );
            if (result.failed > 0) {
                void alertDialog({ title: "Some files were skipped", message: `${result.failed} of ${result.total} files couldn't be downloaded and aren't in the ZIP. Please try again.` });
            }
        } catch (err: any) {
            void alertDialog({ title: "Download failed", message: err.message || "Failed to generate zip file." });
        } finally {
            setIsHostZipping(false);
            setHostZipProgress(0);
        }
    };

    // Refs to keep track of currentEventPhotos and uploadQueue to avoid stale closure bugs in Supabase Realtime callbacks
    const currentEventPhotosRef = useRef<Photo[]>([]);
    const uploadQueueRef = useRef<UploadQueueItem[]>([]);

    useEffect(() => {
        currentEventPhotosRef.current = currentEventPhotos;
    }, [currentEventPhotos]);

    useEffect(() => {
        uploadQueueRef.current = uploadQueue;
    }, [uploadQueue]);

    const handleThumbnailLoaded = useCallback((photoId: string, storageKey: string) => {
        setUploadQueue(prev => prev.map(qItem =>
            (qItem.photoId === photoId || qItem.storageKey === storageKey) && qItem.mediaType !== "video" && qItem.status !== "success"
                ? { ...qItem, status: "success", progress: 100 }
                : qItem
        ));
    }, []);
    const [totalStorage, setTotalStorage] = useState<number>(0);
    const [totalMainEvents, setTotalMainEvents] = useState<number>(0);
    const [workspaceOwner, setWorkspaceOwner] = useState<any | null>(null);
    const [eventOwners, setEventOwners] = useState<Record<string, { email?: string; name?: string; username?: string }>>({});
    const [activeEventDetailTab, setActiveEventDetailTab] = useState<"galleries" | "permissions" | "design" | "partners">("galleries");
    const [eventDetailGalleries, setEventDetailGalleries] = useState<Event[]>([]);
    const [eventDetailLogs, setEventDetailLogs] = useState<EventDetailLog[]>([]);
    const [loadingEventDetail, setLoadingEventDetail] = useState(false);
    const [selectedGuestLog, setSelectedGuestLog] = useState<EventDetailLog | null>(null);
    const [selectedGuestProfile, setSelectedGuestProfile] = useState<any | null>(null);
    const [loadingGuestProfile, setLoadingGuestProfile] = useState(false);

    // Guest requests (Requests tab)
    const [trafficLogs, setTrafficLogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [selectedLogEventId, setSelectedLogEventId] = useState<string>("all");
    const [selectedUserToAssign, setSelectedUserToAssign] = useState<string>("");
    const [assignedEventsForSelect, setAssignedEventsForSelect] = useState<string[]>([]);

    // Form State
    const [eventName, setEventName] = useState("");
    const [eventDate, setEventDate] = useState(() => formatCreateEventDate(new Date()));
    const [selectedEventId, setSelectedEventId] = useState("");
    const selectedEventIdRef = useRef(selectedEventId);
    useEffect(() => { selectedEventIdRef.current = selectedEventId; }, [selectedEventId]);
    // Look up names and roles of this gallery's uploaders once more than one person has uploaded
    const uploaderIdsKey = Array.from(new Set(currentEventPhotos.map(uploaderOf))).sort().join(",");
    useEffect(() => {
        const ids = uploaderIdsKey ? uploaderIdsKey.split(",") : [];
        if (!selectedEventId || ids.length < 2) return;
        let active = true;
        void fetchUploaderDetails(selectedEventId, ids)
            .then(details => { if (active) setUploaderDetails(prev => ({ ...prev, [selectedEventId]: { ...prev[selectedEventId], ...details } })); })
            .catch(error => console.warn("[Dashboard] Could not load uploader names:", error));
        return () => { active = false; };
    }, [selectedEventId, uploaderIdsKey]);
    useEffect(() => {
        setIsSelectingMedia(false);
        setSelectedMediaIds(new Set());
    }, [selectedEventId, galleryMediaTab]);
    const [videoUploadPermission, setVideoUploadPermission] = useState({ eventId: '', userId: '', allowed: false });
    const canPostVideos = videoUploadPermission.eventId === selectedEventId && videoUploadPermission.userId === user?.uid && videoUploadPermission.allowed;
    useEffect(() => {
        let active = true;
        if (!selectedEventId || !user?.uid) return;
        const eventId = selectedEventId, userId = user.uid;
        void (async () => {
            const { data } = await supabase.auth.getSession();
            if (!data.session) return;
            const response = await fetch(getApiUrl(`/api/media/video-upload-permission?eventId=${encodeURIComponent(eventId)}`), { headers: { Authorization: `Bearer ${data.session.access_token}` } });
            const result = await response.json();
            if (active) setVideoUploadPermission({ eventId, userId, allowed: response.ok && result.allowed === true });
        })().catch(() => { if (active) setVideoUploadPermission({ eventId, userId, allowed: false }); });
        return () => { active = false; };
    }, [selectedEventId, user?.uid]);

    const [selectedEventName, setSelectedEventName] = useState("");
    const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
    const [message, setMessage] = useState("");
    const isCoverUpdating = status === "uploading" && message.toLowerCase().includes("cover");
    const [showDatePickerModal, setShowDatePickerModal] = useState(false);
    const [datePickerTarget, setDatePickerTarget] = useState<"rename" | "create">("rename");
    const [datePickerValue, setDatePickerValue] = useState(() => {
        const today = new Date();
        return { month: today.getMonth(), day: today.getDate(), year: today.getFullYear() };
    });

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isCreateSubGalleryModalOpen, setIsCreateSubGalleryModalOpen] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showCreateSuccessModal, setShowCreateSuccessModal] = useState(false);
    const [eventType, setEventType] = useState("Wedding");
    const [coverPositionEvent, setCoverPositionEvent] = useState<Event | null>(null);
    const [coverDraft, setCoverDraft] = useState({ coverOffset: 0, coverOffsetX: 0, coverScale: 1 });
    const coverPreviewRef = useRef<HTMLDivElement | null>(null);
    const coverDragStartRef = useRef<{
        pointerId: number;
        startX: number;
        startY: number;
        coverOffset: number;
        coverOffsetX: number;
    } | null>(null);

    // Event Management State
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [renamingEvent, setRenamingEvent] = useState<Event | null>(null);
    const [editDetailsMode, setEditDetailsMode] = useState<"title" | "date">("title");
    const [shareModalEvent, setShareModalEvent] = useState<Event | null>(null);

    const [showPlanDetailsModal, setShowPlanDetailsModal] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newDate, setNewDate] = useState("");
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [showDeleteSuccessType, setShowDeleteSuccessType] = useState<"event" | "gallery" | null>(null);
    const selectedMainEventId = selectedMainEvent?.id;
    const selectedMainEventLegacyId = selectedMainEvent?.legacyId;
    // Public/private switch on the Permissions tab: the owner, plus anyone can_manage_event_visibility allows.
    // The owner already gets the switch, so only ask the database for other people (as the app does).
    const [visibilityAdminEventId, setVisibilityAdminEventId] = useState('');
    const selectedMainEventIsOwn = !!selectedMainEvent && (selectedMainEvent.createdBy === user?.uid || selectedMainEvent.createdBy === user?.email);
    // A gallery's management screen opens from its link, so ask the database whether this person manages it (owner,
    // guest admin or platform admin). Someone who isn't (or lost guest-admin rights while the page was open) goes back
    // to their dashboard instead of seeing controls the server refuses.
    const recheckManageAccess = useCallback(async (eventId: string | undefined) => {
        if (!eventId) return;
        try {
            const opened = await openGallery(eventId);
            if (opened.access === "manage") return;
            setSelectedMainEvent(previous => previous?.id === eventId ? null : previous);
            setMessage("You don't manage this gallery.");
            setStatus("error");
            setTimeout(() => { setStatus("idle"); setMessage(""); }, 4000);
            router.replace("/host");
        } catch (error) {
            console.warn("[Host] Could not check gallery access:", error);
        }
    }, [router]);
    useEffect(() => {
        if (!selectedMainEventId || !user?.uid || selectedMainEventIsOwn) return;
        void recheckManageAccess(selectedMainEventId);
    }, [selectedMainEventId, selectedMainEventIsOwn, user?.uid, recheckManageAccess]);
    useEffect(() => {
        let active = true;
        setVisibilityAdminEventId('');
        if (!selectedMainEventId || selectedMainEvent?.parentId || selectedMainEventIsOwn) return;
        void Promise.resolve(supabase.rpc('can_manage_event_visibility', { p_event_id: selectedMainEventId })).then(({ data, error }) => {
            if (active && !error && data === true) setVisibilityAdminEventId(selectedMainEventId);
        }).catch(() => {});
        return () => { active = false; };
    }, [selectedMainEventId, selectedMainEvent?.parentId, selectedMainEventIsOwn, user?.uid]);
    const [savingVisibility, setSavingVisibility] = useState(false);
    const [visibilityError, setVisibilityError] = useState("");
    const canChangeSelectedEventVisibility = !!selectedMainEvent && !selectedMainEvent.parentId && (
        selectedMainEvent.createdBy === user?.uid ||
        selectedMainEvent.createdBy === user?.email ||
        visibilityAdminEventId === selectedMainEvent.id
    );
    const changeEventVisibility = async (isPublic: boolean) => {
        if (!selectedMainEvent || savingVisibility) return;
        if (isPublic && !(await confirmDialog({ title: "Make event public?", message: "Anyone with the link will be able to view this event and its sub-galleries without approval.", confirmLabel: "Make public" }))) return;
        const eventId = selectedMainEvent.id;
        setSavingVisibility(true); setVisibilityError("");
        try {
            const { error } = await supabase.rpc("set_event_public_viewing", { event_id: eventId, public_viewing: isPublic });
            if (error) throw error;
            setSelectedMainEvent(previous => previous?.id === eventId ? { ...previous, isPublic } : previous);
            setShareModalEvent(previous => previous?.id === eventId ? { ...previous, isPublic } : previous);
            setUserEvents(previous => previous.map(item => item.id === eventId ? { ...item, isPublic } : item));
            setSharedEvents(previous => previous.map(item => item.id === eventId ? { ...item, isPublic } : item));
        } catch (error: any) {
            setVisibilityError(error.message || "Unable to change event visibility");
        } finally { setSavingVisibility(false); }
    };

    // Template Selection State
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [templateTargetEvent, setTemplateTargetEvent] = useState<Event | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState("hero");

    useEffect(() => {
        // Allow all logged in users to access the dashboard
        // Plan roles: free (default), basic, standard, premium, elite, admin
        const isAuthorized = !!user;

        if (!loading && user && !isAuthorized) {
            router.push("/profile");
        }
    }, [user, loading, router]);

    // Videos the shared upload queue sees finish processing show up in this event's grid
    useEffect(() => onVideosReady(records => {
        const ready = records.filter(row => row.event_id === selectedEventId);
        if (ready.length) setCurrentEventPhotos(previous => {
            const updates = ready.map(row => ({
                id: row.id, eventId: row.event_id, storageKey: row.storage_key,
                url: row.url, thumbnailUrl: row.thumbnail_url, width: row.width, height: row.height,
                mediaType: "video" as const, resourceType: "video" as const, status: "processed" as const,
                uploadedAt: row.uploaded_at, size: row.size, tags: row.tags || [], userId: row.user_id,
            }));
            const updatedIds = new Set(updates.map(row => row.id));
            return [...updates, ...previous.filter(row => !updatedIds.has(row.id))];
        });
    }), [onVideosReady, selectedEventId]);

    // URL State Synchronization
    useEffect(() => {
        const viewParam = searchParams.get("view");
        const levelParam = searchParams.get("level");
        const modeParam = searchParams.get("mode");
        const eventIdParam = searchParams.get("eventId");
        const galleryIdParam = searchParams.get("galleryId");

        // 1. View State
        if (viewParam === "manage") {
            setView(viewParam as any);
        } else {
            setView("main");
        }

        // 2. Manage Level
        if (levelParam === "galleries" || levelParam === "photos" || levelParam === "event-details") {
            setManageLevel(levelParam as any);
        } else {
            setManageLevel("events");
        }

        // 3. Manage Mode
        if (modeParam === "add-event" || modeParam === "add-image") {
            setManageMode(modeParam as any);
        } else {
            setManageMode("list");
        }

        // 4. Selected Event (for generic ID lookups)
        if (eventIdParam) {
            // Find in loaded events (may need to be robust if events aren't loaded yet)
            // We'll trust fetchUserEvents to handle data loading, this just sets the ID.
            const targetEvent = userEvents.find(e => e.id === eventIdParam);
            if (targetEvent) {
                if (levelParam === "event-details" && modeParam === "add-image" && galleryIdParam) {
                    const targetGallery = userEvents.find(e => e.id === galleryIdParam) || eventDetailGalleries.find(e => e.id === galleryIdParam);
                    setSelectedEventId(galleryIdParam);
                    setSelectedEventName(targetGallery?.title || (galleryIdParam === targetEvent.id ? targetEvent.title : "Gallery"));
                    setGalleryMessageText(targetGallery?.description || "");
                    setSelectedMainEvent(targetEvent);
                    return;
                }

                // Always set the selected event ID if we're in add-image mode or specifically on photos level
                if (levelParam === "photos" || modeParam === "add-image") {
                    setSelectedEventId(targetEvent.id);
                    setSelectedEventName(targetEvent.title);
                }

                if (levelParam === "galleries" || levelParam === "event-details") {
                    setSelectedMainEvent(targetEvent);
                } else if (levelParam === "photos") {
                    // If it's a sub-event, we also need to set the Main Event parent
                    if (targetEvent.parentId) {
                        const parent = userEvents.find(e => e.id === targetEvent.parentId);
                        if (parent) setSelectedMainEvent(parent);
                    }
                }
            } else if (levelParam === "event-details" && modeParam === "add-image" && galleryIdParam) {
                // Not in this list: events shared with you as an admin (only your own events are), or your events
                // haven't loaded yet. Still open the gallery the link names, not the event's primary gallery.
                const targetGallery = eventDetailGalleries.find(e => e.id === galleryIdParam)
                    || (selectedMainEvent?.id === galleryIdParam ? selectedMainEvent : undefined);
                setSelectedEventId(galleryIdParam);
                if (targetGallery) {
                    setSelectedEventName(targetGallery.title || "Gallery");
                    setGalleryMessageText(targetGallery.description || "");
                }
            } else {
                // Events aren't loaded yet (or it's an event shared with you): the ID alone is enough for fetching
                setSelectedEventId(eventIdParam);
            }
        } else if (!eventIdParam) {
            setSelectedEventId("");
            setSelectedMainEvent(null);
        }
    }, [searchParams, userEvents, eventDetailGalleries, selectedMainEvent]);

    useEffect(() => {
        const levelParam = searchParams.get("level");
        const eventIdParam = searchParams.get("eventId");
        const shouldRestoreMainEvent = eventIdParam && (levelParam === "event-details" || levelParam === "galleries");

        if (!user?.uid || !shouldRestoreMainEvent || selectedMainEvent?.id === eventIdParam) return;

        const cachedEvent = userEvents.find(event => event.id === eventIdParam);
        if (cachedEvent) {
            setSelectedMainEvent(cachedEvent);
            return;
        }

        let isMounted = true;

        const restoreSelectedMainEvent = async () => {
            setLoadingEventDetail(true);
            try {
                const event = await getEventById(eventIdParam);
                if (isMounted && event) {
                    setSelectedMainEvent(event);
                }
            } catch (error) {
                console.error("Error restoring selected event from URL:", error);
            } finally {
                if (isMounted) setLoadingEventDetail(false);
            }
        };

        restoreSelectedMainEvent();

        return () => {
            isMounted = false;
        };
    }, [searchParams, selectedMainEvent?.id, user?.uid, userEvents]);


    // 1. Fetch main/sub events and storage stats when in "manage" view and relevant navigation items change
    // 1. Fetch main/sub events and storage stats when in "main" or "manage" view
    useEffect(() => {
        if (user && user.uid && (view === "main" || view === "manage")) {
            fetchUserEvents();
            fetchStorageStats();
        }
    }, [user?.uid, view, manageLevel, selectedMainEvent?.id]);

    useEffect(() => {
        if (selectedEventId && (manageMode === "add-image" || manageLevel === "photos" || (manageLevel === "event-details" && activeEventDetailTab === "galleries"))) {
            fetchEventPhotos();
        }
    }, [selectedEventId, manageMode, manageLevel, activeEventDetailTab]);

    useEffect(() => {
        if (selectedMainEventId) {
            void refreshEventFavourites(selectedMainEventId);
        } else {
            setEventFavouritePhotoIds(new Set());
            setEventFavouritePreview(null);
            setEventFavouriteCount(0);
        }
    }, [selectedMainEventId]);

    useEffect(() => {
        if (!selectedMainEventId || manageLevel !== "event-details") return;

        let isMounted = true;

        const fetchEventDetailSections = async () => {
            setLoadingEventDetail(true);
            try {
                const [galleries, logs] = await Promise.all([
                    getSubEvents(selectedMainEventId, selectedMainEventLegacyId),
                    getEventLogs(selectedMainEventId),
                ]);

                if (!isMounted) return;

                setEventDetailGalleries(galleries.sort((a, b) => (a.title || "").localeCompare(b.title || "", undefined, { numeric: true, sensitivity: "base" })));
                setEventDetailLogs(logs);
            } catch (error) {
                console.error("Error loading event detail sections:", error);
                if (isMounted) {
                    setEventDetailGalleries([]);
                    setEventDetailLogs([]);
                }
            } finally {
                if (isMounted) setLoadingEventDetail(false);
            }
        };

        setActiveEventDetailTab("galleries");
        fetchEventDetailSections();

        return () => {
            isMounted = false;
        };
    }, [selectedMainEventId, selectedMainEventLegacyId, manageLevel]);

    const compressImage = async (file: File): Promise<File> => {
        // Only compress if larger than 5MB
        if (file.size < 5 * 1024 * 1024) return file;

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;

                // Max dimension 2500px for web display
                const MAX_DIM = 2500;
                if (width > height) {
                    if (width > MAX_DIM) {
                        height *= MAX_DIM / width;
                        width = MAX_DIM;
                    }
                } else {
                    if (height > MAX_DIM) {
                        width *= MAX_DIM / height;
                        height = MAX_DIM;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx?.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(new File([blob], file.name, { type: "image/jpeg" }));
                        } else {
                            resolve(file);
                        }
                    },
                    "image/jpeg",
                    0.85 // High quality but significantly smaller filesize
                );
                URL.revokeObjectURL(img.src);
            };
            img.onerror = (err) => reject(err);
        });
    };

    const fetchUserEvents = async () => {
        if (!user || !user.uid) return;
        setLoadingEvents(true);
        const type = (view === "main" || manageLevel === "events" || manageLevel === "event-details") ? "main" : "sub";
        const parentId = (view === "manage" && (manageLevel === "galleries" || manageLevel === "photos")) ? selectedMainEvent?.id : undefined;

        // Own events are always visible. Delegated owner events are scoped by roleType below.
        const ownIdentifiers = [user.uid];
        if (user.email) ownIdentifiers.push(user.email);

        const ownerIdentifiers: string[] = [];
        if (user.delegatedBy) ownerIdentifiers.push(user.delegatedBy);
        if (workspaceOwner?.email) ownerIdentifiers.push(workspaceOwner.email);

        const identifiers = user.delegatedBy
            ? [...ownIdentifiers, ...ownerIdentifiers]
            : ownIdentifiers;

        if (type === "sub" && parentId) {
            // ... existing complex sub-event logic ...
            const byRelationship = await getSubEvents(parentId, selectedMainEvent?.legacyId);
            const byIdentity = await getUserEvents(identifiers, type, parentId, selectedMainEvent?.legacyId);
            const combined = [...byRelationship];
            byIdentity.forEach(evt => {
                if (!combined.some(e => e.id === evt.id)) {
                    combined.push(evt);
                }
            });

            const sorted = combined.sort((a, b) => (a.title || "").localeCompare(b.title || "", undefined, { numeric: true, sensitivity: "base" }));

            // Event managers only see events explicitly assigned to them.
            if (user.roleType === 'event') {
                const assignedEvents = user.assignedEvents || [];
                setUserEvents(sorted.filter(e =>
                    (e.createdBy && ownIdentifiers.includes(e.createdBy)) ||
                    assignedEvents.includes(e.id) ||
                    e.parentId === parentId
                ));
            } else {
                setUserEvents(sorted);
            }
        } else {
            // Root level: Fetch by identity pool
            const events = await getUserEvents(identifiers, type, parentId, selectedMainEvent?.legacyId);
            if (view === "main") {
                const [approvedSharedEvents, logs] = await Promise.all([
                    getApprovedSharedEventsForUser(ownIdentifiers, true),
                    getGuestLogs(identifiers),
                ]);
                setSharedEvents(approvedSharedEvents.sort((a, b) => (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0)));
                setTrafficLogs(logs);
            }
            const combinedEvents = [...events];

            if (user.roleType === 'event') {
                const assignedEvents = user.assignedEvents || [];
                const assignedEventDocs = await Promise.all(
                    assignedEvents.map(eventId => getEventById(eventId))
                );

                assignedEventDocs.forEach(eventDoc => {
                    if (eventDoc && !combinedEvents.some(existing => existing.id === eventDoc.id)) {
                        combinedEvents.push(eventDoc);
                    }
                });
            }

            // Event managers only see events explicitly assigned to them.
            if (user.roleType === 'event') {
                const assignedEvents = user.assignedEvents || [];
                setUserEvents(combinedEvents.filter(e =>
                    (e.createdBy && ownIdentifiers.includes(e.createdBy)) ||
                    assignedEvents.includes(e.id)
                ));
            } else {
                setUserEvents(combinedEvents);
            }
        }
        setLoadingEvents(false);
    };

    const fetchEventPhotos = async () => {
        if (!selectedEventId) return;

        let currentEvent = userEvents.find(e => e.id === selectedEventId);

        // Robust fetch: Ensure we have the full event object (especially legacyId and createdBy)
        // If we don't have it or it's missing the legacyId (common for migrated events in the list pool)
        // we fetch it deeply from Supabase database.
        if (!currentEvent || (!currentEvent.legacyId && selectedEventId.includes("-"))) {
            try {
                const fetched = await getEventById(selectedEventId);
                if (fetched) currentEvent = fetched;
            } catch (err) {
                console.error("[Dashboard] Error fetching event details for photos:", err);
            }
        }

        setLoadingPhotos(true);
        try {
            if (selectedEventId === selectedMainEventId) {
                const groupEventIds = Array.from(new Set([
                    selectedMainEventId,
                    selectedMainEventLegacyId,
                    currentEvent?.legacyId,
                    ...eventDetailGalleries.flatMap(g => [g.id, g.legacyId]),
                ].filter(Boolean) as string[]));
                // Home (Primary Gallery): the favourites first, then what was uploaded to Home itself (pages of 20)
                const favPhotos = groupEventIds.length > 0 ? await getFavouritePhotosForEvents(groupEventIds, { includeHidden: true }) : [];
                const own = await getEventPhotosPaginated(selectedEventId, currentEvent?.legacyId, 0, 20, { includeHidden: true });
                const favouriteIds = favPhotos.map(p => p.id).filter(Boolean);
                const homeIds = new Set([selectedEventId, currentEvent?.legacyId].filter(Boolean) as string[]);
                // Home uploads that are also favourites are counted once
                const extraFavourites = favPhotos.filter(p => !homeIds.has(p.eventId));
                const isVideoItem = (p: Photo) => p.mediaType === "video" || p.resourceType === "video";
                setCurrentEventPhotos(mergeHomeMedia(favPhotos as Photo[], own.photos as Photo[]));
                setCurrentEventMediaCounts({
                    photos: own.totalPhotos + extraFavourites.filter(p => !isVideoItem(p)).length,
                    videos: own.totalVideos + extraFavourites.filter(isVideoItem).length,
                });
                setCurrentEventRetainedMediaIds(new Set([...favouriteIds, ...own.retainedMediaIds]));
                setEventFavouritePhotoIds(new Set(favouriteIds));
                setEventFavouriteCount(favouriteIds.length);
                setEventFavouritePreview((favPhotos[0] || null) as Photo | null);
                setPhotoPage(0);
                setHasMorePhotos(own.hasMore);
                return;
            }

            const legacyId = currentEvent?.legacyId;
            const { photos, hasMore, totalPhotos, totalVideos, retainedMediaIds } = await getEventPhotosPaginated(selectedEventId, legacyId, 0, 20, { includeHidden: true });

            setCurrentEventPhotos(photos as Photo[]);
            setCurrentEventMediaCounts({ photos: totalPhotos, videos: totalVideos });
            setCurrentEventRetainedMediaIds(new Set(retainedMediaIds));
            setPhotoPage(0);
            setHasMorePhotos(hasMore);
        } catch (error) {
            console.error("[Dashboard] fetchEventPhotos Error:", error);
            setStatus("error");
            setMessage("Failed to load photos.");
        } finally {
            setLoadingPhotos(false);
        }
    };

    const refreshEventFavourites = async (eventId = selectedMainEventId) => {
        if (!eventId) {
            setEventFavouritePhotoIds(new Set());
            setEventFavouritePreview(null);
            setEventFavouriteCount(0);
            return;
        }

        try {
            const favouriteRows = await getEventFavouritePhotos(eventId);
            setEventFavouritePhotoIds(new Set(favouriteRows.map(row => row.photoId)));
            setEventFavouriteCount(favouriteRows.length);

            if (favouriteRows.length > 0) {
                const favouritePhotos = await getFavouritePhotosForEvents([eventId], { includeHidden: true });
                setEventFavouritePreview(favouritePhotos[0] || null);
            } else {
                setEventFavouritePreview(null);
            }
        } catch (error) {
            console.error("Error refreshing event favourites:", error);
            setEventFavouritePhotoIds(new Set());
            setEventFavouritePreview(null);
            setEventFavouriteCount(0);
        }
    };

    const loadMorePhotos = async () => {
        if (!selectedEventId || loadingPhotos || !hasMorePhotos) return;
        setLoadingPhotos(true);
        try {
            let currentEvent = userEvents.find(e => e.id === selectedEventId);
            if (!currentEvent || (!currentEvent.legacyId && selectedEventId.includes("-"))) {
                try {
                    const fetched = await getEventById(selectedEventId);
                    if (fetched) currentEvent = fetched;
                } catch (err) {}
            }
            const legacyId = currentEvent?.legacyId;
            const nextPage = photoPage + 1;
            const { photos, hasMore, totalPhotos, totalVideos, retainedMediaIds } = await getEventPhotosPaginated(selectedEventId, legacyId, nextPage, 20, { includeHidden: true });
            // Each item once (Home lists its favourites first, and pages can share an item at their edges)
            setCurrentEventPhotos(prev => mergeHomeMedia(prev, photos as Photo[]));
            setCurrentEventMediaCounts({ photos: totalPhotos, videos: totalVideos });
            setCurrentEventRetainedMediaIds(new Set(retainedMediaIds));
            setPhotoPage(nextPage);
            setHasMorePhotos(hasMore);
        } catch (error) {
            console.error("[Dashboard] loadMorePhotos Error:", error);
        } finally {
            setLoadingPhotos(false);
        }
    };

    // The "Uploaded by" filter needs the whole gallery, not just the pages loaded so far. Only the media rows are
    // loaded here; images still load lazily as they scroll into view.
    /** Every media row of a gallery, page by page (media rows only, no images). */
    const fetchAllEventMedia = async (eventId: string): Promise<Photo[]> => {
        let currentEvent = userEvents.find(e => e.id === eventId) || eventDetailGalleries.find(e => e.id === eventId);
        if (!currentEvent || (!currentEvent.legacyId && eventId.includes("-"))) {
            currentEvent = (await getEventById(eventId).catch(() => null)) || currentEvent;
        }
        const all: Photo[] = [];
        for (let page = 0, more = true; more; page += 1) {
            const result = await getEventPhotosPaginated(eventId, currentEvent?.legacyId, page, 200, { includeHidden: true });
            all.push(...(result.photos as Photo[]));
            more = result.hasMore;
        }
        // Pages can share an item at their edges
        const seen = new Set<string>();
        return all.filter(photo => !seen.has(photo.id) && seen.add(photo.id));
    };

    const loadAllEventPhotos = async () => {
        const eventId = selectedEventId;
        if (!eventId || !hasMorePhotos || loadingAllMedia) return;
        setLoadingAllMedia(true);
        try {
            const all = await fetchAllEventMedia(eventId);
            if (selectedEventIdRef.current !== eventId) return;
            // Keeps what's loaded (on Home that includes the favourites) and adds the rest
            setCurrentEventPhotos(prev => mergeHomeMedia(prev, all));
            setHasMorePhotos(false);
            setAllMediaLoadedFor(eventId);
        } catch (error) {
            console.error("[Dashboard] loadAllEventPhotos Error:", error);
            setMessage("Couldn't load the whole gallery for this filter. Please try again.");
            setStatus("error");
            setTimeout(() => { setStatus("idle"); setMessage(""); }, 3000);
        } finally {
            setLoadingAllMedia(false);
        }
    };

    const fetchStorageStats = React.useCallback(async () => {
        if (!user) return;

        // Identity Pool for storage calculation (accounts for both UID and Email tags)
        const identifiers = [user.uid];
        if (user.email) identifiers.push(user.email);
        if (user.phone) identifiers.push(user.phone);

        const [total, eventCount] = await Promise.all([
            getUserTotalStorage(identifiers),
            getUserEventCount(user.uid),
        ]);
        setTotalStorage(total);
        setTotalMainEvents(eventCount);
    }, [user]);

    useEffect(() => {
        if (!user?.uid) return;

        const identifiers = [user.uid, user.email, user.phone].filter(Boolean) as string[];
        const channels = identifiers.map((identifier) =>
            supabase
                .channel(`host-storage-${identifier}-${Math.random().toString(36).slice(2, 8)}`)
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'photos', filter: `user_id=eq.${identifier}` },
                    () => fetchStorageStats()
                )
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'events', filter: `created_by=eq.${identifier}` },
                    () => fetchStorageStats()
                )
                .subscribe()
        );

        return () => {
            channels.forEach((channel) => supabase.removeChannel(channel));
        };
    }, [user?.uid, user?.email, user?.phone, fetchStorageStats]);

    // Real-time photo grid updates for host dashboard (syncs thumbnail resolving in real time)
    useEffect(() => {
        if (!selectedEventId) return;

        console.log(`[Dashboard Realtime] Subscribing to photos for event: ${selectedEventId}`);
        const channel = supabase
            .channel(`host-photos-event-${selectedEventId}-${Math.random().toString(36).slice(2, 8)}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'photos' },
                (payload) => {
                    console.log(`[Dashboard Realtime] Received DB change:`, payload);

                    if (payload.eventType === 'INSERT') {
                        // For INSERT events, event_id is always present in the payload
                        if (payload.new.event_id === selectedEventId) {
                            const isVideo = payload.new.media_type === 'video' || payload.new.resource_type === 'video';
                            // Strict requirement: Videos must NOT show on host/dashboard until 100% processed
                            if (isVideo && payload.new.status !== 'processed') {
                                return;
                            }

                            const newPhoto: Photo = {
                                id: payload.new.id,
                                eventId: payload.new.event_id,
                                storageKey: payload.new.storage_key,
                                url: payload.new.url,
                                thumbnailUrl: payload.new.thumbnail_url,
                                width: payload.new.width,
                                height: payload.new.height,
                                uploadedAt: payload.new.uploaded_at,
                                userId: payload.new.user_id,
                                size: payload.new.size,
                                format: payload.new.format,
                                mediaType: payload.new.media_type,
                                resourceType: payload.new.resource_type,
                                status: payload.new.status
                            };

                            // Add to grid state directly in real-time so it shows immediately!
                            setCurrentEventPhotos(prev => {
                                if (prev.some(p => p.id === newPhoto.id)) return prev;
                                return [newPhoto, ...prev];
                            });
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        // Use currentEventPhotosRef and uploadQueueRef to avoid stale closure state snapshots,
                        // and fallback to checking the event_id directly if React state hasn't flushed yet.
                        const isOurPhoto = (payload.new.event_id === selectedEventId) ||
                                           currentEventPhotosRef.current.some(p => p.id === payload.new.id) ||
                                           uploadQueueRef.current.some(qItem => qItem.photoId === payload.new.id);

                        if (!isOurPhoto) return;

                        setCurrentEventPhotos(prev => {
                            const exists = prev.some(p => p.id === payload.new.id);

                            // 1. If it doesn't exist yet (e.g. video finished transcoding),
                            // we build the Photo record and insert it once status is 'processed'.
                            if (!exists) {
                                const isVideo = payload.new.media_type === 'video' || payload.new.resource_type === 'video';
                                if (isVideo && payload.new.status !== 'processed') {
                                    return prev;
                                }

                                const queueItem = uploadQueueRef.current.find(q => q.photoId === payload.new.id);
                                const mediaDomain = process.env.NEXT_PUBLIC_MEDIA_DOMAIN || 'media.evebash.com';
                                const resolvedStorageKey = payload.new.storage_key || queueItem?.storageKey || "";
                                const completedPhoto: Photo = {
                                    id: payload.new.id,
                                    eventId: selectedEventId,
                                    storageKey: resolvedStorageKey,
                                    url: payload.new.url || `https://${mediaDomain}/${resolvedStorageKey}`,
                                    thumbnailUrl: payload.new.thumbnail_url ?? `https://${mediaDomain}/${resolvedStorageKey}-thumbnail.webp`,
                                    width: payload.new.width,
                                    height: payload.new.height,
                                    uploadedAt: payload.new.uploaded_at || new Date().toISOString(),
                                    mediaType: payload.new.media_type || (isVideo ? "video" : "photo"),
                                    resourceType: payload.new.resource_type || (isVideo ? "video" : "image"),
                                    status: payload.new.status || "processed"
                                };
                                return [completedPhoto, ...prev];
                            }

                            // 2. If it already exists in the grid, update its thumbnail, url, and status
                            return prev.map(p => {
                                if (p.id === payload.new.id) {
                                    return {
                                        ...p,
                                        status: payload.new.status ?? p.status,
                                        thumbnailUrl: payload.new.thumbnail_url ?? p.thumbnailUrl,
                                        width: payload.new.width || p.width,
                                        height: payload.new.height || p.height,
                                        url: payload.new.url || p.url,
                                    };
                                }
                                return p;
                            });
                        });

                        if (payload.new.status === 'processed' || payload.new.thumbnail_url) {
                            setUploadQueue(prev => prev.map(qItem =>
                                (qItem.photoId === payload.new.id || qItem.storageKey === payload.new.storage_key) && qItem.mediaType !== "video"
                                    ? { ...qItem, status: "success", progress: 100 }
                                    : qItem
                            ));
                        }
                    } else if (payload.eventType === 'DELETE') {
                        setCurrentEventPhotos(prev => prev.filter(p => p.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedEventId]);

    useEffect(() => {
        if (!selectedGuestLog) {
            setSelectedGuestProfile(null);
            return;
        }

        let isMounted = true;

        const loadSelectedGuestProfile = async () => {
            setLoadingGuestProfile(true);
            try {
                const matchedProfile = await getGuestProfile(selectedGuestLog);
                if (isMounted) setSelectedGuestProfile(matchedProfile);
            } catch (error) {
                console.error("Error loading guest profile:", error);
                if (isMounted) setSelectedGuestProfile(null);
            } finally {
                if (isMounted) setLoadingGuestProfile(false);
            }
        };

        loadSelectedGuestProfile();

        return () => {
            isMounted = false;
        };
    }, [selectedGuestLog]);

    const fetchTrafficLogs = async () => {
        if (!user) return;
        setLoadingLogs(true);
        try {
            // Enforce strict identity scoping for everyone (Primary, Event, and Web Admins)
            // This ensures guest activity is only visible on the relevant dashboard.
            const identifiers = [user.uid];
            if (user.email) identifiers.push(user.email);
            if (user.delegatedBy) identifiers.push(user.delegatedBy);

            const logs = await (selectedLogEventId === "all"
                ? getGuestLogs(identifiers)
                : getEventLogs(selectedLogEventId));

            // Event managers only see traffic for events explicitly assigned to them.
            if (user.roleType === 'event') {
                const assignedEvents = user.assignedEvents || [];
                setTrafficLogs(logs.filter(log => (log.parentEventId && assignedEvents.includes(log.parentEventId)) || (log.eventId && assignedEvents.includes(log.eventId))));
            } else {
                setTrafficLogs(logs);
            }
        } catch (error) {
            console.error("Error fetching logs:", error);
        } finally {
            setLoadingLogs(false);
        }
    };

    // The guest routes check the signed-in user, so send the login with every call
    const guestRouteHeaders = async (): Promise<Record<string, string>> => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            "Content-Type": "application/json",
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        };
    };

    const updateGuestStatusAction = async (logId: string, status: string, requester: any) => {
        try {
            const url = getApiUrl("/api/v1/permissions/update-guest-status");
            const headers = await guestRouteHeaders();
            const res = await fetch(url, {
                method: "POST",
                headers,
                body: JSON.stringify({ logId, status, requester }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success) {
                // Tell the guest (push to their phone); sent by the backend, browsers can't reach Expo
                void fetch(getApiUrl("/api/v1/notifications/gallery-decision"), {
                    method: "POST",
                    headers,
                    body: JSON.stringify({ guestId: logId }),
                }).catch(() => {});
            }
            return res.ok && data.success ? { success: true } : { success: false, error: data.error };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    };

    const deleteGuestAction = async (logId: string, requester: any) => {
        try {
            const url = getApiUrl("/api/v1/permissions/delete-guest");
            const res = await fetch(url, {
                method: "POST",
                headers: await guestRouteHeaders(),
                body: JSON.stringify({ logId, requester }),
            });
            const data = await res.json().catch(() => ({}));
            return res.ok && data.success ? { success: true } : { success: false, error: data.error };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    };

    const denyRequestAction = async (logId: string, requester: { uid?: string | null; email?: string | null }) => {
        try {
            // One backend step: tells the person (push), then erases the request so they can ask again later
            const res = await fetch(getApiUrl("/api/v1/permissions/deny-request"), {
                method: "POST",
                headers: await guestRouteHeaders(),
                body: JSON.stringify({ logId, requester }),
            });
            const data = await res.json().catch(() => ({}));
            return res.ok && data.success ? { success: true } : { success: false, error: data.error };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : "Network error" };
        }
    };

    const updateGuestPermissionsAction = async (logId: string, permissions: any, requester: any) => {
        try {
            const url = getApiUrl("/api/v1/permissions/update-guest-permissions");
            const res = await fetch(url, {
                method: "POST",
                headers: await guestRouteHeaders(),
                body: JSON.stringify({ logId, permissions, requester }),
            });
            const data = await res.json().catch(() => ({}));
            return res.ok && data.success ? { success: true } : { success: false, error: data.error };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    };

    const handleGuestStatusUpdate = async (logId: string, nextStatus: "approved" | "rejected"): Promise<boolean> => {
        const result = await updateGuestStatusAction(logId, nextStatus, {
            uid: user?.uid,
            email: user?.email,
        });

        if (result.success) {
            setMessage(`Guest ${nextStatus === "approved" ? "approved" : "rejected"} successfully.`);
            setStatus("success");
            const updateLog = (item: EventDetailLog) => item.id === logId ? { ...item, status: nextStatus } : item;
            setEventDetailLogs(prev => prev.map(updateLog));
            setTrafficLogs(prev => prev.map(updateLog as any));
            setSelectedGuestLog(prev => prev?.id === logId ? updateLog(prev) : prev);
            fetchTrafficLogs();
        } else {
            setMessage(result.error || "Failed to update guest.");
            setStatus("error");
            void recheckManageAccess(selectedMainEventId);
        }
        setTimeout(() => { setStatus("idle"); setMessage(""); }, 3000);
        return result.success;
    };

    // Hide photos or videos from guests, or show them again (only the Host section shows hidden media)
    const handleSetMediaHidden = async (photoIds: string[], hidden: boolean) => {
        if (photoIds.length === 0) return;
        const result = await setMediaHidden(photoIds, hidden);
        if (result.success) {
            const ids = new Set(photoIds);
            setCurrentEventPhotos(prev => prev.map(photo => ids.has(photo.id) ? { ...photo, isHidden: hidden } : photo));
            const what = photoIds.length === 1 ? "1 item" : `${photoIds.length} items`;
            setMessage(hidden ? `${what} hidden from guests.` : `${what} visible to guests again.`);
            setStatus("success");
            if (isSelectingMedia) exitMediaSelection();
        } else {
            setMessage(result.error || "Couldn't update the media.");
            setStatus("error");
        }
        setTimeout(() => { setStatus("idle"); setMessage(""); }, 3000);
    };

    // Hide a sub-gallery from guests, or show it again (the event's managers always see it)
    const toggleGalleryHidden = async (gallery: Event) => {
        const hidden = !gallery.isHidden;
        const result = await setGalleryHidden(gallery.id, hidden);
        if (result.success) {
            setEventDetailGalleries(prev => prev.map(item => item.id === gallery.id ? { ...item, isHidden: hidden } : item));
            setMessage(hidden ? `"${gallery.title}" is now hidden from guests.` : `"${gallery.title}" is visible to guests again.`);
            setStatus("success");
        } else {
            setMessage(result.error || "Couldn't update the gallery.");
            setStatus("error");
        }
        setTimeout(() => { setStatus("idle"); setMessage(""); }, 3000);
    };

    // The gallery a photo or video was uploaded to: the event itself or one of its albums (older uploads may use a legacy id)
    const galleryOfMedia = (media: Photo): Event | undefined => {
        const galleries = [...eventDetailGalleries, ...(selectedMainEvent ? [selectedMainEvent] : []), ...userEvents];
        return galleries.find(gallery => gallery.id === media.eventId || (!!gallery.legacyId && gallery.legacyId === media.eventId));
    };

    // Plays one of a gallery's own videos at the top of its guest page (designs that show a gallery video), or clears it
    const saveGalleryVideo = async (gallery: Event, videoId: string | null) => {
        const result = await setGalleryVideo(gallery.id, videoId);
        if (result.success) {
            syncEventFields(gallery.id, { galleryVideoId: videoId });
            setMessage(videoId ? `This video now plays at the top of "${gallery.title}".` : `"${gallery.title}" no longer has a cinematic highlight video.`);
            setStatus("success");
        } else {
            setMessage(result.error || "Couldn't update the cinematic highlight video.");
            setStatus("error");
        }
        setTimeout(() => { setStatus("idle"); setMessage(""); }, 3000);
    };

    const handleSetGalleryVideo = async (video: Photo, use: boolean) => {
        const gallery = galleryOfMedia(video);
        if (gallery) return saveGalleryVideo(gallery, use ? video.id : null);
        setMessage("Couldn't find this video's gallery. Refresh the page and try again.");
        setStatus("error");
        setTimeout(() => { setStatus("idle"); setMessage(""); }, 3000);
    };

    const handleGuestDeny = async (log: { id: string; name?: string | null }): Promise<boolean> => {
        if (!(await confirmDialog({ title: `Deny ${log.name || "this guest"}'s request?`, message: "They'll be notified, and they can ask again later.", confirmLabel: "Deny", tone: "danger" }))) return false;

        const result = await denyRequestAction(log.id, {
            uid: user?.uid,
            email: user?.email,
        });

        if (result.success) {
            setMessage("Request denied.");
            setStatus("success");
            setEventDetailLogs(prev => prev.filter(item => item.id !== log.id));
            setTrafficLogs(prev => prev.filter(item => item.id !== log.id));
            setSelectedGuestLog(prev => prev?.id === log.id ? null : prev);
            fetchTrafficLogs();
        } else {
            setMessage(result.error || "Failed to deny the request.");
            setStatus("error");
            void recheckManageAccess(selectedMainEventId);
        }
        setTimeout(() => { setStatus("idle"); setMessage(""); }, 3000);
        return result.success;
    };

    const handleGuestDelete = async (logId: string): Promise<boolean> => {
        if (!(await confirmDialog({ title: "Remove guest?", message: "Are you sure you want to remove this user from the guest list?", confirmLabel: "Remove", tone: "danger" }))) return false;

        const result = await deleteGuestAction(logId, {
            uid: user?.uid,
            email: user?.email,
        });

        if (result.success) {
            setMessage("Guest removed successfully.");
            setStatus("success");
            fetchTrafficLogs();
        } else {
            setMessage(result.error || "Failed to remove guest.");
            setStatus("error");
            void recheckManageAccess(selectedMainEventId);
        }
        setTimeout(() => { setStatus("idle"); setMessage(""); }, 3000);
        return result.success;
    };

    const handleGuestPermissionToggle = async (
        log: EventDetailLog,
        key: "canAdmin" | "canUpload" | "canComment"
    ) => {
        const nextValue = !log[key];
        const nextPermissions = key === "canAdmin" && nextValue
            ? { canAdmin: true, canUpload: true, canComment: true }
            : { [key]: nextValue };
        const shouldApproveViewAccess = key === "canAdmin" && nextValue && log.status !== "approved";

        if (shouldApproveViewAccess) {
            const statusResult = await updateGuestStatusAction(log.id, "approved", {
                uid: user?.uid,
                email: user?.email,
            });

            if (!statusResult.success) {
                setMessage(statusResult.error || "Failed to update guest.");
                setStatus("error");
                setTimeout(() => { setStatus("idle"); setMessage(""); }, 3000);
                return;
            }
        }

        const result = await updateGuestPermissionsAction(log.id, nextPermissions, {
            uid: user?.uid,
            email: user?.email,
        });

        if (result.success) {
            const updateLog = (item: EventDetailLog) => item.id === log.id
                ? { ...item, ...(shouldApproveViewAccess ? { status: "approved" } : {}), ...nextPermissions }
                : item;
            setEventDetailLogs(prev => prev.map(updateLog));
            setTrafficLogs(prev => prev.map(updateLog as any));
            setSelectedGuestLog(prev => prev?.id === log.id
                ? { ...prev, ...(shouldApproveViewAccess ? { status: "approved" } : {}), ...nextPermissions }
                : prev);
            setMessage("Guest permissions updated.");
            setStatus("success");
        } else {
            setMessage(result.error || "Failed to update permissions.");
            setStatus("error");
            void recheckManageAccess(selectedMainEventId);
        }
        setTimeout(() => { setStatus("idle"); setMessage(""); }, 3000);
    };

    // Fetch workspace owner if current user is delegated
    useEffect(() => {
        const fetchWorkspaceOwner = async () => {
            if (user?.delegatedBy) {
                try {
                    const ownerData = await getUserById(user.delegatedBy);
                    if (ownerData) {
                        setWorkspaceOwner(ownerData);
                    }
                } catch (error) {
                    console.error("Error fetching workspace owner:", error);
                }
            } else {
                setWorkspaceOwner(null);
            }
        };

        if (user) {
            fetchWorkspaceOwner();
        }
    }, [user?.delegatedBy, user?.uid]);

    // Re-fetch events once workspace owner email is available
    useEffect(() => {
        if (workspaceOwner?.email) {
            console.log("[Dashboard] Workspace owner loaded, re-fetching events for attribution...");
            fetchUserEvents();
        }
    }, [workspaceOwner?.email]);

    useEffect(() => {
        const fetchEventOwners = async () => {
            const ownerIds = Array.from(new Set(
                [...userEvents, ...sharedEvents]
                    .map(evt => evt.createdBy)
                    .filter((ownerId): ownerId is string => !!ownerId && !ownerId.includes("@"))
            ));

            if (ownerIds.length === 0) {
                setEventOwners({});
                return;
            }

            const ownerEntries = await Promise.all(
                ownerIds.map(async (ownerId) => {
                    // Name only: other people's email and username aren't readable once RLS is on (profile_cards is)
                    const owner = await getProfileCard(ownerId);
                    return [ownerId, { email: undefined as string | undefined, name: owner?.name, username: undefined as string | undefined }] as const;
                })
            );

            setEventOwners(Object.fromEntries(ownerEntries));
        };

        fetchEventOwners();
    }, [userEvents, sharedEvents]);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    if (loading) {
        return <LoadingScreen message="Loading your dashboard" />;
    }

    if (isNavigating) {
        return <LoadingScreen message="Opening event" />;
    }

    if (!user) {
        return null;
    }

    const handleCreateEventOnly = async (e: React.FormEvent, skipSuccessModal: boolean = false): Promise<boolean> => {
        e.preventDefault();
        if (!eventName.trim()) {
            setStatus("error");
            setMessage("Please enter an event name.");
            setTimeout(() => { setStatus("idle"); setMessage(""); }, 5000);
            return false;
        }

        const { data: authData, error: authError } = await supabase.auth.getUser();
        const authUser = authData?.user;
        if (authError || !authUser?.id) {
            setStatus("error");
            setMessage("Please sign in again before creating an event.");
            setTimeout(() => { setStatus("idle"); setMessage(""); }, 5000);
            return false;
        }

        const creatorUid = authUser.id;
        const creatorEmail = authUser.email || user.email || "";
        const creatorName = user.name || authUser.user_metadata?.name || creatorEmail.split("@")[0] || "User";

        // --- ROLE-BASED LIMITS ---
        const isCreatingMainEvent = manageLevel !== "galleries" && !isCreateSubGalleryModalOpen;
        if (isCreatingMainEvent && user.role !== "admin" && !user.delegatedBy) {
            const eventCount = await getUserEventCount(creatorUid);
            const currentPlan = getPlanDetails(user.role);
            const maxEvents = currentPlan.eventLimit;

            if (eventCount >= maxEvents) {
                setMessage(`You've reached your ${currentPlan.eventLabel}-event limit for the ${currentPlan.name}. Upgrade your plan to create more events.`);
                setStatus("error");
                setTimeout(() => { setStatus("idle"); setMessage(""); }, 5000);
                return false;
            }
        }

        setStatus("uploading");
        setMessage("Creating event...");

        try {
            const profileReady = await createUserProfile(
                creatorUid,
                creatorName,
                creatorEmail,
                user.phone && user.phone !== "No Phone" ? user.phone : "",
                user.role || "user"
            );

            if (!profileReady) {
                setStatus("error");
                setMessage("Your profile is still being prepared. Please try again in a moment.");
                return false;
            }

            const eventId = `${createEventSlug(eventName) || "event"}-${uuidv4().slice(0, 4)}`;

            const isSubEvent = (manageLevel === "galleries" || isCreateSubGalleryModalOpen) && selectedMainEvent;

            // Assign the primary placeholder for main events, or inherit parent's cover for sub-galleries
            const defaultPlaceholder = PLACEHOLDER_IMAGES[0];
            const initialCoverImage = isSubEvent ? (selectedMainEvent.coverImage || defaultPlaceholder) : defaultPlaceholder;

            const newEvent: Event = {
                id: eventId,
                title: eventName,
                date: eventDate.trim() || new Date().toLocaleDateString(),
                coverImage: initialCoverImage,
                description: isSubEvent ? `Welcome to the ${eventName} gallery! Share your beautiful moments and thoughts here.` : `Main Event: ${eventName}`,
                createdBy: creatorUid,
                type: isSubEvent ? "sub" : "main",
                category: isSubEvent ? (selectedMainEvent.category || eventType) : eventType,
                joinId: generateEventJoinId(eventId),
                ...(isSubEvent && { parentId: selectedMainEvent.id }),
                templateId: isSubEvent ? (selectedMainEvent.templateId || "hero") : selectedTemplate
            };

            const created = await createEvent(newEvent);
            if (!created.success) {
                setStatus("error");
                setMessage(created.error || "Failed to create event. Please check the event details and try again.");
                return false;
            }

            setStatus("success");
            setIsCreateModalOpen(false);
            if (!skipSuccessModal) {
                setShowCreateSuccessModal(true);
            }
            setMessage("Your event has been created! ✨");
            if (isSubEvent) {
                setEventDetailGalleries(prev => [...prev, newEvent].sort((a, b) => (a.title || "").localeCompare(b.title || "", undefined, { numeric: true, sensitivity: "base" })));
            }
            setEventName("");
            setEventDate(formatCreateEventDate(new Date()));
            setEventType("Wedding");
            setSelectedTemplate("hero"); // Reset to default
            fetchUserEvents();
            return true;
        } catch (err) {
            console.error(err);
            setStatus("error");
            setMessage(err instanceof Error ? err.message : "Failed to create event.");
            return false;
        }
    };

    // options.kind: upload as photos or videos whatever tab is open (the Cinematic Highlight Video panel uploads videos);
    // options.onVideoSaved: called with a video's id once its row is saved (it can then become the gallery video)
    const uploadFiles = async (files: FileList | File[], options?: { kind?: "photos" | "videos"; onVideoSaved?: (videoId: string) => void }) => {
        const uploadKind = options?.kind ?? galleryMediaTab;
        if (uploadKind === "videos" && !canPostVideos) {
            setStatus("error"); setMessage("Only the event owner and event admins can upload videos."); return;
        }
        const expectedPrefix = uploadKind === "videos" ? "video/" : "image/";
        const selectedFiles = Array.from(files).filter(file => file.type.startsWith(expectedPrefix));
        if (selectedFiles.length === 0 || !selectedEventId) return;

        const isFreeUploadUser = !user.delegatedBy && (!user.role || user.role === "user" || user.role === "free" || user.role === "freemium");
        if (uploadKind === "videos" && isFreeUploadUser) {
            const oversizedVideo = selectedFiles.find(file => file.size > FREE_PLAN_VIDEO_LIMIT_BYTES);
            if (oversizedVideo) {
                setMessage("Free plan videos can be up to 200 MB. Upgrade to upload larger videos.");
                setStatus("error");
                setTimeout(() => { setStatus("idle"); setMessage(""); }, 5000);
                return;
            }
        }

        // Pre-upload format validation for video files
        if (uploadKind === "videos") {
            for (const file of selectedFiles) {
                const validation = validateVideoFile(file);
                if (!validation.valid) {
                    setMessage(validation.error ?? "Invalid video file.");
                    setStatus("error");
                    setTimeout(() => { setStatus("idle"); setMessage(""); }, 6000);
                    return;
                }
            }
        }

        // --- ROLE-BASED LIMITS: Storage Cap ---
        if (user.role !== "admin" && !user.delegatedBy) {
            const currentPlan = getPlanDetails(user.role);
            const identifiers = [user.uid];
            if (user.email) identifiers.push(user.email);
            if (user.phone) identifiers.push(user.phone);
            const currentUsage = await getUserTotalStorage(identifiers);
            const selectedUploadSize = selectedFiles.reduce((total, file) => {
                const isVideo = file.type.startsWith("video/") || ["mp4", "mov", "avi", "mkv", "webm", "m4v"].includes(file.name.split('.').pop()?.toLowerCase() || "");
                // For videos, factor in ~35% overhead for adaptive bitrate HLS streaming chunks (.ts files)
                const estimatedSize = isVideo ? Math.round(file.size * 1.35) : file.size;
                return total + estimatedSize;
            }, 0);

            if (currentUsage >= currentPlan.storageBytes) {
                setMessage(`You've reached your ${currentPlan.storageLabel} storage limit. Upgrade your plan for more storage.`);
                setStatus("error");
                setTimeout(() => { setStatus("idle"); setMessage(""); }, 5000);
                return;
            }

            if (currentUsage + selectedUploadSize > currentPlan.storageBytes) {
                const remainingStorage = Math.max(currentPlan.storageBytes - currentUsage, 0);
                setMessage(
                    `Upload exceeds your ${currentPlan.storageLabel} storage limit. You have ${formatStorageSize(remainingStorage)} remaining, but selected files are ${formatStorageSize(selectedUploadSize)}.`
                );
                setStatus("error");
                setTimeout(() => { setStatus("idle"); setMessage(""); }, 7000);
                return;
            }
        }

        // Initialize queue items in state
        const newQueueItems = selectedFiles.map((file, idx) => {
            const isVideo = file.type.startsWith("video/");
            return {
                id: `${Date.now()}-${idx}-${Math.random()}`,
                fileName: file.name,
                status: "pending" as const,
                eventId: selectedEventId,
                progress: 0,
                mediaType: isVideo ? ("video" as const) : ("photo" as const),
            };
        });
        newQueueItems.forEach(item => uploadControllers.current.set(item.id, new AbortController()));
        setUploadQueue(prev => [...prev, ...newQueueItems]);
        showUploadPanel();

        setStatus("uploading");
        setMessage(`Uploading ${selectedFiles.length} ${uploadKind === "videos" ? "videos" : "images"}...`);
        console.log(`[Dashboard] Starting auto-upload for ${selectedFiles.length} files to event ${selectedEventId}`);

        try {
            let firstUploadedUrl = "";
            const uploadResults: { file: File, photo: Photo }[] = [];

            const concurrencyLimit = 3;
            let activeCount = 0;
            let currentIndex = 0;
            let chunkBuffer: { photo: Photo; queueItemId: string }[] = [];
            let completedCount = 0;

            const flushChunkBuffer = async () => {
                if (chunkBuffer.length === 0) return;
                const itemsToFlush = [...chunkBuffer];
                chunkBuffer = [];
                console.log(`[Dashboard] Flushing chunk of ${itemsToFlush.length} photos to batch API...`);
                try {
                    const session = await supabase.auth.getSession();
                    const headers: Record<string, string> = { "Content-Type": "application/json" };
                    if (session.data.session?.access_token) {
                        headers["Authorization"] = `Bearer ${session.data.session.access_token}`;
                    }
                    let res = await fetch(getApiUrl("/api/media/save-photo-batch"), {
                        method: "POST",
                        headers,
                        body: JSON.stringify({
                            photos: itemsToFlush.map(item => ({
                                storageKey: item.photo.storageKey,
                                eventId: item.photo.eventId,
                                fileName: item.photo.storageKey.split('/').pop() || 'image.jpg',
                                fileSize: item.photo.size,
                                resourceType: item.photo.resourceType
                            }))
                        })
                    });

                    if (!res.ok && (res.status === 401 || res.status === 500)) {
                        console.warn("[Dashboard] save-photo-batch failed, refreshing auth session and retrying...");
                        const { data: refreshed } = await supabase.auth.refreshSession();
                        if (refreshed.session?.access_token) {
                            headers["Authorization"] = `Bearer ${refreshed.session.access_token}`;
                            res = await fetch(getApiUrl("/api/media/save-photo-batch"), {
                                method: "POST",
                                headers,
                                body: JSON.stringify({
                                    photos: itemsToFlush.map(item => ({
                                        storageKey: item.photo.storageKey,
                                        eventId: item.photo.eventId,
                                        fileName: item.photo.storageKey.split('/').pop() || 'image.jpg',
                                        fileSize: item.photo.size,
                                        resourceType: item.photo.resourceType
                                    }))
                                })
                            });
                        }
                    }

                    if (res.ok) {
                        itemsToFlush
                            .filter(item => item.photo.mediaType === "video" || item.photo.resourceType === "video")
                            .forEach(item => options?.onVideoSaved?.(item.photo.id));
                        // Immediately prepend new photos to grid state (videos stay hidden until backend transcode completes)
                        setCurrentEventPhotos(prev => {
                            const newPhotos = itemsToFlush
                                .filter(item => {
                                    const isVideo = item.photo.mediaType === "video" || item.photo.resourceType === "video";
                                    return !isVideo || item.photo.status === "processed";
                                })
                                .map(item => item.photo)
                                .filter(p => !prev.some(existing => existing.id === p.id));
                            return [...newPhotos, ...prev];
                        });

                        const itemIds = new Set(itemsToFlush.map(item => item.queueItemId));
                        setUploadQueue(prev => prev.map(qItem => {
                            if (itemIds.has(qItem.id)) {
                                if (qItem.status === "success" || qItem.status === "error") return qItem;
                                return {
                                    ...qItem,
                                    status: "processing",
                                    progress: 90
                                };
                            }
                            return qItem;
                        }));
                    } else {
                        const itemIds = new Set(itemsToFlush.map(item => item.queueItemId));
                        setUploadQueue(prev => prev.map(qItem =>
                            itemIds.has(qItem.id) ? { ...qItem, status: "error", progress: 100, error: "Failed to save photo metadata" } : qItem
                        ));
                    }
                } catch (e: any) {
                    console.error("[Dashboard] Batch flush error:", e);
                    const itemIds = new Set(itemsToFlush.map(item => item.queueItemId));
                    setUploadQueue(prev => prev.map(qItem =>
                        itemIds.has(qItem.id) ? { ...qItem, status: "error", progress: 100, error: e.message || "Failed to save photo metadata" } : qItem
                    ));
                }
            };

            const runNext = async (workerId: number): Promise<void> => {
                if (currentIndex >= selectedFiles.length) return;

                const index = currentIndex++;
                const file = selectedFiles[index];
                const queueItemId = newQueueItems[index].id;

                const controller = uploadControllers.current.get(queueItemId)!;
                activeCount++;
                // Update status to uploading in UI when task actually starts
                setUploadQueue(prev => prev.map(item => item.id === queueItemId && !controller.signal.aborted ? { ...item, status: "uploading" } : item));

                try {
                    controller.signal.throwIfAborted();
                    console.log(`[Dashboard] Uploading file ${index + 1}/${selectedFiles.length}: ${file.name} (lane: ${workerId})`);
                    // Upload the original file — skip single-save so we can chunk it
                    const uploadResult = await uploadEventImage(
                        file,
                        selectedEventId,
                        user.uid || "anonymous",
                        workerId,
                        true,
                        (percent) => {
                            setUploadQueue(prev => prev.map(item =>
                                item.id === queueItemId && item.status === "uploading"
                                    ? { ...item, progress: Math.min(90, Math.round(percent * 0.9)) }
                                    : item
                            ));
                        },
                        controller.signal,
                        () => {
                            uploadControllers.current.delete(queueItemId);
                            setUploadQueue(previous => previous.map(item => item.id === queueItemId ? { ...item, status: "finalizing" } : item));
                        }
                    );

	                    if (index === 0) firstUploadedUrl = uploadResult.url;

	                    const uniqueId = uploadResult.publicId.replace(/\//g, '_');
	                    const isVideoFile = file.type.startsWith("video/") || !!file.name.match(/\.(mp4|mov|avi|mkv|webm)$/i);
	                    const photo: Photo = {
                        id: uniqueId,
                        eventId: selectedEventId,
                        storageKey: uploadResult.publicId,
                        url: uploadResult.url,
                        uploadedAt: new Date().toISOString(),
                        userId: user.uid || "anonymous",
                        width: uploadResult.width,
                        height: uploadResult.height,
                        size: uploadResult.bytes || file.size,
                        format: uploadResult.format || file.name.split('.').pop()?.toLowerCase() || (isVideoFile ? "mp4" : "jpg"),
                        mediaType: isVideoFile ? "video" : "photo",
                        resourceType: isVideoFile ? "video" : "image"
                    };

                    // Store storageKey and photoId in the queue item so Realtime updates can map to it
                    setUploadQueue(prev => prev.map(item =>
                        item.id === queueItemId
                            ? { ...item, storageKey: uploadResult.publicId, photoId: uniqueId }
                            : item
                    ));

                    if (uploadResult.videoSavedByBackend) {
                        options?.onVideoSaved?.(uniqueId);
                        // /upload/chunk/complete already saved the row and queued the transcode. Saving it again via
                        // save-photo-batch would re-upsert the row (clearing its duration) and notify the host twice.
                        // The video processing poll marks it ready or failed.
                        setUploadQueue(prev => prev.map(qItem =>
                            qItem.id === queueItemId && qItem.status !== "success" && qItem.status !== "error"
                                ? { ...qItem, status: "processing", progress: 90 }
                                : qItem
                        ));
                    } else {
                        // Photos (incl. large chunked images, whose previews are queued here) and small direct-upload
                        // videos, whose transcode save-photo-batch queues.
                        chunkBuffer.push({ photo, queueItemId });
                        // Flush immediately after each upload so resizing starts right away (non-blocking)
                        flushChunkBuffer();
                    }

                    // Store for background indexing
                    uploadResults.push({ file, photo });
                } catch (fileErr: any) {
                    if (fileErr.name !== "AbortError") {
                        console.error(`[Dashboard] File upload error for ${file.name}:`, fileErr);
                    }
                    setUploadQueue(prev => prev.map(item => item.id === queueItemId ? { ...item, status: fileErr.name === "AbortError" ? "cancelled" : "error", progress: 0, error: fileErr.name === "AbortError" ? undefined : fileErr.message || "Failed" } : item));
                    if (fileErr.code === "storage_full" || fileErr.code === "plan_expired") {
                        // The plan is the reason: say so at the top, not only on each file
                        setMessage(fileErr.message);
                        setStatus("error");
                    }
                } finally {
                    uploadControllers.current.delete(queueItemId);
                    activeCount--;
                    completedCount++;

                    // If this is the absolute last photo of the entire batch to complete (success or fail), flush any remaining items
                    if (completedCount === selectedFiles.length) {
                        flushChunkBuffer();
                    }

                    // Process next file in the queue
                    await runNext(workerId);
                }
            };

            // Launch initial set of workers
            const workers: Promise<void>[] = [];
            for (let i = 0; i < Math.min(concurrencyLimit, selectedFiles.length); i++) {
                workers.push(runNext(i));
            }

            // Wait for all workers to finish execution
            await Promise.allSettled(workers);



            await fetchStorageStats();

            // Face scanning runs from the upload pipeline itself (the old trigger-modal-batch call was removed)

            // Auto-update cover if it's currently a placeholder or if it's the first upload
            const currentEvent = userEvents.find(ev => ev.id === selectedEventId);
            const isPlaceholder = !currentEvent?.coverImage || PLACEHOLDER_IMAGES.includes(currentEvent.coverImage);

            if (uploadKind === "photos" && isPlaceholder && firstUploadedUrl) {
                console.log("[Dashboard] Replacing placeholder with first uploaded image as cover");
                await updateEvent(selectedEventId, { coverImage: firstUploadedUrl });
                syncCoverImageForEvent(selectedEventId, firstUploadedUrl);
            }

            const hasVideoUploads = uploadResults.some(item => item.photo.mediaType === "video" || item.photo.resourceType === "video");
            if (hasVideoUploads) {
                // Transfer completion is not video completion. Keep the queue visible
                // until the processing poll marks each video ready or failed.
                showUploadPanel();
                setStatus("idle");
                setMessage("");
            } else {
                setStatus("success");
                setMessage("Gallery updated! ✨");
                setTimeout(() => { setStatus("idle"); setMessage(""); }, 2000);
            }
            fetchUserEvents();
            fetchEventPhotos();
        } catch (err: any) {
            console.error("[Dashboard] Auto-upload error:", err);
            setStatus("error");
            setMessage(`Upload failed: ${err.message || 'Unknown error'}`);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = e.target.files;
        if (!selectedFiles || selectedFiles.length === 0) return;
        await uploadFiles(selectedFiles);
        e.target.value = "";
    };

    const handleGalleryDrag = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (status !== "uploading") {
            setIsDraggingPhotos(e.type === "dragenter" || e.type === "dragover");
        }
    };

    const handleGalleryDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingPhotos(false);

        if (status === "uploading") return;

        const expectedPrefix = galleryMediaTab === "videos" ? "video/" : "image/";
        const droppedFiles = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith(expectedPrefix));
        if (droppedFiles.length === 0) {
            setStatus("error");
            setMessage(galleryMediaTab === "videos" ? "Drop video files to upload." : "Drop image files to upload.");
            setTimeout(() => { setStatus("idle"); setMessage(""); }, 2500);
            return;
        }

        await uploadFiles(droppedFiles);
    };

    const handleSetAsCover = async (photoUrl: string, targetEventId?: string, isMainEvent: boolean = false) => {
        const idToUpdate = targetEventId || selectedEventId;
        if (!idToUpdate) return;

        setStatus("uploading");
        setMessage(`Setting as ${isMainEvent ? 'event' : 'gallery'} cover...`);

        try {
            const success = await updateEvent(idToUpdate, { coverImage: photoUrl });
            if (success) {
                syncCoverImageForEvent(idToUpdate, photoUrl);
                setStatus("success");
                setMessage(`${isMainEvent ? 'Event' : 'Gallery'} thumbnail updated! ✨`);
                fetchUserEvents();
                setTimeout(() => { setStatus("idle"); setMessage(""); }, 2000);
            } else {
                setStatus("error");
                setMessage("Failed to update thumbnail.");
            }
        } catch (error) {
            console.error("Error setting cover:", error);
            setStatus("error");
            setMessage("Error updating thumbnail.");
        }
    };

    const syncCoverImageForEvent = (eventId: string, coverImage: string) => {
        setUserEvents(prev => prev.map(evt => evt.id === eventId ? { ...evt, coverImage } : evt));
        setEventDetailGalleries(prev => prev.map(evt => evt.id === eventId ? { ...evt, coverImage } : evt));
        setSelectedMainEvent(prev => prev?.id === eventId ? { ...prev, coverImage } : prev);
    };

    const syncEventFields = (eventId: string, fields: Partial<Event>) => {
        setUserEvents(prev => prev.map(evt => evt.id === eventId ? { ...evt, ...fields } : evt));
        setEventDetailGalleries(prev => prev.map(evt => evt.id === eventId ? { ...evt, ...fields } : evt));
        setSelectedMainEvent(prev => prev?.id === eventId ? { ...prev, ...fields } : prev);
        setCoverPositionEvent(prev => prev?.id === eventId ? { ...prev, ...fields } : prev);
    };

    const getCoverImageStyle = (evt?: Event | null): React.CSSProperties => {
        if (!evt) return { objectFit: "cover" };
        const coverMode = evt.coverMode || "fill";
        if (coverMode === "fit") {
            return {
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                backgroundColor: "#050505",
            };
        }

        const isDraftTarget = coverPositionEvent?.id === evt.id;
        const x = isDraftTarget ? coverDraft.coverOffsetX : (evt.coverOffsetX || 0);
        const y = isDraftTarget ? coverDraft.coverOffset : (evt.coverOffset || 0);
        const scale = isDraftTarget ? coverDraft.coverScale : (evt.coverScale || 1);
        return {
            position: "absolute",
            left: 0,
            right: 0,
            top: -50,
            width: "100%",
            height: "calc(100% + 100px)",
            objectFit: "cover",
            transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`,
            transformOrigin: "center",
        };
    };

    const handleToggleCoverMode = async (targetEvent: Event) => {
        const nextMode = (targetEvent.coverMode || "fill") === "fill" ? "fit" : "fill";
        const updatedFields: Partial<Event> = {
            coverMode: nextMode,
            coverOffset: 0,
            coverOffsetX: 0,
            coverScale: 1,
        };
        syncEventFields(targetEvent.id, updatedFields);
        setStatus("uploading");
        setMessage(nextMode === "fit" ? "Setting cover to fit..." : "Setting cover to fill...");

        const success = await updateEvent(targetEvent.id, updatedFields);
        setStatus(success ? "success" : "error");
        setMessage(success ? (nextMode === "fit" ? "Cover set to Fit." : "Cover set to Fill.") : "Failed to update cover mode.");
        setTimeout(() => {
            setStatus("idle");
            setMessage("");
        }, 2000);
    };

    const openCoverPosition = (targetEvent: Event) => {
        setCoverPositionEvent(targetEvent);
        setCoverDraft({
            coverOffset: targetEvent.coverOffset || 0,
            coverOffsetX: targetEvent.coverOffsetX || 0,
            coverScale: targetEvent.coverScale || 1,
        });
    };

    const getCoverDragLimits = (scale = coverDraft.coverScale) => {
        const rect = coverPreviewRef.current?.getBoundingClientRect();
        const width = rect?.width || 1;
        const height = rect?.height || 1;
        return {
            x: Math.max(0, (width * scale - width) / 2),
            y: 50 + Math.max(0, (height * scale - height) / 2),
        };
    };

    const clampCoverDraft = (draft: typeof coverDraft) => {
        const limits = getCoverDragLimits(draft.coverScale);
        return {
            coverScale: draft.coverScale,
            coverOffsetX: Math.min(Math.max(draft.coverOffsetX, -limits.x), limits.x),
            coverOffset: Math.min(Math.max(draft.coverOffset, -limits.y), limits.y),
        };
    };

    const handleCoverPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!coverPositionEvent) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        coverDragStartRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            coverOffset: coverDraft.coverOffset,
            coverOffsetX: coverDraft.coverOffsetX,
        };
    };

    const handleCoverPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const start = coverDragStartRef.current;
        if (!start || start.pointerId !== event.pointerId) return;
        const nextDraft = {
            ...coverDraft,
            coverOffsetX: start.coverOffsetX + event.clientX - start.startX,
            coverOffset: start.coverOffset + event.clientY - start.startY,
        };
        setCoverDraft(clampCoverDraft(nextDraft));
    };

    const handleCoverPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
        if (coverDragStartRef.current?.pointerId === event.pointerId) {
            coverDragStartRef.current = null;
        }
    };

    const adjustCoverZoom = (delta: number) => {
        setCoverDraft(prev => {
            const nextScale = Math.min(Math.max(Number((prev.coverScale + delta).toFixed(2)), 1), 2.5);
            return clampCoverDraft({ ...prev, coverScale: nextScale });
        });
    };

    const handleSaveCoverPosition = async () => {
        if (!coverPositionEvent) return;
        const updatedFields: Partial<Event> = {
            coverOffset: coverDraft.coverOffset,
            coverOffsetX: coverDraft.coverOffsetX,
            coverScale: coverDraft.coverScale,
            coverMode: "fill",
        };
        syncEventFields(coverPositionEvent.id, updatedFields);
        setStatus("uploading");
        setMessage("Saving cover position...");
        const success = await updateEvent(coverPositionEvent.id, updatedFields);
        setStatus(success ? "success" : "error");
        setMessage(success ? "Cover position saved." : "Failed to save cover position.");
        if (success) setCoverPositionEvent(null);
        setTimeout(() => {
            setStatus("idle");
            setMessage("");
        }, 2000);
    };

    const handleUpdateEventCategory = async (targetEvent: Event, category: string) => {
        syncEventFields(targetEvent.id, { category });
        setStatus("uploading");
        setMessage("Updating event type...");
        const success = await updateEvent(targetEvent.id, { category });
        setStatus(success ? "success" : "error");
        setMessage(success ? "Event type updated." : "Failed to update event type.");
        setTimeout(() => {
            setStatus("idle");
            setMessage("");
        }, 2000);
    };

    const handleRemoveCoverForEvent = async (targetEvent: Event) => {
        if (!targetEvent.coverImage) {
            setStatus("success");
            setMessage("This event is already using the default cover.");
            setTimeout(() => {
                setStatus("idle");
                setMessage("");
            }, 2000);
            return;
        }

        setStatus("uploading");
        setMessage("Removing cover picture...");

        try {
            const coverUrlToRemove = targetEvent.coverImage;
            const success = await updateEvent(targetEvent.id, { coverImage: "" });
            if (!success) {
                throw new Error("Failed to remove cover picture.");
            }

            const usageDeleted = await deleteCoverUsagePhoto(targetEvent.id, coverUrlToRemove);
            if (!usageDeleted) {
                console.warn("[Dashboard] Cover removed, but storage usage could not be synced.");
            }

            syncCoverImageForEvent(targetEvent.id, "");
            setStatus("success");
            setMessage("Cover picture removed. Default cover restored.");
            await fetchUserEvents();
            await fetchStorageStats();

            setTimeout(() => {
                setStatus("idle");
                setMessage("");
            }, 2000);
        } catch (error: unknown) {
            console.error("Error removing cover:", error);
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "Failed to remove cover picture.");
            setTimeout(() => {
                setStatus("idle");
                setMessage("");
            }, 4000);
        }
    };

    const uploadCoverForEvent = async (file: File, targetEvent: Event) => {
        setStatus("uploading");
        setMessage("Optimizing and uploading cover picture...");

        const optimizedFile = await compressImage(file);
        if (optimizedFile.size !== file.size) {
            console.log(`[Dashboard] Optimized cover: ${Math.round(file.size / 1024 / 1024 * 10) / 10}MB -> ${Math.round(optimizedFile.size / 1024 / 1024 * 10) / 10}MB`);
        }

        const uploadResult = await uploadEventImage(optimizedFile, targetEvent.id, user?.uid || "anonymous");
        const success = await updateEvent(targetEvent.id, { coverImage: uploadResult.url });

        if (!success) {
            throw new Error("Cover upload completed, but saving the event cover failed.");
        }

        const usageSaved = await saveCoverUsagePhoto({
            eventId: targetEvent.id,
            storageKey: uploadResult.publicId || uploadResult.url,
            url: uploadResult.url,
            userId: user?.uid || "anonymous",
            width: uploadResult.width,
            height: uploadResult.height,
            size: uploadResult.bytes || optimizedFile.size,
            format: uploadResult.format,
        });

        if (!usageSaved) {
            console.warn("[Dashboard] Cover updated, but storage usage could not be synced.");
        }

        syncCoverImageForEvent(targetEvent.id, uploadResult.url);
        setStatus("success");
        setMessage("Cover picture updated! ✨");
        await fetchUserEvents();
        await fetchStorageStats();
    };

    const handleMainEventCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        const targetEvent = activeEventDetailEvent || selectedMainEvent;
        if (!file || !targetEvent || !user) return;

        try {
            await uploadCoverForEvent(file, targetEvent);
            setTimeout(() => {
                setStatus("idle");
                setMessage("");
            }, 2000);
        } catch (error: unknown) {
            console.error("Error uploading event cover:", error);
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "Failed to update cover picture.");
            setTimeout(() => {
                setStatus("idle");
                setMessage("");
            }, 4000);
        }
    };

    const handleSubEventCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file || !selectedEventId || !user) return;

        const targetEvent = userEvents.find(evt => evt.id === selectedEventId) || activeSubEvent;
        if (!targetEvent) {
            setStatus("error");
            setMessage("Could not find this event. Please reopen it and try again.");
            return;
        }

        try {
            await uploadCoverForEvent(file, targetEvent);
            setTimeout(() => {
                setStatus("idle");
                setMessage("");
            }, 2000);
        } catch (error: unknown) {
            console.error("Error uploading sub-event cover:", error);
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "Failed to update cover picture.");
            setTimeout(() => {
                setStatus("idle");
                setMessage("");
            }, 4000);
        }
    };

    const getEventShareUrl = (eventId: string) => `${window.location.origin}/events/${eventId}`;

    const ensureEventJoinId = async (eventToShare: Event) => {
        if (eventToShare.joinId) return eventToShare;

        const joinId = generateEventJoinId(eventToShare.id);
        const eventWithJoinId = { ...eventToShare, joinId };
        await updateEvent(eventToShare.id, { joinId });
        setUserEvents(prev => prev.map(evt => evt.id === eventToShare.id ? { ...evt, joinId } : evt));
        setSharedEvents(prev => prev.map(evt => evt.id === eventToShare.id ? { ...evt, joinId } : evt));
        setEventDetailGalleries(prev => prev.map(evt => evt.id === eventToShare.id ? { ...evt, joinId } : evt));
        setSelectedMainEvent(prev => prev?.id === eventToShare.id ? { ...prev, joinId } : prev);
        return eventWithJoinId;
    };

    const handleShareEventLink = async (eventToShare: Event) => {
        try {
            const eventWithJoinId = await ensureEventJoinId(eventToShare);
            setShareModalEvent(eventWithJoinId);
        } catch (error) {
            console.error("Failed to prepare share modal:", error);
            setMessage("Unable to prepare share invitation.");
            setStatus("error");
            setTimeout(() => {
                setStatus("idle");
                setMessage("");
            }, 3000);
        }
    };

    const handleShareInvitation = async () => {
        if (!shareModalEvent) return;

        const url = getEventShareUrl(shareModalEvent.id);
        const text = `Join our event "${shareModalEvent.title}" on EveBash!\nJoin ID: ${shareModalEvent.joinId || generateEventJoinId(shareModalEvent.id)}\nLink: ${url}`;

        try {
            if (navigator.share) {
                await navigator.share({
                    title: `Join ${shareModalEvent.title}`,
                    text,
                    url,
                });
            } else {
                await navigator.clipboard.writeText(text);
                setMessage("Invitation copied!");
                setStatus("success");
                setTimeout(() => {
                    setStatus("idle");
                    setMessage("");
                }, 2000);
            }
        } catch (error) {
            console.error("Sharing failed:", error);
        }
    };

    const toDateInputValue = (value?: string) => {
        if (!value) return "";
        const trimmed = value.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

        const parsed = new Date(trimmed);
        if (Number.isNaN(parsed.getTime())) return "";

        const year = parsed.getFullYear();
        const month = String(parsed.getMonth() + 1).padStart(2, "0");
        const day = String(parsed.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    const getDaysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();

    const clampDatePickerValue = (value: { month: number; day: number; year: number }) => ({
        ...value,
        day: Math.min(value.day, getDaysInMonth(value.month, value.year)),
    });

    const getDatePartsFromInputValue = (value?: string) => {
        const normalized = toDateInputValue(value);
        if (!normalized) {
            const today = new Date();
            return { month: today.getMonth(), day: today.getDate(), year: today.getFullYear() };
        }

        const [year, month, day] = normalized.split("-").map(Number);
        return { month: month - 1, day, year };
    };

    const formatDatePickerValue = (value: { month: number; day: number; year: number }) => (
        `${value.year}-${String(value.month + 1).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`
    );

    const formatFriendlyDatePickerValue = (value: { month: number; day: number; year: number }) => (
        formatCreateEventDate(new Date(value.year, value.month, value.day))
    );

    const openDatePicker = (target: "rename" | "create" = "rename") => {
        setDatePickerTarget(target);
        setDatePickerValue(getDatePartsFromInputValue(target === "create" ? eventDate : newDate));
        setShowDatePickerModal(true);
    };

    const openUploadForEvent = (eventId: string, title: string) => {
        if (manageLevel === "event-details") {
            setSelectedEventId(eventId);
            setSelectedEventName(title);
            const targetEvent = userEvents.find(evt => evt.id === eventId)
                || eventDetailGalleries.find(evt => evt.id === eventId)
                || (selectedMainEvent?.id === eventId ? selectedMainEvent : undefined);
            setGalleryMessageText(targetEvent?.description || "");
            setManageMode("add-image");
            setStatus("idle");
            setMessage("");
            const params = new URLSearchParams(searchParams);
            params.set("view", "manage");
            params.set("level", "event-details");
            params.set("mode", "add-image");
            params.set("eventId", selectedMainEvent?.id || eventId);
            params.set("galleryId", eventId);
            router.push(`/host?${params.toString()}`);
            return;
        }

        const params = new URLSearchParams(searchParams);
        params.set("view", "manage");
        // Maintain current level if valid, otherwise assume photos for this specific action context?
        // Actually, adding images usually implies looking at photos.
        params.set("level", "photos");
        params.set("mode", "add-image");
        params.set("eventId", eventId);

        router.push(`/host?${params.toString()}`);

        // Reset UI transients
        setStatus("idle");
        setMessage("");
    };

    const handleRenameClick = (e: React.MouseEvent, evt: Event, mode: "title" | "date" = "title") => {
        e.stopPropagation();
        setEditDetailsMode(mode);
        setRenamingEvent(evt);
        setNewTitle(evt.title);
        setNewDate(toDateInputValue(evt.date));
        setActiveMenu(null);
    };

    const closeCreateSuccessModal = () => {
        setShowCreateSuccessModal(false);
        setStatus("idle");
        setMessage("");
    };

    const closeRenameModal = () => {
        setRenamingEvent(null);
        setEditDetailsMode("title");
        setNewTitle("");
        setNewDate("");
    };

    const handleRenameSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!renamingEvent || !newTitle.trim()) return;

        // Optimistic Update
        const updatedEvents = userEvents.map(evt =>
            evt.id === renamingEvent.id ? { ...evt, title: newTitle, date: newDate } : evt
        );
        setUserEvents(updatedEvents);

        const currentRenamingEvent = renamingEvent;
        setRenamingEvent(null);
        setEditDetailsMode("title");
        setNewTitle("");
        setNewDate("");
        setMessage(currentRenamingEvent.type === "sub" ? "Gallery updated!" : "Event updated!");
        setStatus("success");

        try {
            await updateEvent(currentRenamingEvent.id, { title: newTitle, date: newDate });
            setTimeout(() => { setStatus("idle"); setMessage(""); }, 2000);
            if (currentRenamingEvent.id === selectedEventId) {
                setSelectedEventName(newTitle);
            }
            setEventDetailGalleries(prev => prev.map(evt =>
                evt.id === currentRenamingEvent.id ? { ...evt, title: newTitle, date: newDate } : evt
            ));
            if (selectedMainEvent && currentRenamingEvent.id === selectedMainEvent.id) {
                setSelectedMainEvent(prev => prev ? { ...prev, title: newTitle, date: newDate } : null);
            }
        } catch (error) {
            console.error("Failed to rename event:", error);
            setMessage("Failed to save changes.");
            setStatus("error");
            // Revert
            setUserEvents(userEvents);
        }
    };

    const handleSaveGalleryMessage = async () => {
        if (!activeEventDetailEvent) return;

        const nextDescription = galleryMessageText.trim();
        setStatus("uploading");
        setMessage("Saving gallery message...");

        try {
            await updateEvent(activeEventDetailEvent.id, { description: nextDescription });
            setUserEvents(prev => prev.map(evt => evt.id === activeEventDetailEvent.id ? { ...evt, description: nextDescription } : evt));
            setEventDetailGalleries(prev => prev.map(evt => evt.id === activeEventDetailEvent.id ? { ...evt, description: nextDescription } : evt));
            setSelectedMainEvent(prev => prev?.id === activeEventDetailEvent.id ? { ...prev, description: nextDescription } : prev);
            setGalleryMessageText(nextDescription);
            setStatus("success");
            setMessage("Gallery message updated.");
            setTimeout(() => {
                setStatus("idle");
                setMessage("");
            }, 2000);
        } catch (error) {
            console.error("Failed to update gallery message:", error);
            setStatus("error");
            setMessage("Failed to update gallery message.");
        }
    };

    const moveSubGallery = async (galleryId: string, direction: -1 | 1) => {
        const currentIndex = eventDetailGalleries.findIndex(gallery => gallery.id === galleryId);
        const nextIndex = currentIndex + direction;
        if (currentIndex < 0 || nextIndex < 0 || nextIndex >= eventDetailGalleries.length) return;

        const nextGalleries = [...eventDetailGalleries];
        [nextGalleries[currentIndex], nextGalleries[nextIndex]] = [nextGalleries[nextIndex], nextGalleries[currentIndex]];
        setEventDetailGalleries(nextGalleries);
        await updateSubEventsOrder(nextGalleries.map(gallery => gallery.id));
        fetchUserEvents();
    };

    const moveGalleryMedia = async (photoId: string, direction: -1 | 1) => {
        const currentItems = galleryMediaTab === "videos" ? videoItems : photoItems;
        const currentIndex = currentItems.findIndex(item => item.id === photoId);
        const nextIndex = currentIndex + direction;
        if (currentIndex < 0 || nextIndex < 0 || nextIndex >= currentItems.length) return;

        const reorderedItems = [...currentItems];
        [reorderedItems[currentIndex], reorderedItems[nextIndex]] = [reorderedItems[nextIndex], reorderedItems[currentIndex]];
        const reorderedIds = reorderedItems.map(item => item.id);
        setCurrentEventPhotos(prev => {
            const reorderedSet = new Set(reorderedIds);
            const otherItems = prev.filter(item => !reorderedSet.has(item.id));
            return galleryMediaTab === "videos"
                ? [...otherItems.filter(item => item.mediaType !== "video" && item.resourceType !== "video"), ...reorderedItems]
                : [...reorderedItems, ...otherItems.filter(item => item.mediaType === "video" || item.resourceType === "video")];
        });
        await updatePhotosOrder(reorderedIds);
    };

    const handleUpdateTemplate = async (templateId: string) => {
        if (!templateTargetEvent) return;

        setStatus("uploading");
        setMessage("Applying new theme...");

        // Optimistic Update for current list
        const updatedEvents = userEvents.map(evt =>
            evt.id === templateTargetEvent.id ? { ...evt, templateId } : evt
        );
        setUserEvents(updatedEvents);

        try {
            // Update main event
            await updateEvent(templateTargetEvent.id, { templateId });

            // If it's a main event, cascade the update to all its sub-events
            if (templateTargetEvent.type === 'main') {
                setMessage("Updating all galleries matching new theme...");
                const subEvents = await getSubEvents(templateTargetEvent.id);

                // Update all sub-events concurrently
                const updatePromises = subEvents.map(subEvent =>
                    updateEvent(subEvent.id, { templateId })
                );

                await Promise.all(updatePromises);
                console.log(`[Dashboard] Cascaded template change '${templateId}' to ${subEvents.length} sub-events.`);
            }

            setShowTemplateModal(false);
            setTemplateTargetEvent(null);
            setMessage("Theme updated successfully! ✨");
            setStatus("success");
            setTimeout(() => { setStatus("idle"); setMessage(""); }, 2000);

            // Refresh to ensure everything is synced
            fetchUserEvents();
        } catch (error) {
            console.error("Failed to update template:", error);
            setMessage("Failed to save changes.");
            setStatus("error");
            // Revert
            fetchUserEvents(); // Re-fetch from server to guarantee correct state
        }
    };



    const handleDeleteEvent = async (eventId: string) => {
        setStatus("uploading");
        setMessage("Deleting event...");
        const isDeletingCurrentEvent =
            eventId === selectedEventId ||
            eventId === selectedMainEvent?.id ||
            searchParams.get("eventId") === eventId;

        try {
            const eventToDelete = userEvents.find(e => e.id === eventId) || eventDetailGalleries.find(e => e.id === eventId);
            const isGallery = eventToDelete?.type === "sub";

            const success = await deleteEvent(eventId);
            if (success) {
                setStatus("success");
                setMessage("");
                setShowDeleteConfirm(null);
                setShowDeleteSuccessType(isGallery ? "gallery" : "event");
                setActiveMenu(null);
                if (eventId === selectedEventId) {
                    setSelectedEventId("");
                    setSelectedEventName("");
                    setManageMode("list");
                }
                if (eventId === selectedMainEvent?.id) {
                    setSelectedMainEvent(null);
                    navigateTo("/host");
                }
                setEventDetailGalleries(prev => prev.filter(gallery => gallery.id !== eventId));
                fetchUserEvents();
                if (isDeletingCurrentEvent) {
                    navigateTo("/host");
                }
                setTimeout(() => { setStatus("idle"); setMessage(""); }, 2000);
            } else {
                setStatus("error");
                setMessage("Failed to delete event.");
            }
        } catch (err) {
            console.error(err);
            setStatus("error");
            setMessage("Error deleting event.");
        }
    };

    const handleDeletePhoto = async (photoId: string) => {
        try {
            const success = await deletePhoto(photoId);
            if (success) {
                setCurrentEventPhotos(prev => prev.filter(p => p.id !== photoId));
                setStatus("success");
                setMessage("Photo removed.");
                setTimeout(() => { setStatus("idle"); setMessage(""); }, 2000);
            } else {
                setStatus("error");
                setMessage("Failed to delete photo.");
            }
            await fetchStorageStats();
            await refreshEventFavourites(selectedMainEventId);
        } catch (error) {
            console.error("Error deleting photo:", error);
            setStatus("error");
            setMessage("Error removing photo.");
        }
    };

    // Deletes the selected items after a confirm, 4 at a time (one request per item, like the single delete)
    const handleDeleteSelectedMedia = async () => {
        const items = activeGalleryItems.filter(item => selectedMediaIds.has(item.id));
        if (items.length === 0) return;
        const what = items.length === 1 ? "1 item" : `${items.length} items`;
        if (!(await confirmDialog({ title: `Delete ${what}?`, message: `${items.length === 1 ? "It" : "They"}'ll be removed from this event for everyone. This can't be undone.`, confirmLabel: "Delete", tone: "danger" }))) return;

        setStatus("uploading");
        setMessage(`Deleting ${what}...`);
        const deletedIds = new Set<string>();
        let next = 0;
        const worker = async () => {
            while (next < items.length) {
                const item = items[next++];
                if (await deletePhoto(item.id)) deletedIds.add(item.id);
            }
        };
        await Promise.all(Array.from({ length: Math.min(4, items.length) }, worker));

        setCurrentEventPhotos(prev => prev.filter(photo => !deletedIds.has(photo.id)));
        const failed = items.length - deletedIds.size;
        if (failed === 0) {
            setStatus("success");
            setMessage(`Deleted ${deletedIds.size === 1 ? "1 item" : `${deletedIds.size} items`}.`);
            exitMediaSelection();
        } else {
            // Keep the failed ones selected so the host can try again
            setSelectedMediaIds(new Set(items.filter(item => !deletedIds.has(item.id)).map(item => item.id)));
            setStatus("error");
            setMessage(`Deleted ${deletedIds.size} of ${items.length}. ${failed === 1 ? "1 item" : `${failed} items`} couldn't be deleted. Please try again.`);
        }
        setTimeout(() => { setStatus("idle"); setMessage(""); }, 4000);
        await fetchStorageStats();
        await refreshEventFavourites(selectedMainEventId);
    };

    const toggleMediaSelection = (photoId: string) => {
        setSelectedMediaIds(prev => {
            const next = new Set(prev);
            if (next.has(photoId)) next.delete(photoId); else next.add(photoId);
            return next;
        });
    };

    const exitMediaSelection = () => {
        setIsSelectingMedia(false);
        setSelectedMediaIds(new Set());
    };

    // Returns an error message for the dialog, or null when the move succeeded.
    const handleMoveMedia = async (targetGalleryId: string): Promise<string | null> => {
        if (!mediaToMove || mediaToMove.length === 0) return null;
        const ids = mediaToMove.map(item => item.id);
        const result = await movePhotosToGallery(ids, targetGalleryId);
        if (result.error) return result.error;

        const movedIds = new Set(ids);
        const targetLabel = targetGalleryId === selectedMainEvent?.id
            ? "Home (Primary Gallery)"
            : eventDetailGalleries.find(gallery => gallery.id === targetGalleryId)?.title || "the selected gallery";
        // The Primary Gallery view lists every gallery's media, so items stay and only change source there.
        setCurrentEventPhotos(prev => isPrimaryGalleryView
            ? prev.map(item => movedIds.has(item.id) ? { ...item, eventId: targetGalleryId } : item)
            : prev.filter(item => !movedIds.has(item.id)));
        setMediaToMove(null);
        exitMediaSelection();
        setStatus("success");
        setMessage(`Moved ${ids.length === 1 ? "1 item" : `${ids.length} items`} to ${targetLabel}.`);
        setTimeout(() => { setStatus("idle"); setMessage(""); }, 2500);
        return null;
    };

    // Copies the originals into the user's EB Vault; the items stay in the event. Returns an error for the dialog.
    const handleSaveToVault = async (vaultFolderId: string | null): Promise<string | null> => {
        if (!mediaToSave || mediaToSave.length === 0) return null;
        try {
            const { saved, failed } = await vaultApi.saveFromEvent(mediaToSave.map(item => item.id), vaultFolderId);
            if (saved.length === 0) return failed[0]?.error || "Nothing could be saved. Please try again.";
            setMediaToSave(null);
            exitMediaSelection();
            setStatus(failed.length ? "error" : "success");
            setMessage(failed.length
                ? `Saved ${saved.length} of ${saved.length + failed.length} to EB Vault. ${failed[0].error}`
                : `Saved ${saved.length === 1 ? "1 item" : `${saved.length} items`} to EB Vault.`);
            setTimeout(() => { setStatus("idle"); setMessage(""); }, 4000);
            return null;
        } catch (error) {
            return error instanceof Error ? error.message : "Couldn't save to EB Vault. Please try again.";
        }
    };

    const handleToggleEventFavourite = async (photoId: string) => {
        if (!selectedMainEventId || !user?.uid) return;

        try {
            const result = await toggleEventFavouritePhoto(selectedMainEventId, photoId, user.uid);
            if (result.error) {
                setStatus("error");
                setMessage(result.error);
                return;
            }

            setEventFavouritePhotoIds(prev => {
                const next = new Set(prev);
                if (result.favourited) next.add(photoId);
                else next.delete(photoId);
                return next;
            });
            setStatus("success");
            setMessage(result.favourited ? "Added to Primary Gallery." : "Removed from Primary Gallery.");
            await refreshEventFavourites(selectedMainEventId);
            setTimeout(() => { setStatus("idle"); setMessage(""); }, 2000);
        } catch (error) {
            console.warn("Error updating favourite photo:", error);
            setStatus("error");
            setMessage("Failed to update Primary Gallery.");
        }
    };

    const handleRotatePhoto = async (photoId: string, direction: "left" | "right") => {
        try {
            setStatus("uploading");
            setMessage(direction === "left" ? "Rotating photo left..." : "Rotating photo right...");

            const result = await rotatePhoto(photoId, direction);
            if (!result.success || !result.url || !result.thumbnailUrl) {
                throw new Error(result.error || "Failed to rotate photo.");
            }

            const cacheBuster = result.cacheBuster || Date.now();
            const displayUrl = `${result.url}?v=${cacheBuster}`;
            const displayThumbnailUrl = `${result.thumbnailUrl}?v=${cacheBuster}`;

            setCurrentEventPhotos(prev => prev.map(photo => (
                photo.id === photoId
                    ? {
                        ...photo,
                        url: displayUrl,
                        thumbnailUrl: displayThumbnailUrl,
                        width: result.width ?? photo.width,
                        height: result.height ?? photo.height,
                        size: result.size ?? photo.size,
                    }
                    : photo
            )));

            setViewingPhoto((prev: any | null) => prev?.id === photoId ? {
                ...prev,
                src: displayUrl,
                width: result.width ?? prev.width,
                height: result.height ?? prev.height,
            } : prev);

            setStatus("success");
            setMessage("Photo rotation saved.");
            setTimeout(() => { setStatus("idle"); setMessage(""); }, 2000);
        } catch (error) {
            console.error("Error rotating photo:", error);
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "Error rotating photo.");
        }
    };

    const ownEventIdentifiers = new Set([user.uid, user.email].filter(Boolean) as string[]);
    const activeSubEvent = userEvents.find(e => e.id === selectedEventId)
        || eventDetailGalleries.find(e => e.id === selectedEventId)
        || (selectedMainEvent?.id === selectedEventId ? selectedMainEvent : undefined);
    const coverUrl = resolveEventCoverImage(activeSubEvent?.coverImage, 'preview', activeSubEvent?.category || selectedMainEvent?.category);
    const isInlineEventDetailGalleryEditor = manageLevel === "event-details" && activeEventDetailTab === "galleries" && manageMode === "add-image";
    const activeEventDetailEvent = isInlineEventDetailGalleryEditor ? (activeSubEvent || selectedMainEvent) : selectedMainEvent;
    const activeGalleryOriginalMessage = activeEventDetailEvent?.description || "";
    const hasGalleryMessageChanges = galleryMessageText !== activeGalleryOriginalMessage;
    const photoItems = currentEventPhotos.filter(photo => photo.mediaType !== "video" && photo.resourceType !== "video" && photo.status !== "uploading");
    const videoItems = currentEventPhotos.filter(photo => (photo.mediaType === "video" || photo.resourceType === "video") && photo.status === "processed");
    const selectedMediaItems = galleryMediaTab === "videos" ? videoItems : photoItems;
    const isPrimaryGalleryView = !!selectedMainEvent && selectedEventId === selectedMainEvent.id;
    const sourceGalleryOptions = [selectedMainEvent, ...eventDetailGalleries]
        .filter((gallery): gallery is Event => !!gallery)
        .map(gallery => ({
            id: gallery.id,
            label: gallery.id === selectedMainEvent?.id ? "Home (Primary Gallery)" : gallery.title,
            legacyId: gallery.legacyId,
            count: selectedMediaItems.filter(photo => photo.eventId === gallery.id || (!!gallery.legacyId && photo.eventId === gallery.legacyId)).length,
        }))
        .filter(option => option.count > 0);
    const effectiveSourceGalleryFilter = sourceGalleryOptions.some(option => option.id === sourceGalleryFilter)
        ? sourceGalleryFilter
        : "all";
    const isFavouriteFilterActive = !isPrimaryGalleryView && showOnlyFavourites;
    const sourceFilteredMediaItems = isPrimaryGalleryView && effectiveSourceGalleryFilter !== "all"
        ? selectedMediaItems.filter(photo => {
            const source = sourceGalleryOptions.find(option => option.id === effectiveSourceGalleryFilter);
            return photo.eventId === source?.id || (!!source?.legacyId && photo.eventId === source.legacyId);
        })
        : selectedMediaItems;
    const favouriteFilteredItems = isFavouriteFilterActive
        ? sourceFilteredMediaItems.filter(photo => eventFavouritePhotoIds.has(photo.id))
        : sourceFilteredMediaItems;
    const uploaderOptions = buildUploaderOptions(favouriteFilteredItems, uploaderDetails[selectedEventId] || {}, user.uid);
    const effectiveUploaderFilter = uploaderOptions.some(option => option.userId === uploaderFilter) ? uploaderFilter : "all";
    const isUploaderFilterActive = effectiveUploaderFilter !== "all";
    const activeGalleryItems = isUploaderFilterActive
        ? favouriteFilteredItems.filter(photo => uploaderOf(photo) === effectiveUploaderFilter)
        : favouriteFilteredItems;
    const activeGalleryFilterCount = [isUploaderFilterActive, isFavouriteFilterActive, isPrimaryGalleryView && effectiveSourceGalleryFilter !== "all"].filter(Boolean).length;
    const isAnyGalleryFilterActive = isUploaderFilterActive || isFavouriteFilterActive || (isPrimaryGalleryView && effectiveSourceGalleryFilter !== "all");
    // Shown once more than one person uploaded here (or more pages could reveal another uploader)
    const showUploaderFilter = new Set(currentEventPhotos.map(uploaderOf)).size > 1 || hasMorePhotos || allMediaLoadedFor === selectedEventId;
    const activeFavouriteCount = selectedMediaItems.filter(photo => eventFavouritePhotoIds.has(photo.id)).length;
    const moveTargetGalleries = [selectedMainEvent, ...eventDetailGalleries]
        .filter((gallery): gallery is Event => !!gallery)
        .map(gallery => ({ id: gallery.id, label: gallery.id === selectedMainEvent?.id ? "Home (Primary Gallery)" : gallery.title }));
    const canMoveMedia = moveTargetGalleries.length > 1;
    const stripUrlQuery = (value?: string | null) => (value || "").split("?")[0];
    const createdEvents = userEvents.filter(evt => evt.createdBy && ownEventIdentifiers.has(evt.createdBy));
    const legacySharedEvents = userEvents.filter(evt => !evt.createdBy || !ownEventIdentifiers.has(evt.createdBy));

    const pendingGuestRequests = trafficLogs.filter(log => log.status === "pending");
    const pendingRequestsByEvent = Object.entries(
        pendingGuestRequests.reduce<Record<string, any[]>>((groups, log) => {
            const eventTitle = log.eventTitle || "Untitled Event";
            groups[eventTitle] = groups[eventTitle] || [];
            groups[eventTitle].push(log);
            return groups;
        }, {})
    );
    const hostConsoleTabs = [
        { id: "hosted", label: "Host", count: userEvents.length, Icon: HostIcon },
        { id: "shared", label: "Shared", count: sharedEvents.length, Icon: Users },
        { id: "request", label: "Requests", count: pendingGuestRequests.length, Icon: UserPlus },
    ] as const;
    const eventDetailPendingLogs = eventDetailLogs.filter(log => log.status === "pending");
    // Admins and members share one table in list order, so a row doesn't jump when its Admin switch flips
    const eventDetailApprovedLogs = eventDetailLogs.filter(log => log.status === "approved");
    const eventDetailAdminCount = eventDetailApprovedLogs.filter(log => !!log.canAdmin).length;
    const eventDetailVisibleLogsCount = eventDetailPendingLogs.length + eventDetailApprovedLogs.length;
    // Galleries without a template show Midnight Hero on the guest page
    const designTemplate = TEMPLATE_THEMES.find(t => t.id === (selectedMainEvent?.templateId || "hero"));
    const designTemplateLabel = designTemplate?.label || selectedMainEvent?.templateId || "Midnight Hero";
    const planDetails = getPlanDetails(user.role);
    const subscriptionStatus = getSubscriptionStatus({
        role: user.role,
        planStartDate: user.planStartDate,
        planEndDate: user.planEndDate,
    });
    const shouldWarnExpiredPlanMedia = subscriptionStatus.status === "grace";
    const storagePercent = getUsagePercent(totalStorage, planDetails.storageBytes);
    const eventPercent = getUsagePercent(totalMainEvents, planDetails.eventLimit);
    const isImmersiveHostEventView = view === "manage" && manageLevel === "event-details";
    const mediaTabs = [
        { id: "photos", label: `Photos (${currentEventMediaCounts.photos})`, icon: ImageIcon },
        { id: "videos", label: `Videos (${currentEventMediaCounts.videos})`, icon: Video },
    ] as const;

    const getEventOwnerName = (evt: Event) => {
        if (!evt.createdBy) return "Unknown owner";
        if (evt.createdBy.includes("@")) return evt.createdBy;
        return eventOwners[evt.createdBy]?.name || "Unknown owner";
    };

    const getSharedAccessLabel = (evt: Event) => {
        const ownerId = evt.createdBy;
        const isFullManager = !!ownerId && user.roleType === "primary" && (
            user.delegatedBy === ownerId ||
            user.delegatedBy === eventOwners[ownerId]?.email ||
            user.delegatedBy === workspaceOwner?.id
        );

        return isFullManager ? "Full Manager" : "Event Manager";
    };

    // Guest list on the Permissions tab: one row per guest with a switch per permission. From xl up it's a
    // table (Member / Role / Permissions / Actions); below that each row stacks into a card.
    // Borders use plain border-slate-800 (globals.css re-themes it); divide-slate-800, xl:border-slate-800 and bg-slate-800/60 fall through to cream.
    const renderEventDetailPermissionTable = (logs: EventDetailLog[], isPending: boolean) => {
        const columns = isPending
            ? "xl:grid-cols-[minmax(0,1fr)_8rem_repeat(4,5.5rem)_16rem]"
            : "xl:grid-cols-[minmax(0,1fr)_8rem_repeat(4,5.5rem)_6.5rem]";
        const headerLabel = "text-[11px] font-black uppercase tracking-[0.16em] text-slate-500";
        const permissionColumns = [
            { key: "view", label: "View" },
            { key: "canAdmin", label: "Admin" },
            { key: "canUpload", label: "Upload" },
            { key: "canComment", label: "Comment" },
        ] as const;

        return (
            <div className="overflow-hidden rounded-[1.5rem] border border-slate-700 bg-slate-900/50">
                <div className={cn("hidden border-b border-slate-700 bg-slate-900 xl:grid", columns)}>
                    <div className={cn("row-span-2 self-center px-5 py-3", headerLabel)}>Member</div>
                    <div className={cn("row-span-2 flex items-center border-l border-slate-800 px-4", headerLabel)}>Role</div>
                    <div className="col-span-4 border-b border-l border-slate-800 py-2.5 text-center text-[11px] font-black uppercase tracking-[0.18em] text-[#CA9C68]">Permissions</div>
                    <div className={cn("row-span-2 flex items-center justify-end border-l border-slate-800 px-5", headerLabel)}>Actions</div>
                    {permissionColumns.map(({ key, label }) => (
                        <div key={key} className={cn("border-l border-slate-800 px-2 py-2.5 text-center", headerLabel)}>{label}</div>
                    ))}
                </div>

                <div>
                    {logs.map((log) => {
                        const guestName = log.name || "Guest";
                        const loginDate = log.loginAt?.seconds
                            ? new Date(log.loginAt.seconds * 1000).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                            : "Unknown";
                        const contact = log.email || log.phone || "No contact";
                        const hasAdminAccess = Boolean(log.canAdmin);
                        const role = isPending
                            ? { label: "Pending", icon: RefreshCw, className: "border-sky-400/30 bg-sky-400/10 text-sky-300" }
                            : hasAdminAccess
                                ? { label: "Admin", icon: ShieldCheck, className: "border-[#CA9C68]/30 bg-[#CA9C68]/10 text-[#CA9C68]" }
                                : { label: "Member", icon: Users, className: "border-slate-700 bg-slate-800 text-slate-300" };
                        const RoleIcon = role.icon;
                        const roleBadge = (
                            <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-widest", role.className)}>
                                <RoleIcon className="h-3 w-3" />
                                {role.label}
                            </span>
                        );
                        const removeGuest = async () => {
                            // Only drop the row once it's really deleted (not on Cancel or a failed request); otherwise the
                            // guest looked removed but kept their approved row and got straight back in when asking again
                            if (await handleGuestDelete(log.id)) {
                                setEventDetailLogs(prev => prev.filter(item => item.id !== log.id));
                            }
                        };

                        return (
                            <div
                                key={log.id}
                                className={cn(
                                    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-4 border-t border-slate-800 p-4 transition-colors first:border-t-0 hover:bg-slate-900 xl:items-stretch xl:gap-0 xl:p-0",
                                    columns
                                )}
                            >
                                <button
                                    type="button"
                                    onClick={() => setSelectedGuestLog(log)}
                                    title="View guest details"
                                    className="group/member col-start-1 row-start-1 flex min-w-0 items-center gap-3 text-left xl:px-5 xl:py-3.5"
                                >
                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#CA9C68]/10 text-sm font-black text-[#CA9C68]">
                                        {guestName.charAt(0)}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block truncate text-base font-black text-white transition-colors group-hover/member:text-[#CA9C68]">{guestName}</span>
                                        <span className="block truncate text-xs font-bold text-slate-400">{contact} • {loginDate}</span>
                                        <span className="mt-2 flex xl:hidden">{roleBadge}</span>
                                    </span>
                                </button>

                                <div className="hidden items-center border-l border-slate-800 px-4 xl:flex">{roleBadge}</div>

                                <div className="col-span-2 row-start-2 grid grid-cols-4 gap-2 rounded-2xl border border-slate-800 bg-slate-950/40 p-3 xl:contents">
                                    {permissionColumns.map(({ key, label }) => {
                                        let control: React.ReactNode;
                                        if (key === "view") {
                                            // Not a switch: approved guests can always view; removing a guest is the trash button
                                            control = isPending ? (
                                                <span className="flex h-7 items-center text-sm font-black text-slate-600" aria-label="Can't view until approved">—</span>
                                            ) : (
                                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#CA9C68]/10 text-[#CA9C68]" aria-label="Can view" title="Approved guests can view this event">
                                                    <Check className="h-4 w-4" />
                                                </span>
                                            );
                                        } else {
                                            // Admins always get uploads and comments, so those switches show on and are locked
                                            const impliedByAdmin = key !== "canAdmin" && hasAdminAccess;
                                            const isOn = Boolean(log[key]) || impliedByAdmin;
                                            control = (
                                                <button
                                                    type="button"
                                                    role="switch"
                                                    aria-checked={isOn}
                                                    aria-label={`${label} for ${guestName}`}
                                                    title={impliedByAdmin ? "Admins can always upload and comment" : undefined}
                                                    disabled={impliedByAdmin}
                                                    onClick={() => void handleGuestPermissionToggle(log, key)}
                                                    className={cn(
                                                        "relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CA9C68]/60 disabled:cursor-not-allowed disabled:opacity-50",
                                                        isOn ? "bg-[#CA9C68]" : "bg-slate-700"
                                                    )}
                                                >
                                                    <span className={cn(
                                                        "absolute left-0 top-1 h-5 w-5 rounded-full bg-white transition-transform",
                                                        isOn ? "translate-x-6" : "translate-x-1"
                                                    )} />
                                                </button>
                                            );
                                        }

                                        return (
                                            <div key={key} className="flex flex-col items-center gap-2 border-slate-800 xl:justify-center xl:border-l xl:px-2 xl:py-3.5">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 xl:hidden">{label}</span>
                                                {control}
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className={cn(
                                    "flex items-center justify-end gap-2 border-slate-800 xl:col-span-1 xl:col-start-auto xl:row-start-auto xl:border-l xl:px-5 xl:py-3.5",
                                    isPending ? "col-span-2 row-start-3" : "col-start-2 row-start-1"
                                )}>
                                    {isPending && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => void handleGuestStatusUpdate(log.id, "approved")}
                                                className="flex-1 rounded-full bg-emerald-500/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-emerald-300 xl:flex-none"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void handleGuestDeny(log)}
                                                className="flex-1 rounded-full bg-rose-500/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-rose-300 xl:flex-none"
                                            >
                                                Deny
                                            </button>
                                        </>
                                    )}
                                    {/* Members only: a pending request is turned down with Deny. Plain title, not <Tooltip>: its
                                        hidden bubble pokes past the table's clipped right edge */}
                                    {!isPending && (
                                        <button
                                            type="button"
                                            onClick={() => void removeGuest()}
                                            aria-label={`Remove ${guestName}`}
                                            title="Remove guest"
                                            className="rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-slate-400 transition-colors hover:border-rose-400/30 hover:bg-rose-500/10 hover:text-rose-400"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderEventCard = (evt: Event) => {
        const isSharedEvent = !evt.createdBy || !ownEventIdentifiers.has(evt.createdBy);

        return (
        <motion.div
            key={evt.id}
            whileHover={{ y: -5 }}
            onClick={(e) => {
                if (manageLevel === "events") {
                    navigateWithModifierClick(e, `/host?view=manage&level=event-details&eventId=${evt.id}`, router.push);
                } else {
                    navigateWithModifierClick(e, `/host?view=manage&level=photos&mode=add-image&eventId=${evt.id}`, router.push);
                }
            }}
            className="group relative flex cursor-pointer flex-col rounded-2xl border border-[#273034] bg-[#0E141A] p-3 text-left transition-colors hover:border-[#CA9C68]/40"
        >
            {/* Same card as the dashboard (src/components/dashboard/DashboardEvents.tsx) */}
            <div className="relative w-full overflow-hidden rounded-xl bg-[#0E141A]" style={{ aspectRatio: "16 / 10" }}>
                <img
                    src={resolveEventCoverImage(evt.coverImage, 'thumbnail', evt.category)}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-30 blur-xl"
                />
                <img
                    src={resolveEventCoverImage(evt.coverImage, 'thumbnail', evt.category)}
                    alt={evt.title}
                    className="absolute inset-0 h-full w-full transition-transform duration-700 group-hover:scale-105"
                    style={getCoverImageStyle(evt)}
                />
                {evt.category && (
                    <div className="absolute left-3 top-3 z-10 rounded-full border border-[#CA9C68]/30 bg-black/65 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#CA9C68] backdrop-blur-sm">
                        {evt.category}
                    </div>
                )}
            </div>

            <div className="absolute top-5 right-5 z-20">
                <Tooltip text="Options">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenu(activeMenu === evt.id ? null : evt.id);
                        }}
                        className="rounded-full border border-white/20 bg-black/65 p-2 text-white backdrop-blur-sm transition-all hover:bg-black/80 active:scale-95"
                    >
                        <MoreHorizontal className="h-4 w-4" />
                    </button>
                </Tooltip>

                <AnimatePresence>
                    {activeMenu === evt.id && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: -10 }}
                            className="absolute right-0 mt-3 w-44 bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 py-2 z-30 overflow-hidden"
                        >
                            <button
                                onClick={(e) => handleRenameClick(e, evt)}
                                className="w-full px-5 py-3 text-left text-sm font-bold flex items-center space-x-3 hover:bg-slate-900/50 transition-colors"
                                title="Rename this event"
                            >
                                <Pencil className="w-4 h-4 text-blue-500" />
                                <span>Rename</span>
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openUploadForEvent(evt.id, evt.title);
                                    setActiveMenu(null);
                                }}
                                className="w-full px-5 py-3 text-left text-sm font-bold flex items-center space-x-3 hover:bg-slate-900/50 transition-colors border-t border-slate-700"
                                title="Manage photos for this event"
                            >
                                <Camera className="w-4 h-4 text-purple-500" />
                                <span>Edit Photos</span>
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setTemplateTargetEvent(evt);
                                    setShowTemplateModal(true);
                                    setActiveMenu(null);
                                }}
                                className="w-full px-5 py-3 text-left text-sm font-bold flex items-center space-x-3 hover:bg-slate-900/50 transition-colors border-t border-slate-700 text-sky-400"
                                title="Change design template"
                            >
                                <LayoutDashboard className="w-4 h-4" />
                                <span>Change Template</span>
                            </button>
                            {manageLevel === "events" && (
                                <a
                                    href={`/events/${evt.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenu(null);
                                    }}
                                    className="w-full px-5 py-3 text-left text-sm font-bold flex items-center space-x-3 hover:bg-slate-900/50 transition-colors border-t border-slate-700 text-blue-600"
                                    title="Visit public website"
                                >
                                    <Globe className="w-4 h-4" />
                                    <span>Visit Website</span>
                                </a>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleShareEventLink(evt);
                                    setActiveMenu(null);
                                }}
                                className="w-full px-5 py-3 text-left text-sm font-bold flex items-center space-x-3 hover:bg-slate-900/50 transition-colors border-t border-slate-700"
                                title="Share event invitation"
                            >
                                <Share2 className="w-4 h-4 text-emerald-500" />
                                <span>Share Event</span>
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowDeleteConfirm(evt.id);
                                    setActiveMenu(null);
                                }}
                                className="w-full px-5 py-3 text-left text-sm font-bold flex items-center space-x-3 hover:bg-red-50 text-red-600 transition-colors border-t border-slate-700"
                                title="Permanently delete this event"
                            >
                                <Trash2 className="w-4 h-4" />
                                <span>Delete</span>
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="px-1 pb-1 pt-4 text-left text-white">
                <h3 className="truncate text-xl leading-tight text-white" style={SERIF}>{evt.title}</h3>
                <div className="mt-2 flex items-center gap-1.5 text-sm text-slate-400">
                    <Calendar className="h-4 w-4 shrink-0 text-[#CA9C68]" aria-hidden="true" />
                    <span className="truncate">{formatShortEventDate(formatEventDate(evt.date))}</span>
                </div>
                {isSharedEvent && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        <div className="inline-flex max-w-full items-center rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-slate-300">
                            <span className="truncate">Owner: {getEventOwnerName(evt)}</span>
                        </div>
                        <div className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-slate-300">
                            {getSharedAccessLabel(evt)}
                        </div>
                    </div>
                )}
                {user?.delegatedBy && workspaceOwner && (
                    <div className="mt-3 inline-flex max-w-full items-center rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-slate-300">
                        <span className="truncate">Managed for: {workspaceOwner.email}</span>
                    </div>
                )}
            </div>
        </motion.div>
        );
    };

    const renderManagedWorkspaceBanner = () => {
        if (!user?.delegatedBy || !workspaceOwner) return null;

        return (
            <div className="bg-[#CA9C68]/30 rounded-3xl p-6 border border-[#CA9C68]/30 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-[#CA9C68]/50 rounded-2xl flex items-center justify-center text-[#CA9C68]">
                        <Users size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-200 font-serif">Managed Workspace</h3>
                        <p className="text-sm text-stone-700 font-sans">
                            You are managing the account for <span className="text-[#CA9C68] font-bold">{workspaceOwner.email}</span>
                        </p>
                    </div>
                </div>
                <div className="hidden sm:block">
                    <span className="px-4 py-1.5 bg-slate-800 text-[#CA9C68] rounded-full text-[10px] font-black uppercase tracking-widest border border-[#CA9C68]/50 shadow-sm">
                        {user.roleType === 'primary' ? 'Full Manager' : 'Event Admin'}
                    </span>
                </div>
            </div>
        );
    };

    const renderEventSection = (title: string, items: Event[], showWorkspaceBanner = false) => {
        if (items.length === 0) return null;

        return (
            <section className="space-y-5">
                <div>
                    <h3 className="text-xl font-bold text-slate-200 font-serif">{title}</h3>
                    <p className="text-sm text-slate-400 font-sans">{items.length} {items.length === 1 ? "item" : "items"}</p>
                </div>
                {showWorkspaceBanner && renderManagedWorkspaceBanner()}
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {items.map(renderEventCard)}
                </div>
            </section>
        );
    };



    const shareModalUrl = shareModalEvent ? getEventShareUrl(shareModalEvent.id) : "";
    const shareModalJoinId = shareModalEvent?.joinId || (shareModalEvent ? generateEventJoinId(shareModalEvent.id) : "");

    return (
        <div className={cn(
            "min-h-screen font-serif text-slate-200 transition-colors duration-300",
            isImmersiveHostEventView ? "bg-black" : "bg-[#050505]"
        )}>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <AnimatePresence mode="wait">
                    {view === "main" ? (
                        <motion.div
                            key="main-view"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-8"
                        >
                            <div className="relative">
                                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-4 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-[#0B0F13] p-3 shadow-2xl shadow-black/30 sm:p-4 xl:flex xl:gap-x-6">
                                    <div className="order-1 flex min-w-0 items-center gap-3 sm:gap-4">
                                        <Tooltip text="Plan Details">
                                            <button
                                                onClick={() => {
                                                    fetchStorageStats();
                                                    setShowPlanDetailsModal(true);
                                                }}
                                                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-[#CA9C68] transition-colors hover:bg-white/10"
                                                aria-label="Plan Details"
                                            >
                                                <HostConsoleIcon className="h-6 w-6" aria-hidden="true" />
                                            </button>
                                        </Tooltip>
                                        <div className="min-w-0">
                                            <h2 className="truncate font-brand font-normal tracking-wide text-[#F5EFE6]" style={{ fontSize: 28, lineHeight: "30px" }}>Host Console</h2>
                                            <p className="truncate font-sans text-slate-400" style={{ fontSize: 12, lineHeight: "18px" }}>Event operations</p>
                                        </div>
                                    </div>

                                    <span className="order-2 hidden h-10 w-px shrink-0 bg-white/10 xl:block" />

                                    <div className="order-3 col-span-2 flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-black/40 p-1.5 [scrollbar-width:none] sm:gap-1.5 xl:max-w-2xl xl:flex-1">
                                        {hostConsoleTabs.map(({ id, label, count, Icon }) => {
                                            const isActive = activeTab === id;
                                            const highlightCount = isActive || (id === "request" && count > 0);
                                            return (
                                                <button
                                                    key={id}
                                                    onClick={() => setActiveTab(id)}
                                                    aria-pressed={isActive}
                                                    className={cn(
                                                        "flex h-12 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-2 font-sans text-[11px] font-semibold uppercase tracking-[0.04em] max-[360px]:gap-1 max-[360px]:px-1.5 max-[360px]:tracking-normal transition-colors sm:h-[3.25rem] sm:gap-2.5 sm:px-4 sm:text-[13px] sm:tracking-[0.14em]",
                                                        isActive
                                                            ? "border-[#CA9C68]/50 bg-gradient-to-b from-[#CA9C68]/20 to-[#CA9C68]/[0.06] text-[#E2BC8C] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                                                            : "border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
                                                    )}
                                                >
                                                    <Icon className="hidden h-[18px] w-[18px] shrink-0 sm:block" />
                                                    {label}
                                                    <span className={cn(
                                                        "min-w-6 rounded-md px-1.5 py-0.5 text-center text-[11px] font-bold tracking-normal sm:min-w-7 sm:text-xs",
                                                        highlightCount ? "bg-[#CA9C68] text-slate-950" : "bg-white/10 text-slate-300"
                                                    )}>
                                                        {count}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="order-2 xl:order-4 xl:ml-auto">
                                        <button
                                            onClick={() => setIsCreateModalOpen(true)}
                                            className="flex h-12 items-center gap-2 whitespace-nowrap rounded-xl bg-[#CA9C68] px-4 font-sans text-sm font-black text-slate-950 transition-colors hover:bg-[#D7AE7D] sm:px-5"
                                            aria-label="Create Event"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span className="sm:hidden">New</span>
                                            <span className="hidden sm:inline">Create Event</span>
                                        </button>
                                    </div>
                                </div>

                                {loadingEvents ? (
                                    <div className="flex justify-center py-12">
                                        <div className="w-8 h-8 border-4 border-slate-600 border-t-sky-400 rounded-full animate-spin" />
                                    </div>
                                ) : activeTab === "request" ? (
                                    <div className="mt-6">
                                        {pendingGuestRequests.length === 0 ? (
                                            <div className="flex min-h-64 flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed border-slate-700 text-center text-slate-400">
                                                <Check className="mb-4 h-10 w-10 text-emerald-400/40" />
                                                <p className="mb-2 text-lg font-bold text-slate-200">All caught up!</p>
                                                <p className="text-sm">New access requests will appear here.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-5">
                                                {pendingRequestsByEvent.map(([eventTitle, logs]) => (
                                                    <section key={eventTitle} className="rounded-[1.5rem] border border-slate-700 bg-slate-900/60 p-4 sm:p-5">
                                                        <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                                                            <div className="min-w-0">
                                                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Event</p>
                                                                <h3 className="truncate text-lg font-black text-white">{eventTitle}</h3>
                                                            </div>
                                                            <span className="shrink-0 rounded-full bg-[#CA9C68] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-950">
                                                                {logs.length} {logs.length === 1 ? "Request" : "Requests"}
                                                            </span>
                                                        </div>
                                                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                                                            {logs.map((log) => (
                                                                <div key={log.id} className="flex flex-col gap-4 rounded-[1.2rem] border border-white/10 bg-black p-4 sm:flex-row sm:items-center">
                                                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#CA9C68] text-lg font-black text-slate-950">
                                                                        {(log.name || "G").charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="truncate text-base font-bold text-white">{log.name || "Anonymous Guest"}</p>
                                                                        <p className="mt-1 truncate text-sm text-slate-400">{log.email || log.phone || "No contact provided"}</p>
                                                                    </div>
                                                                    <div className="flex gap-2 sm:ml-auto">
                                                                        <button
                                                                            onClick={() => void handleGuestDeny(log)}
                                                                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500 text-white transition-colors hover:bg-rose-400"
                                                                            aria-label="Deny request"
                                                                        >
                                                                            <X className="h-4 w-4" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleGuestStatusUpdate(log.id, "approved")}
                                                                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white transition-colors hover:bg-emerald-400"
                                                                            aria-label="Approve request"
                                                                        >
                                                                            <Check className="h-4 w-4" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </section>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                                        {(activeTab === 'hosted' ? userEvents : sharedEvents).map((event) => (
                                            <DashboardEventCard
                                                key={event.id}
                                                event={event}
                                                guests={consoleEventStats[event.id]?.guests}
                                                onOpen={() => router.push(`/host?view=manage&level=event-details&eventId=${event.id}`)}
                                                footer={activeTab === "shared" && (
                                                    <p className="mt-2 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                                                        Owner: <span className="normal-case text-white">{getEventOwnerName(event)}</span>
                                                    </p>
                                                )}
                                            />
                                        ))}

                                        {(activeTab === 'hosted' ? userEvents : sharedEvents).length === 0 && (
                                            <div className="col-span-full h-64 rounded-[1.5rem] border-2 border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-400">
                                                <p className="font-medium text-lg mb-2">{activeTab === 'hosted' ? 'No events yet' : 'Nothing shared'}</p>
                                                <p className="text-sm text-center">{activeTab === 'hosted' ? 'Create your first album to see it here.' : 'Events shared with you will appear here.'}</p>
                                                {activeTab === 'hosted' && (
                                                    <button
                                                        onClick={() => setIsCreateModalOpen(true)}
                                                        className="mt-4 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-full text-sm font-bold transition-colors"
                                                    >
                                                        Create one now
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

{/* HOST GUIDE SECTION */}
                            <div className="mt-16 rounded-3xl border border-[#2B2F2E] bg-[#10171C]/90 p-6 shadow-xl shadow-black/25 backdrop-blur-sm sm:p-8">
                                <div className="mb-8">
                                    <h2 className="text-3xl font-bold text-white">Host Your Perfect Event</h2>
                                    <p className="text-slate-400 mt-2">Everything you need to capture memories flawlessly.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                                    {/* Benefit 1 */}
                                    <div className="rounded-xl border border-[#2B2F2E] bg-[#0D1318] p-6">
                                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-[#CA9C68]/20 bg-[#CA9C68]/10">
                                            <ImageIcon className="h-6 w-6 text-[#CA9C68]" />
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-2">Stunning Galleries</h3>
                                        <p className="text-slate-400 text-sm">Create unlimited, high-resolution albums to preserve every beautiful memory.</p>
                                    </div>

                                    {/* Benefit 2 */}
                                    <div className="rounded-xl border border-[#2B2F2E] bg-[#0D1318] p-6">
                                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-[#CA9C68]/20 bg-[#CA9C68]/10">
                                            <Users className="h-6 w-6 text-[#CA9C68]" />
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-2">Guest Sharing</h3>
                                        <p className="text-slate-400 text-sm">Easily invite guests via QR codes and securely share photos directly with them.</p>
                                    </div>

                                    {/* Benefit 3 */}
                                    <div className="rounded-xl border border-[#2B2F2E] bg-[#0D1318] p-6">
                                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-[#CA9C68]/20 bg-[#CA9C68]/10">
                                            <Video className="h-6 w-6 text-[#CA9C68]" />
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-2">Live Streaming</h3>
                                        <p className="text-slate-400 text-sm">Broadcast your special moments live to loved ones who could not attend in person.</p>
                                    </div>
                                </div>

                                {/* SECTION 4: HOW TO HOST (YouTube Card) */}
                                <div
                                    onClick={() => window.open('https://www.youtube.com/@EveBashApp', '_blank')}
                                    className="relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-indigo-900 to-indigo-950 p-6 cursor-pointer shadow-lg shadow-indigo-900/20 group border border-indigo-500/20"
                                >
                                    <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
                                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between">
                                        <div className="mb-6 md:mb-0 max-w-md">
                                            <div className="inline-block px-3 py-1 bg-indigo-500/20 backdrop-blur-sm rounded-lg text-indigo-300 text-[10px] font-bold tracking-widest mb-3">
                                                HOW TO HOST
                                            </div>
                                            <h3 className="text-2xl font-bold text-white mb-1">Watch & Learn</h3>
                                            <p className="text-indigo-200 text-sm font-medium">Watch our step-by-step tutorials and host your event like a pro.</p>
                                        </div>
                                        <div className="flex items-center bg-indigo-500/20 backdrop-blur-md px-5 py-3 rounded-xl text-white font-bold w-fit group-hover:bg-indigo-500/40 transition-colors border border-indigo-400/30">
                                            <Play className="w-4 h-4 mr-2" fill="currentColor" /> Watch on YouTube
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ) : view === "manage" ? (
                        <motion.div
                            key="manage-view"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            {manageLevel !== "event-details" && (
                            <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-4">
                                <div>
                                    <h2 className="text-3xl font-bold mb-2 uppercase tracking-wide">
                                        {manageLevel === "events" ? "Your Events" : "Galleries"}
                                    </h2>
                                    <p className="text-slate-700 font-sans">
                                        {manageLevel === "events"
                                            ? "Organize your wedding into high-level events."
                                            : `Galleries within ${selectedMainEvent?.title}`
                                        }
                                    </p>
                                </div>

                                <div className="flex space-x-3">
                                    <Tooltip text={`Create new ${manageLevel === "events" ? "event" : "gallery"}`}>
                                        <button
                                            onClick={() => {
                                                // Preserve existing params but add mode=add-event
                                                const params = new URLSearchParams(searchParams);
                                                params.set("mode", "add-event");
                                                router.push(`/host?${params.toString()}`);

                                                // Reset generic UI state
                                                setStatus("idle");
                                                setMessage("");
                                                setSelectedTemplate("hero");
                                            }}
                                            className="flex items-center space-x-2 px-6 py-3 bg-slate-900 text-white rounded-full text-sm font-bold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl active:scale-95"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>Create {manageLevel === "events" ? "Event" : "Gallery"}</span>
                                        </button>
                                    </Tooltip>
                                </div>
                            </div>
                            )}

                            {manageLevel === "event-details" && !selectedMainEvent && (
                                <div className="flex min-h-80 items-center justify-center rounded-[2rem] border border-slate-700 bg-slate-900/60 p-8 text-center">
                                    <div className="space-y-4">
                                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-sky-300" />
                                        <div>
                                            <h3 className="text-xl font-bold text-white">Loading Event Details</h3>
                                            <p className="mt-2 text-sm font-semibold text-slate-400">Restoring this event after refresh.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {manageLevel === "event-details" && selectedMainEvent && (
                                <div className="space-y-8">
                                    <div className="relative overflow-hidden rounded-[2rem] border border-[#CA9C68]/25 bg-neutral-950 shadow-2xl shadow-black/50">
                                        <div
                                            ref={(node) => {
                                                if (activeEventDetailEvent && coverPositionEvent?.id === activeEventDetailEvent.id) {
                                                    coverPreviewRef.current = node;
                                                }
                                            }}
                                            className={cn(
                                                "relative h-[26rem] sm:h-[30rem]",
                                                activeEventDetailEvent && coverPositionEvent?.id === activeEventDetailEvent.id && "cursor-grab active:cursor-grabbing"
                                            )}
                                            onPointerDown={activeEventDetailEvent && coverPositionEvent?.id === activeEventDetailEvent.id ? handleCoverPointerDown : undefined}
                                            onPointerMove={activeEventDetailEvent && coverPositionEvent?.id === activeEventDetailEvent.id ? handleCoverPointerMove : undefined}
                                            onPointerUp={activeEventDetailEvent && coverPositionEvent?.id === activeEventDetailEvent.id ? handleCoverPointerEnd : undefined}
                                            onPointerCancel={activeEventDetailEvent && coverPositionEvent?.id === activeEventDetailEvent.id ? handleCoverPointerEnd : undefined}
                                            style={activeEventDetailEvent && coverPositionEvent?.id === activeEventDetailEvent.id ? { touchAction: "none" } : undefined}
                                        >
                                            <img
                                                src={resolveEventCoverImage(activeEventDetailEvent?.coverImage, 'preview', activeEventDetailEvent?.category || selectedMainEvent.category)}
                                                alt={activeEventDetailEvent?.title || selectedMainEvent.title}
                                                draggable={false}
                                                className="h-full w-full select-none"
                                                style={getCoverImageStyle(activeEventDetailEvent)}
                                            />
                                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#080a14] via-[#080a14]/55 to-black/10" />
                                            <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/45 to-transparent" />
                                            {activeEventDetailEvent && coverPositionEvent?.id === activeEventDetailEvent.id && (
                                                <div className="pointer-events-none absolute inset-x-6 top-6 z-20 rounded-full border border-white/15 bg-black/60 px-4 py-2 text-center text-xs font-black uppercase tracking-[0.2em] text-white/90 backdrop-blur-md">
                                                    Drag image
                                                </div>
                                            )}
                                            {isCoverUpdating && (
                                                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-slate-950/45 backdrop-blur-sm">
                                                    <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-slate-950/80 px-5 py-4 text-sm font-bold text-white shadow-2xl">
                                                        <Loader2 className="h-5 w-5 animate-spin text-royal-gold" />
                                                        <span>{message || "Updating your cover image..."}</span>
                                                    </div>
                                                </div>
                                            )}
                                            {!coverPositionEvent && (
                                            <div className="absolute right-3 top-3 z-10 flex items-start gap-0.5 sm:right-6 sm:top-5 sm:gap-2">
                                                {activeEventDetailEvent && (
                                                    <>
                                                        <button
                                                            onClick={() => handleToggleCoverMode(activeEventDetailEvent)}
                                                            disabled={status === "uploading"}
                                                            className="flex flex-col items-center gap-1.5 rounded-xl px-2 py-2 text-white/85 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:px-3"
                                                        >
                                                            {(activeEventDetailEvent.coverMode || "fill") === "fill"
                                                                ? <Maximize2 className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.5} />
                                                                : <Minimize2 className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.5} />}
                                                            <span className="text-center text-[10px] font-medium uppercase leading-tight tracking-wider sm:text-xs">{(activeEventDetailEvent.coverMode || "fill") === "fill" ? "Fit" : "Fill"}</span>
                                                        </button>
                                                        {(activeEventDetailEvent.coverMode || "fill") === "fill" && (
                                                            <button
                                                                onClick={() => openCoverPosition(activeEventDetailEvent)}
                                                                disabled={status === "uploading"}
                                                                className="flex flex-col items-center gap-1.5 rounded-xl px-2 py-2 text-white/85 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:px-3"
                                                            >
                                                                <Settings className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.5} />
                                                                <span className="text-center text-[10px] font-medium uppercase leading-tight tracking-wider sm:text-xs">Position</span>
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                                <label className="flex flex-col items-center gap-1.5 rounded-xl px-2 py-2 text-white/85 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:px-3 cursor-pointer">
                                                    <ImageIcon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.5} />
                                                    <span className="text-center text-[10px] font-medium uppercase leading-tight tracking-wider sm:text-xs">Change Cover</span>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={handleMainEventCoverUpload}
                                                        className="hidden"
                                                        disabled={status === "uploading"}
                                                    />
                                                </label>
                                                <button
                                                    onClick={() => activeEventDetailEvent && handleRemoveCoverForEvent(activeEventDetailEvent)}
                                                    disabled={status === "uploading"}
                                                    className="flex flex-col items-center gap-1.5 rounded-xl px-2 py-2 text-white/85 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:px-3 hover:text-rose-200"
                                                >
                                                    <Trash2 className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.5} />
                                                    <span className="text-center text-[10px] font-medium uppercase leading-tight tracking-wider sm:text-xs">Remove Cover</span>
                                                </button>
                                            </div>
                                            )}
                                            <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
                                                <div className="min-w-0">
                                                    <h3 className="line-clamp-2 break-words font-serif text-5xl font-semibold leading-[1.15] text-[#F5EFE6] sm:text-7xl">{activeEventDetailEvent?.title || selectedMainEvent.title}</h3>
                                                    <p className="mt-3 font-sans text-base text-white/85 sm:text-xl">{formatEventDate(activeEventDetailEvent?.date || selectedMainEvent.date)}</p>
                                                </div>
                                                <div className="flex shrink-0 items-end gap-1 sm:gap-3">
                                                    <button
                                                        onClick={(e) => activeEventDetailEvent && handleRenameClick(e, activeEventDetailEvent, "title")}
                                                        className="flex flex-col items-center gap-1.5 rounded-xl px-2 py-2 text-white/85 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:px-3"
                                                    >
                                                        <Pencil className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={1.5} />
                                                        <span className="text-center text-[10px] font-medium uppercase leading-tight tracking-wider sm:text-xs sm:text-sm">Edit Title</span>
                                                    </button>
                                                    <button
                                                        onClick={(e) => activeEventDetailEvent && handleRenameClick(e, activeEventDetailEvent, "date")}
                                                        className="flex flex-col items-center gap-1.5 rounded-xl px-2 py-2 text-white/85 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:px-3"
                                                    >
                                                        <Calendar className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={1.5} />
                                                        <span className="text-center text-[10px] font-medium uppercase leading-tight tracking-wider sm:text-xs sm:text-sm">Edit Date</span>
                                                    </button>
                                                    <button
                                                        onClick={() => activeEventDetailEvent && handleShareEventLink(activeEventDetailEvent)}
                                                        className="flex flex-col items-center gap-1.5 rounded-xl px-2 py-2 text-white/85 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:px-3"
                                                    >
                                                        <Share2 className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={1.5} />
                                                        <span className="text-center text-[10px] font-medium uppercase leading-tight tracking-wider sm:text-xs sm:text-sm">Share</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* sm:grid-cols-4 again when the Partners tab comes back */}
                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                        {([
                                            { id: "galleries", label: "Galleries", subtitle: "Photos and Videos", Icon: GalleriesIcon },
                                            { id: "permissions", label: "Permissions", subtitle: "Event access control", Icon: PermissionsIcon },
                                            { id: "design", label: "Design", subtitle: "Theme and style", Icon: DesignIcon },
                                            // Hidden until Phase 2 (comes with EB Business and EB Network). To restore, uncomment:
                                            // { id: "partners", label: "Partners", subtitle: "Linked vendors", Icon: PartnersIcon },
                                        ] as const).map(({ id, label, subtitle, Icon }) => {
                                            const isActive = activeEventDetailTab === id;
                                            const pendingCount = id === "permissions"
                                                ? eventDetailLogs.filter(log => log.status === "pending").length
                                                : 0;
                                            return (
                                                <button
                                                    key={id}
                                                    onClick={() => {
                                                        setActiveEventDetailTab(id);
                                                        if (id !== "galleries") setManageMode("list");
                                                    }}
                                                    aria-pressed={isActive}
                                                    className={cn(
                                                        "group relative flex min-h-[5.5rem] items-center overflow-hidden rounded-2xl border px-3 py-4 text-left transition-colors sm:px-5 sm:py-5",
                                                        isActive
                                                            ? "border-[#CA9C68]/70 bg-gradient-to-br from-[#CA9C68]/[0.09] via-neutral-950 to-neutral-950"
                                                            : "border-white/10 bg-gradient-to-br from-white/[0.04] to-neutral-950 hover:border-white/20 hover:from-white/[0.07]"
                                                    )}
                                                >
                                                    {isActive && (
                                                        <span className="absolute inset-x-0 top-0 h-[3px] bg-[#CA9C68]" />
                                                    )}
                                                    <Icon className="h-6 w-6 shrink-0 text-[#CA9C68] sm:h-8 sm:w-8" />
                                                    <span className="mx-2.5 h-10 w-px shrink-0 bg-white/10 sm:mx-5 sm:h-12" />
                                                    <span className="min-w-0">
                                                        <span className="block truncate text-sm font-semibold text-white sm:text-lg">{label}</span>
                                                        <span className="mt-0.5 block text-[11px] leading-snug text-neutral-400 sm:mt-1 sm:text-sm">{subtitle}</span>
                                                    </span>
                                                    {pendingCount > 0 && (
                                                        <span className="absolute right-2 top-2 rounded-full bg-[#CA9C68] px-1.5 py-0.5 text-[10px] leading-none sm:right-3 sm:top-3 sm:px-2 font-black text-slate-950">
                                                            {pendingCount}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className={cn(
                                        "rounded-[2rem] border border-white/10 bg-neutral-950 p-5 sm:p-6",
                                        isInlineEventDetailGalleryEditor && "hidden"
                                    )}>
                                        {activeEventDetailTab === "galleries" && (
                                            <div className="space-y-6">
                                                <div className="flex flex-wrap items-center justify-between gap-4">
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#CA9C68]/30 bg-[#CA9C68]/10">
                                                            <GalleryChaptersIcon className="h-6 w-6 text-[#CA9C68]" aria-hidden="true" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-serif text-3xl font-semibold leading-tight text-[#F5EFE6]">Galleries</h4>
                                                                <GalleryTypesInfo />
                                                            </div>
                                                            <p className="text-sm text-slate-400">Your celebration in chapters</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => setIsCreateSubGalleryModalOpen(true)}
                                                        className="flex items-center gap-2 rounded-xl bg-[#CA9C68] px-4 py-2.5 text-sm font-bold text-slate-950 transition-transform hover:-translate-y-0.5"
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                        <span>Add Sub-Gallery</span>
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                                    <div
                                                        className={cn(
                                                            "group relative min-h-[220px] cursor-pointer overflow-hidden rounded-2xl border bg-neutral-900 shadow-lg transition-all hover:border-[#CA9C68]/70 sm:col-span-2",
                                                            selectedEventId === selectedMainEvent.id && manageMode === "add-image"
                                                                ? "border-[#CA9C68]/70"
                                                                : "border-[#CA9C68]/35"
                                                        )}
                                                        onClick={() => openUploadForEvent(selectedMainEvent.id, selectedMainEvent.title)}
                                                    >
                                                        <img
                                                            src={resolveEventCoverImage(selectedMainEvent.coverImage, 'thumbnail', selectedMainEvent.category)}
                                                            alt={selectedMainEvent.title}
                                                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                        />
                                                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />

                                                        <div className="absolute inset-0 flex flex-col justify-between p-4 sm:p-5">
                                                            <div className="flex justify-end">
                                                                <span className="rounded-full border border-[#CA9C68]/60 bg-black/55 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#E8C9A0] shadow-[0_0_14px_rgba(202,156,104,0.35)] backdrop-blur-sm">Primary Collection</span>
                                                            </div>
                                                            <div className="flex items-end justify-between gap-3">
                                                                <h5 className="min-w-0 flex-1 line-clamp-2 font-serif text-2xl font-semibold leading-tight text-white drop-shadow-md sm:text-3xl">Home (Primary Gallery)</h5>
                                                                <span className="flex shrink-0 items-center gap-1 rounded-lg bg-[#CA9C68] px-3 py-2 text-xs font-bold text-slate-950 transition-colors group-hover:bg-[#d8ad7c]">
                                                                    <span>Open</span>
                                                                    <ChevronRight className="h-3.5 w-3.5" />
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {loadingEventDetail ? (
                                                        <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-slate-700 p-8 text-slate-400">
                                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                            <span className="text-sm font-bold">Loading sub-galleries...</span>
                                                        </div>
                                                    ) : eventDetailGalleries.map((gallery) => (
                                                        <div
                                                            key={gallery.id}
                                                            className={cn(
                                                                "group flex min-h-[220px] cursor-pointer flex-col overflow-hidden rounded-2xl border bg-neutral-900 p-2.5 shadow-lg transition-all hover:border-[#CA9C68]/70",
                                                                selectedEventId === gallery.id && manageMode === "add-image"
                                                                    ? "border-[#CA9C68]/70"
                                                                    : "border-[#CA9C68]/35"
                                                            )}
                                                            onClick={() => openUploadForEvent(gallery.id, gallery.title)}
                                                        >
                                                            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-neutral-800">
                                                                <img
                                                                    src={resolveEventCoverImage(gallery.coverImage || selectedMainEvent.coverImage, 'thumbnail', gallery.category || selectedMainEvent.category)}
                                                                    alt={gallery.title}
                                                                    className={cn(
                                                                        "absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105",
                                                                        gallery.isHidden && "opacity-50 grayscale"
                                                                    )}
                                                                />
                                                                {gallery.isHidden && (
                                                                    <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full border border-white/20 bg-black/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-sm">
                                                                        <EyeOff className="h-3 w-3" aria-hidden="true" />
                                                                        Hidden from guests
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-1 items-center justify-between gap-2 px-1.5 pt-3 pb-1">
                                                                <h5 className="min-w-0 flex-1 truncate font-serif text-xl font-semibold text-white" title={gallery.title}>{gallery.title}</h5>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); void toggleGalleryHidden(gallery); }}
                                                                    aria-label={gallery.isHidden ? `Show ${gallery.title} to guests` : `Hide ${gallery.title} from guests`}
                                                                    aria-pressed={!!gallery.isHidden}
                                                                    title={gallery.isHidden ? "Hidden from guests: click to show it" : "Hide from guests"}
                                                                    className={cn(
                                                                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors",
                                                                        gallery.isHidden
                                                                            ? "border-[#CA9C68]/60 bg-[#CA9C68]/15 text-[#E2B77F] hover:bg-[#CA9C68]/25"
                                                                            : "border-white/15 bg-white/5 text-slate-300 hover:border-[#CA9C68]/50 hover:text-[#E2B77F]"
                                                                    )}
                                                                >
                                                                    {gallery.isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(gallery.id); }}
                                                                    aria-label={`Delete ${gallery.title}`}
                                                                    title="Delete gallery"
                                                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-rose-400 transition-colors hover:border-rose-400/40 hover:bg-rose-500/15"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}

                                                    <button
                                                        type="button"
                                                        onClick={() => setIsCreateSubGalleryModalOpen(true)}
                                                        className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#CA9C68]/50 bg-transparent text-[#CA9C68] transition-colors hover:border-[#CA9C68] hover:bg-[#CA9C68]/5"
                                                    >
                                                        <Plus className="h-8 w-8" strokeWidth={1.5} />
                                                        <span className="text-base">Create Sub-Gallery</span>
                                                    </button>
                                                </div>
                                                <div className="pt-6 flex justify-center">
                                                    <button
                                                        onClick={() => setShowDeleteConfirm(selectedMainEvent.id)}
                                                        className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/10 px-8 py-3 text-sm font-black uppercase tracking-widest text-rose-400 hover:bg-rose-500/20 transition-colors"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        <span>Delete Event</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {activeEventDetailTab === "permissions" && (
                                            <div className="space-y-5">
                                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                                    <div>
                                                        <h4 className="text-xl font-black text-white">Permissions</h4>
                                                        <p className="text-sm font-bold text-slate-400">Approve, deny, or remove guest access requests for this event.</p>
                                                    </div>
                                                    {canChangeSelectedEventVisibility && selectedMainEvent && (
                                                        <div className="w-full shrink-0 sm:w-[22rem]">
                                                            <button
                                                                type="button"
                                                                role="switch"
                                                                aria-checked={selectedMainEvent.isPublic}
                                                                aria-label="Public event"
                                                                aria-describedby="event-visibility-description"
                                                                disabled={savingVisibility}
                                                                onClick={() => void changeEventVisibility(!selectedMainEvent.isPublic)}
                                                                className={cn(
                                                                    "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CA9C68]/60 disabled:cursor-wait",
                                                                    selectedMainEvent.isPublic
                                                                        ? "border-[#CA9C68]/70 bg-[#CA9C68]/10"
                                                                        : "border-slate-700 bg-slate-900/45 hover:border-slate-500 hover:bg-slate-900/70"
                                                                )}
                                                            >
                                                                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors", selectedMainEvent.isPublic ? "bg-[#CA9C68] text-slate-950" : "bg-slate-800 text-slate-300")}>
                                                                    {savingVisibility ? <Loader2 className="h-4 w-4 animate-spin" /> : selectedMainEvent.isPublic ? <PublicIcon className="h-5 w-5" /> : <PrivateIcon className="h-5 w-5" />}
                                                                </span>
                                                                <span className="min-w-0 flex-1">
                                                                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Event visibility</span>
                                                                    <span className={cn("block text-sm font-bold", selectedMainEvent.isPublic ? "text-[#E2B77F]" : "text-slate-200")}>{selectedMainEvent.isPublic ? "Public" : "Private"}</span>
                                                                    <span id="event-visibility-description" className="mt-0.5 block text-xs text-slate-400">{selectedMainEvent.isPublic ? "Anyone with the link can view this event and its sub-galleries." : "Guests need your approval to view this event."}</span>
                                                                </span>
                                                                <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", selectedMainEvent.isPublic ? "bg-[#CA9C68]" : "bg-slate-700", savingVisibility && "opacity-60")}>
                                                                    <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform", selectedMainEvent.isPublic ? "translate-x-5" : "translate-x-0.5")} />
                                                                </span>
                                                            </button>
                                                            {savingVisibility && <p role="status" className="sr-only">Saving…</p>}
                                                            {visibilityError && <p role="alert" className="mt-2 text-xs text-rose-300">{visibilityError}</p>}
                                                        </div>
                                                    )}
                                                </div>

                                                {loadingEventDetail ? (
                                                    <div className="flex items-center justify-center rounded-[1.5rem] border border-slate-700 p-8 text-slate-400">
                                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                        <span className="text-sm font-bold">Loading permissions...</span>
                                                    </div>
                                                ) : eventDetailVisibleLogsCount > 0 ? (
                                                    <div className="space-y-6">
                                                        {eventDetailPendingLogs.length > 0 && (
                                                            <section className="space-y-3">
                                                                <h5 className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">
                                                                    Pending Requests ({eventDetailPendingLogs.length})
                                                                </h5>
                                                                {renderEventDetailPermissionTable(eventDetailPendingLogs, true)}
                                                            </section>
                                                        )}

                                                        {eventDetailApprovedLogs.length > 0 && (
                                                            <section className="space-y-3">
                                                                <h5 className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">
                                                                    Members ({eventDetailApprovedLogs.length})
                                                                    {eventDetailAdminCount > 0 && (
                                                                        <span className="text-[#CA9C68]"> · {eventDetailAdminCount} {eventDetailAdminCount === 1 ? "Admin" : "Admins"}</span>
                                                                    )}
                                                                </h5>
                                                                {renderEventDetailPermissionTable(eventDetailApprovedLogs, false)}
                                                            </section>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="rounded-[1.5rem] border border-dashed border-slate-700 p-8 text-center">
                                                        <p className="text-sm font-bold text-slate-400">No guest requests for this event yet.</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {activeEventDetailTab === "design" && (
                                            <div className="space-y-5">
                                                <div>
                                                    <h4 className="text-xl font-black text-white">Event Design</h4>
                                                    <p className="text-sm font-bold text-slate-400">Event type and the template guests see on the app and website.</p>
                                                </div>

                                                <div className="grid gap-4 lg:grid-cols-12">
                                                    <div className="flex flex-col gap-4 lg:col-span-5">
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowCategoryModal(true)}
                                                            className="flex flex-1 items-center justify-between gap-3 rounded-[1.2rem] border border-slate-700 bg-slate-900/50 p-5 text-left transition-colors hover:border-[#CA9C68]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CA9C68]/60"
                                                        >
                                                            <span className="min-w-0">
                                                                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Event Type</span>
                                                                <span className="mt-1 block truncate font-serif text-2xl font-bold text-[#FFF7EB]">{selectedMainEvent.category || 'Select Type'}</span>
                                                            </span>
                                                            <ChevronRight className="h-5 w-5 shrink-0 text-[#CA9C68]" />
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setTemplateTargetEvent(selectedMainEvent);
                                                                setShowTemplateModal(true);
                                                            }}
                                                            className="flex flex-1 items-center justify-between gap-3 rounded-[1.2rem] border border-slate-700 bg-slate-900/50 p-5 text-left transition-colors hover:border-[#CA9C68]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CA9C68]/60"
                                                        >
                                                            <span className="min-w-0">
                                                                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Template</span>
                                                                <span className="mt-1 block truncate font-serif text-2xl font-bold text-[#CA9C68]">{designTemplateLabel}</span>
                                                            </span>
                                                            <ChevronRight className="h-5 w-5 shrink-0 text-[#CA9C68]" />
                                                        </button>
                                                    </div>

                                                    <div className="flex flex-col justify-between gap-5 rounded-[1.2rem] border border-[#CA9C68]/25 bg-[linear-gradient(135deg,rgba(202,156,104,0.12),rgba(27,33,31,0.5)_60%)] p-5 sm:p-6 lg:col-span-7">
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-3">
                                                                {designTemplate && (
                                                                    <span
                                                                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10"
                                                                        style={{ backgroundColor: designTemplate.background?.dark || "#000" }}
                                                                    >
                                                                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: designTemplate.accent }} />
                                                                    </span>
                                                                )}
                                                                <p className="min-w-0 truncate font-serif text-2xl font-bold text-[#CA9C68] sm:text-3xl">{designTemplateLabel}</p>
                                                            </div>
                                                            {designTemplate?.desc && (
                                                                <p className="mt-2 text-base text-slate-300">{designTemplate.desc}</p>
                                                            )}
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={() => window.open(`/events/${encodeURIComponent(selectedMainEvent.id)}`, '_blank', 'noopener,noreferrer')}
                                                            className="flex w-full items-center gap-4 rounded-2xl border border-[#CA9C68]/40 bg-[#CA9C68]/10 px-5 py-4 text-left transition-colors hover:bg-[#CA9C68]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CA9C68]/60"
                                                        >
                                                            <Eye className="h-6 w-6 shrink-0 text-[#CA9C68]" />
                                                            <span className="min-w-0">
                                                                <span className="block font-serif text-base font-bold leading-tight text-[#FFF7EB] sm:text-lg">Preview Guest Theme</span>
                                                                <span className="mt-1 block text-[11px] font-bold uppercase leading-snug tracking-widest text-slate-400">
                                                                    See how guests view your {designTemplateLabel} theme
                                                                </span>
                                                            </span>
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="rounded-[1.5rem] border border-slate-700 bg-slate-950/80 p-5 sm:p-6">
                                                    <div className="mb-5">
                                                        <h5 className="text-lg font-black text-white">Guest Home Preview</h5>
                                                        <p className="text-xs font-bold text-slate-400">A quick sketch of the app and website in your template&apos;s colours. Use Preview Guest Theme for the real page.</p>
                                                    </div>
                                                    <EventDesignPreview
                                                        eventId={selectedMainEvent.id}
                                                        title={selectedMainEvent.title}
                                                        eventType={selectedMainEvent.category}
                                                        dateLabel={formatEventDate(selectedMainEvent.date)}
                                                        coverUrl={resolveEventCoverImage(selectedMainEvent.coverImage, 'preview', selectedMainEvent.category)}
                                                        galleryNames={eventDetailGalleries.filter(gallery => gallery.id !== selectedMainEvent.id).map(gallery => gallery.title || gallery.id)}
                                                        templateId={selectedMainEvent.templateId}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {activeEventDetailTab === "partners" && (
                                            <div className="space-y-6">
                                                <div className="rounded-[1.8rem] border border-[#CA9C68]/20 bg-slate-900/60 p-6 text-left shadow-xl backdrop-blur-md sm:p-8">
                                                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#CA9C68]/30 bg-[#CA9C68]/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-[#CA9C68]">
                                                        <PartnersIcon className="h-4 w-4 text-[#CA9C68]" />
                                                        <span>Event Partners · Phase 2</span>
                                                    </div>
                                                    <h4 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                                                        Coming Soon
                                                    </h4>
                                                    <p className="mt-3 text-sm font-medium leading-relaxed text-slate-300 sm:text-base">
                                                        The Event Partners feature is linked with EB Business & EB Network. In Phase 2, hosts will be able to link verified photographers, caterers, planners, and venues directly to their event.
                                                    </p>
                                                    <div className="mt-6 grid gap-4 sm:grid-cols-3">
                                                        {[
                                                            { title: "Link Verified Vendors", desc: "Attach official vendor profiles to your event dashboard.", icon: Users },
                                                            { title: "EB Business Integration", desc: "Directly showcase service providers registered on EB Business.", icon: Store },
                                                            { title: "Partner Showcase", desc: "Highlight credited partners to your guests on the event page.", icon: Star },
                                                        ].map(({ title, desc, icon: Icon }) => (
                                                            <div key={title} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                                                                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[#CA9C68]/10 text-[#CA9C68]">
                                                                    <Icon className="h-4 w-4" />
                                                                </div>
                                                                <h5 className="text-xs font-black uppercase tracking-wider text-white">{title}</h5>
                                                                <p className="mt-1.5 text-xs font-medium text-slate-400 leading-normal">{desc}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {message && (
                                        <div className={cn(
                                            "rounded-2xl p-4 text-center text-sm font-bold",
                                            status === "success"
                                                ? "bg-emerald-500/10 text-emerald-300"
                                                : status === "error"
                                                    ? "bg-rose-500/10 text-rose-300"
                                                    : "bg-sky-500/10 text-sky-300"
                                        )}>
                                            {message}
                                        </div>
                                    )}
                                </div>
                            )}

                            {manageMode === "list" && manageLevel !== "event-details" && (
                                <div className="space-y-8">
                                    {loadingEvents ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                                            {Array.from({ length: 3 }).map((_, i) => (
                                                <div key={i} className="animate-pulse bg-slate-800 aspect-[4/5] rounded-3xl" />
                                            ))}
                                        </div>
                                    ) : userEvents.length === 0 ? (
                                        <div className="py-20 bg-slate-800 rounded-3xl border border-dashed border-slate-600 flex flex-col items-center justify-center text-center">
                                            <div className="w-20 h-20 bg-slate-900/50 rounded-full flex items-center justify-center mb-6">
                                                <Camera className="w-10 h-10 text-slate-400" />
                                            </div>
                                            <h3 className="text-xl font-bold mb-2">No galleries found</h3>
                                            <p className="text-stone-700 max-w-xs mx-auto mb-8 font-sans">Create your first event by clicking the button above.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-12">
                                            {renderEventSection(manageLevel === "events" ? "Your Created Events" : "Your Created Galleries", createdEvents)}
                                            {renderEventSection(manageLevel === "events" ? "Shared Events" : "Shared Galleries", legacySharedEvents, true)}
                                        </div>
                                    )}
                                </div>
                            )}

                            {manageMode === "add-event" && manageLevel === "events" && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="max-w-lg mx-auto bg-slate-800 p-8 md:p-12 rounded-[2.5rem] shadow-xl border border-slate-700"
                                >
                                    <div className="flex items-center justify-between mb-8">
                                        <h3 className="text-2xl font-bold italic tracking-tight">New Event</h3>
                                        <Tooltip text="Back to list">
                                            <button
                                                onClick={() => {
                                                    const params = new URLSearchParams(searchParams);
                                                    params.set("mode", "list");
                                                    params.delete("galleryId");
                                                    goBackOr(`/host?${params.toString()}`);
                                                }}
                                                className="text-slate-400 hover:text-slate-400 transition-colors"
                                            >
                                                <ChevronLeft className="w-6 h-6" />
                                            </button>
                                        </Tooltip>
                                    </div>

                                    <form onSubmit={handleCreateEventOnly} className="space-y-8">
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-[0.2em] text-stone-700 mb-4 ml-1">
                                                What is the occasion?
                                            </label>
                                            <input
                                                type="text"
                                                value={eventName}
                                                onChange={(e) => setEventName(e.target.value)}
                                                placeholder="e.g. Dream Wedding 2024"
                                                className="w-full px-6 py-5 bg-slate-900/50 border border-slate-700 rounded-3xl focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all outline-none text-xl font-medium"
                                                required
                                                autoFocus
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-[0.2em] text-stone-700 mb-4 ml-1">
                                                Date
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => openDatePicker("create")}
                                                className="flex w-full items-center justify-between px-6 py-5 bg-slate-900/50 border border-slate-700 rounded-3xl focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all outline-none text-xl font-medium text-left"
                                            >
                                                <span className={eventDate ? "text-white" : "text-slate-500"}>
                                                    {eventDate || "Select event date"}
                                                </span>
                                                <ChevronDown className="h-5 w-5 text-slate-400" />
                                            </button>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-[0.2em] text-stone-700 mb-4 ml-1">Event Type</label>
                                            <div className="grid grid-cols-2 gap-3">
                                                {EVENT_TYPE_OPTIONS.map(({ name, icon: Icon }) => {
                                                    const isSelected = eventType === name;
                                                    return (
                                                        <button
                                                            key={name}
                                                            type="button"
                                                            onClick={() => {
                                                                setEventType(name);
                                                                const newTemplates = getTemplatesForEventCategory(name);
                                                                if (newTemplates.length > 0) setSelectedTemplate(newTemplates[0].id);
                                                            }}
                                                            className={cn(
                                                                "flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-black transition-colors",
                                                                isSelected
                                                                    ? "border-[#CA9C68] bg-[#CA9C68] text-slate-950"
                                                                    : "border-slate-700 bg-slate-900/50 text-slate-300 hover:border-[#CA9C68]/60"
                                                            )}
                                                        >
                                                            <Icon className="h-4 w-4" />
                                                            <span>{name}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-[0.2em] text-stone-700 mb-4 ml-1">Choose Style</label>
                                            <div className="flex flex-col gap-3 max-h-[40vh] overflow-y-auto pr-2">
                                                {getTemplatesForEventCategory(eventType).map((template) => {
                                                    const isActive = selectedTemplate === template.id;
                                                    return (
                                                        <div
                                                            key={template.id}
                                                            onClick={() => setSelectedTemplate(template.id)}
                                                            className={cn(
                                                                "flex items-center justify-between p-3 rounded-2xl border-2 transition-colors cursor-pointer",
                                                                isActive ? "bg-slate-900 border-sky-500 shadow-md" : "bg-slate-900/50 border-slate-700 hover:border-slate-500"
                                                            )}
                                                            style={{ borderColor: isActive ? template.accent : undefined }}
                                                        >
                                                            <div className="flex items-center gap-3 flex-1">
                                                                <div
                                                                    className="w-10 h-10 rounded-full flex items-center justify-center border border-slate-700 shadow-sm"
                                                                    style={{ backgroundColor: template.background?.light || '#fff' }}
                                                                >
                                                                    <div
                                                                        className="w-3.5 h-3.5 rounded-full shadow-sm"
                                                                        style={{ backgroundColor: template.accent || '#000' }}
                                                                    />
                                                                </div>

                                                                <div className="flex-1 mr-2">
                                                                    <div
                                                                        className="text-sm font-bold font-outfit"
                                                                        style={{ color: isActive ? template.accent : '#334155' }}
                                                                    >
                                                                        {template.label}
                                                                    </div>
                                                                    <div className="text-[11px] text-slate-500 font-inter mt-0.5 truncate">
                                                                        {template.desc}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {isActive && (
                                                                <div
                                                                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-sm"
                                                                    style={{ backgroundColor: template.accent }}
                                                                >
                                                                    <Check className="w-3 h-3 text-white" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={status === "uploading"}
                                            className={cn(
                                                "w-full py-5 rounded-[1.5rem] font-bold text-lg shadow-lg transition-all flex items-center justify-center space-x-3 active:scale-95",
                                                status === "uploading" ? "bg-stone-300 text-stone-700 cursor-not-allowed" : "bg-slate-900 text-white hover:bg-slate-800"
                                            )}
                                        >
                                            {status === "uploading" ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    <span>Creating...</span>
                                                </>
                                            ) : (
                                                <span>Create Event</span>
                                            )}
                                        </button>

                                        {message && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className={cn(
                                                    "p-4 rounded-2xl text-sm font-bold text-center",
                                                    status === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                                                )}
                                            >
                                                {message}
                                            </motion.div>
                                        )}
                                    </form>
                                </motion.div>
                            )}

                            <AnimatePresence>
                                {isCreateSubGalleryModalOpen && (
                                    <div className={modalStyles.overlay}>
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                            className={cn(modalStyles.panel, "my-8")}
                                        >
                                            <ModalHeader
                                                title="New Sub-Gallery"
                                                onClose={() => setIsCreateSubGalleryModalOpen(false)}
                                            />

                                            <form
                                                onSubmit={async (e) => {
                                                    // Pass true to skip the success modal
                                                    const success = await handleCreateEventOnly(e, true);
                                                    if (success) {
                                                        setIsCreateSubGalleryModalOpen(false);
                                                    }
                                                }}
                                                className="space-y-6"
                                            >
                                                <div>
                                                    <input
                                                        type="text"
                                                        value={eventName}
                                                        onChange={(e) => setEventName(e.target.value)}
                                                        placeholder="Sub-gallery name"
                                                        className={modalStyles.input}
                                                        required
                                                        autoFocus
                                                    />
                                                </div>

                                                <div>
                                                    <label className={modalStyles.label}>
                                                        SUB-GALLERY DATE
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={() => openDatePicker("create")}
                                                        className={cn(modalStyles.input, "flex items-center justify-between text-left")}
                                                    >
                                                        <div className="flex items-center">
                                                            <Calendar className="w-5 h-5 text-[#CA9C68] mr-3" />
                                                            <span className={eventDate ? "text-white" : "text-slate-400"}>
                                                                {eventDate || "Select event date"}
                                                            </span>
                                                        </div>
                                                        <ChevronDown className="h-4 w-4 text-slate-400" />
                                                    </button>
                                                </div>

                                                <button
                                                    type="submit"
                                                    disabled={status === "uploading"}
                                                    className={cn(modalStyles.primary, "mt-2 w-full py-4")}
                                                >
                                                    {status === "uploading" ? (
                                                        <>
                                                            <Loader2 className="w-5 h-5 animate-spin" />
                                                            <span>Creating...</span>
                                                        </>
                                                    ) : (
                                                        <span>Create Sub-Gallery</span>
                                                    )}
                                                </button>

                                                {message && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 5 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        className={status === "success" ? modalStyles.success : modalStyles.error}
                                                    >
                                                        {message}
                                                    </motion.div>
                                                )}
                                            </form>
                                        </motion.div>
                                    </div>
                                )}
                            </AnimatePresence>

                            {manageMode === "add-image" && (manageLevel !== "event-details" || activeEventDetailTab === "galleries") && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    onDragEnter={handleGalleryDrag}
                                    onDragOver={handleGalleryDrag}
                                    onDragLeave={handleGalleryDrag}
                                    onDrop={handleGalleryDrop}
                                    className={cn(
                                        "relative max-w-7xl mx-auto bg-slate-800 p-4 sm:p-8 lg:p-10 rounded-[2rem] shadow-xl border border-slate-700 font-serif transition-colors",
                                        isDraggingPhotos && "border-[#CA9C68] bg-slate-800/95",
                                        isInlineEventDetailGalleryEditor && "mt-8"
                                    )}
                                >
                                    {isDraggingPhotos && (
                                        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-[2rem] border-2 border-dashed border-[#CA9C68] bg-slate-950/70 backdrop-blur-sm">
                                            <div className="flex flex-col items-center text-center">
                                                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#CA9C68] text-slate-950 shadow-lg">
                                                    <Upload className="h-8 w-8" />
                                                </div>
                                                <p className="text-lg font-black text-white">
                                                    {galleryMediaTab === "videos" ? "Drop videos to upload" : "Drop images to upload"}
                                                </p>
                                                <p className="mt-1 text-sm font-bold text-slate-300">They will be added to {selectedEventName}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Sub-event Cover Banner */}
                                    {!isInlineEventDetailGalleryEditor && (
                                    <div
                                        ref={(node) => {
                                            if (activeSubEvent && coverPositionEvent?.id === activeSubEvent.id) {
                                                coverPreviewRef.current = node;
                                            }
                                        }}
                                        className={cn(
                                            "relative w-full h-64 md:h-80 rounded-[2rem] overflow-hidden mb-8 group/cover shadow-md border border-slate-700",
                                            activeSubEvent && coverPositionEvent?.id === activeSubEvent.id && "cursor-grab active:cursor-grabbing"
                                        )}
                                        onPointerDown={activeSubEvent && coverPositionEvent?.id === activeSubEvent.id ? handleCoverPointerDown : undefined}
                                        onPointerMove={activeSubEvent && coverPositionEvent?.id === activeSubEvent.id ? handleCoverPointerMove : undefined}
                                        onPointerUp={activeSubEvent && coverPositionEvent?.id === activeSubEvent.id ? handleCoverPointerEnd : undefined}
                                        onPointerCancel={activeSubEvent && coverPositionEvent?.id === activeSubEvent.id ? handleCoverPointerEnd : undefined}
                                        style={activeSubEvent && coverPositionEvent?.id === activeSubEvent.id ? { touchAction: "none" } : undefined}
                                    >
                                        <img
                                            src={coverUrl}
                                            alt={`${selectedEventName} Cover`}
                                            draggable={false}
                                            className="w-full h-full select-none transition-transform duration-700 group-hover/cover:scale-105"
                                            style={getCoverImageStyle(activeSubEvent)}
                                        />
                                        {/* Elegant dark overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/40 transition-opacity duration-300" />
                                        {activeSubEvent && coverPositionEvent?.id === activeSubEvent.id && (
                                            <div className="pointer-events-none absolute inset-x-6 top-6 z-20 rounded-full border border-white/15 bg-black/60 px-4 py-2 text-center text-xs font-black uppercase tracking-[0.2em] text-white/90 backdrop-blur-md">
                                                Drag image
                                            </div>
                                        )}
                                        {isCoverUpdating && (
                                            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-slate-950/45 backdrop-blur-sm">
                                                <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-slate-950/80 px-5 py-4 text-sm font-bold text-white shadow-2xl">
                                                    <Loader2 className="h-5 w-5 animate-spin text-sky-300" />
                                                    <span>{message || "Updating your cover image..."}</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Floating Glassmorphic "Change Cover" Button */}
                                        {!coverPositionEvent && (
                                        <div className="absolute top-6 right-6 z-10">
                                            <label className="flex items-center space-x-2 px-5 py-3 bg-slate-800/20 hover:bg-slate-800/30 active:bg-slate-800/40 backdrop-blur-md text-white rounded-full text-sm font-bold cursor-pointer transition-all border border-white/30 shadow-lg active:scale-95">
                                                <Camera className="w-4 h-4" />
                                                <span>Change Cover</span>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleSubEventCoverUpload}
                                                    className="hidden"
                                                    disabled={status === "uploading"}
                                                />
                                            </label>
                                        </div>
                                        )}

                                        {/* Information overlay */}
                                        <div className="absolute bottom-6 left-8 right-8 flex items-end justify-between">
                                            <div className="text-white">
                                                <span className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-sky-400">Sub-Event Cover</span>
                                                <div className="flex items-center space-x-3 mt-1">
                                                    <h4 className="text-2xl md:text-3xl font-bold font-serif tracking-tight">{selectedEventName}</h4>
                                                    <button
                                                        onClick={(e) => {
                                                            if (activeSubEvent) {
                                                                handleRenameClick(e, activeSubEvent);
                                                            }
                                                        }}
                                                        className="p-1.5 bg-slate-800/20 hover:bg-slate-800/30 backdrop-blur-md rounded-lg text-white transition-all active:scale-95 border border-white/20"
                                                        title="Rename sub-event"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                                {activeSubEvent?.date && (
                                                    <p className="text-xs text-stone-200 mt-1.5 font-sans flex items-center gap-1.5">
                                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-royal-gold" />
                                                        {activeSubEvent.date}
                                                     </p>
                                                 )}
                                            </div>
                                        </div>
                                    </div>
                                    )}

                                    {/* Header bar: back, gallery title, gallery actions */}
                                    <div className={cn(
                                        "mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-4 border-b border-slate-700 pb-5 sm:mb-8 md:grid-cols-[minmax(max-content,1fr)_minmax(0,auto)_minmax(max-content,1fr)] md:gap-x-6",
                                        isInlineEventDetailGalleryEditor && "-mx-4 -mt-4 rounded-t-[2rem] bg-slate-950 px-4 pt-4 sm:-mx-8 sm:-mt-8 sm:px-8 sm:pt-6 lg:-mx-10 lg:-mt-10 lg:px-10"
                                    )}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const fallbackParams = new URLSearchParams(searchParams);
                                                fallbackParams.set("mode", "list");
                                                fallbackParams.delete("galleryId");

                                                if (isInlineEventDetailGalleryEditor) {
                                                    goBackOr(`/host?${fallbackParams.toString()}`);
                                                    setMessage("");
                                                    setStatus("idle");
                                                    return;
                                                }

                                                goBackOr(`/host?${fallbackParams.toString()}`);
                                            }}
                                            className="col-start-1 row-start-1 inline-flex items-center gap-1.5 justify-self-start rounded-full py-2 pr-3 text-base font-semibold text-slate-300 transition-colors hover:text-white active:scale-95"
                                        >
                                            <ChevronLeft className="h-5 w-5" />
                                            <span>Galleries</span>
                                        </button>

                                        <h3
                                            className="col-span-2 row-start-2 min-w-0 truncate text-center font-serif text-2xl font-semibold tracking-tight text-[#F5EFE6] md:col-span-1 md:col-start-2 md:row-start-1 lg:text-[1.75rem]"
                                            title={selectedEventName}
                                        >
                                            {selectedEventName}
                                            {isInlineEventDetailGalleryEditor && activeEventDetailEvent && (
                                                <> · {activeEventDetailEvent.id === selectedMainEvent?.id ? "Home (Primary Gallery)" : "Sub-Gallery"}</>
                                            )}
                                        </h3>

                                        <div className="col-start-2 row-start-1 flex items-center justify-end gap-2 sm:gap-2.5 md:col-start-3">
                                            <button
                                                type="button"
                                                onClick={handleHostDownloadZip}
                                                disabled={isHostZipping || currentEventPhotos.length === 0}
                                                aria-label={`Download ${galleryMediaTab === "videos" ? "videos" : "photos"} shown (.ZIP)`}
                                                title={`Download ${isAnyGalleryFilterActive ? "the filtered " : "all "}${galleryMediaTab === "videos" ? "videos" : "photos"} in this gallery (.ZIP)`}
                                                className="flex h-10 min-w-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-[#CA9C68]/60 bg-[#CA9C68]/10 px-2.5 font-sans text-sm font-black text-[#E2B77F] transition-colors hover:bg-[#CA9C68]/20 disabled:opacity-40 sm:h-12 sm:px-3.5"
                                            >
                                                {isHostZipping ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        <span>{hostZipProgress}%</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Download className="h-4 w-4" />
                                                        <span className="hidden sm:inline">Download</span>
                                                    </>
                                                )}
                                            </button>

                                            {isInlineEventDetailGalleryEditor && activeEventDetailEvent && activeEventDetailEvent.id !== selectedMainEvent?.id && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowDeleteConfirm(activeEventDetailEvent.id)}
                                                    aria-label="Delete Gallery"
                                                    title="Delete Gallery"
                                                    className="flex h-10 min-w-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-[#B4616A] px-2.5 font-sans text-sm font-black text-[#FCE8EA] transition-colors hover:bg-[#C26E77] sm:h-12 sm:px-3.5"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                    <span className="hidden sm:inline">Delete</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {message && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={cn(
                                                "mb-8 p-4 rounded-2xl text-sm font-bold text-center flex items-center justify-center space-x-2",
                                                status === "success" ? "bg-green-50 text-green-700" :
                                                    status === "error" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
                                            )}
                                        >
                                            {status === "uploading" && <Loader2 className="w-4 h-4 animate-spin" />}
                                            <span>{message}</span>
                                        </motion.div>
                                    )}

                                    {isInlineEventDetailGalleryEditor && activeEventDetailEvent && (
                                        <div className="mb-6 rounded-2xl border border-[#CA9C68]/55 bg-slate-950/40 p-4 sm:p-5">
                                            <div className="mb-3 flex items-center justify-between gap-4">
                                                <p className="text-base font-semibold text-white">Welcome Message</p>
                                                <span className={cn(
                                                    "text-sm",
                                                    galleryMessageText.length >= 200 ? "text-rose-300" : "text-slate-400"
                                                )}>
                                                    {galleryMessageText.length}/200
                                                </span>
                                            </div>
                                            <textarea
                                                value={galleryMessageText}
                                                onChange={(event) => setGalleryMessageText(event.target.value.slice(0, 200))}
                                                placeholder="Write a brief, elegant welcome note..."
                                                maxLength={200}
                                                className="min-h-[7.5rem] w-full resize-none rounded-xl sm:min-h-[5.5rem] border border-[#CA9C68]/50 bg-slate-950/50 px-4 py-3 text-base leading-7 text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-[#CA9C68]"
                                            />
                                            <div className="mt-3 flex justify-end">
                                                <button
                                                    onClick={handleSaveGalleryMessage}
                                                    disabled={!hasGalleryMessageChanges || status === "uploading"}
                                                    className={cn(
                                                        "flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-all active:scale-95",
                                                        hasGalleryMessageChanges && status !== "uploading"
                                                            ? "bg-[#CA9C68] text-slate-950 hover:bg-[#D7AE7D]"
                                                            : "border border-[#CA9C68]/25 bg-[#CA9C68]/10 text-[#CA9C68]/70"
                                                    )}
                                                >
                                                    {status === "uploading" && message.toLowerCase().includes("gallery message") ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : !hasGalleryMessageChanges && (
                                                        <Check className="h-4 w-4" />
                                                    )}
                                                    <span>{hasGalleryMessageChanges ? "Save" : "Saved"}</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {isInlineEventDetailGalleryEditor && activeEventDetailEvent && activeEventDetailEvent.id === selectedEventId && (
                                        <GalleryVideoPanel
                                            gallery={activeEventDetailEvent}
                                            canUpload={canPostVideos}
                                            onUpload={(file) => {
                                                const gallery = activeEventDetailEvent;
                                                // The upload lands in this gallery's Videos and becomes its gallery video once saved
                                                void uploadFiles([file], { kind: "videos", onVideoSaved: (videoId) => { void saveGalleryVideo(gallery, videoId); } });
                                            }}
                                            onChange={(videoId) => saveGalleryVideo(activeEventDetailEvent, videoId)}
                                            onPlay={(video) => setViewingPhoto({
                                                id: video.id,
                                                src: video.url,
                                                storageKey: video.storageKey,
                                                width: video.width,
                                                height: video.height,
                                                filename: video.storageKey?.split('/').pop() || "video",
                                                thumbnailUrl: video.thumbnailUrl,
                                                mediaType: "video",
                                                resourceType: "video"
                                            })}
                                        />
                                    )}

                                    <div className="mb-4 flex rounded-2xl border border-slate-700 bg-slate-900/60 p-1.5">
                                        {mediaTabs.map(({ id, label, icon: Icon }) => {
                                            const active = galleryMediaTab === id;
                                            return (
                                                <button
                                                    key={id}
                                                    type="button"
                                                    onClick={() => setGalleryMediaTab(id)}
                                                    aria-pressed={active}
                                                    className={cn(
                                                        "inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-semibold transition-colors",
                                                        active ? "bg-[#CA9C68] text-slate-950 shadow-sm" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                                    )}
                                                >
                                                    <Icon className="h-4 w-4" />
                                                    <span>{label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {/* Filter (top left) and view toggle on one line */}
                                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                                        <div ref={galleryFilterMenuRef} className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setIsGalleryFilterOpen(open => !open)}
                                            aria-expanded={isGalleryFilterOpen}
                                            aria-haspopup="dialog"
                                            className={cn(
                                                "flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors",
                                                isGalleryFilterOpen || activeGalleryFilterCount > 0
                                                    ? "border-[#CA9C68]/70 bg-[#CA9C68]/10 text-[#E2B77F]"
                                                    : "border-slate-700 bg-slate-900/45 text-slate-100 hover:border-slate-500 hover:bg-slate-900/70"
                                            )}
                                        >
                                            <SlidersHorizontal className="h-4 w-4 shrink-0 text-[#CA9C68]" />
                                            <span>Filter</span>
                                            {activeGalleryFilterCount > 0 && (
                                                <span className="min-w-5 rounded-md bg-[#CA9C68] px-1.5 py-0.5 text-center font-sans text-xs font-bold text-slate-950">{activeGalleryFilterCount}</span>
                                            )}
                                            <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", isGalleryFilterOpen && "rotate-180")} />
                                        </button>
                                        {/* Source gallery (or Favourites only), Uploaded by and Select */}
                                        {isGalleryFilterOpen && (
                                        <div role="dialog" aria-label="Gallery filters" className="absolute left-0 top-full z-30 mt-2 flex w-[min(21rem,calc(100vw-2rem))] flex-col gap-3 rounded-2xl border border-slate-700 bg-slate-950 p-3 shadow-2xl shadow-black/50">
                                        {isPrimaryGalleryView ? (
                                        <div className="flex h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/45 pl-3 pr-1.5" title="Filter Primary Gallery media by origin">
                                            <Layers3 className="h-4 w-4 shrink-0 text-[#CA9C68]" />
                                            <span className="flex-1 whitespace-nowrap text-sm font-semibold text-slate-100">Source gallery</span>
                                            <FilterDropdown
                                                value={effectiveSourceGalleryFilter}
                                                onChange={setSourceGalleryFilter}
                                                ariaLabel="Filter by source gallery"
                                                options={[
                                                    { value: "all", label: `All galleries (${selectedMediaItems.length})` },
                                                    ...sourceGalleryOptions.map(option => ({ value: option.id, label: `${option.label} (${option.count})` })),
                                                ]}
                                            />
                                        </div>
                                        ) : (
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={showOnlyFavourites}
                                            onClick={() => setShowOnlyFavourites(current => !current)}
                                            title={`${activeFavouriteCount} in ${galleryMediaTab === "videos" ? "Videos" : "Photos"}`}
                                            className={cn(
                                                "flex h-11 w-full items-center gap-2 rounded-xl border pl-3 pr-2 text-left transition-colors",
                                                showOnlyFavourites
                                                    ? "border-[#CA9C68]/70 bg-[#CA9C68]/10"
                                                    : "border-slate-700 bg-slate-900/45 hover:border-slate-500 hover:bg-slate-900/70"
                                            )}
                                        >
                                            <Star className={cn("h-4 w-4 shrink-0", showOnlyFavourites ? "fill-current text-[#E2B77F]" : "text-slate-200")} />
                                            <span className={cn("whitespace-nowrap text-sm font-semibold", showOnlyFavourites ? "text-[#E2B77F]" : "text-slate-100")}>
                                                Favourites only
                                            </span>
                                            <span className={cn(
                                                "min-w-6 rounded-md px-1.5 py-0.5 text-center font-sans text-xs font-bold",
                                                showOnlyFavourites ? "bg-[#CA9C68] text-slate-950" : "bg-white/10 text-slate-300"
                                            )}>
                                                {activeFavouriteCount}
                                            </span>
                                            <span className={cn("relative ml-0.5 h-5 w-9 shrink-0 rounded-full transition-colors", showOnlyFavourites ? "bg-[#CA9C68]" : "bg-slate-700")}>
                                                <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform", showOnlyFavourites ? "translate-x-[18px]" : "translate-x-0.5")} />
                                            </span>
                                        </button>
                                        )}

                                        {/* Uploaded by: owner, admins and guests who uploaded here. Picking someone loads the whole gallery first. */}
                                        {showUploaderFilter && (
                                        <div className="flex h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/45 pl-3 pr-1.5" title="Show only what one person uploaded">
                                            {loadingAllMedia
                                                ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#CA9C68]" />
                                                : <Users className="h-4 w-4 shrink-0 text-[#CA9C68]" />}
                                            <span className="flex-1 whitespace-nowrap text-sm font-semibold text-slate-100">Uploaded by</span>
                                            <FilterDropdown
                                                value={effectiveUploaderFilter}
                                                onOpen={() => void loadAllEventPhotos()}
                                                onChange={setUploaderFilter}
                                                ariaLabel="Filter by who uploaded"
                                                options={[
                                                    { value: "all", label: loadingAllMedia ? "Loading everyone…" : `Everyone (${favouriteFilteredItems.length}${hasMorePhotos ? "+" : ""})` },
                                                    ...uploaderOptions.map(option => ({ value: option.userId, label: `${option.label} · ${option.count}` })),
                                                ]}
                                            />
                                        </div>
                                        )}
                                        {galleryViewMode === "grid" && activeGalleryItems.length > 0 && !isSelectingMedia && (
                                        <div className="border-t border-slate-800 pt-3">
                                            <button
                                                type="button"
                                                onClick={() => { setIsSelectingMedia(true); setIsGalleryFilterOpen(false); }}
                                                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#CA9C68]/40 bg-[#CA9C68]/10 px-4 text-sm font-semibold text-[#CA9C68] hover:bg-[#CA9C68]/20"
                                            >
                                                <CheckSquare className="h-4 w-4" />
                                                <span>Select</span>
                                            </button>
                                            <p className="mt-2 text-xs text-slate-400">
                                                {canMoveMedia ? "Select items to move them to another gallery or save copies to EB Vault." : "Select items to save copies to your EB Vault."}
                                            </p>
                                        </div>
                                        )}
                                        </div>
                                        )}
                                        </div>

                                        {/* View Toggle */}
                                        <div className="flex h-11 items-center rounded-xl border border-slate-700 bg-slate-900/60 p-1">
                                            <button
                                                type="button"
                                                onClick={() => setGalleryViewMode("grid")}
                                                aria-label="Grid view"
                                                title="Grid View"
                                                aria-pressed={galleryViewMode === "grid"}
                                                className={cn(
                                                    "grid h-9 w-9 place-items-center rounded-lg transition-colors",
                                                    galleryViewMode === "grid" ? "bg-[#CA9C68]/20 text-[#E2B77F]" : "text-slate-400 hover:text-white"
                                                )}
                                            >
                                                <LayoutGrid className="h-4 w-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setGalleryViewMode("list")}
                                                aria-label="List view"
                                                title="List View"
                                                aria-pressed={galleryViewMode === "list"}
                                                className={cn(
                                                    "grid h-9 w-9 place-items-center rounded-lg transition-colors",
                                                    galleryViewMode === "list" ? "bg-[#CA9C68]/20 text-[#E2B77F]" : "text-slate-400 hover:text-white"
                                                )}
                                            >
                                                <List className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {galleryViewMode === "grid" && activeGalleryItems.length > 0 && isSelectingMedia && (
                                        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-900/45 px-4 py-3 sm:px-5">
                                            <span className="text-sm font-bold text-slate-200" aria-live="polite">
                                                {selectedMediaIds.size} selected
                                            </span>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedMediaIds(
                                                        selectedMediaIds.size === activeGalleryItems.length
                                                            ? new Set()
                                                            : new Set(activeGalleryItems.map(item => item.id))
                                                    )}
                                                    className="rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-400"
                                                >
                                                    {selectedMediaIds.size === activeGalleryItems.length ? "Clear" : "Select all"}
                                                </button>
                                                {canMoveMedia && (
                                                    <button
                                                        type="button"
                                                        disabled={selectedMediaIds.size === 0}
                                                        onClick={() => setMediaToMove(activeGalleryItems.filter(item => selectedMediaIds.has(item.id)))}
                                                        className="flex items-center gap-2 rounded-full bg-[#CA9C68] px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
                                                    >
                                                        <FolderInput className="h-4 w-4" />
                                                        <span>Move to…</span>
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    disabled={selectedMediaIds.size === 0}
                                                    onClick={() => setMediaToSave(activeGalleryItems.filter(item => selectedMediaIds.has(item.id)))}
                                                    className="flex items-center gap-2 rounded-full border border-[#7FA38C]/50 bg-[#7FA38C]/10 px-4 py-2 text-sm font-semibold text-[#A9C9B4] disabled:opacity-40"
                                                >
                                                    <HardDrive className="h-4 w-4" />
                                                    <span>Save to EB Vault</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={selectedMediaIds.size === 0}
                                                    onClick={() => void handleSetMediaHidden(Array.from(selectedMediaIds), true)}
                                                    className="flex items-center gap-2 rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-400 disabled:opacity-40"
                                                >
                                                    <EyeOff className="h-4 w-4" />
                                                    <span>Hide from guests</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={selectedMediaIds.size === 0}
                                                    onClick={() => void handleSetMediaHidden(Array.from(selectedMediaIds), false)}
                                                    className="flex items-center gap-2 rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-400 disabled:opacity-40"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                    <span>Show to guests</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={selectedMediaIds.size === 0}
                                                    onClick={() => void handleDeleteSelectedMedia()}
                                                    className="flex items-center gap-2 rounded-full border border-rose-400/50 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-40"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                    <span>Delete</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={exitMediaSelection}
                                                    className="rounded-full px-3 py-2 text-sm font-semibold text-slate-400 hover:text-white"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {galleryViewMode === "grid" ? (
                                        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5">
                                            {/* Add Image Button */}
                                            {!isFavouriteFilterActive && (galleryMediaTab !== "videos" || canPostVideos) && <motion.label
                                                layout
                                                className={cn(
                                                    "group relative flex aspect-square cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-3 text-center transition-colors",
                                                    status === "uploading" ? "border-sky-500/50 bg-sky-500/5" : "border-[#CA9C68]/55 bg-slate-900/50 hover:border-[#CA9C68] hover:bg-slate-900/70"
                                                )}
                                                title="Click to select photos to upload"
                                            >
                                                <input
                                                    type="file"
                                                    multiple
                                                    accept={galleryMediaTab === "videos" ? "video/*" : "image/*"}
                                                    onChange={handleFileUpload}
                                                    className="hidden"
                                                    disabled={status === "uploading"}
                                                />
                                                {status === "uploading" ? (
                                                    <div className="flex flex-col items-center text-sky-400">
                                                        <Loader2 className="w-10 h-10 animate-spin mb-3" />
                                                        <span className="text-sm font-semibold">Adding...</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center gap-4 text-slate-200 transition-colors group-hover:text-white">
                                                        <span className="grid h-14 w-14 place-items-center rounded-2xl border border-[#CA9C68]/70 bg-[#CA9C68]/10 text-[#F1D3A8] shadow-[0_0_28px_rgba(202,156,104,0.35)] transition-all group-hover:bg-[#CA9C68]/20 group-hover:shadow-[0_0_36px_rgba(202,156,104,0.5)] sm:h-16 sm:w-16">
                                                            <Plus className="h-7 w-7 sm:h-8 sm:w-8" />
                                                        </span>
                                                        <span className="text-sm font-medium sm:text-base">
                                                            {galleryMediaTab === "videos" ? "Add or Drop Videos" : "Add or Drop Photos"}
                                                        </span>
                                                    </div>
                                                )}
                                            </motion.label>}

                                            {/* Existing Photos Grid */}
                                            {activeGalleryItems.map((photo, index) => {
                                                const isCover = stripUrlQuery(userEvents.find(ev => ev.id === selectedEventId)?.coverImage) === stripUrlQuery(photo.url);
                                                const isVideo = photo.mediaType === "video" || photo.resourceType === "video";
                                                const gridSrc = !isVideo ? (photo.thumbnailUrl || `${photo.url}-thumbnail.webp`) : photo.url;
                                                const shouldBlurMediaForPlan = shouldWarnExpiredPlanMedia && !currentEventRetainedMediaIds.has(photo.id);
                                                const isFavourite = eventFavouritePhotoIds.has(photo.id);
                                                return (
                                                    <motion.div
                                                        key={photo.id}
                                                        layout
                                                        className={cn(
                                                            "group relative aspect-square rounded-2xl bg-slate-900 shadow-md shadow-black/20 border border-slate-700",
                                                            isSelectingMedia ? "cursor-pointer" : "cursor-zoom-in",
                                                            isSelectingMedia && selectedMediaIds.has(photo.id) && "ring-2 ring-[#CA9C68] ring-offset-2 ring-offset-[#2B2F2E]"
                                                        )}
                                                        role={isSelectingMedia ? "checkbox" : undefined}
                                                        aria-checked={isSelectingMedia ? selectedMediaIds.has(photo.id) : undefined}
                                                        aria-label={isSelectingMedia ? `Select ${isVideo ? "video" : "photo"} ${index + 1}` : undefined}
                                                        tabIndex={isSelectingMedia ? 0 : undefined}
                                                        onKeyDown={isSelectingMedia ? (e) => {
                                                            if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleMediaSelection(photo.id); }
                                                        } : undefined}
                                                        onClick={() => {
                                                            if (isSelectingMedia) {
                                                                toggleMediaSelection(photo.id);
                                                                return;
                                                            }
                                                            setViewingPhoto({
                                                                id: photo.id,
                                                                src: photo.url,
                                                                storageKey: photo.storageKey,
                                                                width: photo.width,
                                                                height: photo.height,
                                                                filename: photo.storageKey?.split('/').pop() || (isVideo ? "video" : "photo"),
                                                                thumbnailUrl: photo.thumbnailUrl,
                                                                mediaType: isVideo ? "video" : "photo",
                                                                resourceType: isVideo ? "video" : "image"
                                                            });
                                                        }}
                                                    >
                                                        {/* Inner Clipping Container for Photo */}
                                                        <div className="absolute inset-0 overflow-hidden rounded-[15px]">
                                                            <GridMediaCell
                                                                photo={photo}
                                                                gridSrc={gridSrc}
                                                                isVideo={isVideo}
                                                                shouldBlurMediaForPlan={shouldBlurMediaForPlan} onThumbnailLoaded={handleThumbnailLoaded}
                                                            />
                                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            {isVideo && galleryOfMedia(photo)?.galleryVideoId === photo.id && (
                                                                <span className="pointer-events-none absolute left-2.5 top-2.5 z-[1] flex items-center gap-1 rounded-full border border-[#CA9C68]/60 bg-slate-950/80 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#F5E7D4] backdrop-blur-sm">
                                                                    <Clapperboard className="h-3 w-3 text-[#CA9C68]" aria-hidden="true" />
                                                                    Cinematic highlight
                                                                </span>
                                                            )}
                                                            {photo.isHidden && (
                                                                <>
                                                                    <div className="pointer-events-none absolute inset-0 bg-slate-950/55" />
                                                                    <span className="pointer-events-none absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-full border border-white/20 bg-black/70 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white backdrop-blur-sm">
                                                                        <EyeOff className="h-3 w-3" aria-hidden="true" />
                                                                        Hidden
                                                                    </span>
                                                                </>
                                                            )}
                                                            {shouldBlurMediaForPlan && (
                                                                <div className="pointer-events-none absolute left-1/2 top-14 z-20 w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-2xl border border-[#CA9C68]/50 bg-slate-950/95 px-3 py-2 text-center text-[10px] font-black uppercase leading-4 tracking-[0.08em] text-[#F5E7D4] shadow-2xl shadow-black/50 backdrop-blur-md">
                                                                    Plan expired<br />
                                                                    <span className="text-[9px] text-[#D7AE7D]/90">May be deleted after grace period</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {isSelectingMedia ? (
                                                            <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg bg-slate-950/80 p-1.5 text-[#CA9C68] shadow-lg">
                                                                {selectedMediaIds.has(photo.id) ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5 text-white" />}
                                                            </div>
                                                        ) : (<>
                                                        <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1.5">
                                                            {!isVideo && (
                                                                <button
                                                                    aria-label="Delete Image"
                                                                    title="Delete Image"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeletePhoto(photo.id);
                                                                    }}
                                                                    className="grid h-9 w-9 place-items-center rounded-lg bg-slate-950/70 text-rose-300 shadow-lg backdrop-blur-md opacity-0 transition-all active:scale-95 group-hover:opacity-100 hover:bg-rose-500 hover:text-white"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            )}
                                                            <button
                                                                type="button"
                                                                aria-label={photo.isHidden ? `Show this ${isVideo ? "video" : "photo"} to guests` : `Hide this ${isVideo ? "video" : "photo"} from guests`}
                                                                title={photo.isHidden ? "Hidden from guests: click to show it" : "Hide from guests"}
                                                                aria-pressed={!!photo.isHidden}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    void handleSetMediaHidden([photo.id], !photo.isHidden);
                                                                }}
                                                                className={cn(
                                                                    "grid h-9 w-9 place-items-center rounded-lg shadow-lg backdrop-blur-md transition-all active:scale-95",
                                                                    photo.isHidden
                                                                        ? "bg-[#CA9C68] text-slate-950"
                                                                        : "bg-slate-950/70 text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[#CA9C68] hover:text-slate-950"
                                                                )}
                                                            >
                                                                {photo.isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                            </button>
                                                            <button
                                                                aria-label={isFavourite ? "Remove from Primary Gallery" : "Add to Primary Gallery"}
                                                                title={isFavourite ? "Remove from Primary Gallery" : "Add to Primary Gallery"}
                                                                aria-pressed={isFavourite}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleToggleEventFavourite(photo.id);
                                                                }}
                                                                className={cn(
                                                                    "grid h-9 w-9 place-items-center rounded-lg shadow-lg backdrop-blur-md transition-all active:scale-95",
                                                                    isFavourite
                                                                        ? "bg-[#CA9C68] text-slate-950"
                                                                        : "bg-slate-950/70 text-white hover:bg-[#CA9C68] hover:text-slate-950"
                                                                )}
                                                            >
                                                                <Star className={cn("h-4 w-4", isFavourite && "fill-current")} />
                                                            </button>
                                                            <button
                                                                aria-label={isVideo ? "Video actions" : "Photo actions"}
                                                                title={isVideo ? "Video actions" : "Photo actions"}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    isVideo ? setVideoActionItem(photo) : setPhotoActionItem(photo);
                                                                }}
                                                                className="grid h-9 w-9 place-items-center rounded-lg bg-slate-950/70 text-white shadow-lg backdrop-blur-md transition-all active:scale-90 hover:bg-slate-950/90"
                                                            >
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                        {!isFavouriteFilterActive && !isUploaderFilterActive && activeGalleryItems.length > 1 && (
                                                            <div className="absolute bottom-2.5 left-2.5 z-10 flex overflow-hidden rounded-lg border border-white/10 bg-slate-950/70 font-sans text-white shadow-lg backdrop-blur-md">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        moveGalleryMedia(photo.id, -1);
                                                                    }}
                                                                    disabled={index === 0}
                                                                    className="px-3 py-2 text-xs font-black disabled:opacity-30"
                                                                    aria-label="Move media backward"
                                                                >
                                                                    ↑
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        moveGalleryMedia(photo.id, 1);
                                                                    }}
                                                                    disabled={index === activeGalleryItems.length - 1}
                                                                    className="border-l border-slate-700 px-3 py-2 text-xs font-black disabled:opacity-30"
                                                                    aria-label="Move media forward"
                                                                >
                                                                    ↓
                                                                </button>
                                                            </div>
                                                        )}
                                                        </>)}

                                                    </motion.div>
                                                );
                                            })}

                                            {/* Loading Skeletons for current fetching */}
                                            {loadingPhotos && activeGalleryItems.length === 0 && (
                                                Array.from({ length: 4 }).map((_, i) => (
                                                    <div key={i} className="aspect-square bg-slate-900/50 rounded-2xl animate-pulse border border-slate-700" />
                                                ))
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* Add Image Option as List Item */}
                                            {!isFavouriteFilterActive && (galleryMediaTab !== "videos" || canPostVideos) && <motion.label
                                                className={cn(
                                                    "flex items-center p-5 sm:p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-colors group",
                                                    status === "uploading" ? "border-sky-500/50 bg-sky-500/5" : "border-[#CA9C68]/55 bg-slate-900/50 hover:border-[#CA9C68] hover:bg-slate-900/70"
                                                )}
                                            >
                                                <input
                                                    type="file"
                                                    multiple
                                                    accept={galleryMediaTab === "videos" ? "video/*" : "image/*"}
                                                    onChange={handleFileUpload}
                                                    className="hidden"
                                                    disabled={status === "uploading"}
                                                />
                                                <div className="mr-5 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#CA9C68]/70 bg-[#CA9C68]/10 text-[#F1D3A8] shadow-[0_0_24px_rgba(202,156,104,0.3)] transition-all group-hover:bg-[#CA9C68]/20 sm:mr-6">
                                                    {status === "uploading" ? (
                                                        <Loader2 className="w-6 h-6 text-sky-400 animate-spin" />
                                                    ) : (
                                                        <Plus className="w-6 h-6" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-200">
                                                        {galleryMediaTab === "videos" ? "Add New Videos" : "Add New Photos"}
                                                    </p>
                                                    <p className="text-sm text-slate-400">
                                                        {galleryMediaTab === "videos" ? "Click to upload videos, or drag them here" : "Click to upload memories, or drag images here"}
                                                    </p>
                                                </div>
                                            </motion.label>}

                                            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-sm">
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="bg-slate-900/50/50 border-b border-slate-700">
                                                                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-widest text-slate-400">Preview</th>
                                                                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-widest text-slate-400">Technical Details</th>
                                                                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-widest text-slate-400">Metadata</th>
                                                                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-stone-50">
                                                            {activeGalleryItems.map((photo, index) => {
                                                                const isVideo = photo.mediaType === "video" || photo.resourceType === "video";
                                                                const isCover = stripUrlQuery(userEvents.find(ev => ev.id === selectedEventId)?.coverImage) === stripUrlQuery(photo.url);
                                                                const gridSrc = !isVideo ? (photo.thumbnailUrl || `${photo.url}-thumbnail.webp`) : photo.url;
                                                                const shouldBlurMediaForPlan = shouldWarnExpiredPlanMedia && !currentEventRetainedMediaIds.has(photo.id);
                                                                const isFavourite = eventFavouritePhotoIds.has(photo.id);
                                                                const dateAdded = (
                                                                    photo.uploadedAt && typeof photo.uploadedAt === 'number'
                                                                        ? new Date(photo.uploadedAt)
                                                                        : photo.uploadedAt?.toDate?.() || new Date()
                                                                ).toLocaleDateString('en-GB', {
                                                                    day: 'numeric',
                                                                    month: 'short',
                                                                    year: 'numeric'
                                                                });

                                                                // Fallback for format if missing (for legacy photos)
                                                                let displayFormat = photo.format;
                                                                if (!displayFormat && photo.url) {
                                                                    const ext = photo.url.split('.').pop()?.split('?')[0].toLowerCase();
                                                                    if (ext && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
                                                                        displayFormat = ext === 'jpeg' ? 'jpg' : ext;
                                                                    }
                                                                }

                                                                const formatSize = (bytes?: number) => {
                                                                    if (!bytes) return 'Legacy Photo';
                                                                    const k = 1024;
                                                                    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                                                                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                                                                    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                                                                };

                                                                return (
                                                                    <tr key={photo.id} className="hover:bg-slate-900/50/50 transition-colors group">
                                                                        <td className="px-8 py-6">
                                                                            <div
                                                                                className="w-32 h-32 rounded-[1.5rem] overflow-hidden cursor-zoom-in shadow-md border border-slate-700 group-hover:scale-105 transition-transform"
                                                                                onClick={() => {
                                                                                    setViewingPhoto({
                                                                                        id: photo.id,
                                                                                        src: photo.url,
                                                                                        storageKey: photo.storageKey,
                                                                                        width: photo.width,
                                                                                        height: photo.height,
                                                                                        filename: photo.storageKey?.split('/').pop() || (isVideo ? "video" : "photo"),
                                                                                        thumbnailUrl: photo.thumbnailUrl,
                                                                                        mediaType: isVideo ? "video" : "photo",
                                                                                        resourceType: isVideo ? "video" : "image"
                                                                                    });
                                                                                }}
                                                                            >
                                                                                <GridMediaCell
                                                                                    photo={photo}
                                                                                    gridSrc={gridSrc}
                                                                                    isVideo={isVideo}
                                                                                    shouldBlurMediaForPlan={shouldBlurMediaForPlan}
                                                                                    onThumbnailLoaded={handleThumbnailLoaded}
                                                                                />
                                                                                {shouldBlurMediaForPlan && (
                                                                                    <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 w-[calc(100%-1rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[#CA9C68]/50 bg-slate-950/95 px-2 py-2 text-center text-[9px] font-black uppercase leading-4 tracking-[0.08em] text-[#F5E7D4] shadow-2xl shadow-black/50 backdrop-blur-md">
                                                                                        Plan expired<br />
                                                                                        <span className="text-[8px] text-[#D7AE7D]/90">May be deleted after grace period</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-8 py-6">
                                                                            <div className="space-y-1.5">
                                                                                <div className="flex items-center text-xs">
                                                                                    <span className="text-slate-400 w-20">Resolution:</span>
                                                                                    <span className="font-bold text-slate-700">{photo.width && photo.height ? `${photo.width} × ${photo.height}` : 'N/A'}</span>
                                                                                </div>
                                                                                <div className="flex items-center text-xs">
                                                                                    <span className="text-slate-400 w-20">File Size:</span>
                                                                                    <span className={cn("font-bold text-slate-700", !photo.size && "text-slate-400 font-normal italic")}>
                                                                                        {formatSize(photo.size)}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="flex items-center text-xs">
                                                                                    <span className="text-slate-400 w-20">Format:</span>
                                                                                    <span className="font-bold text-slate-700 uppercase">{displayFormat || 'N/A'}</span>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-8 py-6">
                                                                            <div className="space-y-1.5">
                                                                                <div className="flex items-center text-xs">
                                                                                    <span className="text-slate-400 w-20">Added On:</span>
                                                                                    <span className="font-bold text-slate-700">{dateAdded}</span>
                                                                                </div>
                                                                                <div className="flex items-center space-x-2 pt-1">
                                                                                    {!isVideo && isCover && (
                                                                                        <span className="px-2 py-0.5 bg-sky-500/10 text-sky-400 text-[9px] font-bold uppercase rounded-md border border-sky-500/20">
                                                                                            Gallery Thumb
                                                                                        </span>
                                                                                    )}
                                                                                    {!isVideo && stripUrlQuery(selectedMainEvent?.coverImage) === stripUrlQuery(photo.url) && (
                                                                                        <span className="px-2 py-0.5 bg-slate-900/10 text-white text-[9px] font-bold uppercase rounded-md border border-slate-900/20">
                                                                                            Event Thumb
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-8 py-6 text-right">
                                                                            <div className="flex items-center justify-end space-x-2">
                                                                                {!isFavouriteFilterActive && !isUploaderFilterActive && activeGalleryItems.length > 1 && (
                                                                                    <div className="flex overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => moveGalleryMedia(photo.id, -1)}
                                                                                            disabled={index === 0}
                                                                                            className="px-3 py-2 text-xs font-black text-slate-300 disabled:opacity-30"
                                                                                            aria-label="Move media backward"
                                                                                        >
                                                                                            ↑
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => moveGalleryMedia(photo.id, 1)}
                                                                                            disabled={index === activeGalleryItems.length - 1}
                                                                                            className="border-l border-slate-700 px-3 py-2 text-xs font-black text-slate-300 disabled:opacity-30"
                                                                                            aria-label="Move media forward"
                                                                                        >
                                                                                            ↓
                                                                                        </button>
                                                                                    </div>
                                                                                )}
                                                                                <Tooltip text={isVideo ? "Video actions" : "Photo actions"}>
                                                                                    <button
                                                                                        aria-label={isVideo ? "Video actions" : "Photo actions"}
                                                                                        onClick={() => isVideo ? setVideoActionItem(photo) : setPhotoActionItem(photo)}
                                                                                        className="p-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 transition-all active:scale-95 hover:bg-slate-700 hover:text-white"
                                                                                    >
                                                                                        <MoreHorizontal className="w-4 h-4" />
                                                                                    </button>
                                                                                </Tooltip>
                                                                                <Tooltip text={isFavourite ? "Remove from Primary Gallery" : "Add to Primary Gallery"}>
                                                                                        <button
                                                                                            onClick={() => handleToggleEventFavourite(photo.id)}
                                                                                            className={cn(
                                                                                                "p-2.5 rounded-xl border transition-all active:scale-95",
                                                                                                isFavourite
                                                                                                    ? "border-[#CA9C68] bg-[#CA9C68] text-slate-950"
                                                                                                    : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-[#CA9C68] hover:text-slate-950"
                                                                                            )}
                                                                                        >
                                                                                            <Star className={cn("w-4 h-4", isFavourite && "fill-current")} />
                                                                                        </button>
                                                                                </Tooltip>
                                                                                <Tooltip text={isVideo ? "Delete Video" : "Delete Image"}>
                                                                                    <button
                                                                                        onClick={() => handleDeletePhoto(photo.id)}
                                                                                        className="p-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-400 transition-all active:scale-95 hover:bg-red-50 hover:text-red-500"
                                                                                    >
                                                                                        <Trash2 className="w-4 h-4" />
                                                                                    </button>
                                                                                </Tooltip>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                {activeGalleryItems.length === 0 && !loadingPhotos && (
                                                    <div className="p-12 text-center">
                                                        <p className="text-slate-400 italic">
                                                            {isFavouriteFilterActive
                                                                ? `No favourite ${galleryMediaTab === "videos" ? "videos" : "photos"} in this gallery yet.`
                                                                : galleryMediaTab === "videos" ? "No videos in this gallery yet." : "No photos in this gallery yet."}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {hasMorePhotos && (
                                        <div className="flex justify-center mt-12 mb-8">
                                            <button
                                                onClick={loadMorePhotos}
                                                disabled={loadingPhotos}
                                                className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-full font-bold shadow-lg flex items-center space-x-2 transition-all border border-slate-700"
                                            >
                                                {loadingPhotos ? <Loader2 className="w-5 h-5 animate-spin text-sky-400" /> : <ChevronDown className="w-5 h-5 text-sky-400" />}
                                                <span>{loadingPhotos ? "Loading..." : "Load More Photos"}</span>
                                            </button>
                                        </div>
                                    )}

                                </motion.div>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="permissions-view"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                        </motion.div>
                    )}
                </AnimatePresence>


                {/* Category Selection Modal */}
                <AnimatePresence>
                    {showCategoryModal && selectedMainEvent && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className={cn(modalStyles.overlay, "items-end sm:items-center")}
                            onClick={() => setShowCategoryModal(false)}
                        >
                            <motion.div
                                initial={{ y: "100%" }}
                                animate={{ y: 0 }}
                                exit={{ y: "100%" }}
                                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                onClick={(e) => e.stopPropagation()}
                                className={cn(modalStyles.panel, "flex max-h-[85vh] flex-col overflow-hidden")}
                            >
                                <ModalHeader
                                    title="Event Type"
                                    subtitle="Choose a category for your gallery"
                                    onClose={() => setShowCategoryModal(false)}
                                />

                                <div className="overflow-y-auto pr-2 -mr-2 space-y-2 pb-4">
                                    {EVENT_TYPE_OPTIONS.map(({ name, icon: Icon }) => {
                                        const isActive = selectedMainEvent.category === name;
                                        // Match mobile colors
                                        const getCatColor = (n: string) => {
                                            if (n === 'Wedding') return '#ff4b72';
                                            if (n === 'Birthday') return '#3b82f6';
                                            if (n === 'Anniversary') return '#CA9C68';
                                            if (n === 'Corporate') return '#10b981';
                                            if (n === 'Sports') return '#06b6d4';
                                            if (n === 'College') return '#6366f1';
                                            return '#64748b'; // Other
                                        };
                                        const color = getCatColor(name);

                                        return (
                                            <button
                                                key={name}
                                                onClick={() => {
                                                    handleUpdateEventCategory(selectedMainEvent, name);
                                                    setShowCategoryModal(false);
                                                }}
                                                className={cn(
                                                    "w-full flex items-center justify-between p-4 rounded-2xl border transition-all",
                                                    isActive
                                                        ? "border-[#CA9C68] bg-[#CA9C68]/10"
                                                        : "border-[var(--site-border)] bg-[#13191F]/50 hover:border-[#CA9C68]/40"
                                                )}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div
                                                        className="flex h-10 w-10 items-center justify-center rounded-xl"
                                                        style={{ backgroundColor: `${color}20` }}
                                                    >
                                                        <Icon className="h-5 w-5" style={{ color }} />
                                                    </div>
                                                    <span className={cn(
                                                        "text-base font-bold",
                                                        isActive ? "text-[#CA9C68]" : "text-slate-200"
                                                    )}>
                                                        {name}
                                                    </span>
                                                </div>
                                                {isActive && (
                                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#CA9C68] text-slate-950">
                                                        <Check className="h-4 w-4" />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Template Selection Modal */}
                <AnimatePresence>
                    {showTemplateModal && templateTargetEvent && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className={modalStyles.overlay}
                            onClick={() => setShowTemplateModal(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.9, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.9, y: 20 }}
                                onClick={(e) => e.stopPropagation()}
                                className={cn(modalStyles.panel, "max-w-2xl overflow-hidden")}
                            >
                                <ModalHeader
                                    title="Choose Style"
                                    subtitle="Select a design template for this event."
                                    onClose={() => {
                                        setShowTemplateModal(false);
                                        setTemplateTargetEvent(null);
                                    }}
                                />

                                <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-2 pb-4">
                                    {getTemplatesForEventCategory(templateTargetEvent.category, templateTargetEvent.templateId).map((template) => {
                                        const isActive = templateTargetEvent.templateId === template.id;
                                        return (
                                            <div
                                                key={template.id}
                                                onClick={() => handleUpdateTemplate(template.id)}
                                                className={cn(
                                                    "flex items-center justify-between p-3 rounded-2xl border-2 transition-colors cursor-pointer",
                                                    isActive ? "bg-[#13191F]/50" : "border-[var(--site-border)] bg-[#13191F]/50 hover:border-[#CA9C68]/40"
                                                )}
                                                style={{ borderColor: isActive ? template.accent : undefined }}
                                            >
                                                <div className="flex items-center gap-3 flex-1">
                                                    <div
                                                        className="w-10 h-10 rounded-full flex items-center justify-center border border-white/10"
                                                        style={{ backgroundColor: template.background?.dark || '#000' }}
                                                    >
                                                        <div
                                                            className="w-3.5 h-3.5 rounded-full"
                                                            style={{ backgroundColor: template.accent || '#fff' }}
                                                        />
                                                    </div>

                                                    <div className="flex-1 mr-2">
                                                        <div
                                                            className="text-sm font-bold font-outfit"
                                                            style={{ color: isActive ? template.accent : '#fff' }}
                                                        >
                                                            {template.label}
                                                        </div>
                                                        <div className="text-[11px] text-slate-400 font-inter mt-0.5 truncate">
                                                            {template.desc}
                                                        </div>
                                                    </div>
                                                </div>

                                                {isActive && (
                                                    <div
                                                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                                                        style={{ backgroundColor: template.accent }}
                                                    >
                                                        <Check className="w-3 h-3 text-black" />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Rename Modal */}
                <AnimatePresence>
                    {renamingEvent && (
                        <div className={modalStyles.overlay}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className={modalStyles.panel}
                            >
                                <ModalHeader
                                    title={editDetailsMode === "date"
                                        ? renamingEvent.type === "sub" ? "Edit Gallery Date" : "Edit Event Date"
                                        : renamingEvent.type === "sub" ? "Edit Gallery Title" : "Edit Event Title"}
                                    onClose={closeRenameModal}
                                />
                                <form onSubmit={handleRenameSubmit} className="space-y-6">
                                    {editDetailsMode === "title" && (
                                        <div>
                                            <label className={modalStyles.label}>New Name</label>
                                            <input
                                                type="text"
                                                value={newTitle}
                                                onChange={(e) => setNewTitle(e.target.value)}
                                                className={cn(modalStyles.input, "text-lg font-medium")}
                                                required
                                                autoFocus
                                            />
                                        </div>
                                    )}
                                    {editDetailsMode === "date" && (
                                        <div>
                                            <label className={modalStyles.label}>Date</label>
                                            <button
                                                type="button"
                                                onClick={() => openDatePicker("rename")}
                                                className={cn(modalStyles.input, "flex items-center justify-between text-left hover:border-[#CA9C68]/60")}
                                            >
                                                <span className="flex min-w-0 items-center gap-4">
                                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
                                                        <Calendar className="h-5 w-5" />
                                                    </span>
                                                    <span className="min-w-0">
                                                        <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Selected Date</span>
                                                        <span className="block truncate text-lg font-bold text-white">
                                                            {newDate ? formatEventDate(newDate) : "Tap to choose date"}
                                                        </span>
                                                    </span>
                                                </span>
                                                <span className="rounded-full bg-[#CA9C68]/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#CA9C68]">
                                                    Change
                                                </span>
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={closeRenameModal}
                                            className={cn(modalStyles.secondary, "flex-1")}
                                            title="Discard changes"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={status === "uploading"}
                                            className={cn(modalStyles.primary, "flex-1")}
                                            title="Save changes"
                                        >
                                            {status === "uploading" ? "Saving..." : editDetailsMode === "date" ? "Save Date" : "Save Title"}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Plan Details Modal */}
                <AnimatePresence>
                    {showPlanDetailsModal && (
                        <div className={modalStyles.overlay}>
                            <button
                                type="button"
                                aria-label="Close plan details"
                                onClick={() => setShowPlanDetailsModal(false)}
                                className="absolute inset-0 cursor-default"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.92, y: 18 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.92, y: 18 }}
                                className={cn(modalStyles.panel, "overflow-hidden p-0 sm:p-0")}
                                style={{ borderColor: planDetails.accentSoft }}
                            >
                                <div className="px-7 pb-6 pt-7" style={{ background: `linear-gradient(to bottom, ${planDetails.accentSoft}, rgba(15, 23, 42, 0.2), transparent)` }}>
                                    <div className="flex items-center gap-4">
                                        <div
                                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border"
                                            style={{
                                                borderColor: planDetails.accentSoft,
                                                backgroundColor: planDetails.accentSoft,
                                                color: planDetails.accent,
                                            }}
                                        >
                                            <svg
                                                width="22"
                                                height="22"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="1.8"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                aria-hidden="true"
                                            >
                                                <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
                                                <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
                                                <line x1="6" x2="6.01" y1="6" y2="6" />
                                                <line x1="6" x2="6.01" y1="18" y2="18" />
                                            </svg>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-2xl font-black text-white">Storage & Quota</h3>
                                            <p className="text-sm font-semibold text-slate-400">Your current plan usage</p>
                                        </div>
                                        <ModalCloseButton onClick={() => setShowPlanDetailsModal(false)} label="Close plan details" className="self-start" />
                                    </div>

                                    <p className="mt-6 text-sm font-semibold text-slate-300">
                                        Active plan: <span className="font-black" style={{ color: planDetails.accent }}>{planDetails.name}</span>
                                    </p>
                                    {subscriptionStatus.message && (
                                        <div
                                            className={cn(
                                                "mt-5 rounded-2xl border p-4 text-sm font-semibold leading-6",
                                                subscriptionStatus.tone === "danger"
                                                    ? "border-rose-400/25 bg-rose-400/10 text-rose-100"
                                                    : "border-[#CA9C68]/25 bg-[#CA9C68]/10 text-[#F5E7D4]"
                                            )}
                                        >
                                            <div className="mb-1 text-[10px] font-black uppercase tracking-[0.16em]">
                                                {subscriptionStatus.label}
                                            </div>
                                            {subscriptionStatus.message}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-5 px-7 py-6">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <span className="h-2 w-2 rounded-full bg-[#D7AE7D]" />
                                                <span className="text-sm font-black text-slate-100">Storage</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="font-black text-white">{formatStorageSize(totalStorage)}</span>
                                                <span className="font-semibold text-slate-500">
                                                    / {planDetails.storageLabel}
                                                </span>
                                                <span className="rounded-full bg-[#CA9C68]/10 px-2 py-1 text-[10px] font-black text-[#CA9C68]">
                                                    {planDetails.storageBytes === Infinity ? "∞" : `${Math.round(storagePercent)}%`}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-slate-950">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-[#CA9C68] to-[#D7AE7D]"
                                                style={{ width: `${planDetails.storageBytes === Infinity ? 5 : storagePercent}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="h-px bg-slate-700/70" />

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <span className="h-2 w-2 rounded-full bg-indigo-400" />
                                                <span className="text-sm font-black text-slate-100">Events</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="font-black text-white">{totalMainEvents}</span>
                                                <span className="font-semibold text-slate-500">
                                                    / {planDetails.eventLabel}
                                                </span>
                                                <span className="rounded-full bg-indigo-400/10 px-2 py-1 text-[10px] font-black text-indigo-300">
                                                    {planDetails.eventLimit === Infinity ? "∞" : `${Math.round(eventPercent)}%`}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-slate-950">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-200"
                                                style={{ width: `${planDetails.eventLimit === Infinity ? 5 : eventPercent}%` }}
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowPlanDetailsModal(false);
                                            router.push("/pricing");
                                        }}
                                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#CA9C68] px-5 py-4 text-sm font-black uppercase tracking-wide text-slate-950 transition-colors hover:bg-[#D7AE7D]"
                                    >
                                        Manage Plan
                                        <ArrowRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Share Modal */}
                <AnimatePresence>
                    {shareModalEvent && (
                        <div className={modalStyles.overlay}>
                            <button
                                type="button"
                                aria-label="Close share modal"
                                onClick={() => setShareModalEvent(null)}
                                className="absolute inset-0 cursor-default"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.92, y: 18 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.92, y: 18 }}
                                className={cn(modalStyles.panel, "text-center")}
                            >
                                <ModalHeader title="Share Event" onClose={() => setShareModalEvent(null)} closeLabel="Close share modal" className="mb-0 text-left" />


                                <div className="mx-auto mt-7 w-full max-w-[250px] rounded-[2rem] bg-white p-6 shadow-xl">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shareModalUrl)}`}
                                        alt={`QR code for ${shareModalEvent.title}`}
                                        className="mx-auto h-52 w-52 object-contain"
                                    />
                                    <p className="mt-3 text-xs font-black uppercase tracking-widest text-slate-950">Scan to Join</p>
                                </div>

                                <div className="mt-8">
                                    <p className="text-sm font-black uppercase tracking-widest text-slate-400">Unique Join ID</p>
                                    <div className="mx-auto mt-4 inline-flex min-w-56 items-center justify-center rounded-2xl border border-[#CA9C68]/40 px-8 py-4">
                                        <span className="text-3xl font-black uppercase tracking-[0.25em] text-[#CA9C68]">{shareModalJoinId}</span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleShareInvitation}
                                    className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl bg-[#CA9C68] px-6 py-5 text-sm font-black uppercase tracking-wide text-slate-950 shadow-lg transition-all hover:bg-[#D7AE7D] active:scale-[0.98]"
                                >
                                    <Share2 className="h-5 w-5" />
                                    <span>Share Invitation</span>
                                </button>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Cover Position Toolbar */}
                <AnimatePresence>
                    {coverPositionEvent && (
                        <motion.div
                            initial={{ opacity: 0, y: -16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -16 }}
                            className="fixed left-1/2 top-24 z-[80] flex w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 flex-col gap-3 rounded-[1.5rem] border border-white/15 bg-slate-950/90 p-3 text-white shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div className="flex flex-col gap-1 px-2">
                                <span className="text-xs font-black uppercase tracking-[0.2em] text-[#CA9C68]">Drag image</span>
                                <span className="truncate text-sm font-bold text-slate-300">{coverPositionEvent.title}</span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1">
                                    <button
                                        type="button"
                                        onClick={() => adjustCoverZoom(-0.1)}
                                        className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-white transition hover:bg-slate-700"
                                        aria-label="Zoom out"
                                    >
                                        -
                                    </button>
                                    <span className="min-w-14 text-center text-xs font-black text-white">{Math.round(coverDraft.coverScale * 100)}%</span>
                                    <button
                                        type="button"
                                        onClick={() => adjustCoverZoom(0.1)}
                                        className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-white transition hover:bg-slate-700"
                                        aria-label="Zoom in"
                                    >
                                        +
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        coverDragStartRef.current = null;
                                        setCoverPositionEvent(null);
                                    }}
                                    className="rounded-full border border-white/15 px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-200 transition hover:bg-white/10"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveCoverPosition}
                                    className="rounded-full bg-[#CA9C68] px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-950 transition hover:bg-[#D7AE7D]"
                                >
                                    Save
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Date Picker Modal */}
                <AnimatePresence>
                    {showDatePickerModal && (
                        <div
                            className={modalStyles.overlay}
                            style={{ zIndex: 10000 }}
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.92, y: 12 }}
                                className={cn(modalStyles.panel, "max-w-sm")}
                                style={{ zIndex: 10001 }}
                            >
                                <ModalHeader title="Select Date" onClose={() => setShowDatePickerModal(false)} closeLabel="Close date picker" />
                                <div className="grid grid-cols-3 gap-6">
                                    <DatePickerColumn
                                        options={DATE_PICKER_MONTHS.map((label, value) => ({ label, value }))}
                                        selectedValue={datePickerValue.month}
                                        onSelect={(month) => setDatePickerValue(prev => clampDatePickerValue({ ...prev, month }))}
                                    />
                                    <DatePickerColumn
                                        key={`${datePickerValue.month}-${datePickerValue.year}`}
                                        options={Array.from({ length: getDaysInMonth(datePickerValue.month, datePickerValue.year) }, (_, index) => ({
                                            label: String(index + 1).padStart(2, "0"),
                                            value: index + 1,
                                        }))}
                                        selectedValue={datePickerValue.day}
                                        onSelect={(day) => setDatePickerValue(prev => ({ ...prev, day }))}
                                    />
                                    <DatePickerColumn
                                        options={Array.from({ length: 201 }, (_, index) => {
                                            const value = 1950 + index;
                                            return { label: String(value), value };
                                        })}
                                        selectedValue={datePickerValue.year}
                                        onSelect={(year) => setDatePickerValue(prev => clampDatePickerValue({ ...prev, year }))}
                                    />
                                </div>

                                <div className={modalStyles.actions}>
                                    <button
                                        type="button"
                                        onClick={() => setShowDatePickerModal(false)}
                                        className={modalStyles.secondary}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const formattedDate = formatDatePickerValue(datePickerValue);
                                            if (datePickerTarget === "create") {
                                                setEventDate(formatFriendlyDatePickerValue(datePickerValue));
                                            } else {
                                                setNewDate(formattedDate);
                                            }
                                            setShowDatePickerModal(false);
                                        }}
                                        className={modalStyles.primary}
                                    >
                                        OK
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Delete Confirmation Modal */}
                <AnimatePresence>
                    {showDeleteConfirm && (
                        <div className={modalStyles.overlay}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className={modalStyles.panel}
                            >
                                {(() => {
                                    const eventToDelete = userEvents.find(e => e.id === showDeleteConfirm) || eventDetailGalleries.find(e => e.id === showDeleteConfirm);
                                    const itemType = eventToDelete?.type === "sub" ? "gallery" : "event";
                                    const itemTypeTitle = eventToDelete?.type === "sub" ? "Gallery" : "Event";
                                    return (
                                        <>
                                            <ModalHeader title={`Delete ${itemTypeTitle}`} onClose={() => setShowDeleteConfirm(null)} className="mb-3" />
                                            <p className={modalStyles.body}>
                                                Are you sure you want to delete the {itemType} "{eventToDelete?.title}"? This will permanently remove all photos inside this {itemType}.
                                            </p>
                                            <div className={modalStyles.actions}>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowDeleteConfirm(null)}
                                                    className={modalStyles.secondary}
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteEvent(showDeleteConfirm)}
                                                    disabled={status === "uploading"}
                                                    className={modalStyles.danger}
                                                >
                                                    {status === "uploading" ? "Deleting..." : "Delete"}
                                                </button>
                                            </div>
                                        </>
                                    );
                                })()}
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Delete Success Modal */}
                <AnimatePresence>
                    {showDeleteSuccessType && (
                        <div className={modalStyles.overlay}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className={modalStyles.panel}
                            >
                                <ModalHeader title="Success" onClose={() => setShowDeleteSuccessType(null)} className="mb-3" />
                                <p className={modalStyles.body}>
                                    {showDeleteSuccessType === "gallery" ? "Gallery" : "Event"} deleted successfully.
                                </p>
                                <div className={modalStyles.actions}>
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteSuccessType(null)}
                                        className={modalStyles.primary}
                                    >
                                        OK
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
                {/* Image Preview Lightbox */}
                <Lightbox
                    isOpen={!!viewingPhoto}
                    photo={viewingPhoto ? (() => {
                        // Merge live photo data so HLSVideoPlayer gets the latest
                        // HLS URL if Realtime updated it after the lightbox was opened
                        const livePhoto = currentEventPhotos.find(p => p.id === viewingPhoto.id);
                        return {
                            ...viewingPhoto,
                            src: livePhoto?.url || viewingPhoto.src,
                            raw_url: (livePhoto as any)?.raw_url || (viewingPhoto as any)?.raw_url,
                            thumbnailUrl: livePhoto?.thumbnailUrl || viewingPhoto.thumbnailUrl,
                        };
                    })() : null}
                    onClose={() => setViewingPhoto(null)}
                    keepPageHeaderVisible
                    hideFilename
                    compactMedia
                    onRotate={(direction) => viewingPhoto?.id ? handleRotatePhoto(viewingPhoto.id, direction) : undefined}
                    isFavourite={!!viewingPhoto?.id && eventFavouritePhotoIds.has(viewingPhoto.id)}
                    onToggleFavourite={
                        viewingPhoto?.id
                            ? () => handleToggleEventFavourite(viewingPhoto.id)
                            : undefined
                    }
                    onNext={() => {
                        const currentIndex = activeGalleryItems.findIndex(p => p.id === viewingPhoto?.id);
                        if (currentIndex !== -1) {
                            const nextIndex = (currentIndex + 1) % activeGalleryItems.length;
                            const nextPhoto = activeGalleryItems[nextIndex];
                            const isVideo = nextPhoto.mediaType === "video" || nextPhoto.resourceType === "video";
                            setViewingPhoto({
                                id: nextPhoto.id,
                                src: nextPhoto.url,
                                storageKey: nextPhoto.storageKey,
                                width: nextPhoto.width,
                                height: nextPhoto.height,
                                filename: nextPhoto.storageKey?.split('/').pop() || (isVideo ? "video" : "photo"),
                                mediaType: isVideo ? "video" : "photo",
                                resourceType: isVideo ? "video" : "image"
                            });
                        }
                    }}
                    onPrev={() => {
                        const currentIndex = activeGalleryItems.findIndex(p => p.id === viewingPhoto?.id);
                        if (currentIndex !== -1) {
                            const prevIndex = (currentIndex - 1 + activeGalleryItems.length) % activeGalleryItems.length;
                            const prevPhoto = activeGalleryItems[prevIndex];
                            const isVideo = prevPhoto.mediaType === "video" || prevPhoto.resourceType === "video";
                            setViewingPhoto({
                                id: prevPhoto.id,
                                src: prevPhoto.url,
                                storageKey: prevPhoto.storageKey,
                                width: prevPhoto.width,
                                height: prevPhoto.height,
                                filename: prevPhoto.storageKey?.split('/').pop() || (isVideo ? "video" : "photo"),
                                mediaType: isVideo ? "video" : "photo",
                                resourceType: isVideo ? "video" : "image"
                            });
                        }
                    }}
                />

                {videoActionItem && <VideoThumbnailActions ready={videoActionItem.status === "processed"} galleryVideo={(() => {
                    const gallery = galleryOfMedia(videoActionItem);
                    if (!gallery) return undefined;
                    const isCurrent = gallery.galleryVideoId === videoActionItem.id;
                    return { isCurrent, galleryTitle: gallery.title, isHidden: !!videoActionItem.isHidden, onToggle: () => { void handleSetGalleryVideo(videoActionItem, !isCurrent); setVideoActionItem(null); } };
                })()} onClose={() => setVideoActionItem(null)} onChoose={() => { setThumbnailVideo(videoActionItem); setVideoActionItem(null); }} onDelete={() => { void handleDeletePhoto(videoActionItem.id); setVideoActionItem(null); }} onMove={canMoveMedia ? () => { setMediaToMove([videoActionItem]); setVideoActionItem(null); } : undefined} onSaveToVault={() => { setMediaToSave([videoActionItem]); setVideoActionItem(null); }} />}
                {mediaToSave && (
                    <FolderPickerDialog
                        title={`Save ${mediaToSave.length === 1 ? "1 item" : `${mediaToSave.length} items`} to EB Vault`}
                        confirmLabel="Save"
                        excludeFolderIds={[]}
                        onClose={() => setMediaToSave(null)}
                        onPick={handleSaveToVault}
                    />
                )}
                {mediaToMove && (
                    <MoveToGalleryDialog
                        itemCount={mediaToMove.length}
                        galleries={moveTargetGalleries}
                        currentGalleryIds={Array.from(new Set(mediaToMove.map(item => item.eventId)))}
                        onClose={() => setMediaToMove(null)}
                        onMove={handleMoveMedia}
                    />
                )}
                {thumbnailVideo && <VideoThumbnailPicker video={thumbnailVideo} onClose={() => setThumbnailVideo(null)} onSaved={(id, thumbnailUrl) => setCurrentEventPhotos(previous => previous.map(photo => photo.id === id ? { ...photo, thumbnailUrl } : photo))} />}

                <AnimatePresence>
                    {photoActionItem && (
                        <div className={modalStyles.overlay} onClick={() => setPhotoActionItem(null)}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                                className={modalStyles.panel}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <ModalHeader
                                    title="Photo Actions"
                                    subtitle="Choose where this photo should appear as a thumbnail."
                                    onClose={() => setPhotoActionItem(null)}
                                />

                                <div className="space-y-3">
                                    <button
                                        onClick={async () => {
                                            await handleSetAsCover(photoActionItem.url);
                                            setPhotoActionItem(null);
                                        }}
                                        className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-[#CA9C68] px-5 py-4 text-left font-black text-slate-950 transition-transform active:scale-[0.98]"
                                    >
                                        <ImageIcon className="h-5 w-5 shrink-0" />
                                        <span>Make Gallery Thumbnail</span>
                                    </button>
                                    {selectedMainEvent && (
                                        <button
                                            onClick={async () => {
                                                await handleSetAsCover(photoActionItem.url, selectedMainEvent.id, true);
                                                setPhotoActionItem(null);
                                            }}
                                            className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-[#CA9C68]/30 bg-[#CA9C68]/10 px-5 py-4 text-left font-black text-[#CA9C68] transition-transform active:scale-[0.98]"
                                        >
                                            <Star className="h-5 w-5 shrink-0" />
                                            <span>Make Event Thumbnail</span>
                                        </button>
                                    )}
                                    {canMoveMedia && (
                                        <button
                                            onClick={() => {
                                                setMediaToMove([photoActionItem]);
                                                setPhotoActionItem(null);
                                            }}
                                            className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-slate-600 px-5 py-4 text-left font-black text-slate-200 transition-transform active:scale-[0.98] hover:border-slate-400"
                                        >
                                            <FolderInput className="h-5 w-5 shrink-0" />
                                            <span>Move to Another Gallery</span>
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                            setMediaToSave([photoActionItem]);
                                            setPhotoActionItem(null);
                                        }}
                                        className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-[#7FA38C]/40 px-5 py-4 text-left font-black text-[#A9C9B4] transition-transform active:scale-[0.98] hover:border-[#7FA38C]"
                                    >
                                        <HardDrive className="h-5 w-5 shrink-0" />
                                        <span>Save to EB Vault</span>
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {selectedGuestLog && (
                        <div className={modalStyles.overlay} onClick={() => setSelectedGuestLog(null)}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                                className={cn(modalStyles.panel, "max-w-xl overflow-hidden p-0 sm:p-0")}
                                onClick={(event) => event.stopPropagation()}
                            >
                                <div className="border-b border-[var(--site-border)] px-6 py-6">
                                    <div className="flex items-start gap-4">
                                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-[#CA9C68] text-xl font-black text-slate-950">
                                            {selectedGuestProfile?.profileImage ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={selectedGuestProfile.profileImage} alt="" className="h-full w-full object-cover" />
                                            ) : (
                                                (selectedGuestProfile?.name || selectedGuestLog.name || "G").charAt(0)
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="truncate text-2xl font-black text-white">{selectedGuestProfile?.name || selectedGuestLog.name || "Guest"}</h3>
                                            <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                                                Member #{String(eventDetailLogs.findIndex(log => log.id === selectedGuestLog.id) + 1).padStart(2, "0")}
                                            </p>
                                        </div>
                                        <ModalCloseButton onClick={() => setSelectedGuestLog(null)} />
                                    </div>
                                </div>

                                <div className="space-y-5 p-6">
                                    <div className="rounded-[1.5rem] border border-slate-800 bg-slate-900/70 p-4">
                                        {loadingGuestProfile ? (
                                            <div className="flex items-center justify-center py-6 text-slate-400">
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                <span className="text-sm font-bold">Loading profile...</span>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {[
                                                    ["Profile Name", selectedGuestProfile?.name || selectedGuestLog.name || "Not set"],
                                                    ["Username", selectedGuestProfile?.username ? `@${selectedGuestProfile.username}` : "Not set"],
                                                    ["Email ID", selectedGuestProfile?.email || selectedGuestLog.email || (selectedGuestLog.phone?.includes("@") ? selectedGuestLog.phone : "") || "Not set"],
                                                    ["Phone Number", selectedGuestProfile?.phone || (!selectedGuestLog.phone?.includes("@") ? selectedGuestLog.phone : "") || "Not set"],
                                                ].map(([label, value]) => (
                                                    <div key={label} className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3 last:border-b-0 last:pb-0">
                                                        <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
                                                        <span className="min-w-0 truncate text-right text-sm font-bold text-slate-100">{value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-[#CA9C68]">Member Privileges</p>
                                        <div className="space-y-3">
                                            {[
                                                { key: "canAdmin", label: "Admin Access", desc: "Manage event, sub-galleries, and other guests", icon: ShieldCheck },
                                                { key: "canUpload", label: "Allow Photo Uploads", desc: "Can add photos to the event. Videos are reserved for the event owner and admins.", icon: Camera },
                                                { key: "canComment", label: "Allow Comments", desc: "Can react and post comments on media", icon: MessageCircle },
                                            ].map(({ key, label, desc, icon: Icon }) => {
                                                const permKey = key as "canAdmin" | "canUpload" | "canComment";
                                                const isActive = Boolean(selectedGuestLog[permKey] || (selectedGuestLog.canAdmin && (permKey === "canUpload" || permKey === "canComment")));

                                                return (
                                                    <button
                                                        key={key}
                                                        type="button"
                                                        onClick={() => handleGuestPermissionToggle(selectedGuestLog, permKey)}
                                                        className={cn(
                                                            "flex w-full items-center gap-4 rounded-[1.25rem] border p-4 text-left transition-colors",
                                                            isActive ? "border-[#CA9C68]/45 bg-[#CA9C68]/10" : "border-slate-800 bg-slate-900/70 hover:border-slate-700"
                                                        )}
                                                    >
                                                        <span className={cn(
                                                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                                                            isActive ? "bg-[#CA9C68]/15 text-[#CA9C68]" : "bg-slate-800 text-slate-400"
                                                        )}>
                                                            <Icon className="h-5 w-5" />
                                                        </span>
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block text-sm font-black text-white">{label}</span>
                                                            <span className="mt-1 block text-xs font-bold text-slate-500">{desc}</span>
                                                        </span>
                                                        <span className={cn(
                                                            "relative h-7 w-12 rounded-full transition-colors",
                                                            isActive ? "bg-[#CA9C68]" : "bg-slate-700"
                                                        )}>
                                                            <span className={cn(
                                                                "absolute top-1 h-5 w-5 rounded-full bg-white transition-transform",
                                                                isActive ? "translate-x-6" : "translate-x-1"
                                                            )} />
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setSelectedGuestLog(null)}
                                        className="w-full rounded-2xl bg-[#CA9C68] px-5 py-4 text-sm font-black uppercase tracking-widest text-slate-950"
                                    >
                                        Save Permissions
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {showCreateSuccessModal && (
                        <div className={modalStyles.overlay}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.94, y: 12 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.94, y: 12 }}
                                className={cn(modalStyles.panel, "max-w-sm text-center")}
                            >
                                <ModalCloseButton onClick={closeCreateSuccessModal} className="absolute right-5 top-5" />
                                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#CA9C68]/10 text-[#CA9C68]">
                                    <Check className="h-7 w-7" />
                                </div>
                                <h2 className={modalStyles.title}>Success</h2>
                                <p className={cn(modalStyles.body, "mt-3")}>Your event has been created! ✨</p>
                                <button
                                    type="button"
                                    onClick={closeCreateSuccessModal}
                                    className={cn(modalStyles.primary, "mt-7 w-full py-4")}
                                >
                                    OK
                                </button>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Create Event Modal */}
                <AnimatePresence>
                    {isCreateModalOpen && (
                        <div className={modalStyles.overlay}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className={cn(modalStyles.panel, "my-8 max-w-lg")}
                            >
                                <ModalHeader title="Create Event" onClose={() => setIsCreateModalOpen(false)} />

                                {status === "error" && message && (
                                    <div className={cn(modalStyles.error, "mb-6")}>
                                        {message}
                                    </div>
                                )}

                                <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    const success = await handleCreateEventOnly(e);
                                    if (success) {
                                        setIsCreateModalOpen(false);
                                    }
                                }} className="space-y-6">
                                    <div>
                                        <label className={modalStyles.label}>Event Name</label>
                                        <input
                                            type="text"
                                            value={eventName}
                                            onChange={(e) => setEventName(e.target.value)}
                                            placeholder="e.g. Wedding of John & Jane"
                                            className={cn(modalStyles.input, "text-lg font-medium")}
                                            required
                                            autoFocus
                                        />
                                    </div>

                                    <div>
                                        <label className={modalStyles.label}>Event Type</label>
                                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                            {EVENT_TYPE_OPTIONS.map(({ name, icon: Icon }) => {
                                                const isSelected = eventType === name;
                                                return (
                                                    <button
                                                        key={name}
                                                        type="button"
                                                        onClick={() => {
                                                            setEventType(name);
                                                            const newTemplates = getTemplatesForEventCategory(name);
                                                            if (newTemplates.length > 0) setSelectedTemplate(newTemplates[0].id);
                                                        }}
                                                        className={cn(
                                                            "flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-black transition-colors",
                                                            isSelected
                                                                ? "border-[#CA9C68] bg-[#CA9C68] text-slate-950"
                                                                : "border-[var(--site-border)] bg-[#13191F] text-[var(--site-subtle)] hover:border-[#CA9C68]/50 hover:text-white"
                                                        )}
                                                    >
                                                        <Icon className="h-4 w-4 shrink-0" />
                                                        <span className="truncate">{name}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div>
                                        <label className={modalStyles.label}>Event Date</label>
                                        <button
                                            type="button"
                                            onClick={() => openDatePicker("create")}
                                            className={cn(modalStyles.input, "flex items-center justify-between text-left text-lg font-medium hover:border-[#CA9C68]/50")}
                                        >
                                            <span className={eventDate ? "text-white" : "text-slate-500"}>
                                                {eventDate || "Select event date"}
                                            </span>
                                            <Calendar className="h-5 w-5 text-[#CA9C68]" />
                                        </button>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={status === "uploading"}
                                        className={cn(modalStyles.primary, "w-full py-5")}
                                    >
                                        {status === "uploading" ? (
                                            <>
                                                <Loader2 className="w-6 h-6 animate-spin" />
                                                <span>Creating...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Create Event</span>
                                                <Sparkles className="w-5 h-5" />
                                            </>
                                        )}
                                    </button>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
                {/* Global Message Toast */}
                <AnimatePresence>
                    {message && !isCreateModalOpen && !showCreateSuccessModal && !showDeleteConfirm && (
                        <motion.div
                            initial={{ opacity: 0, y: 50, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm pointer-events-none"
                        >
                            <div className={cn(
                                "px-6 py-4 rounded-2xl shadow-2xl font-bold text-sm text-center border backdrop-blur-xl",
                                status === "success"
                                    ? "bg-emerald-500/20 text-emerald-100 border-emerald-500/30"
                                    : status === "error"
                                        ? "bg-rose-500/20 text-rose-100 border-rose-500/30"
                                        : "bg-sky-500/20 text-sky-100 border-sky-500/30"
                            )}>
                                {message}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </main >
        </div >
    );
}

export default function UserDashboard() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-slate-900/50">
                <Loader2 className="w-10 h-10 animate-spin text-sky-400" />
            </div>
        }>
            <DashboardContent />
        </Suspense>
    );
}

function OptionCard({ title, description, icon: Icon, onClick, href, color, hoverBorder, badge, actionTitle }: any) {
    const router = useRouter();

    return (
        <Tooltip text={actionTitle}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={(event) => {
                    if (href) {
                        navigateWithModifierClick(event, href, router.push);
                        return;
                    }

                    onClick?.(event);
                }}
                className={cn(
                    "group cursor-pointer bg-slate-800 p-10 rounded-[3rem] border border-slate-700 shadow-sm transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 relative overflow-hidden h-full flex flex-col",
                    hoverBorder
                )}
            >
                {badge && (
                    <div className="absolute top-8 right-8 px-3 py-1 bg-stone-100 text-[10px] font-bold uppercase tracking-widest text-stone-700 rounded-full">
                        {badge}
                    </div>
                )}
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-8 transition-transform group-hover:scale-110", color)}>
                    <Icon className="w-7 h-7" />
                </div>
                <h3 className="text-2xl font-bold mb-4 group-hover:text-white transition-colors">
                    {title}
                </h3>
                <p className="text-slate-700 font-sans leading-relaxed mb-6 text-sm">
                    {description}
                </p>
                <div className="flex items-center text-xs font-bold uppercase tracking-widest text-white mt-auto">
                    Explore
                    <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </div>
            </motion.div>
        </Tooltip>
    );
}
