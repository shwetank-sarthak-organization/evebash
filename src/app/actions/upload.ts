"use server";

import { randomUUID } from "crypto";
import { after } from "next/server";
import sharp from "sharp";
import { getCachedBackblazeAuth, getUploadUrl } from "@/lib/backblaze";

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

async function uploadBufferToB2(buffer: Buffer, key: string, contentType: string) {
    const auth = await getCachedBackblazeAuth();
    const uploadUrlData = await getUploadUrl(auth);

    const uploadResponse = await fetch(uploadUrlData.uploadUrl, {
        method: "POST",
        headers: {
            Authorization: uploadUrlData.authorizationToken,
            "Content-Type": contentType,
            "X-Bz-File-Name": encodeURIComponent(key),
            "X-Bz-Content-Sha1": "do_not_verify",
            "Content-Length": String(buffer.length),
        },
        body: buffer as unknown as BodyInit,
    });

    if (!uploadResponse.ok) {
        throw new Error(`B2 upload failed for key ${key} with status ${uploadResponse.status}`);
    }
}

async function normalizeImageOrientation(buffer: Buffer) {
    return sharp(buffer).rotate().toBuffer();
}

function shouldNormalizeImage(contentType: string) {
    const normalized = contentType.toLowerCase();
    return ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/tiff"].some((type) => normalized.startsWith(type));
}

export async function uploadToBackblaze(base64File: string, folder: string, options: BackblazeUploadOptions = {}) {
    try {
        const resourceType = options.resourceType || (options.contentType?.startsWith("video/") ? "video" : "image");
        const { contentType, bytes: parsedBytes } = parseBase64DataUrl(base64File, options.contentType);
        const bytes = resourceType === "image" && shouldNormalizeImage(contentType) ? await normalizeImageOrientation(parsedBytes) : parsedBytes;
        const storageKey = buildStorageKey(folder, { ...options, resourceType }, contentType);

        console.log(`[Server Action] Uploading media to Backblaze. Size: ${Math.round(bytes.length / 1024 / 1024 * 100) / 100} MB`);

        const auth = await getCachedBackblazeAuth();
        const uploadUrl = await getUploadUrl(auth);

        const uploadResponse = await fetch(uploadUrl.uploadUrl, {
            method: "POST",
            headers: {
                Authorization: uploadUrl.authorizationToken,
                "Content-Type": contentType,
                "X-Bz-File-Name": encodeURIComponent(storageKey),
                "X-Bz-Content-Sha1": "do_not_verify",
                "Content-Length": String(bytes.length),
            },
            body: bytes as unknown as BodyInit,
        });

        const uploadResult = await uploadResponse.json().catch(() => ({}));
        if (!uploadResponse.ok) {
            throw new Error(uploadResult.message || `Backblaze upload failed with ${uploadResponse.status}`);
        }

        const mediaDomain = requireEnv("MEDIA_DOMAIN").replace(/^https?:\/\//, "").replace(/\/+$/, "");
        const url = `https://${mediaDomain}/${storageKey}`;

        // Resizing logic for non-event images (e.g. profile photos)
        if (resourceType === "image" && contentType && !contentType.startsWith("video/")) {
            if (process.env.NODE_ENV === "development") {
                console.log(`[Server Action] Local development environment detected. Processing resizing locally in background for: ${storageKey}`);
                localDevResizeAndUpload(bytes, storageKey, mediaDomain);
            } else {
                // Background resizing for production (e.g., profile pictures) via after()
                console.log(`[Server Action] Queuing profile resize in background for: ${storageKey}`);
                after(async () => {
                    try {
                        const thumbnailBuffer = await sharp(bytes)
                            .rotate()
                            .resize({ width: 400, fit: "inside", withoutEnlargement: true })
                            .webp({ quality: 75 })
                            .toBuffer();
                        const previewBuffer = await sharp(bytes)
                            .rotate()
                            .resize({ width: 900, fit: "inside", withoutEnlargement: true })
                            .webp({ quality: 75 })
                            .toBuffer();
                        await uploadBufferToB2(thumbnailBuffer, `${storageKey}-thumbnail.webp`, "image/webp");
                        await uploadBufferToB2(previewBuffer, `${storageKey}-preview.webp`, "image/webp");
                        console.log(`[Server Action] Background profile resizing complete for: ${storageKey}`);
                    } catch (resizeErr) {
                        console.error(`[Server Action] Background profile resizing failed for ${storageKey}:`, resizeErr);
                    }
                });
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
        const auth = await getCachedBackblazeAuth();
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

async function localDevResizeAndUpload(bytes: Buffer, storageKey: string, mediaDomain: string) {
  try {
    console.log(`[Local Dev Background Action] Starting image resizing for: ${storageKey}`);
    
    const thumbnailBuffer = await sharp(bytes)
      .rotate()
      .resize({ width: 400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();

    const previewBuffer = await sharp(bytes)
      .rotate()
      .resize({ width: 900, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();

    const thumbnailKey = `${storageKey}-thumbnail.webp`;
    const previewKey = `${storageKey}-preview.webp`;
    const thumbnailUrl = `https://${mediaDomain}/${thumbnailKey}`;

    console.log(`[Local Dev Background Action] Uploading WebP assets for: ${storageKey}`);
    await uploadBufferToB2(thumbnailBuffer, thumbnailKey, "image/webp");
    await uploadBufferToB2(previewBuffer, previewKey, "image/webp");

    console.log(`[Local Dev Background Action] Updating DB record for storage_key: ${storageKey}`);
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Wait a bit to ensure client has inserted the row
    let updated = false;
    for (let attempt = 1; attempt <= 4; attempt++) {
      const { data: updatedData, error: dbError } = await supabaseAdmin
        .from("photos")
        .update({ thumbnail_url: thumbnailUrl })
        .eq("storage_key", storageKey)
        .select();

      if (dbError) {
        console.error(`[Local Dev Background Action] DB update error:`, dbError);
        break;
      }

      if (updatedData && updatedData.length > 0) {
        console.log(`[Local Dev Background Action] Successfully updated database record in attempt ${attempt}`);
        updated = true;
        break;
      }

      if (attempt < 4) {
        console.log(`[Local Dev Background Action] Row not found yet, sleeping 2 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    if (!updated) {
      console.warn(`[Local Dev Background Action] Warning: No database row found matching storage_key "${storageKey}" after 4 attempts.`);
    }
  } catch (err) {
    console.error(`[Local Dev Background Action] Failed:`, err);
  }
}
