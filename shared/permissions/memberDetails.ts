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

/** Every member and request of an event, by guest row id, for its Permissions list. Empty when it can't be read. */
export async function fetchMemberDirectory(url: string, accessToken: string, eventId: string): Promise<Record<string, MemberDetails>> {
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ eventId }),
        });
        const result = await response.json().catch(() => ({}));
        return response.ok && result.success ? result.members : {};
    } catch {
        return {};
    }
}

/** What tells two members with the same name apart: the username (unique), else the email, else what the row has. */
export function memberLabel(details: MemberDetails | undefined, fallback: string) {
    if (details?.username) return `@${details.username}`;
    return details?.email || fallback;
}
