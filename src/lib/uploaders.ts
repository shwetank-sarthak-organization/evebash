import { getApiUrl } from "@/lib/apiBase";
import { supabase } from "@/lib/supabase";

// Keep in sync with apps/mobile/lib/uploaders.ts and apps/backend/src/routes/uploaders.ts.
export type UploaderRole = "owner" | "admin" | "guest" | "former_guest" | "deleted" | "anonymous";
export type UploaderDetails = { name: string; role: UploaderRole };
export type UploaderOption = { userId: string; label: string; count: number };

const ROLE_LABELS: Record<UploaderRole, string> = {
    owner: "Owner",
    admin: "Admin",
    guest: "Guest",
    former_guest: "Former guest",
    deleted: "Deleted user",
    anonymous: "Anonymous",
};
const ROLE_ORDER: UploaderRole[] = ["owner", "admin", "guest", "former_guest", "deleted", "anonymous"];

/** Names and roles of a gallery's uploaders (gallery managers only). Missing on failure: the filter shows "Unknown". */
export async function fetchUploaderDetails(eventId: string, userIds: string[]): Promise<Record<string, UploaderDetails>> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token || userIds.length === 0) return {};
    const response = await fetch(getApiUrl("/api/v1/permissions/uploaders"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ eventId, userIds }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) return {};
    return Object.fromEntries((result.uploaders as ({ userId: string } & UploaderDetails)[]).map(({ userId, name, role }) => [userId, { name, role }]));
}

/** "Me (Owner) · 24", "Priya (Guest) · 3"…: you first, then by role, then by name. Only people with media here. */
export function buildUploaderOptions(
    items: { userId?: string | null }[],
    details: Record<string, UploaderDetails>,
    myUserId?: string | null,
): UploaderOption[] {
    const counts = new Map<string, number>();
    for (const item of items) {
        const id = item.userId || "anonymous";
        counts.set(id, (counts.get(id) || 0) + 1);
    }
    return Array.from(counts, ([userId, count]) => {
        const detail = details[userId];
        const role = detail ? ROLE_LABELS[detail.role] : "";
        const name = userId === myUserId ? "Me" : detail?.name || (userId === "anonymous" ? "Anonymous" : "Unknown");
        return { userId, count, label: role && role !== name ? `${name} (${role})` : name, rank: detail ? ROLE_ORDER.indexOf(detail.role) : ROLE_ORDER.length };
    })
        .sort((a, b) => Number(b.userId === myUserId) - Number(a.userId === myUserId) || a.rank - b.rank || a.label.localeCompare(b.label))
        .map(({ userId, label, count }) => ({ userId, label, count }));
}

/** The uploader of a media row ("anonymous" when none was recorded). */
export function uploaderOf(item: { userId?: string | null }) {
    return item.userId || "anonymous";
}
