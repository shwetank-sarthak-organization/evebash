import { NextRequest, NextResponse, after } from "next/server";
import { publishResizeTask } from "@/lib/qstash";
import sharp from "sharp";
import { getCachedBackblazeAuth, getUploadUrl, BackblazeAuth } from "@/lib/backblaze";
import { createClient } from "@supabase/supabase-js";
import { formatStorageSize, getPlanDetails } from "@/lib/planLimits";

export const runtime = "nodejs";
export const maxDuration = 60;

type SupabaseUser = {
  id: string;
};

const allowedMimePrefixes = ["image/", "video/"];
const FREE_PLAN_VIDEO_LIMIT_BYTES = 200 * 1024 * 1024;
const PLAN_EXPIRY_GRACE_DAYS = 7;
const FREE_PLAN_STORAGE_BYTES = 1024 * 1024 * 1024;

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

async function deleteB2File(auth: BackblazeAuth, bucketId: string, key: string) {
  try {
    const listResponse = await fetch(`${auth.apiUrl}/b2api/v3/b2_list_file_names`, {
      method: "POST",
      headers: {
        Authorization: auth.authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bucketId,
        startFileName: key,
        maxFileCount: 1,
        prefix: key,
      }),
    });

    if (!listResponse.ok) return false;

    const listData = await listResponse.json();
    const file = listData.files?.find((item: { fileName: string; fileId?: string }) => item.fileName === key);
    if (!file?.fileId) return true;

    const deleteResponse = await fetch(`${auth.apiUrl}/b2api/v3/b2_delete_file_version`, {
      method: "POST",
      headers: {
        Authorization: auth.authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: key,
        fileId: file.fileId,
      }),
    });

    return deleteResponse.ok;
  } catch (error) {
    console.warn(`[Upload] Could not delete B2 file ${key}:`, error);
    return false;
  }
}

async function rollbackB2Upload(storageKey: string, resourceType: string) {
  try {
    const backblazeAuth = await getCachedBackblazeAuth();
    const bucketId = requireEnv("B2_BUCKET_ID");
    const originalKey = storageKey;
    
    if (resourceType === "image") {
      const thumbnailKey = `${storageKey}-thumbnail.webp`;
      const previewKey = `${storageKey}-preview.webp`;
      console.log(`[Upload Rollback] Deleting B2 assets for storage key: ${storageKey}`);
      await Promise.all([
        deleteB2File(backblazeAuth, bucketId, originalKey),
        deleteB2File(backblazeAuth, bucketId, thumbnailKey),
        deleteB2File(backblazeAuth, bucketId, previewKey)
      ]);
    } else {
      console.log(`[Upload Rollback] Deleting B2 original file: ${storageKey}`);
      await deleteB2File(backblazeAuth, bucketId, originalKey);
    }
  } catch (err) {
    console.error("[Upload Rollback] Failed to rollback B2 files:", err);
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

async function getUploaderRole(userId: string) {
  const supabaseAdmin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role, delegated_by, email, plan_end_date")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[Upload] Failed to load uploader profile:", error.message);
  }

  return {
    role: String(data?.role || "user").toLowerCase(),
    delegatedBy: data?.delegated_by || null,
    email: String(data?.email || ""),
    planEndDate: data?.plan_end_date ? String(data.plan_end_date) : "",
  };
}

function isFreePlanRole(role: string) {
  return !role || role === "user" || role === "free" || role === "freemium";
}

function isPaidPlanRole(role: string) {
  return !isFreePlanRole(role) && role !== "admin";
}

function isBeyondPlanGracePeriod(role: string, planEndDate: string) {
  if (!isPaidPlanRole(role) || !planEndDate) return false;
  const endDate = new Date(`${planEndDate}T23:59:59.999Z`);
  if (Number.isNaN(endDate.getTime())) return false;
  const graceEndsAt = new Date(endDate);
  graceEndsAt.setUTCDate(graceEndsAt.getUTCDate() + PLAN_EXPIRY_GRACE_DAYS);
  return Date.now() > graceEndsAt.getTime();
}

async function getUserUploadedBytes(userId: string, email?: string) {
  const supabaseAdmin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const identifiers = [userId, email].filter(Boolean);
  if (identifiers.length === 0) return 0;

  const { data, error } = await supabaseAdmin
    .from("photos")
    .select("size")
    .in("user_id", identifiers);

  if (error) {
    console.warn("[Upload] Failed to calculate uploader storage:", error.message);
    return 0;
  }

  return (data || []).reduce((sum, row) => sum + (Number(row.size) || 0), 0);
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
    const uploader = await getUploaderRole(user.id);

    if (resourceType === "video") {
      if (!uploader.delegatedBy && isFreePlanRole(uploader.role) && fileSize > FREE_PLAN_VIDEO_LIMIT_BYTES) {
        return jsonResponse({ error: "Free plan videos can be up to 200 MB. Upgrade to upload larger videos." }, 403);
      }
    }

    if (!uploader.delegatedBy && isBeyondPlanGracePeriod(uploader.role, uploader.planEndDate)) {
      const currentUsage = await getUserUploadedBytes(user.id, uploader.email);
      if (currentUsage + fileSize > FREE_PLAN_STORAGE_BYTES) {
        return jsonResponse(
          { error: "Your plan grace period has ended and your account is over the free 1 GB limit. Renew your plan to upload more." },
          403
        );
      }
    }

    if (scope === "event" && !uploader.delegatedBy) {
      const plan = getPlanDetails(uploader.role);
      if (plan.storageBytes !== Infinity) {
        const currentUsage = await getUserUploadedBytes(user.id, uploader.email);
        if (currentUsage + fileSize > plan.storageBytes) {
          const remainingStorage = Math.max(plan.storageBytes - currentUsage, 0);
          return jsonResponse(
            {
              error: `Upload exceeds your ${plan.storageLabel} storage limit. You have ${formatStorageSize(remainingStorage)} remaining, but this file is ${formatStorageSize(fileSize)}.`,
            },
            403
          );
        }
      }
    }

    const storageKey = buildStorageKey({
      eventId,
      userId: user.id,
      resourceType,
      fileName,
      scope,
    });

    const backblazeAuth = await getCachedBackblazeAuth();
    const uploadUrl = await getUploadUrl(backblazeAuth);

    // Convert ArrayBuffer to Buffer — raw ArrayBuffer as fetch body is unreliable
    // in some Node.js/Vercel runtime versions and can cause B2 upload failures.
    const bodyBuffer = Buffer.from(bytes);

    const uploadResponse = await fetch(uploadUrl.uploadUrl, {
      method: "POST",
      headers: {
        Authorization: uploadUrl.authorizationToken,
        "Content-Type": mimeType,
        "X-Bz-File-Name": encodeURIComponent(storageKey),
        "X-Bz-Content-Sha1": "do_not_verify",
        "Content-Length": String(bodyBuffer.length),
      },
      body: bodyBuffer,
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

    // Write database record if event scope
    let savedPhotoId: string | undefined = undefined;
    if (scope === "event") {
      const photoId = storageKey.replace(/\//g, "_");
      const upsertData = {
        id: photoId,
        event_id: eventId,
        storage_key: storageKey,
        url: url,
        height: null,
        width: null,
        uploaded_at: new Date().toISOString(),
        tags: [],
        user_id: user.id,
        size: fileSize,
        format: fileName.split(".").pop()?.toLowerCase() || "jpg",
        media_type: mediaType,
        resource_type: resourceType,
      };

      const supabaseAdmin = createClient(
        requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
        requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

      console.log(`[Upload] Writing DB record for photo: ${photoId}`);
      const { error: dbError } = await supabaseAdmin.from("photos").upsert(upsertData);

      if (dbError) {
        console.error(`[Upload] Database save failed for ${photoId}. Rolling back B2 upload...`, dbError);
        await rollbackB2Upload(storageKey, resourceType);
        return jsonResponse({ error: `Upload succeeded to storage but failed to save database record: ${dbError.message}` }, 500);
      }

      savedPhotoId = photoId;

      // Notify event owner when a guest uploads media
      if (eventId && user.id) {
        after(() => {
          (async () => {
            const { data: event, error: eventErr } = await supabaseAdmin
              .from('events')
              .select('created_by, title')
              .eq('id', eventId)
              .maybeSingle();

            if (eventErr) {
              console.error("[Upload] Error fetching event details for notification:", eventErr);
              return;
            }

            if (event?.created_by && event.created_by !== user.id) {
              const isVideo = resourceType === "video";
              const { sendPushNotification } = await import("@/lib/pushNotifications");
              await sendPushNotification(
                event.created_by,
                isVideo ? '🎥 New video uploaded' : '📸 New photo uploaded',
                `Someone added a ${isVideo ? 'video' : 'photo'} to "${event.title}"`,
                { eventId }
              );
            }
          })().catch((err) => {
            console.error("[Upload] Push notification background error:", err);
          });
        });
      }
    }

    if (resourceType === "image") {
      const qstashToken = process.env.QSTASH_TOKEN;
      if (process.env.NODE_ENV === "development") {
        console.log(`[Upload] Local development environment detected. Processing resizing locally in background for: ${storageKey}`);
        localDevResizeAndUpload(bytes, storageKey, mediaDomain);
      } else if (qstashToken) {
        // QStash path: return response immediately, publish resize job in background
        console.log(`[Upload] Queuing resize via QStash for: ${storageKey}`);
        after(() => {
          publishResizeTask({ storageKey, origin: request.nextUrl.origin }).catch((err) => {
            console.error("[Upload] Error publishing resize task via QStash:", err);
          });
        });
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
      savedPhotoId,
    });
  } catch (error: unknown) {
    console.error("[MediaUpload] Error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Upload failed" }, 500);
  }
}
