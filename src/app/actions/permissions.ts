"use server";

import { supabase } from "@/lib/supabase";
import { updateGuestStatus, deleteGuest } from "@/lib/firestore";

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
    if (!requester.uid && !requester.email) return false;
    if (requester.email && SUPER_ADMIN_EMAILS.includes(requester.email)) {
        return true;
    }

    const { data: log, error } = await supabase
        .from('guests')
        .select('parent_event_owner_id')
        .eq('id', logId)
        .maybeSingle();

    if (error || !log) return false;

    const ownerId = log.parent_event_owner_id;
    if (!ownerId) return false;

    if (ownerId === requester.uid || ownerId === requester.email) {
        return true;
    }

    if (requester.uid) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role, delegated_by, role_type')
            .eq('id', requester.uid)
            .maybeSingle();

        if (profile) {
            const isGlobalAdmin = profile.role === "admin" && !profile.delegated_by;
            const isDelegatedPrimary = profile.delegated_by === ownerId && profile.role_type === "primary";

            if (isGlobalAdmin || isDelegatedPrimary) {
                return true;
            }
        }
    }

    return false;
}

export async function updateGuestStatusAction(
    logId: string,
    status: "pending" | "approved" | "rejected",
    requester: Requester
) {
    try {
        const allowed = await canManageGuestLog(logId, requester);
        if (!allowed) {
            return { success: false, error: "You do not have permission to update this guest." };
        }

        const success = await updateGuestStatus(logId, status);
        if (!success) throw new Error("Failed to update status in database");
        return { success: true };
    } catch (error: unknown) {
        console.error("[Permissions] Failed to update guest status:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to update guest." };
    }
}

export async function deleteGuestAction(logId: string, requester: Requester) {
    try {
        const allowed = await canManageGuestLog(logId, requester);
        if (!allowed) {
            return { success: false, error: "You do not have permission to remove this guest." };
        }

        const success = await deleteGuest(logId);
        if (!success) throw new Error("Failed to delete guest from database");
        return { success: true };
    } catch (error: unknown) {
        console.error("[Permissions] Failed to delete guest:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to remove guest." };
    }
}
