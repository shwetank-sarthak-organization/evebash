// Website and app (one copy): the host's unsaved edits in Preview Guest Theme's edit mode (todo #11).
// One draft per event, by gallery id (Home and every album). Nothing here saves: each platform saves the draft with
// its own updateEvent / setGalleryVideo / theme content call.

import type { ThemeContent, ThemeContentBlock } from "../themes/themeContent";

/** The edit-mode fields of one gallery, in each platform's save format (date: what that platform's updateEvent
 *  is given). A field that is absent is unchanged. */
export interface GalleryDraft {
    title?: string;
    date?: string;
    description?: string;
    /** "" = remove the cover (the default cover shows) */
    coverImage?: string;
    coverMode?: "fit" | "fill";
    /** The cover's focus point and zoom (shared/themes/coverFocus.ts) */
    coverOffset?: number;
    coverOffsetX?: number;
    coverScale?: number;
    /** The phone cover (shared/themes/phoneCover.ts); null = phones use the computer cover's photo / framing */
    phoneCoverImage?: string | null;
    phoneCoverMode?: "fit" | "fill" | null;
    phoneCoverOffset?: number | null;
    phoneCoverOffsetX?: number | null;
    phoneCoverScale?: number | null;
    /** null = no highlight video */
    galleryVideoId?: string | null;
    /** The theme's own content (shared/themes/themeContent.ts): only the changed blocks, as typed. Main galleries only. */
    themeContent?: ThemeContent;
}

/** The draft fields of the computer cover */
export const COMPUTER_COVER_DRAFT_FIELDS = ["coverImage", "coverMode", "coverOffset", "coverOffsetX", "coverScale"] as const;
/** The draft fields of the phone cover */
export const PHONE_COVER_DRAFT_FIELDS = ["phoneCoverImage", "phoneCoverMode", "phoneCoverOffset", "phoneCoverOffsetX", "phoneCoverScale"] as const;
/** The draft fields the cover panel changes */
export const COVER_DRAFT_FIELDS = [...COMPUTER_COVER_DRAFT_FIELDS, ...PHONE_COVER_DRAFT_FIELDS] as const;

export type DraftField = keyof GalleryDraft;

export type EventDraft = Readonly<Record<string, GalleryDraft>>;

export const EMPTY_DRAFT: EventDraft = {};

const sameValue = (a: unknown, b: unknown) => (a ?? null) === (b ?? null);

/** Sets one field of one gallery. Setting it back to the saved value takes it out of the draft, so the counter
 *  only counts real changes. */
export function setDraftField<K extends DraftField>(
    draft: EventDraft,
    galleryId: string,
    field: K,
    value: GalleryDraft[K],
    savedValue: GalleryDraft[K] | undefined,
): EventDraft {
    const gallery: GalleryDraft = { ...draft[galleryId] };
    if (sameValue(value, savedValue)) delete gallery[field];
    else gallery[field] = value;
    const next = { ...draft };
    if (Object.keys(gallery).length === 0) delete next[galleryId];
    else next[galleryId] = gallery;
    return next;
}

/** Sets one theme content block of one gallery; `unchanged` (the same as saved) takes it out of the draft */
export function setDraftBlock<B extends ThemeContentBlock>(
    draft: EventDraft,
    galleryId: string,
    block: B,
    value: ThemeContent[B],
    unchanged: boolean,
): EventDraft {
    const gallery: GalleryDraft = { ...draft[galleryId] };
    const content: ThemeContent = { ...gallery.themeContent };
    if (unchanged) delete content[block];
    else content[block] = value;
    if (Object.keys(content).length > 0) gallery.themeContent = content;
    else delete gallery.themeContent;
    const next = { ...draft };
    if (Object.keys(gallery).length === 0) delete next[galleryId];
    else next[galleryId] = gallery;
    return next;
}

export function withoutGallery(draft: EventDraft, galleryId: string): EventDraft {
    if (!(galleryId in draft)) return draft;
    const next = { ...draft };
    delete next[galleryId];
    return next;
}

export function draftSummary(draft: EventDraft): { changes: number; galleries: number } {
    const galleries = Object.values(draft).filter((gallery) => Object.keys(gallery).length > 0);
    // Each theme content block counts as one change
    const changes = (gallery: GalleryDraft) => Object.keys(gallery).length - (gallery.themeContent ? 1 - Object.keys(gallery.themeContent).length : 0);
    return { changes: galleries.reduce((sum, gallery) => sum + changes(gallery), 0), galleries: galleries.length };
}

/** "1 change", "4 changes in 2 galleries" */
export function draftSummaryText(draft: EventDraft): string {
    const { changes, galleries } = draftSummary(draft);
    if (changes === 0) return "No changes";
    const changeText = `${changes} ${changes === 1 ? "change" : "changes"}`;
    return galleries > 1 ? `${changeText} in ${galleries} galleries` : changeText;
}

interface DraftableGallery {
    phoneCoverImage?: string | null;
    phoneCoverMode?: "fit" | "fill" | null;
    phoneCoverOffset?: number | null;
    phoneCoverOffsetX?: number | null;
    phoneCoverScale?: number | null;
    title?: string;
    date?: string;
    description?: string;
    coverImage?: string;
    coverMode?: "fit" | "fill";
    coverOffset?: number;
    coverOffsetX?: number;
    coverScale?: number;
    galleryVideoId?: string | null;
    themeContent?: ThemeContent;
}

/** The gallery as guests will see it once the draft is saved. `display` turns saved-format values into what the
 *  page shows (the date as text, the cover as an image link). A Fit / Fill change resets the cover position, as
 *  the host page does, unless the draft also moves it. Returns the same object when nothing applies, so screens
 *  don't redraw for nothing. */
export function applyGalleryDraft<T extends DraftableGallery>(
    gallery: T,
    draft: GalleryDraft | undefined,
    display: { date?: (value: string) => string; coverImage?: (value: string) => string } = {},
): T {
    if (!draft || Object.keys(draft).length === 0) return gallery;
    const next: T = { ...gallery };
    if (draft.title !== undefined) next.title = draft.title;
    if (draft.date !== undefined) next.date = display.date ? display.date(draft.date) : draft.date;
    if (draft.description !== undefined) next.description = draft.description;
    if (draft.coverImage !== undefined) next.coverImage = display.coverImage ? display.coverImage(draft.coverImage) : draft.coverImage;
    if (draft.coverMode !== undefined && draft.coverMode !== (gallery.coverMode || "fill")) {
        next.coverMode = draft.coverMode;
        next.coverOffset = 0;
        next.coverOffsetX = 0;
        next.coverScale = 1;
    }
    if (draft.coverOffset !== undefined) next.coverOffset = draft.coverOffset;
    if (draft.coverOffsetX !== undefined) next.coverOffsetX = draft.coverOffsetX;
    if (draft.coverScale !== undefined) next.coverScale = draft.coverScale;
    // The phone cover: saved as it is (each screen picks its cover and readies the photo, shared/themes/phoneCover.ts)
    if (draft.phoneCoverImage !== undefined) next.phoneCoverImage = draft.phoneCoverImage;
    if (draft.phoneCoverMode !== undefined) next.phoneCoverMode = draft.phoneCoverMode;
    if (draft.phoneCoverOffset !== undefined) next.phoneCoverOffset = draft.phoneCoverOffset;
    if (draft.phoneCoverOffsetX !== undefined) next.phoneCoverOffsetX = draft.phoneCoverOffsetX;
    if (draft.phoneCoverScale !== undefined) next.phoneCoverScale = draft.phoneCoverScale;
    if (draft.galleryVideoId !== undefined) next.galleryVideoId = draft.galleryVideoId;
    if (draft.themeContent !== undefined) next.themeContent = { ...gallery.themeContent, ...draft.themeContent };
    return next;
}

/** A new main gallery gets "Main Event: <title>" as its message; that isn't a message for guests, so the message
 *  panel starts empty for it. */
export function editableMessage(message: string | undefined, mainTitle: string | undefined): string {
    const text = message || "";
    return mainTitle && text.trim() === `Main Event: ${mainTitle}` ? "" : text;
}
