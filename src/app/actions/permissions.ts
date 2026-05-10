"use server";

import { adminDb } from "@/lib/firebase-admin";

const SUPER_ADMIN_EMAILS = [
    "shwetank.chauhan17@gmail.com",
    "shwetank.chauhan3@gmail.com",
    "code4sarthak@gmail.com",
];

type Requester = {
    uid?: string | null;
    email?: string | null;
};

async function canManageGuestLog(logId: string, requester: Requester) {
    if (!requester.uid && !requester.email) return { allowed: false, logRef: null };
    if (requester.email && SUPER_ADMIN_EMAILS.includes(requester.email)) {
        return { allowed: true, logRef: adminDb.collection("guests").doc(logId) };
    }

    const logRef = adminDb.collection("guests").doc(logId);
    const logSnap = await logRef.get();
    if (!logSnap.exists) return { allowed: false, logRef };

    const log = logSnap.data() || {};
    const ownerId = log.parentEventOwnerId;
    if (!ownerId) return { allowed: false, logRef };

    if (ownerId === requester.uid || ownerId === requester.email) {
        return { allowed: true, logRef };
    }

    if (requester.uid) {
        const profileSnap = await adminDb.collection("users").doc(requester.uid).get();
        const profile = profileSnap.data() || {};
        const isGlobalAdmin = profile.role === "admin" && !profile.delegatedBy;
        const isDelegatedPrimary = profile.delegatedBy === ownerId && profile.roleType === "primary";

        if (isGlobalAdmin || isDelegatedPrimary) {
            return { allowed: true, logRef };
        }
    }

    return { allowed: false, logRef };
}

export async function updateGuestStatusAction(
    logId: string,
    status: "pending" | "approved" | "rejected",
    requester: Requester
) {
    try {
        const { allowed, logRef } = await canManageGuestLog(logId, requester);
        if (!allowed || !logRef) {
            return { success: false, error: "You do not have permission to update this guest." };
        }

        await logRef.update({ status });
        return { success: true };
    } catch (error: unknown) {
        console.error("[Permissions] Failed to update guest status:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to update guest." };
    }
}

export async function deleteGuestAction(logId: string, requester: Requester) {
    try {
        const { allowed, logRef } = await canManageGuestLog(logId, requester);
        if (!allowed || !logRef) {
            return { success: false, error: "You do not have permission to remove this guest." };
        }

        await logRef.delete();
        return { success: true };
    } catch (error: unknown) {
        console.error("[Permissions] Failed to delete guest:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to remove guest." };
    }
}
