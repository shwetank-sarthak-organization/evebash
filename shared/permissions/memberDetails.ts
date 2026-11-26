// A member's username and email for the Permissions popup (website and app). Only the backend can read them, and it
// only tells the people who manage that member's event (apps/backend/src/routes/permissions.ts: /member-details).

export type MemberDetails = { username?: string; email?: string };

/** Empty when it can't be read, so the popup still shows the name and photo. */
export async function fetchMemberDetails(url: string, accessToken: string, logId: string): Promise<MemberDetails> {
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ logId }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) return {};
        return { username: result.username || undefined, email: result.email || undefined };
    } catch {
        return {};
    }
}

/** The event owner's name, username and email, for the Owner row in Permissions (todo #50). */
export type OwnerDetails = { name?: string; username?: string; email?: string };

/** One event's Permissions details: every member and request by guest row id, and the owner. */
export type MemberDirectory = { members: Record<string, MemberDetails>; owner?: OwnerDetails };

/** Empty when it can't be read (or the backend is older and sends no owner), so the list still shows names. */
export async function fetchMemberDirectory(url: string, accessToken: string, eventId: string): Promise<MemberDirectory> {
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ eventId }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) return { members: {} };
        const owner = result.owner
            ? { name: result.owner.name || undefined, username: result.owner.username || undefined, email: result.owner.email || undefined }
            : undefined;
        return { members: result.members || {}, owner };
    } catch {
        return { members: {} };
    }
}


/** What tells two members with the same name apart: the username (unique), else the email, else what the row has. */
export function memberLabel(details: MemberDetails | undefined, fallback: string) {
    if (details?.username) return `@${details.username}`;
    return details?.email || fallback;
}
