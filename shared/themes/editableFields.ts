// Website and app (one copy): what a host can edit on a gallery's guest page from Preview Guest Theme (todo #11).
// Each theme lists its own fields; a theme with no entry gets the standard five. A new theme adds its entry here
// when it is created, and must read every listed field from the event data it is given (never a fixed copy), so
// the preview shows the host's unsaved changes.

import type { ThemeContentBlock } from "./themeContent";

export type EditableFieldKind = "text" | "longText" | "date" | "cover" | "video" | "couple";

/** Event fields that already have a column on events (both database.ts files save them with updateEvent or
 *  setGalleryVideo; themeContent with the theme content call). A field that needs a new column can't be listed until
 *  that column exists. */
export type EditableColumn = "title" | "date" | "description" | "coverImage" | "galleryVideoId" | "themeContent";

export const EDITABLE_COLUMNS: readonly EditableColumn[] = ["title", "date", "description", "coverImage", "galleryVideoId", "themeContent"];

export type EditPlatform = "web" | "app";

export interface EditableField {
    key: string;
    /** Button and panel name in the edit bar */
    label: string;
    kind: EditableFieldKind;
    column: EditableColumn;
    /** "home": the main gallery only; "every": Home and every album */
    where: "home" | "every";
    maxLength?: number;
    /** Leave out when both platforms show it */
    platforms?: readonly EditPlatform[];
    /** Theme content (column themeContent): the block it edits. It belongs to the whole event (saved on the main
     *  gallery), so it can be edited from every gallery that shows it. */
    block?: ThemeContentBlock;
}

export const COVER_FIELD: EditableField = { key: "cover", label: "Cover", kind: "cover", column: "coverImage", where: "every" };
export const TITLE_FIELD: EditableField = { key: "title", label: "Title", kind: "text", column: "title", where: "every" };
export const DATE_FIELD: EditableField = { key: "date", label: "Date", kind: "date", column: "date", where: "every" };
// Same limit as the host page's Welcome Message box
export const MESSAGE_FIELD: EditableField = { key: "message", label: "Message", kind: "longText", column: "description", where: "every", maxLength: 200 };
export const VIDEO_FIELD: EditableField = { key: "video", label: "Video", kind: "video", column: "galleryVideoId", where: "every" };

// Confetti Circle's bride and groom (todo #10): the app shows the section (todo #12) but has no Couple sheet yet, so the
// field stays web-only until that sheet is built
export const COUPLE_FIELD: EditableField = { key: "couple", label: "Couple", kind: "couple", column: "themeContent", block: "couple", where: "every", platforms: ["web"] };

export const STANDARD_EDITABLE_FIELDS: readonly EditableField[] = [COVER_FIELD, TITLE_FIELD, DATE_FIELD, MESSAGE_FIELD, VIDEO_FIELD];

/** Themes whose edit list differs from the standard five, by template id */
export const THEME_EDITABLE_FIELDS: Readonly<Record<string, readonly EditableField[]>> = {
    // Periwinkle Script shows the gallery message in the card on its cover, not in the gallery header
    periwinkle: [COVER_FIELD, TITLE_FIELD, DATE_FIELD, { ...MESSAGE_FIELD, label: "Cover message" }, VIDEO_FIELD],
    confetti: [...STANDARD_EDITABLE_FIELDS, COUPLE_FIELD],
};

/** The fields the edit bar shows for a gallery in this theme, in order */
export function editableFieldsFor(templateId: string | undefined, platform: EditPlatform, isHome: boolean): EditableField[] {
    const fields = THEME_EDITABLE_FIELDS[templateId || "hero"] || STANDARD_EDITABLE_FIELDS;
    return fields.filter((field) =>
        (!field.platforms || field.platforms.includes(platform)) && (field.where === "every" || isHome));
}
