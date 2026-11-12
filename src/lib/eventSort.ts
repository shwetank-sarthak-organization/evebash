// Sorting and filtering for the dashboard event lists. Mirrors the app's Gallery screen
// (apps/mobile/app/(tabs)/your-events.tsx) so both list events the same way.

import { eventDateValue } from "../../shared/text/eventDate";

// Shared with the app (shared/text/eventDate.ts); exported here for the dashboard lists and tests
export { eventDateValue };

export type EventSortKey = "recent" | "date_desc" | "date_asc" | "name";

export const EVENT_SORT_OPTIONS: { key: EventSortKey; label: string }[] = [
    { key: "recent", label: "Recently added" },
    { key: "date_desc", label: "Event date: newest first" },
    { key: "date_asc", label: "Event date: oldest first" },
    { key: "name", label: "Name: A to Z" },
];

export const ALL_EVENT_TYPES = "All";

// createdAt arrives as an ISO string from Supabase; older code paths used Firestore-style timestamps
type CreatedAt = string | number | { seconds?: number; toDate?: () => Date } | null | undefined;
type SortableEvent = { title: string; date?: string; category?: string; createdAt?: CreatedAt };

export function getCreatedTime(event: { createdAt?: CreatedAt }) {
    const createdAt = event.createdAt;
    if (!createdAt) return 0;
    if (typeof createdAt === "string" || typeof createdAt === "number") {
        return new Date(createdAt).getTime() || 0;
    }
    if (createdAt.seconds) {
        return createdAt.seconds * 1000;
    }
    if (createdAt.toDate) {
        return createdAt.toDate().getTime();
    }
    return 0;
}

export function sortEvents<T extends SortableEvent>(list: T[], sortKey: EventSortKey): T[] {
    const sorted = [...list];
    if (sortKey === "name") {
        return sorted.sort((a, b) => (a.title || "").localeCompare(b.title || "", undefined, { numeric: true, sensitivity: "base" }));
    }
    if (sortKey === "date_desc" || sortKey === "date_asc") {
        const direction = sortKey === "date_desc" ? -1 : 1;
        return sorted.sort((a, b) => {
            const da = eventDateValue(a.date);
            const db = eventDateValue(b.date);
            // Events without a readable date go last either way
            if (da === null && db === null) return 0;
            if (da === null) return 1;
            if (db === null) return -1;
            return (da - db) * direction;
        });
    }
    return sorted.sort((a, b) => getCreatedTime(b) - getCreatedTime(a));
}

/** The event types the list actually has (case-insensitive, first spelling wins), A to Z. */
export function getEventTypes(list: SortableEvent[]): string[] {
    const types = new Map<string, string>();
    list.forEach((event) => {
        const category = event.category?.trim();
        if (category && !types.has(category.toLowerCase())) types.set(category.toLowerCase(), category);
    });
    return Array.from(types.values()).sort((a, b) => a.localeCompare(b));
}

export function filterEvents<T extends SortableEvent>(list: T[], query: string, type: string): T[] {
    const q = query.trim().toLowerCase();
    return list.filter((event) =>
        (event.title || "").toLowerCase().includes(q) &&
        (type === ALL_EVENT_TYPES || event.category?.trim().toLowerCase() === type.toLowerCase())
    );
}
