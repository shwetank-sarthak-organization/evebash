import { useSyncExternalStore } from "react";
import {
    EMPTY_DRAFT,
    applyGalleryDraft,
    setDraftBlock,
    setDraftField,
    withoutGallery,
    type DraftField,
    type EventDraft,
    type GalleryDraft,
} from "../../../shared/guestEdit/draft";
import { eventDateInputValue } from "../../../shared/text/eventDate";
import {
    cleanThemeContentBlock,
    editableCouple,
    sameCouple,
    type CoupleBlock,
    type CouplePerson,
    type CoupleSide,
    type ThemeContent,
    type ThemeContentBlock,
} from "../../../shared/themes/themeContent";
import { Event, GalleryVideo, Photo, getEventById, getSubEvents, saveThemeContentBlock, setGalleryVideo, updateEvent } from "@/lib/database";
import { removeEventCover, uploadEventCover } from "@/lib/eventCoverUpload";
import { resolveEventCoverImage } from "@/lib/eventCovers";
import { formatEventDate } from "@/lib/utils";
import type { CoverTarget } from "../../../shared/themes/phoneCover";

// Preview Guest Theme's edit mode on the website (todo #11): the host edits the real guest page and saves once.
// Every gallery of the event is its own page (/events/<id>), so the edits live here, outside the pages, and survive
// moving between galleries. A reload starts over (the page asks first while there are unsaved changes).

/** Off by default; NEXT_PUBLIC_GUEST_EDIT_MODE=true turns it on */
export const GUEST_EDIT_ENABLED = process.env.NEXT_PUBLIC_GUEST_EDIT_MODE === "true";

const SESSION_KEY = "evebash:guest-edit";

export interface GuestEditState {
    /** The main gallery of the event being edited; null when not editing */
    rootId: string | null;
    /** "View as guest": the edit bar is folded away */
    viewingAsGuest: boolean;
    /** Saved values of the main gallery and every album (hidden ones too), main gallery first */
    galleries: Event[];
    galleriesLoaded: boolean;
    draft: EventDraft;
    /** Saved during this visit; shown until the page loads its data again */
    saved: EventDraft;
    /** New cover pictures, uploaded on Save; the draft holds a local preview link for each */
    coverFiles: Readonly<Record<string, File>>;
    /** The chosen highlight video of a gallery (draft or saved this visit), so the page can play it */
    videos: Readonly<Record<string, GalleryVideo | null>>;
    saving: boolean;
    /** The edit panel that is open: a field of the theme's edit list, for one gallery (and the part of it to show
     *  first, e.g. the couple's right side) */
    openPanel: { galleryId: string; key: string; part?: string } | null;
}

const initialState: GuestEditState = {
    rootId: null,
    viewingAsGuest: false,
    galleries: [],
    galleriesLoaded: false,
    draft: EMPTY_DRAFT,
    saved: EMPTY_DRAFT,
    coverFiles: {},
    videos: {},
    saving: false,
    openPanel: null,
};

let state: GuestEditState = initialState;
const listeners = new Set<() => void>();

function update(next: Partial<GuestEditState>) {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
}

function readSessionRoot(): string | null {
    try {
        return typeof window === "undefined" ? null : window.sessionStorage.getItem(SESSION_KEY);
    } catch {
        return null;
    }
}

function writeSessionRoot(rootId: string | null) {
    try {
        if (rootId) window.sessionStorage.setItem(SESSION_KEY, rootId);
        else window.sessionStorage.removeItem(SESSION_KEY);
    } catch {
        // Private windows can refuse storage: edit mode then just ends on reload
    }
}

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export function useGuestEditState(): GuestEditState {
    return useSyncExternalStore(subscribe, () => state, () => initialState);
}

export function getGuestEditState() {
    return state;
}

/** True when this tab was editing this event before a reload */
export function wasEditing(rootId: string) {
    return GUEST_EDIT_ENABLED && readSessionRoot() === rootId;
}

/** The draft field holding each cover's photo, and the key of its new picture waiting for Save */
const IMAGE_FIELD = { computer: "coverImage", phone: "phoneCoverImage" } as const;
const coverFileKey = (galleryId: string, target: CoverTarget) => (target === "phone" ? `${galleryId}#phone` : galleryId);

function revokePreviews(draft: EventDraft) {
    Object.values(draft).forEach((gallery) => {
        [gallery.coverImage, gallery.phoneCoverImage].forEach((image) => {
            if (image?.startsWith("blob:")) URL.revokeObjectURL(image);
        });
    });
}

async function loadGalleries(rootId: string) {
    try {
        const root = await getEventById(rootId);
        const albums = root ? await getSubEvents(root.id, root.legacyId) : [];
        if (state.rootId !== rootId) return;
        update({ galleries: root ? [root, ...albums.filter((album) => album.id !== root.id)] : [], galleriesLoaded: true });
    } catch (error) {
        console.error("[GuestEdit] Could not load the event's galleries:", error);
        if (state.rootId === rootId) update({ galleriesLoaded: true });
    }
}

/** Starts edit mode for an event (call only for its managers) */
export function startGuestEdit(rootId: string) {
    if (!GUEST_EDIT_ENABLED) return;
    writeSessionRoot(rootId);
    // Moving to another gallery of the same event keeps the edits
    if (state.rootId === rootId) return;
    revokePreviews(state.draft);
    update({ ...initialState, rootId });
    void loadGalleries(rootId);
}

/** Leaves edit mode and drops unsaved changes */
export function stopGuestEdit() {
    writeSessionRoot(null);
    revokePreviews(state.draft);
    update(initialState);
}

export function setViewingAsGuest(viewingAsGuest: boolean) {
    update({ viewingAsGuest, ...(viewingAsGuest && { openPanel: null }) });
}

/** Opens a field's edit panel (from the bar or from a pencil on the page); null closes it */
export function openGuestEditPanel(panel: GuestEditState["openPanel"]) {
    update({ openPanel: panel });
}

export function discardGuestEdits() {
    revokePreviews(state.draft);
    const videos = { ...state.videos };
    Object.keys(state.draft).forEach((galleryId) => {
        if (!(galleryId in state.saved) || state.saved[galleryId].galleryVideoId === undefined) delete videos[galleryId];
    });
    update({ draft: EMPTY_DRAFT, coverFiles: {}, videos });
}

/** A gallery's value as saved, in the draft's format (the date as "2026-11-06") */
export function savedValue<K extends DraftField>(galleryId: string, field: K): GalleryDraft[K] | undefined {
    const savedThisVisit = state.saved[galleryId]?.[field];
    if (savedThisVisit !== undefined) return savedThisVisit;
    const gallery = state.galleries.find((item) => item.id === galleryId);
    if (!gallery) return undefined;
    switch (field) {
        case "date": return eventDateInputValue(gallery.date) as GalleryDraft[K];
        case "coverMode": return (gallery.coverMode || "fill") as GalleryDraft[K];
        case "coverOffset": return Number(gallery.coverOffset || 0) as GalleryDraft[K];
        case "coverOffsetX": return Number(gallery.coverOffsetX || 0) as GalleryDraft[K];
        case "coverScale": return Number(gallery.coverScale || 1) as GalleryDraft[K];
        case "galleryVideoId": return (gallery.galleryVideoId ?? null) as GalleryDraft[K];
        // The phone cover: null = same as the computer cover
        case "phoneCoverImage": return (gallery.phoneCoverImage || null) as GalleryDraft[K];
        case "phoneCoverMode": return (gallery.phoneCoverMode || null) as GalleryDraft[K];
        case "phoneCoverOffset":
        case "phoneCoverOffsetX":
        case "phoneCoverScale": return (gallery[field] == null ? null : Number(gallery[field])) as GalleryDraft[K];
        default: return (gallery[field as "title" | "description" | "coverImage"] ?? "") as GalleryDraft[K];
    }
}

/** The value the edit panels show: the draft, else what is saved */
export function currentValue<K extends DraftField>(galleryId: string, field: K): GalleryDraft[K] | undefined {
    const drafted = state.draft[galleryId]?.[field];
    return drafted !== undefined ? drafted : savedValue(galleryId, field);
}

export function setGuestEditField<K extends DraftField>(galleryId: string, field: K, value: GalleryDraft[K]) {
    const next: Partial<GuestEditState> = { draft: setDraftField(state.draft, galleryId, field, value, savedValue(galleryId, field)) };
    // Another photo for a cover: its new picture from the computer, if any, is dropped
    const target = field === "coverImage" ? "computer" : field === "phoneCoverImage" ? "phone" : null;
    const previous = target ? state.draft[galleryId]?.[IMAGE_FIELD[target]] : undefined;
    if (target && previous !== value) {
        if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous);
        const coverFiles = { ...state.coverFiles };
        delete coverFiles[coverFileKey(galleryId, target)];
        next.coverFiles = coverFiles;
    }
    update(next);
}

/** Takes fields of one gallery out of the draft (the panel's Undo) */
export function undoGuestEditFields(galleryId: string, fields: DraftField[]) {
    const gallery: GalleryDraft = { ...state.draft[galleryId] };
    const coverFiles = { ...state.coverFiles };
    (["computer", "phone"] as const).forEach((target) => {
        if (!fields.includes(IMAGE_FIELD[target])) return;
        const image = gallery[IMAGE_FIELD[target]];
        if (image?.startsWith("blob:")) URL.revokeObjectURL(image);
        delete coverFiles[coverFileKey(galleryId, target)];
    });
    fields.forEach((field) => delete gallery[field]);
    const videos = { ...state.videos };
    if (fields.includes("galleryVideoId") && state.saved[galleryId]?.galleryVideoId === undefined) delete videos[galleryId];
    update({
        draft: Object.keys(gallery).length > 0 ? { ...state.draft, [galleryId]: gallery } : withoutGallery(state.draft, galleryId),
        coverFiles,
        videos,
    });
}

/** The event's theme content as saved (this visit's save, else as loaded); kept on the main gallery */
function savedThemeContent(galleryId: string): ThemeContent | undefined {
    return state.saved[galleryId]?.themeContent ?? state.galleries.find((item) => item.id === galleryId)?.themeContent;
}

/** Both sides of the couple as the panel shows them: the draft, else what is saved, else empty with the default labels */
export function currentCouple(galleryId: string): Record<CoupleSide, CouplePerson> {
    const category = state.galleries.find((item) => item.id === galleryId)?.category;
    return editableCouple(state.draft[galleryId]?.themeContent?.couple ?? savedThemeContent(galleryId)?.couple, category);
}

export function setGuestEditCouple(galleryId: string, couple: CoupleBlock) {
    const category = state.galleries.find((item) => item.id === galleryId)?.category;
    const unchanged = sameCouple(couple, editableCouple(savedThemeContent(galleryId)?.couple, category));
    update({ draft: setDraftBlock(state.draft, galleryId, "couple", couple, unchanged) });
}

/** Takes one theme content block out of the draft (the panel's Undo) */
export function undoGuestEditBlock(galleryId: string, block: ThemeContentBlock) {
    update({ draft: setDraftBlock(state.draft, galleryId, block, undefined, true) });
}

/** A new cover picture from the host's computer, for the computer or the phone cover: shown at once, uploaded on Save */
export function setGuestEditCoverFile(galleryId: string, file: File, target: CoverTarget = "computer") {
    const preview = URL.createObjectURL(file);
    setGuestEditField(galleryId, IMAGE_FIELD[target], preview);
    update({ coverFiles: { ...state.coverFiles, [coverFileKey(galleryId, target)]: file } });
}

/** The gallery's own processed, visible video in the shape the guest page plays */
function playableVideo(video: Photo | null): GalleryVideo | null {
    if (!video || video.status !== "processed" || video.isHidden || !video.url) return null;
    return { id: video.id, streamUrl: video.url, posterUrl: video.thumbnailUrl, width: video.width, height: video.height };
}

export function setGuestEditVideo(galleryId: string, video: Photo | null) {
    setGuestEditField(galleryId, "galleryVideoId", video?.id ?? null);
    update({ videos: { ...state.videos, [galleryId]: playableVideo(video) } });
}

/** The highlight video to show for a gallery while editing; undefined = not changed, use the saved one */
export function editedVideoFor(editState: GuestEditState, galleryId: string): GalleryVideo | null | undefined {
    const changed = editState.draft[galleryId]?.galleryVideoId !== undefined || editState.saved[galleryId]?.galleryVideoId !== undefined;
    return changed ? editState.videos[galleryId] ?? null : undefined;
}

/** A gallery as guests will see it once saved: the saved values of this visit, then the draft */
export function withGuestEdits<T extends Event | null | undefined>(gallery: T, editState: GuestEditState, coverMode: "preview" | "thumbnail" = "preview"): T {
    if (!gallery || !editState.rootId) return gallery;
    const display = {
        date: (value: string) => formatEventDate(value),
        // A new picture shows from the computer until it's uploaded
        coverImage: (value: string) => value.startsWith("blob:") ? value : resolveEventCoverImage(value, coverMode, gallery.category),
    };
    const saved = applyGalleryDraft(gallery, editState.saved[gallery.id], display);
    return applyGalleryDraft(saved, editState.draft[gallery.id], display) as T;
}

function galleryName(galleryId: string) {
    const gallery = state.galleries.find((item) => item.id === galleryId);
    return gallery ? (gallery.parentId ? gallery.title || "Album" : "Home") : "a gallery";
}

/** Saves the draft gallery by gallery with the same calls the host page uses. A gallery that fails keeps its
 *  unsaved part, so Save can be pressed again. Returns the names of the galleries that failed, and why when known. */
export async function saveGuestEdits(userId: string): Promise<{ failed: string[]; reasons: string[] }> {
    if (state.saving) return { failed: [], reasons: [] };
    update({ saving: true });
    const failed: string[] = [];
    const reasons = new Set<string>();

    for (const [galleryId, changes] of Object.entries(state.draft)) {
        const done = (fields: GalleryDraft) => {
            const remaining: GalleryDraft = { ...state.draft[galleryId] };
            (Object.keys(fields) as DraftField[]).forEach((field) => delete remaining[field]);
            const draft = Object.keys(remaining).length > 0 ? { ...state.draft, [galleryId]: remaining } : withoutGallery(state.draft, galleryId);
            update({ draft, saved: { ...state.saved, [galleryId]: { ...state.saved[galleryId], ...fields } } });
        };

        try {
            // 1. A new cover picture (computer or phone cover): uploaded only now, then saved like the host page does
            for (const target of ["computer", "phone"] as const) {
                const imageField = IMAGE_FIELD[target];
                const image = changes[imageField];
                const coverFile = state.coverFiles[coverFileKey(galleryId, target)];
                if (!coverFile || !image?.startsWith("blob:")) continue;
                const coverUrl = await uploadEventCover(coverFile, galleryId, userId, target);
                URL.revokeObjectURL(image);
                const coverFiles = { ...state.coverFiles };
                delete coverFiles[coverFileKey(galleryId, target)];
                update({ coverFiles });
                done({ [imageField]: coverUrl });
            }
            // Removed: the computer cover goes back to the default cover, the phone cover to the computer cover
            if (changes.coverImage === "") {
                const previousCover = savedValue(galleryId, "coverImage");
                if (previousCover) await removeEventCover(galleryId, previousCover);
                done({ coverImage: "" });
            }
            if (changes.phoneCoverImage === null && savedValue(galleryId, "phoneCoverImage")) {
                await removeEventCover(galleryId, savedValue(galleryId, "phoneCoverImage") || "", "phone");
                done({ phoneCoverImage: null, phoneCoverMode: null, phoneCoverOffset: null, phoneCoverOffsetX: null, phoneCoverScale: null });
            }

            // 2. Text, date, cover picked from the gallery, Fit / Fill (which resets the position, as on the host page)
            const fields: Partial<Event> = {};
            const savedFields: GalleryDraft = {};
            if (changes.title !== undefined) { fields.title = changes.title; savedFields.title = changes.title; }
            if (changes.date !== undefined) { fields.date = changes.date; savedFields.date = changes.date; }
            if (changes.description !== undefined) { fields.description = changes.description; savedFields.description = changes.description; }
            if (changes.coverImage && !changes.coverImage.startsWith("blob:")) { fields.coverImage = changes.coverImage; savedFields.coverImage = changes.coverImage; }
            if (changes.coverMode !== undefined) {
                Object.assign(fields, { coverMode: changes.coverMode, coverOffset: 0, coverOffsetX: 0, coverScale: 1 });
                savedFields.coverMode = changes.coverMode;
            }
            // Moved or zoomed: a percent focus point and zoom (shared/themes/coverFocus.ts)
            for (const field of ["coverOffset", "coverOffsetX", "coverScale"] as const) {
                if (changes[field] !== undefined) { fields[field] = changes[field]; savedFields[field] = changes[field]; }
            }
            // The phone cover's photo chosen from the gallery, and its framing (each set as it is: Fit / Fill in the
            // panel sets the position too)
            const remainingPhone = state.draft[galleryId] || {};
            if (typeof remainingPhone.phoneCoverImage === "string" && !remainingPhone.phoneCoverImage.startsWith("blob:")) {
                fields.phoneCoverImage = remainingPhone.phoneCoverImage;
                savedFields.phoneCoverImage = remainingPhone.phoneCoverImage;
            }
            for (const field of ["phoneCoverMode", "phoneCoverOffset", "phoneCoverOffsetX", "phoneCoverScale"] as const) {
                if (remainingPhone[field] !== undefined) {
                    Object.assign(fields, { [field]: remainingPhone[field] });
                    Object.assign(savedFields, { [field]: remainingPhone[field] });
                }
            }
            if (Object.keys(fields).length > 0) {
                const ok = await updateEvent(galleryId, fields);
                if (!ok) throw new Error("updateEvent returned false");
                done(savedFields);
            }

            // 3. Highlight video
            if (changes.galleryVideoId !== undefined) {
                const result = await setGalleryVideo(galleryId, changes.galleryVideoId);
                if (!result.success) throw new Error(result.error || "setGalleryVideo failed");
                done({ galleryVideoId: changes.galleryVideoId });
            }

            // 4. The theme's own content (Confetti Circle's couple...): each changed block, cleaned, on the main event
            for (const [block, value] of Object.entries(changes.themeContent || {}) as [ThemeContentBlock, unknown][]) {
                const result = await saveThemeContentBlock(galleryId, block, cleanThemeContentBlock(block, value));
                if (!result.success) {
                    if (result.error) reasons.add(result.error);
                    throw new Error(result.error || "saveThemeContentBlock failed");
                }
                // The page lays this over the content it loaded, so a block that is now gone must say so
                const content: ThemeContent = { ...result.content };
                if (!(block in content)) content[block] = undefined;
                update({
                    draft: setDraftBlock(state.draft, galleryId, block, undefined, true),
                    saved: { ...state.saved, [galleryId]: { ...state.saved[galleryId], themeContent: content } },
                });
            }
        } catch (error) {
            console.error(`[GuestEdit] Saving ${galleryId} failed:`, error);
            failed.push(galleryName(galleryId));
        }
    }

    // Keep the saved values as the new baseline for the panels
    update({
        saving: false,
        galleries: state.galleries.map((gallery) => {
            const saved = state.saved[gallery.id];
            if (!saved) return gallery;
            return {
                ...gallery,
                ...(saved.title !== undefined && { title: saved.title }),
                ...(saved.date !== undefined && { date: formatEventDate(saved.date) }),
                ...(saved.description !== undefined && { description: saved.description }),
                ...(saved.coverImage !== undefined && { coverImage: saved.coverImage }),
                ...(saved.coverMode !== undefined && { coverMode: saved.coverMode, coverOffset: 0, coverOffsetX: 0, coverScale: 1 }),
                ...(saved.coverOffset !== undefined && { coverOffset: saved.coverOffset }),
                ...(saved.coverOffsetX !== undefined && { coverOffsetX: saved.coverOffsetX }),
                ...(saved.coverScale !== undefined && { coverScale: saved.coverScale }),
                ...(saved.galleryVideoId !== undefined && { galleryVideoId: saved.galleryVideoId }),
                ...(saved.phoneCoverImage !== undefined && { phoneCoverImage: saved.phoneCoverImage }),
                ...(saved.phoneCoverMode !== undefined && { phoneCoverMode: saved.phoneCoverMode }),
                ...(saved.phoneCoverOffset !== undefined && { phoneCoverOffset: saved.phoneCoverOffset }),
                ...(saved.phoneCoverOffsetX !== undefined && { phoneCoverOffsetX: saved.phoneCoverOffsetX }),
                ...(saved.phoneCoverScale !== undefined && { phoneCoverScale: saved.phoneCoverScale }),
                ...(saved.themeContent !== undefined && { themeContent: saved.themeContent }),
            };
        }),
    });
    return { failed, reasons: [...reasons] };
}
