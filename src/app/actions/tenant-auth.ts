"use server";

import { 
    getAllowedUser, 
    logGuestLogin, 
    requestAccess, 
    getPendingRequests, 
    addAllowedUser, 
    denyRequest 
} from "@/lib/database";

export interface LoginResult {
    success: boolean;
    user?: {
        name: string;
        phone: string;
        role: string;
    };
    error?: string;
    status: 'allowed' | 'denied' | 'needs_request';
}

export async function checkAndLogGuest(name: string, phone: string, slug: string): Promise<LoginResult> {
    try {
        console.log(`[ServerAction] Checking access for ${phone} on ${slug}`);

        const allowedData = await getAllowedUser(phone);

        if (allowedData) {
            console.log(`[ServerAction] User found in allowed_users:`, allowedData);

            // Log approved login
            await logGuestLogin(
                name || allowedData.name || "Guest", 
                phone, 
                slug, 
                undefined, 
                slug, 
                undefined, 
                'approved'
            );

            return {
                success: true,
                status: 'allowed',
                user: {
                    name: allowedData.name || name,
                    phone: phone,
                    role: allowedData.role || 'guest'
                }
            };
        }

        return {
            success: false,
            status: 'needs_request'
        };

    } catch (error: any) {
        console.error("[ServerAction] Error in checkAndLogGuest:", error);
        return {
            success: false,
            status: 'denied',
            error: error.message
        };
    }
}

export async function requestGuestAccessAction(name: string, phone: string) {
    try {
        await requestAccess(name, phone);
        return { success: true };
    } catch (error: any) {
        console.error("[ServerAction] Error in requestGuestAccess:", error);
        return { success: false, error: error.message };
    }
}

export async function getPendingRequestsAction() {
    try {
        const requests = await getPendingRequests();
        return { success: true, data: requests };
    } catch (error: any) {
        console.error("[ServerAction] Error getting requests:", error);
        return { success: false, error: error.message, data: [] };
    }
}

export async function approveRequestAction(name: string, phone: string) {
    try {
        // 1. Add to allowed_users
        await addAllowedUser(name, phone, "guest");

        // 2. Remove from pending_requests
        await denyRequest(phone);

        return { success: true };
    } catch (error: any) {
        console.error("[ServerAction] Error approving request:", error);
        return { success: false, error: error.message };
    }
}

export async function denyRequestAction(phone: string) {
    try {
        await denyRequest(phone);
        return { success: true };
    } catch (error: any) {
        console.error("[ServerAction] Error denying request:", error);
        return { success: false, error: error.message };
    }
}
