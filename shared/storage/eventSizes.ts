// The per-event list in the Storage card (website and app). /api/v1/media/storage-usage sends it largest first.

export type EventStorageSize = { eventId: string; title: string; bytes: number };

/** Events shown before "Show all". */
export const EVENT_SIZES_SHOWN = 5;

/** Empty from older backends or before its migration, so the card simply has no list. */
export function readEventSizes(sizes: unknown): EventStorageSize[] {
    if (!Array.isArray(sizes)) return [];
    return sizes.map((size) => ({
        eventId: String(size?.eventId ?? ""),
        title: String(size?.title || "Untitled event"),
        bytes: Number(size?.bytes) || 0,
    }));
}
