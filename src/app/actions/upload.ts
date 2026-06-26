"use server";

import { randomUUID } from "crypto";
import { waitUntil } from "@vercel/functions";
import { publishResizeTask } from "@/lib/qstash";
import sharp from "sharp";

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

        // Inline resizing — generate thumbnail and preview immediately
        if (resourceType === "image" && contentType && !contentType.startsWith("video/")) {
            const qstashToken = process.env.QSTASH_TOKEN;
            if (qstashToken) {
                // QStash path: waitUntil keeps the function alive until publish completes
                console.log(`[Server Action] Queuing resize via QStash for: ${storageKey}`);
                waitUntil(publishResizeTask({ storageKey }));
            } else {
                // Fallback: inline resizing
                console.log(`[Server Action] No QStash token — resizing inline for: ${storageKey}`);
                try {
                    const thumbnailBuffer = await sharp(bytes)
                        .resize({ width: 400, fit: "inside", withoutEnlargement: true })
                        .webp({ quality: 75 })
                        .toBuffer();
                    const previewBuffer = await sharp(bytes)
                        .resize({ width: 900, fit: "inside", withoutEnlargement: true })
                        .webp({ quality: 75 })
                        .toBuffer();
                    await uploadBufferToB2(thumbnailBuffer, `${storageKey}-thumbnail.webp`, "image/webp");
                    await uploadBufferToB2(previewBuffer, `${storageKey}-preview.webp`, "image/webp");
                } catch (resizeErr) {
                    console.error(`[Server Action] Resizing failed for ${storageKey}:`, resizeErr);
                }
            }
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

