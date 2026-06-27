import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { publishResizeTask } from "@/lib/qstash";
import sharp from "sharp";
import { getCachedBackblazeAuth, getUploadUrl } from "@/lib/backblaze";

export const runtime = "nodejs";
export const maxDuration = 60;

type SupabaseUser = {
  id: string;
};

const allowedMimePrefixes = ["image/", "video/"];

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}

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

function buildStorageKey(params: {
  eventId?: string;
  userId: string;
  resourceType: string;
  fileName: string;
  scope?: "event" | "profile";
}) {
  const userId = sanitizeSegment(params.userId) || "user";
  const folder = params.resourceType === "video" ? "videos" : "photos";
  const cleanName = sanitizeSegment(params.fileName) || `${folder.slice(0, -1)}.bin`;
  const uniquePrefix = `${Date.now()}-${crypto.randomUUID()}`;

  if (params.scope === "profile") {
    return `profiles/${userId}/${uniquePrefix}-${cleanName}`;
  }

  const eventId = sanitizeSegment(params.eventId || "") || "event";
  return `events/${eventId}/${folder}/${userId}-${uniquePrefix}-${cleanName}`;
}

function base64ToArrayBuffer(base64File: string) {
  const match = base64File.match(/^data:([^;]+);base64,(.+)$/);
  const contentType = match?.[1] || "image/jpeg";
  const payload = match?.[2] || base64File;
  const buffer = Buffer.from(payload, "base64");
  return {
    contentType,
    bytes: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    size: buffer.byteLength,
  };
}

async function uploadBufferToB2(buffer: Buffer, key: string, contentType: string) {
  const backblazeAuth = await getCachedBackblazeAuth();
  const uploadUrlData = await getUploadUrl(backblazeAuth);

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

async function localDevResizeAndUpload(bytes: ArrayBuffer, storageKey: string, mediaDomain: string) {
  try {
    console.log(`[Local Dev Background] Starting image resizing for: ${storageKey}`);
    const bufferBytes = Buffer.from(bytes);
    
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
    const thumbnailUrl = `https://${mediaDomain}/${thumbnailKey}`;

    console.log(`[Local Dev Background] Uploading WebP assets for: ${storageKey}`);
    await uploadBufferToB2(thumbnailBuffer, thumbnailKey, "image/webp");
    await uploadBufferToB2(previewBuffer, previewKey, "image/webp");

    console.log(`[Local Dev Background] Updating DB record for storage_key: ${storageKey}`);
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
        console.error(`[Local Dev Background] DB update error:`, dbError);
        break;
      }

      if (updatedData && updatedData.length > 0) {
        console.log(`[Local Dev Background] Successfully updated database record in attempt ${attempt}`);
        updated = true;
        break;
      }

      if (attempt < 4) {
        console.log(`[Local Dev Background] Row not found yet, sleeping 2 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    if (!updated) {
      console.warn(`[Local Dev Background] Warning: No database row found matching storage_key "${storageKey}" after 4 attempts.`);
    }
  } catch (err) {
    console.error(`[Local Dev Background] Failed:`, err);
  }
}

async function verifySupabaseUser(accessToken: string): Promise<SupabaseUser | null> {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
  const supabaseAnonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey,
    },
  });

  if (!response.ok) return null;

  const user = await response.json().catch(() => null);
  return user?.id ? { id: user.id } : null;
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";

    if (!accessToken) {
      return jsonResponse({ error: "Missing authorization token" }, 401);
    }

    const user = await verifySupabaseUser(accessToken);
    if (!user) {
      return jsonResponse({ error: "Invalid authorization token" }, 401);
    }

    const contentTypeHeader = request.headers.get("content-type") || "";
    let eventId = "";
    let scope: "event" | "profile" = "event";
    let fileName = "upload.jpg";
    let fileSize = 0;
    let bytes: ArrayBuffer;
    let mimeType = "application/octet-stream";
    let requestedResourceType = "image";

    if (contentTypeHeader.includes("application/json")) {
      const body = await request.json();
      scope = body.scope === "profile" ? "profile" : "event";
      eventId = String(body.eventId || "");
      requestedResourceType = String(body.resourceType || "image");
      fileName = String(body.fileName || (scope === "profile" ? "profile.jpg" : "upload.jpg"));

      if (scope === "event" && !eventId.trim()) {
        return jsonResponse({ error: "Missing eventId" }, 400);
      }
      if (!body.base64) {
        return jsonResponse({ error: "Missing base64 file" }, 400);
      }

      const payload = base64ToArrayBuffer(String(body.base64));
      bytes = payload.bytes;
      mimeType = String(body.contentType || payload.contentType);
      fileSize = payload.size;
    } else {
      const formData = await request.formData();
      const file = formData.get("file");
      eventId = String(formData.get("eventId") || "");
      requestedResourceType = String(formData.get("resourceType") || "image");

      if (!(file instanceof File)) {
        return jsonResponse({ error: "Missing file" }, 400);
      }

      if (!eventId.trim()) {
        return jsonResponse({ error: "Missing eventId" }, 400);
      }

      fileName = file.name;
      mimeType = file.type || "application/octet-stream";
      fileSize = file.size;
      bytes = await file.arrayBuffer();
    }

    if (!allowedMimePrefixes.some((prefix) => mimeType.startsWith(prefix))) {
      return jsonResponse({ error: "Only image and video uploads are supported" }, 400);
    }

    const resourceType = requestedResourceType === "video" || mimeType.startsWith("video/") ? "video" : "image";
    const mediaType = resourceType === "video" ? "video" : "photo";
    const storageKey = buildStorageKey({
      eventId,
      userId: user.id,
      resourceType,
      fileName,
      scope,
    });

    const backblazeAuth = await getCachedBackblazeAuth();
    const uploadUrl = await getUploadUrl(backblazeAuth);

    const uploadResponse = await fetch(uploadUrl.uploadUrl, {
      method: "POST",
      headers: {
        Authorization: uploadUrl.authorizationToken,
        "Content-Type": mimeType,
        "X-Bz-File-Name": encodeURIComponent(storageKey),
        "X-Bz-Content-Sha1": "do_not_verify",
        "Content-Length": String(bytes.byteLength),
      },
      body: bytes,
    });

    const uploadResult = await uploadResponse.json().catch(() => ({}));
    if (!uploadResponse.ok) {
      return jsonResponse(
        {
          error: uploadResult.message || `Backblaze upload failed with ${uploadResponse.status}`,
        },
        502
      );
    }

    const mediaDomain = requireEnv("MEDIA_DOMAIN").replace(/^https?:\/\//, "").replace(/\/+$/, "");
    const url = `https://${mediaDomain}/${storageKey}`;

    if (resourceType === "image") {
      const qstashToken = process.env.QSTASH_TOKEN;
      if (process.env.NODE_ENV === "development") {
        console.log(`[Upload] Local development environment detected. Processing resizing locally in background for: ${storageKey}`);
        localDevResizeAndUpload(bytes, storageKey, mediaDomain);
      } else if (qstashToken) {
        // QStash path: return response immediately, publish resize job in background
        // waitUntil keeps the Vercel function alive until publish completes
        console.log(`[Upload] Queuing resize via QStash for: ${storageKey}`);
        waitUntil(publishResizeTask({ storageKey, origin: request.nextUrl.origin }));
      } else {
        // Fallback: inline resizing if QStash is not configured
        console.log(`[Upload] No QStash token — resizing inline for: ${storageKey}`);
        try {
          const bufferBytes = Buffer.from(bytes);
          const thumbnailBuffer = await sharp(bufferBytes)
            .resize({ width: 400, fit: "inside", withoutEnlargement: true })
            .webp({ quality: 75 })
            .toBuffer();
          const previewBuffer = await sharp(bufferBytes)
            .resize({ width: 900, fit: "inside", withoutEnlargement: true })
            .webp({ quality: 75 })
            .toBuffer();
          await uploadBufferToB2(thumbnailBuffer, `${storageKey}-thumbnail.webp`, "image/webp");
          await uploadBufferToB2(previewBuffer, `${storageKey}-preview.webp`, "image/webp");
        } catch (resizeErr) {
          console.error(`[Upload] Inline resizing failed for ${storageKey}:`, resizeErr);
        }
      }
    }

    return jsonResponse({
      url,
      publicId: storageKey,
      storageKey,
      fileId: uploadResult.fileId,
      fileName: uploadResult.fileName || storageKey,
      bytes: uploadResult.contentLength || fileSize,
      format: fileName.split(".").pop()?.toLowerCase() || undefined,
      mediaType,
      resourceType,
    });
  } catch (error: unknown) {
    console.error("[MediaUpload] Error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Upload failed" }, 500);
  }
}
