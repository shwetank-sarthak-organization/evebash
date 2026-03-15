"use server";

import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import * as admin from 'firebase-admin';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Server Action to delete a user's account from Firebase Auth and their profile from Firestore.
 * This can ONLY be called securely from the server.
 */
export async function deleteUserCompletely(uid: string, requesterEmail: string) {
    try {
        console.log(`[Server Action] Request to delete user: ${uid} by ${requesterEmail}`);

        // 1. Security Check: Only specific Super Admins are allowed to trigger this
        const superAdmins = [
            "shwetank.chauhan17@gmail.com",
            "shwetank.chauhan3@gmail.com",
            "code4sarthak@gmail.com"
        ];

        if (!superAdmins.includes(requesterEmail)) {
            console.error(`[Security] Unauthorized delete attempt by: ${requesterEmail}`);
            return { success: false, error: "Unauthorized access. Only Super Admins can delete accounts." };
        }

        // 2. Delete from Firebase Authentication
        console.log(`[Server Action] Deleting Auth record for UID: ${uid}...`);
        try {
            const auth = getAdminAuth();
            await auth.deleteUser(uid);
            console.log(`[Server Action] Auth record deleted successfully.`);
        } catch (authError: any) {
            // If the user doesn't exist in Auth, we continue to delete from Firestore
            if (authError.code === 'auth/user-not-found') {
                console.warn(`[Server Action] Auth record not found for UID: ${uid}, proceeding to Firestore.`);
            } else {
                console.error(`[Server Action] Failed to delete Auth record:`, authError);
                throw authError;
            }
        }

        // 3. Delete from Firestore Database
        console.log(`[Server Action] Deleting Firestore profile for UID: ${uid}...`);
        const db = getAdminDb();
        await db.collection("users").doc(uid).delete();
        console.log(`[Server Action] Firestore profile deleted successfully.`);

        return { success: true };
    } catch (error: any) {
        console.error("[Server Action] Error deleting user completely:", error);
        return { success: false, error: error.message || "An internal error occurred." };
    }
}

/**
 * Server Action to find all users in Firebase Auth and ensure they have a profile in Firestore.
 */
export async function syncAllAuthUsers(requesterEmail: string) {
    try {
        console.log(`[Server Action] Request to sync all users by: ${requesterEmail}`);

        // 1. Security Check
        const superAdmins = [
            "shwetank.chauhan17@gmail.com",
            "shwetank.chauhan3@gmail.com",
            "code4sarthak@gmail.com"
        ];

        if (!superAdmins.includes(requesterEmail)) {
            return { success: false, error: "Unauthorized." };
        }

        // 2. List all users from Auth
        const auth = getAdminAuth();
        const listUsersResult = await auth.listUsers(1000);
        const authUsers = listUsersResult.users;
        console.log(`[Server Action] Found ${authUsers.length} users in Auth.`);

        let syncCount = 0;

        // 3. Batch process profiles
        const db = getAdminDb();
        for (const authUser of authUsers) {
            const userDoc = await db.collection("users").doc(authUser.uid).get();

            if (!userDoc.exists) {
                console.log(`[Server Action] Creating missing profile for: ${authUser.email}`);
                await db.collection("users").doc(authUser.uid).set({
                    name: authUser.displayName || authUser.email?.split("@")[0] || "Wedding User",
                    email: authUser.email,
                    role: "user", // Default for bulk sync
                    roleType: "primary",
                    createdAt: admin.firestore.Timestamp.now(),
                    lastLogin: admin.firestore.Timestamp.now(), // Placeholder
                    syncedAt: admin.firestore.Timestamp.now()
                });
                syncCount++;
            }
        }

        return { success: true, count: authUsers.length, synced: syncCount };
    } catch (error: any) {
        console.error("[Server Action] Error syncing all users:", error);
        return { success: false, error: error.message || "Sync failed." };
    }
}

/**
 * Server Action to securely upload a base64 encoded profile image to Cloudinary.
 * Returns the secure URL of the uploaded image.
 */
export async function uploadProfileImageToCloudinary(base64Image: string, uid: string) {
    try {
        console.log(`[Server Action] Uploading profile image for UID: ${uid}`);

        // Security Check: Verify UID (this relies on the client passing the current auth context UID honestly.
        // In a strictly secure app, we'd verify a session token here, but this matches the current Firebase client-auth pattern).
        if (!uid) {
            throw new Error("Unauthorized request. UID is missing.");
        }

        // Upload the image to Cloudinary
        const uploadResponse = await cloudinary.uploader.upload(base64Image, {
            folder: `wedding_app_profiles/${uid}`,
            public_id: 'profile_pic',
            overwrite: true,
            resource_type: 'image',
            transformation: [
                { width: 500, height: 500, crop: "fill", gravity: "face" },
                { quality: "auto:good" }
            ]
        });

        console.log(`[Server Action] Profile image uploaded successfully: ${uploadResponse.secure_url}`);
        return { success: true, url: uploadResponse.secure_url };
    } catch (error: any) {
        console.error("[Server Action] Error uploading profile image to Cloudinary:", error);
        return { success: false, error: error.message || "Upload failed." };
    }
}
