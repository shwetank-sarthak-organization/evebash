"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Check, Clapperboard, ExternalLink, Eye, Heart, ImageIcon, Loader2, MessageSquare, Monitor, Pencil, Smartphone, Type, Upload, X } from "lucide-react";
import { COVER_DRAFT_FIELDS, PHONE_COVER_DRAFT_FIELDS, applyGalleryDraft, draftSummaryText, editableMessage } from "../../../shared/guestEdit/draft";
import { COVER_FIELD_NAMES, hasPhoneFraming, hasPhonePhoto, shownCover, type CoverTarget } from "../../../shared/themes/phoneCover";
import { clampCoverZoom, coverFocus, focusToOffsets, MAX_COVER_ZOOM, MIN_COVER_ZOOM } from "../../../shared/themes/coverFocus";
import { editableFieldsFor, type EditableField } from "../../../shared/themes/editableFields";
import {
    COUPLE_LIMITS,
    COUPLE_SIDES,
    SOCIAL_NETWORKS,
    SOCIAL_NETWORK_NAMES,
    emptyCouplePerson,
    socialLinkUrl,
    type CouplePerson,
    type CoupleSide,
    type SocialNetwork,
} from "../../../shared/themes/themeContent";
import { SOCIAL_ICONS } from "@/components/icons/SocialIcons";
import { Photo, getGalleryVideos } from "@/lib/database";
import { resolveEventCoverImage } from "@/lib/eventCovers";
import { coverImageStyle } from "@/lib/coverStyle";
import { isDefaultCoverPhoto, useCoverTarget } from "@/lib/screenCover";
import { cn } from "@/lib/utils";
import { alertDialog, confirmDialog, modalStyles } from "@/components/ui/Modal";
import {
    currentCouple,
    currentValue,
    discardGuestEdits,
    getGuestEditState,
    openGuestEditPanel,
    saveGuestEdits,
    setGuestEditCouple,
    setGuestEditCoverFile,
    setGuestEditField,
    setGuestEditVideo,
    setViewingAsGuest,
    stopGuestEdit,
    undoGuestEditBlock,
    undoGuestEditFields,
    useGuestEditState,
} from "./guestEditStore";

// The bar at the bottom of the guest page in Preview Guest Theme's edit mode (todo #11). Its buttons come from the
// theme's edit list (shared/themes/editableFields.ts); each opens a small panel above the bar while the page stays
// visible, and the page shows every change at once. Nothing reaches guests until Save.

const FIELD_ICONS: Record<EditableField["kind"], React.ComponentType<{ className?: string }>> = {
    cover: ImageIcon,
    text: Type,
    date: CalendarDays,
    longText: MessageSquare,
    video: Clapperboard,
    couple: Heart,
};

const barButton = "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--site-gold)] disabled:cursor-not-allowed disabled:opacity-50";
const quietButton = cn(barButton, "border border-[var(--site-border)] text-[var(--site-subtle)] hover:bg-[var(--site-tint)]/5");
const goldButton = cn(barButton, "bg-[var(--site-gold)] text-[var(--site-on-gold)] hover:bg-[var(--site-gold-light)]");

interface GuestEditBarProps {
    /** The gallery on screen */
    galleryId: string;
    templateId?: string;
    userId: string;
    /** Photos of the gallery on screen, for choosing the cover */
    photos: { id: string; src: string; thumbnailUrl?: string }[];
}

export function GuestEditBar({ galleryId, templateId, userId, photos }: GuestEditBarProps) {
    const editState = useGuestEditState();
    // The bar's height while it shows, as --guest-edit-bar on the page: themes with text at the bottom of their first
    // screen (Sunlit Portrait, Midnight Hero) lift it above the bar. Measured from whenever the bar appears (it renders
    // nothing until edit mode has started); gone while viewing as a guest, and for guests.
    const measureBar = useCallback((bar: HTMLDivElement) => {
        const root = document.documentElement;
        const observer = new ResizeObserver(() => root.style.setProperty("--guest-edit-bar", `${bar.offsetHeight}px`));
        observer.observe(bar);
        return () => {
            observer.disconnect();
            root.style.removeProperty("--guest-edit-bar");
        };
    }, []);
    const router = useRouter();
    const pathname = usePathname();
    // The open panel (opened here or by a pencil on the page) belongs to the gallery it was opened on: moving to
    // another gallery closes it
    const openField = editState.openPanel?.galleryId === galleryId ? editState.openPanel.key : null;
    const setOpenField = (update: string | null | ((current: string | null) => string | null)) => {
        const key = typeof update === "function" ? update(openField) : update;
        openGuestEditPanel(key ? { galleryId, key } : null);
    };
    const [savedNote, setSavedNote] = useState(false);
    const hasChanges = Object.keys(editState.draft).length > 0;

    const rootId = editState.rootId;
    const gallery = editState.galleries.find((item) => item.id === galleryId);
    const isHome = galleryId === rootId;
    const fields = editableFieldsFor(templateId, "web", isHome);
    const openFieldDef = fields.find((field) => field.key === openField);
    // Theme content belongs to the whole event: edited and saved on the main gallery from any gallery
    const draftGalleryId = (field: EditableField) => (field.block && rootId ? rootId : galleryId);
    const isChanged = (field: EditableField) => {
        const draft = editState.draft[draftGalleryId(field)];
        if (field.block) return draft?.themeContent?.[field.block] !== undefined;
        return draft?.[field.column] !== undefined || (field.kind === "cover" && COVER_DRAFT_FIELDS.some((cover) => draft?.[cover] !== undefined));
    };

    // Leaving the page (reload, closing the tab, another site) with unsaved changes asks first
    useEffect(() => {
        if (!hasChanges) return;
        const warn = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [hasChanges]);

    useEffect(() => {
        if (!openField) return;
        const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") openGuestEditPanel(null); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [openField]);

    if (!rootId) return null;

    const save = async () => {
        setOpenField(null);
        const { failed, reasons } = await saveGuestEdits(userId);
        if (failed.length > 0) {
            void alertDialog({
                title: "Some changes weren't saved",
                message: reasons.length > 0
                    ? `Saving ${failed.join(", ")} failed. ${reasons.join(" ")} Those changes are still here.`
                    : `Saving ${failed.join(", ")} failed. Those changes are still here: check your connection and press Save again.`,
            });
        } else {
            setSavedNote(true);
            window.setTimeout(() => setSavedNote(false), 2500);
        }
    };

    const discard = async () => {
        const confirmed = await confirmDialog({ title: "Discard your changes?", message: "Everything you changed since the last Save goes back to how guests see it now.", confirmLabel: "Discard" });
        if (confirmed) {
            setOpenField(null);
            discardGuestEdits();
        }
    };

    const finish = async () => {
        if (Object.keys(getGuestEditState().draft).length > 0) {
            const leave = await confirmDialog({ title: "Leave without saving?", message: "Your unsaved changes will be lost.", confirmLabel: "Leave", cancelLabel: "Keep editing" });
            if (!leave) return;
        }
        stopGuestEdit();
        // Drop ?edit=1 so the page doesn't start edit mode again
        router.replace(pathname);
    };

    const switchGallery = (id: string) => {
        if (id !== galleryId) router.push(`/events/${encodeURIComponent(id)}`);
    };

    if (editState.viewingAsGuest) {
        return (
            <div className="lightbox-hide-ui fixed bottom-4 right-4 z-[60] font-sans">
                <button type="button" onClick={() => setViewingAsGuest(false)} className={cn(goldButton, "px-5 py-3 shadow-2xl shadow-black/40")}>
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Back to editing
                    {hasChanges && <span className="rounded-full bg-[var(--site-on-gold)]/15 px-2 py-0.5">{draftSummaryText(editState.draft)}</span>}
                </button>
            </div>
        );
    }

    const manageHref = `/host?view=manage&level=event-details&mode=add-image&eventId=${encodeURIComponent(rootId)}&galleryId=${encodeURIComponent(galleryId)}`;

    return (
        <div ref={measureBar} className="lightbox-hide-ui fixed inset-x-0 bottom-0 z-[60] px-2 pb-2 font-sans sm:px-4 sm:pb-4" role="region" aria-label="Edit this page">
            <div className="relative mx-auto max-w-5xl">
                {openFieldDef && (
                    <EditPanel
                        key={`${openFieldDef.key}:${editState.openPanel?.part || ""}`}
                        field={openFieldDef}
                        galleryId={draftGalleryId(openFieldDef)}
                        part={editState.openPanel?.part}
                        changed={isChanged(openFieldDef)}
                        legacyId={gallery?.legacyId}
                        photos={photos}
                        manageHref={manageHref}
                        onClose={() => setOpenField(null)}
                    />
                )}

                {/* Phones and tablets: gallery + leave buttons, then the edit buttons, then Save. Wide screens: one row. */}
                <div className="flex flex-col gap-2 rounded-[1.4rem] border border-[var(--site-border)] bg-[var(--site-surface)]/95 p-2.5 text-[var(--site-text)] shadow-2xl shadow-black/50 backdrop-blur-md sm:p-3 lg:flex-row lg:items-center lg:gap-3">
                    <div className="flex items-center gap-2 lg:contents">
                        {/* Which gallery the changes go to */}
                        <label className="flex min-w-0 flex-1 items-center gap-2 lg:order-1 lg:max-w-[14rem] lg:flex-none">
                            <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--site-gold-text)]">Editing</span>
                            <select
                                value={galleryId}
                                onChange={(event) => switchGallery(event.target.value)}
                                disabled={!editState.galleriesLoaded}
                                className="min-w-0 flex-1 truncate rounded-full border border-[var(--site-border)] bg-[var(--site-bg)] px-3 py-1.5 text-xs font-bold text-[var(--site-text)] outline-none focus:border-[var(--site-gold)]"
                            >
                                {editState.galleries.length === 0 && <option value={galleryId}>{gallery?.title || "This gallery"}</option>}
                                {editState.galleries.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.id === rootId ? "Home" : item.title || "Album"}{item.isHidden ? " (hidden from guests)" : ""}
                                    </option>
                                ))}
                            </select>
                        </label>

                        {/* Leave edit mode */}
                        <div className="flex shrink-0 items-center gap-1.5 lg:order-4 lg:border-l lg:border-[var(--site-border)] lg:pl-3">
                            <button type="button" onClick={() => { setOpenField(null); setViewingAsGuest(true); }} className={quietButton} aria-label="View as guest" title="View as guest: hide this bar">
                                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <a href={manageHref} target="_blank" rel="noopener noreferrer" className={quietButton} aria-label="Manage photos in the host section" title="Manage photos and videos in the host section">
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                            </a>
                            <button type="button" onClick={() => void finish()} className={quietButton} title="Stop editing">
                                <X className="h-3.5 w-3.5" aria-hidden="true" />
                                Done
                            </button>
                        </div>
                    </div>

                    {/* The theme's edit buttons */}
                    <div className="-mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] lg:order-2 lg:flex-1">
                        {fields.map((field) => {
                            const Icon = FIELD_ICONS[field.kind];
                            const changed = isChanged(field);
                            return (
                                <button
                                    key={field.key}
                                    type="button"
                                    aria-pressed={openField === field.key}
                                    onClick={() => setOpenField((current) => current === field.key ? null : field.key)}
                                    className={cn(quietButton, openField === field.key && "border-[var(--site-gold)] bg-[var(--site-gold)]/15 text-[var(--site-text)]")}
                                >
                                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                                    {field.label}
                                    {changed && <span className="h-1.5 w-1.5 rounded-full bg-[var(--site-gold)]" aria-label="changed" />}
                                </button>
                            );
                        })}
                    </div>

                    {/* Save */}
                    <div className="flex items-center justify-between gap-2 lg:order-3 lg:justify-end">
                        <span className="text-xs font-semibold text-[var(--site-muted)]" aria-live="polite">
                            {editState.saving ? "Saving..." : savedNote ? "Saved" : draftSummaryText(editState.draft)}
                        </span>
                        <div className="flex items-center gap-1.5">
                            <button type="button" onClick={() => void discard()} disabled={!hasChanges || editState.saving} className={quietButton}>Discard</button>
                            <button type="button" onClick={() => void save()} disabled={!hasChanges || editState.saving} className={goldButton}>
                                {editState.saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : savedNote ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function EditPanel({ field, galleryId, part, changed, legacyId, photos, manageHref, onClose }: {
    field: EditableField;
    /** The gallery whose draft the panel changes (the main gallery for theme content) */
    galleryId: string;
    /** The part to show first (a pencil's) */
    part?: string;
    changed: boolean;
    legacyId?: string;
    photos: GuestEditBarProps["photos"];
    manageHref: string;
    onClose: () => void;
}) {
    // Re-read on every change so the inputs follow the draft
    useGuestEditState();
    const savedText = field.kind === "text" || field.kind === "longText" ? String(currentValue(galleryId, field.column) ?? "") : "";
    // A new main gallery's automatic "Main Event: <title>" message isn't for guests: the panel starts empty
    const textValue = field.column === "description" && !changed ? editableMessage(savedText, getGuestEditState().galleries[0]?.title) : savedText;

    return (
        <div
            role="dialog"
            aria-label={field.label}
            className="absolute inset-x-0 bottom-full mb-2 max-h-[60vh] overflow-y-auto rounded-[1.4rem] border border-[var(--site-border)] bg-[var(--site-surface)] p-4 text-[var(--site-text)] shadow-2xl shadow-black/50 sm:left-auto sm:w-[26rem] sm:p-5"
        >
            <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-black text-[var(--site-text)]">{field.label}</p>
                <div className="flex items-center gap-1">
                    {changed && (
                        <button
                            type="button"
                            onClick={() => field.block
                                ? undoGuestEditBlock(galleryId, field.block)
                                : undoGuestEditFields(galleryId, field.kind === "cover" ? [...COVER_DRAFT_FIELDS] : [field.column])}
                            className="rounded-full px-2.5 py-1 text-xs font-bold text-[var(--site-gold-text)] hover:bg-[var(--site-gold)]/10"
                        >
                            Undo
                        </button>
                    )}
                    <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-[var(--site-muted)] hover:bg-[var(--site-tint)]/5 hover:text-[var(--site-text)]">
                        <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>
            </div>

            {field.kind === "text" && (
                <input
                    autoFocus
                    value={textValue}
                    maxLength={field.maxLength}
                    onChange={(event) => setGuestEditField(galleryId, field.column, event.target.value)}
                    className={cn(modalStyles.input, "py-3")}
                />
            )}

            {field.kind === "longText" && (
                <>
                    <textarea
                        autoFocus
                        rows={4}
                        value={textValue}
                        maxLength={field.maxLength}
                        onChange={(event) => setGuestEditField(galleryId, field.column, event.target.value)}
                        placeholder="Write a brief, elegant welcome note..."
                        className={cn(modalStyles.input, "resize-none py-3")}
                    />
                    {field.maxLength && (
                        <p className="mt-1.5 text-right text-xs text-[var(--site-muted)]">{textValue.length}/{field.maxLength}</p>
                    )}
                </>
            )}

            {field.kind === "date" && (
                <input
                    type="date"
                    autoFocus
                    value={String(currentValue(galleryId, "date") ?? "")}
                    onChange={(event) => setGuestEditField(galleryId, "date", event.target.value)}
                    className={cn(modalStyles.input, "py-3 [color-scheme:dark] light:[color-scheme:light]")}
                />
            )}

            {field.kind === "cover" && <CoverPanel galleryId={galleryId} photos={photos} />}

            {field.kind === "video" && <VideoPanel galleryId={galleryId} legacyId={legacyId} manageHref={manageHref} />}

            {field.kind === "couple" && <CouplePanel galleryId={galleryId} firstSide={part === "right" ? "right" : "left"} />}
        </div>
    );
}

/** The cover being edited (the computer or the phone cover): the gallery's values with the draft, what that screen
 *  shows now, and how to change it */
function useCoverEditor(galleryId: string, target: CoverTarget) {
    useGuestEditState();
    const editState = getGuestEditState();
    const gallery = editState.galleries.find((item) => item.id === galleryId);
    const withDraft = gallery ? applyGalleryDraft(applyGalleryDraft(gallery, editState.saved[galleryId]), editState.draft[galleryId]) : undefined;
    const shown = withDraft ? shownCover(withDraft, target, isDefaultCoverPhoto) : {};
    const ownPhone = !!withDraft && (hasPhonePhoto(withDraft) || hasPhoneFraming(withDraft));
    const names = COVER_FIELD_NAMES[target];
    const category = gallery?.category || editState.galleries[0]?.category;
    const image = shown.coverImage?.startsWith("blob:") ? shown.coverImage : resolveEventCoverImage(shown.coverImage, "preview", category);
    const focus = coverFocus(shown);

    // The phone cover starts from what phones show now (the computer cover's framing), so changing one part of it
    // doesn't move the rest
    const ownFraming = () => {
        if (target !== "phone" || currentValue(galleryId, "phoneCoverMode")) return;
        setGuestEditField(galleryId, "phoneCoverMode", shown.coverMode || "fill");
        setGuestEditField(galleryId, "phoneCoverOffset", Number(shown.coverOffset || 0));
        setGuestEditField(galleryId, "phoneCoverOffsetX", Number(shown.coverOffsetX || 0));
        setGuestEditField(galleryId, "phoneCoverScale", Number(shown.coverScale || 1));
    };
    const setPosition = (fields: { offset?: number; offsetX?: number; scale?: number }) => {
        ownFraming();
        if (fields.offset !== undefined) setGuestEditField(galleryId, names.offset, fields.offset);
        if (fields.offsetX !== undefined) setGuestEditField(galleryId, names.offsetX, fields.offsetX);
        if (fields.scale !== undefined) setGuestEditField(galleryId, names.scale, fields.scale);
    };
    const centre = () => setPosition({ offset: 0, offsetX: 0, scale: 1 });

    return {
        image,
        mode: (shown.coverMode || "fill") as "fit" | "fill",
        focus,
        /** The photo itself (not the default cover) */
        hasPhoto: target === "phone" ? hasPhonePhoto(withDraft || {}) || !isDefaultCoverPhoto(withDraft?.coverImage) : !isDefaultCoverPhoto(withDraft?.coverImage),
        ownPhone,
        chosenPhoto: target === "phone" ? withDraft?.phoneCoverImage : withDraft?.coverImage,
        shown,
        setPosition,
        centre,
        // Fit shows the whole photo; switching resets the position, as the host page does
        setMode: (mode: "fit" | "fill") => {
            if (target === "computer") {
                undoGuestEditFields(galleryId, ["coverOffset", "coverOffsetX", "coverScale"]);
                setGuestEditField(galleryId, "coverMode", mode);
            } else {
                setGuestEditField(galleryId, "phoneCoverMode", mode);
                setGuestEditField(galleryId, "phoneCoverOffset", 0);
                setGuestEditField(galleryId, "phoneCoverOffsetX", 0);
                setGuestEditField(galleryId, "phoneCoverScale", 1);
            }
        },
        // A new photo starts filled and centred
        choosePhoto: (photo: string) => {
            setGuestEditField(galleryId, names.image, photo);
            if (target === "phone") setGuestEditField(galleryId, "phoneCoverMode", "fill");
            centre();
        },
        uploadPhoto: (file: File) => {
            setGuestEditCoverFile(galleryId, file, target);
            if (target === "phone") setGuestEditField(galleryId, "phoneCoverMode", "fill");
            centre();
        },
        // The computer cover goes back to the default cover; the phone cover back to the computer cover
        remove: () => {
            if (target === "computer") {
                setGuestEditField(galleryId, "coverImage", "");
                return;
            }
            for (const field of PHONE_COVER_DRAFT_FIELDS) setGuestEditField(galleryId, field, null);
        },
    };
}

function CoverPanel({ galleryId, photos }: { galleryId: string; photos: GuestEditBarProps["photos"] }) {
    // The cover for this screen first; the other one is a tab away
    const screenTarget = useCoverTarget();
    const [chosenTarget, setTarget] = useState<CoverTarget | null>(null);
    const target = chosenTarget || screenTarget;
    const cover = useCoverEditor(galleryId, target);
    const fileInput = useRef<HTMLInputElement>(null);
    const pickable = photos.filter((photo) => photo.src).slice(0, 60);

    return (
        <div className="space-y-4">
            <div className="inline-flex rounded-full border border-[var(--site-border)] p-0.5" role="tablist" aria-label="Which cover">
                {(["computer", "phone"] as const).map((item) => (
                    <button
                        key={item}
                        type="button"
                        role="tab"
                        aria-selected={target === item}
                        onClick={() => setTarget(item)}
                        className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold", target === item ? "bg-[var(--site-gold)] text-[var(--site-on-gold)]" : "text-[var(--site-subtle)]")}
                    >
                        {item === "computer" ? <Monitor className="h-3.5 w-3.5" aria-hidden="true" /> : <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />}
                        {item === "computer" ? "Computer" : "Phone"}
                    </button>
                ))}
            </div>

            {/* Which cover this is, and where the other one is set */}
            <div className="flex items-start gap-3">
                <CoverFramePreview target={target} image={cover.image} shown={cover.shown} />
                <p className="text-xs leading-5 text-[var(--site-muted)]">
                    {target === "computer"
                        ? "Computer cover: computers and tablets. Phones show the phone cover; set it in the Phone tab or in the EveBash app."
                        : cover.ownPhone
                            ? "Phone cover: the EveBash app and phone browsers. Computers keep the computer cover."
                            : "Phones show the computer cover. Change anything here to give phones (the app and phone browsers) their own cover."}
                </p>
            </div>

            <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => fileInput.current?.click()} className={goldButton}>
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    {target === "phone" && !cover.ownPhone ? "Use a different photo" : "Upload new"}
                </button>
                <div className="inline-flex rounded-full border border-[var(--site-border)] p-0.5" role="group" aria-label="Cover fit">
                    {(["fill", "fit"] as const).map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            aria-pressed={cover.mode === mode}
                            onClick={() => cover.setMode(mode)}
                            className={cn("rounded-full px-3 py-1.5 text-xs font-bold", cover.mode === mode ? "bg-[var(--site-gold)] text-[var(--site-on-gold)]" : "text-[var(--site-subtle)]")}
                        >
                            {mode === "fill" ? "Fill" : "Fit"}
                        </button>
                    ))}
                </div>
                {target === "phone" ? (
                    cover.ownPhone && (
                        <button type="button" onClick={cover.remove} className={quietButton}>
                            Use the computer cover
                        </button>
                    )
                ) : cover.hasPhoto ? (
                    <button type="button" onClick={cover.remove} className={cn(quietButton, "text-rose-300 light:text-rose-700")}>
                        Remove cover
                    </button>
                ) : (
                    <span className="self-center text-xs text-[var(--site-muted)]">Default cover</span>
                )}
            </div>
            {cover.mode === "fill" && (
                <CoverPositioner
                    image={cover.image}
                    focus={cover.focus}
                    onMove={(x, y) => {
                        const offsets = focusToOffsets(x, y);
                        cover.setPosition({ offset: offsets.coverOffset, offsetX: offsets.coverOffsetX });
                    }}
                    onZoom={(zoom) => cover.setPosition({ scale: clampCoverZoom(zoom) })}
                    onCentre={cover.centre}
                />
            )}

            <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) cover.uploadPhoto(file);
                }}
            />

            <div>
                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--site-muted)]">Or choose a photo from this gallery</p>
                {pickable.length === 0 ? (
                    <p className="text-xs text-[var(--site-muted)]">No photos in this gallery yet.</p>
                ) : (
                    <div className="grid grid-cols-4 gap-1.5">
                        {pickable.map((photo) => (
                            <button
                                key={photo.id}
                                type="button"
                                aria-pressed={cover.chosenPhoto === photo.src}
                                onClick={() => cover.choosePhoto(photo.src)}
                                className={cn("relative aspect-square overflow-hidden rounded-lg bg-[var(--site-bg)]", cover.chosenPhoto === photo.src && "ring-2 ring-[var(--site-gold)]")}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={photo.thumbnailUrl || photo.src} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

/** A small phone- or computer-shaped frame with the cover as that screen shows it */
function CoverFramePreview({ target, image, shown }: { target: CoverTarget; image: string; shown: Parameters<typeof coverImageStyle>[0] }) {
    return (
        <div
            className={cn(
                "relative shrink-0 overflow-hidden border-2 border-[var(--site-border)] bg-black",
                target === "phone" ? "h-24 w-[3.4rem] rounded-xl" : "h-16 w-28 rounded-md",
            )}
            role="img"
            aria-label={target === "phone" ? "How the cover looks on a phone" : "How the cover looks on a computer"}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" className="absolute inset-0 h-full w-full" style={coverImageStyle(shown)} />
        </div>
    );
}

/** Move and zoom: the whole photo with a dot on the part to keep in view, and the zoom. The page follows at once. */
function CoverPositioner({ image, focus, onMove, onZoom, onCentre }: {
    image: string;
    focus: { x: number; y: number; zoom: number };
    onMove: (x: number, y: number) => void;
    onZoom: (zoom: number) => void;
    onCentre: () => void;
}) {
    const box = useRef<HTMLDivElement>(null);
    const dragging = useRef(false);
    const { x, y, zoom } = focus;

    const moveTo = (clientX: number, clientY: number) => {
        const rect = box.current?.getBoundingClientRect();
        if (!rect || rect.width === 0 || rect.height === 0) return;
        onMove(((clientX - rect.left) / rect.width) * 100, ((clientY - rect.top) / rect.height) * 100);
    };

    return (
        <div className="rounded-2xl border border-[var(--site-border)] bg-[var(--site-bg)]/60 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--site-muted)]">Move and zoom</p>
                <button type="button" onClick={onCentre} className="rounded-full px-2.5 py-1 text-xs font-bold text-[var(--site-gold-text)] hover:bg-[var(--site-gold)]/10">
                    Centre
                </button>
            </div>
            <p className="mb-2 text-xs text-[var(--site-muted)]">Drag the dot to the part of the photo that should stay in view.</p>
            <div className="flex justify-center">
                <div
                    ref={box}
                    role="slider"
                    tabIndex={0}
                    aria-label="Part of the photo to keep in view"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(x)}
                    aria-valuetext={`${Math.round(x)}% from the left, ${Math.round(y)}% from the top`}
                    onPointerDown={(event) => {
                        dragging.current = true;
                        event.currentTarget.setPointerCapture(event.pointerId);
                        moveTo(event.clientX, event.clientY);
                    }}
                    onPointerMove={(event) => { if (dragging.current) moveTo(event.clientX, event.clientY); }}
                    onPointerUp={() => { dragging.current = false; }}
                    onPointerCancel={() => { dragging.current = false; }}
                    onKeyDown={(event) => {
                        const step = event.shiftKey ? 10 : 2;
                        const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
                        const move = moves[event.key];
                        if (!move) return;
                        event.preventDefault();
                        onMove(x + move[0], y + move[1]);
                    }}
                    className="relative inline-block cursor-crosshair touch-none select-none overflow-hidden rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--site-gold)]"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt="" draggable={false} className="block max-h-40 w-auto max-w-full" />
                    <span
                        aria-hidden="true"
                        className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--site-gold)] shadow-lg shadow-black/50"
                        style={{ left: `${x}%`, top: `${y}%` }}
                    />
                </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
                <span className="w-12 text-xs font-bold text-[var(--site-subtle)]">Zoom</span>
                <button type="button" onClick={() => onZoom(zoom - 0.1)} disabled={zoom <= MIN_COVER_ZOOM} className={cn(quietButton, "h-7 w-7 px-0")} aria-label="Zoom out">−</button>
                <input
                    type="range"
                    min={MIN_COVER_ZOOM * 100}
                    max={MAX_COVER_ZOOM * 100}
                    step={5}
                    value={Math.round(zoom * 100)}
                    onChange={(event) => onZoom(Number(event.target.value) / 100)}
                    className="min-w-0 flex-1 accent-[var(--site-gold)]"
                    aria-label="Zoom"
                />
                <button type="button" onClick={() => onZoom(zoom + 0.1)} disabled={zoom >= MAX_COVER_ZOOM} className={cn(quietButton, "h-7 w-7 px-0")} aria-label="Zoom in">+</button>
                <span className="w-11 text-right text-xs font-bold text-[var(--site-text)]">{Math.round(zoom * 100)}%</span>
            </div>
        </div>
    );
}

function VideoPanel({ galleryId, legacyId, manageHref }: { galleryId: string; legacyId?: string; manageHref: string }) {
    const [loaded, setLoaded] = useState<{ galleryId: string; videos: Photo[] } | null>(null);
    const videos = loaded?.galleryId === galleryId ? loaded.videos : null;
    const chosenId = currentValue(galleryId, "galleryVideoId") ?? null;

    useEffect(() => {
        let cancelled = false;
        void getGalleryVideos(galleryId, legacyId).then((list) => {
            if (!cancelled) setLoaded({ galleryId, videos: list.filter((video) => video.status !== "failed") });
        });
        return () => { cancelled = true; };
    }, [galleryId, legacyId]);

    const chosen = videos?.find((video) => video.id === chosenId);

    return (
        <div className="space-y-3">
            <p className="text-xs text-[var(--site-muted)]">
                {!chosenId ? "No highlight video. Pick one of this gallery's videos."
                    : !videos ? "Loading..."
                    : !chosen ? "The chosen video is no longer in this gallery, so guests don't see it."
                    : chosen.isHidden ? "This video is hidden from guests, so they don't see it until you show it again."
                    : chosen.status !== "processed" ? "Processing: guests will see it once it's ready."
                    : "Plays at the top of this gallery."}
            </p>
            {!videos ? (
                <Loader2 className="h-5 w-5 animate-spin text-[var(--site-muted)]" aria-hidden="true" />
            ) : (
                <div className="grid grid-cols-3 gap-2">
                    <button
                        type="button"
                        aria-pressed={!chosenId}
                        onClick={() => setGuestEditVideo(galleryId, null)}
                        className={cn("grid aspect-video place-items-center rounded-lg border border-dashed border-[var(--site-border)] text-xs font-bold text-[var(--site-muted)]", !chosenId && "ring-2 ring-[var(--site-gold)]")}
                    >
                        None
                    </button>
                    {videos.map((video) => (
                        <button
                            key={video.id}
                            type="button"
                            aria-pressed={video.id === chosenId}
                            onClick={() => setGuestEditVideo(galleryId, video)}
                            className={cn("relative aspect-video overflow-hidden rounded-lg bg-[var(--site-bg)]", video.id === chosenId && "ring-2 ring-[var(--site-gold)]")}
                            title={video.storageKey?.split("/").pop() || "Video"}
                        >
                            {video.thumbnailUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={video.thumbnailUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                            )}
                            {(video.isHidden || video.status !== "processed") && (
                                <span className="absolute inset-x-1 bottom-1 truncate rounded bg-black/70 px-1 text-[10px] font-bold text-white">
                                    {video.isHidden ? "Hidden" : "Processing"}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}
            <a href={manageHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--site-gold-text)] hover:underline">
                Upload a new video in the host section
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
        </div>
    );
}

const linkHints: Readonly<Record<SocialNetwork, string>> = {
    instagram: "instagram.com/name or @name",
    facebook: "facebook.com/name",
    x: "x.com/name or @name",
};

/** The couple (Confetti Circle): each side's label, name, a few words and links. Only a side with a name shows, and
 *  only the links that are filled in; nothing is taken from the gallery title. */
function CouplePanel({ galleryId, firstSide }: { galleryId: string; firstSide: CoupleSide }) {
    useGuestEditState();
    const [side, setSide] = useState<CoupleSide>(firstSide);
    const couple = currentCouple(galleryId);
    const person = couple[side];
    const sideName = (key: CoupleSide) => couple[key].label.trim() || couple[key].name.trim() || (key === "left" ? "Left side" : "Right side");
    const hasContent = !!(person.name.trim() || person.about.trim() || SOCIAL_NETWORKS.some((network) => person.links[network]?.trim()));

    const setPerson = (changes: Partial<CouplePerson>) => setGuestEditCouple(galleryId, { ...couple, [side]: { ...person, ...changes } });
    const label = "mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-[var(--site-muted)]";

    return (
        <div className="space-y-4">
            <div className="inline-flex max-w-full rounded-full border border-[var(--site-border)] p-0.5" role="tablist" aria-label="Which side">
                {COUPLE_SIDES.map((key) => (
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={side === key}
                        onClick={() => setSide(key)}
                        className={cn("max-w-[11rem] truncate rounded-full px-3 py-1.5 text-xs font-bold", side === key ? "bg-[var(--site-gold)] text-[var(--site-on-gold)]" : "text-[var(--site-subtle)]")}
                    >
                        {sideName(key)}
                    </button>
                ))}
            </div>

            <p className="text-xs leading-5 text-[var(--site-muted)]">
                {person.name.trim()
                    ? `Shows ${side === "left" ? "left" : "right"} of the video, on Home and every album. Only what you fill in shows.`
                    : hasContent
                        ? "Add a name: guests see this side only once it has one."
                        : "Guests don't see this side until you add a name."}
            </p>

            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
                <label>
                    <span className={label}>Shown as</span>
                    <input
                        value={person.label}
                        maxLength={COUPLE_LIMITS.label}
                        placeholder="e.g. The Bride"
                        onChange={(event) => setPerson({ label: event.target.value })}
                        className={cn(modalStyles.input, "px-4 py-2.5 text-sm")}
                    />
                </label>
                <label>
                    <span className={label}>Name</span>
                    <input
                        autoFocus
                        value={person.name}
                        maxLength={COUPLE_LIMITS.name}
                        placeholder="Their name"
                        onChange={(event) => setPerson({ name: event.target.value })}
                        className={cn(modalStyles.input, "px-4 py-2.5 text-sm")}
                    />
                </label>
            </div>

            <label className="block">
                <span className={label}>A few words</span>
                <textarea
                    rows={3}
                    value={person.about}
                    maxLength={COUPLE_LIMITS.about}
                    placeholder="Optional"
                    onChange={(event) => setPerson({ about: event.target.value })}
                    className={cn(modalStyles.input, "resize-none px-4 py-2.5 text-sm")}
                />
                <span className="mt-1 block text-right text-xs text-[var(--site-muted)]">{person.about.length}/{COUPLE_LIMITS.about}</span>
            </label>

            <fieldset className="space-y-2">
                <legend className={label}>Social links (optional)</legend>
                {SOCIAL_NETWORKS.map((network) => {
                    const Icon = SOCIAL_ICONS[network];
                    const value = person.links[network] || "";
                    const wrong = !!value.trim() && !socialLinkUrl(network, value);
                    return (
                        <div key={network}>
                            <div className="relative">
                                <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--site-muted)]" aria-hidden="true" />
                                <input
                                    value={value}
                                    maxLength={COUPLE_LIMITS.link}
                                    placeholder={linkHints[network]}
                                    aria-label={SOCIAL_NETWORK_NAMES[network]}
                                    aria-invalid={wrong}
                                    inputMode="url"
                                    autoCapitalize="none"
                                    spellCheck={false}
                                    onChange={(event) => setPerson({ links: { ...person.links, [network]: event.target.value } })}
                                    className={cn(modalStyles.input, "py-2.5 pl-10 pr-4 text-sm", wrong && "border-rose-400 light:border-rose-600")}
                                />
                            </div>
                            {wrong && (
                                <p className="mt-1 text-xs text-rose-300 light:text-rose-700">
                                    Not a {SOCIAL_NETWORK_NAMES[network]} profile link, so it won&apos;t show.
                                </p>
                            )}
                        </div>
                    );
                })}
            </fieldset>

            {hasContent && (
                <button type="button" onClick={() => setPerson(emptyCouplePerson(person.label))} className={cn(quietButton, "text-rose-300 light:text-rose-700")}>
                    Clear this side
                </button>
            )}
        </div>
    );
}
