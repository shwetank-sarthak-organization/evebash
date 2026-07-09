import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { getCachedBackblazeAuth, getUploadUrl, BackblazeAuth } from "@/lib/backblaze";

export const runtime = "nodejs";
export const maxDuration = 60;

type B2FileVersion = {
  fileName: string;
  fileId?: string;
};

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

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

function inferContentType(key: string, fallback = "image/jpeg") {
  const cleanKey = key.split("?")[0].toLowerCase();
  if (cleanKey.endsWith(".png")) return "image/png";
  if (cleanKey.endsWith(".webp")) return "image/webp";
  if (cleanKey.endsWith(".tif") || cleanKey.endsWith(".tiff")) return "image/tiff";
  if (cleanKey.endsWith(".jpg") || cleanKey.endsWith(".jpeg")) return "image/jpeg";
  return fallback;
}

async function verifySupabaseUser(accessToken: string) {
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

async function listExactFileVersions(auth: BackblazeAuth, bucketId: string, key: string): Promise<B2FileVersion[]> {
  const response = await fetch(`${auth.apiUrl}/b2api/v3/b2_list_file_versions`, {
    method: "POST",
    headers: {
      Authorization: auth.authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bucketId,
      startFileName: key,
      maxFileCount: 20,
      prefix: key,
    }),
  });

  if (!response.ok) {
    console.warn(`[MediaRotate] Could not list existing file versions for ${key}: ${response.status}`);
    return [];
  }

  const data = await response.json().catch(() => ({}));
  return (data.files || []).filter((file: B2FileVersion) => file.fileName === key && file.fileId);
}

async function deleteB2FileVersion(auth: BackblazeAuth, file: B2FileVersion) {
  if (!file.fileId) return false;

  const response = await fetch(`${auth.apiUrl}/b2api/v3/b2_delete_file_version`, {
    method: "POST",
    headers: {
      Authorization: auth.authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: file.fileName,
      fileId: file.fileId,
    }),
  });

  if (!response.ok) {
    console.warn(`[MediaRotate] Could not delete old file version ${file.fileName}: ${response.status}`);
    return false;
  }

  return true;
}

async function uploadBufferToB2(buffer: Buffer, key: string, contentType: string) {
  const uploadUrlData = await getUploadUrl(await getCachedBackblazeAuth());

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

    const { photoId, direction } = await request.json().catch(() => ({}));
    if (!photoId) {
      return jsonResponse({ error: "Missing photoId" }, 400);
    }

    const angle = direction === "left" ? -90 : direction === "right" ? 90 : Number(direction);
    if (![90, -90, 180, -180, 270, -270].includes(angle)) {
      return jsonResponse({ error: "Invalid rotation direction" }, 400);
    }

    const supabaseAdmin = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    const { data: photo, error: photoError } = await supabaseAdmin
      .from("photos")
      .select("*")
      .eq("id", photoId)
      .maybeSingle();

    if (photoError) throw photoError;
    if (!photo) {
      return jsonResponse({ error: "Photo not found" }, 404);
    }

    const isVideo = photo.media_type === "video" || photo.resource_type === "video";
    if (isVideo) {
      return jsonResponse({ error: "Videos cannot be rotated from this tool" }, 400);
    }

    if (!photo.storage_key || !photo.url) {
      return jsonResponse({ error: "Photo storage details are missing" }, 400);
    }

    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("created_by")
      .eq("id", photo.event_id)
      .maybeSingle();

    if (eventError) throw eventError;

    let isAuthorized = event?.created_by === user.id || photo.user_id === user.id;
    if (!isAuthorized) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      isAuthorized = profile?.role === "admin";
    }

    if (!isAuthorized) {
      return jsonResponse({ error: "Forbidden: You do not have permission to rotate this photo" }, 403);
    }

    const downloadResponse = await fetch(photo.url);
    if (!downloadResponse.ok) {
      throw new Error(`Failed to download original image with status ${downloadResponse.status}`);
    }

    const originalBytes = Buffer.from(await downloadResponse.arrayBuffer());
    const rotated = await sharp(originalBytes).rotate(angle).toBuffer({ resolveWithObject: true });
    const rotatedBuffer = rotated.data;
    const rotatedMetadata = rotated.info;
    const thumbnailBuffer = await sharp(rotatedBuffer)
      .resize({ width: 400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
    const previewBuffer = await sharp(rotatedBuffer)
      .resize({ width: 900, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();

    const auth = await getCachedBackblazeAuth();
    const bucketId = requireEnv("B2_BUCKET_ID");
    const storageKey = photo.storage_key;
    const thumbnailKey = `${storageKey}-thumbnail.webp`;
    const previewKey = `${storageKey}-preview.webp`;
    const mediaDomain = requireEnv("MEDIA_DOMAIN").replace(/^https?:\/\//, "").replace(/\/+$/, "");
    const url = `https://${mediaDomain}/${storageKey}`;
    const thumbnailUrl = `https://${mediaDomain}/${thumbnailKey}`;
    const contentType = inferContentType(storageKey);

    const oldVersions = await Promise.all([
      listExactFileVersions(auth, bucketId, storageKey),
      listExactFileVersions(auth, bucketId, thumbnailKey),
      listExactFileVersions(auth, bucketId, previewKey),
    ]);

    await uploadBufferToB2(rotatedBuffer, storageKey, contentType);
    await uploadBufferToB2(thumbnailBuffer, thumbnailKey, "image/webp");
    await uploadBufferToB2(previewBuffer, previewKey, "image/webp");

    await Promise.all(oldVersions.flat().map((file) => deleteB2FileVersion(auth, file)));

    const { error: updateError } = await supabaseAdmin
      .from("photos")
      .update({
        url,
        thumbnail_url: thumbnailUrl,
        width: rotatedMetadata.width || null,
        height: rotatedMetadata.height || null,
        size: rotatedBuffer.length,
      })
      .eq("id", photoId);

    if (updateError) throw updateError;

    return jsonResponse({
      success: true,
      url,
      thumbnailUrl,
      width: rotatedMetadata.width || null,
      height: rotatedMetadata.height || null,
      size: rotatedBuffer.length,
      cacheBuster: Date.now(),
    });
  } catch (error: unknown) {
    console.error("[MediaRotate] Error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Rotation failed" }, 500);
  }
}
