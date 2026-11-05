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
