"use server";

import { createClient } from "@supabase/supabase-js";
import { v2 as cloudinary } from 'cloudinary';

// Initialize Cloudinary
cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Initialize Supabase Admin Client using service role key
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

/**
 * Server Action to delete a user's account from Supabase Auth and their profile from Database.
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

        // 2. Delete from Supabase Authentication
        console.log(`[Server Action] Deleting Supabase Auth user: ${uid}...`);
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(uid);
        if (authError) {
            console.error("[Server Action] Supabase Auth user deletion warning/error:", authError.message);
        } else {
            console.log(`[Server Action] Supabase Auth user deleted successfully.`);
        }

        // 3. Delete from Database Profile Table
        console.log(`[Server Action] Deleting profile for UID: ${uid}...`);
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .delete()
            .eq('id', uid);

        if (profileError) {
            console.error(`[Server Action] Failed to delete profile record:`, profileError);
            throw profileError;
        }
        console.log(`[Server Action] Database profile deleted successfully.`);

        return { success: true };
    } catch (error: any) {
        console.error("[Server Action] Error deleting user completely:", error);
        return { success: false, error: error.message || "An internal error occurred." };
    }
}

/**
 * Server Action to find all users in Supabase Auth and ensure they have a profile in Database.
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

        // 2. List all users from Supabase Auth
        console.log(`[Server Action] Fetching users list from Auth...`);
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) throw listError;

        console.log(`[Server Action] Found ${users.length} users in Auth.`);
        let syncCount = 0;

        // 3. Bulk process profiles
        for (const authUser of users) {
            const { data: existing, error: fetchError } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .eq('id', authUser.id)
                .maybeSingle();

            if (fetchError) {
                console.error(`[Server Action] Error fetching profile for ${authUser.id}:`, fetchError);
                continue;
            }

            if (!existing) {
                console.log(`[Server Action] Creating missing profile for: ${authUser.email}`);
                const name = authUser.user_metadata?.name || authUser.email?.split("@")[0] || "Wedding User";
                const { error: insertError } = await supabaseAdmin
                    .from('profiles')
                    .insert({
                        id: authUser.id,
                        name,
                        email: authUser.email || null,
                        role: "user", // Default for bulk sync
                        role_type: "primary",
                        created_at: new Date().toISOString()
                    });

                if (insertError) {
                    console.error(`[Server Action] Insert profile failed for ${authUser.id}:`, insertError);
                } else {
                    syncCount++;
                }
            }
        }

        return { success: true, count: users.length, synced: syncCount };
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
