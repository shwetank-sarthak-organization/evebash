"use server";

import { randomUUID } from "crypto";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

type BackblazeAuth = {
    authorizationToken: string;
    apiUrl: string;
};

type BackblazeUploadUrl = {
    uploadUrl: string;
    authorizationToken: string;
};

type BackblazeUploadOptions = {
    fileName?: string;
    contentType?: string;
    resourceType?: "image" | "video";
};

function requireEnv(name: string) {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`${name} is not configured`);
    }
    return value;
}

function sanitizeSegment(value: string) {
    return value
        .trim()
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 100);
}

function parseBase64DataUrl(base64File: string, fallbackContentType?: string) {
    const match = base64File.match(/^data:([^;]+);base64,(.+)$/);
    const contentType = match?.[1] || fallbackContentType || "application/octet-stream";
    const payload = match?.[2] || base64File;
    return {
        contentType,
        bytes: Buffer.from(payload, "base64"),
    };
}

function getExtension(fileName: string, contentType: string) {
    const fromName = fileName.split(".").pop();
    if (fromName && fromName !== fileName) return fromName.toLowerCase();
    if (contentType.includes("/")) return contentType.split("/")[1].split("+")[0].toLowerCase();
    return "bin";
}

function buildStorageKey(folder: string, options: Required<Pick<BackblazeUploadOptions, "resourceType">> & BackblazeUploadOptions, contentType: string) {
    const cleanFolder = folder
        .split("/")
        .map((segment) => sanitizeSegment(segment))
        .filter(Boolean)
        .join("/");
    const mediaFolder = options.resourceType === "video" ? "videos" : "photos";
    const safeFileName = sanitizeSegment(options.fileName || `upload.${getExtension("", contentType)}`);
    const extension = getExtension(safeFileName, contentType);
    const finalName = safeFileName.includes(".") ? safeFileName : `${safeFileName}.${extension}`;

    return `${cleanFolder || "uploads"}/${mediaFolder}/${Date.now()}-${randomUUID()}-${finalName}`;
}

async function authorizeBackblaze(): Promise<BackblazeAuth> {
    const keyId = requireEnv("B2_KEY_ID");
    const applicationKey = requireEnv("B2_APPLICATION_KEY");
    const credentials = Buffer.from(`${keyId}:${applicationKey}`).toString("base64");

    const response = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
        headers: {
            Authorization: `Basic ${credentials}`,
        },
    });

    if (!response.ok) {
        throw new Error(`Backblaze authorization failed with ${response.status}`);
    }

    const data = await response.json();
    return {
        authorizationToken: data.authorizationToken,
        apiUrl: data.apiInfo.storageApi.apiUrl,
    };
}

async function getUploadUrl(auth: BackblazeAuth): Promise<BackblazeUploadUrl> {
    const bucketId = requireEnv("B2_BUCKET_ID");
    const response = await fetch(`${auth.apiUrl}/b2api/v3/b2_get_upload_url`, {
        method: "POST",
        headers: {
            Authorization: auth.authorizationToken,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ bucketId }),
    });

    if (!response.ok) {
        throw new Error(`Backblaze upload URL request failed with ${response.status}`);
    }

    return response.json();
}
async function uploadBufferToB2(buffer: Buffer, key: string, contentType: string) {
    const auth = await authorizeBackblaze();
    const uploadUrlData = await getUploadUrl(auth);

    const uploadResponse = await fetch(uploadUrlData.uploadUrl, {
        method: "POST",
        headers: {
            Authorization: uploadUrlData.authorizationToken,
            "Content-Type": contentType,
            "X-Bz-File-Name": encodeURIComponent(key),
            "X-Bz-Content-Sha1": "do_not_verify",
        },
        body: buffer as any,
    });

    if (!uploadResponse.ok) {
        throw new Error(`B2 upload failed for key ${key} with status ${uploadResponse.status}`);
    }
}
export async function uploadToBackblaze(base64File: string, folder: string, options: BackblazeUploadOptions = {}) {
    try {
        const resourceType = options.resourceType || (options.contentType?.startsWith("video/") ? "video" : "image");
        const { contentType, bytes } = parseBase64DataUrl(base64File, options.contentType);
        const storageKey = buildStorageKey(folder, { ...options, resourceType }, contentType);

        console.log(`[Server Action] Uploading media to Backblaze. Size: ${Math.round(bytes.length / 1024 / 1024 * 100) / 100} MB`);

        const auth = await authorizeBackblaze();
        const uploadUrl = await getUploadUrl(auth);

        const uploadResponse = await fetch(uploadUrl.uploadUrl, {
            method: "POST",
            headers: {
                Authorization: uploadUrl.authorizationToken,
                "Content-Type": contentType,
                "X-Bz-File-Name": encodeURIComponent(storageKey),
                "X-Bz-Content-Sha1": "do_not_verify",
            },
            body: bytes,
        });

        const uploadResult = await uploadResponse.json().catch(() => ({}));
        if (!uploadResponse.ok) {
            throw new Error(uploadResult.message || `Backblaze upload failed with ${uploadResponse.status}`);
        }

        const mediaDomain = requireEnv("MEDIA_DOMAIN").replace(/^https?:\/\//, "").replace(/\/+$/, "");
        const url = `https://${mediaDomain}/${storageKey}`;

        // Run the background resizing asynchronously
        if (resourceType === "image" && contentType && !contentType.startsWith("video/")) {
            const supabaseAdmin = createClient(
                requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
                requireEnv("SUPABASE_SERVICE_ROLE_KEY")
            );

            const bufferBytes = Buffer.from(bytes);

            setTimeout(async () => {
                try {
                    console.log(`[Server Action BackgroundResize] Starting async resize for key: ${storageKey}`);

                    const thumbnailBuffer = await sharp(bufferBytes)
                        .resize({ width: 400, fit: "inside", withoutEnlargement: true })
                        .webp({ quality: 75 })
                        .toBuffer();

                    const previewBuffer = await sharp(bufferBytes)
                        .resize({ width: 900, fit: "inside", withoutEnlargement: true })
                        .webp({ quality: 75 })
                        .toBuffer();

                    const thumbnailKey = `${storageKey}-thumbnail.webp`;
                    const previewKey = `${storageKey}-preview.webp`;

                    console.log(`[Server Action BackgroundResize] Uploading thumbnail to B2...`);
                    await uploadBufferToB2(thumbnailBuffer, thumbnailKey, "image/webp");

                    console.log(`[Server Action BackgroundResize] Uploading preview to B2...`);
                    await uploadBufferToB2(previewBuffer, previewKey, "image/webp");

                    const thumbnailUrl = `https://${mediaDomain}/${thumbnailKey}`;

                    // Wait 3 seconds to ensure the client has finished saving the photo metadata
                    await new Promise((resolve) => setTimeout(resolve, 3000));

                    console.log(`[Server Action BackgroundResize] Updating database record for: ${storageKey}`);
                    const { error: dbError } = await supabaseAdmin
                        .from("photos")
                        .update({ thumbnail_url: thumbnailUrl })
                        .eq("storage_key", storageKey);

                    if (dbError) {
                        console.error(`[Server Action BackgroundResize] Database update failed for key ${storageKey}:`, dbError);
                    } else {
                        console.log(`[Server Action BackgroundResize] Successfully completed resizing and updated database for key: ${storageKey}`);
                    }
                } catch (err: unknown) {
                    console.error(`[Server Action BackgroundResize] Error processing background resize for key ${storageKey}:`, err);
                }
            }, 500);
        }

        return {
            success: true,
            url,
            public_id: storageKey,
            storageKey,
            fileId: uploadResult.fileId,
            width: undefined,
            height: undefined,
            bytes: uploadResult.contentLength || bytes.length,
            format: getExtension(options.fileName || storageKey, contentType),
            resourceType,
        };
    } catch (error: unknown) {
        console.error("[Server Action] Backblaze upload error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Backblaze upload failed",
        };
    }
}

export async function getPresignedUploadUrl(
    folder: string,
    fileName: string,
    contentType: string,
    resourceType: "image" | "video" = "image"
) {
    try {
        const auth = await authorizeBackblaze();
        const uploadUrlData = await getUploadUrl(auth);
        
        const storageKey = buildStorageKey(
            folder,
            { fileName, contentType, resourceType },
            contentType
        );
        
        const mediaDomain = requireEnv("MEDIA_DOMAIN")
            .replace(/^https?:\/\//, "")
            .replace(/\/+$/, "");

        return {
            success: true as const,
            uploadUrl: uploadUrlData.uploadUrl,
            authToken: uploadUrlData.authorizationToken,
            storageKey,
            finalUrl: `https://${mediaDomain}/${storageKey}`,
        };
    } catch (error: unknown) {
        console.error("[Server Action] getPresignedUploadUrl error:", error);
        return {
            success: false as const,
            error: error instanceof Error ? error.message : "Failed to generate upload URL",
        };
    }
}

