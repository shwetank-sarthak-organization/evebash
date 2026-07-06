import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { getCachedBackblazeAuth, getUploadUrl } from "@/lib/backblaze";

export const runtime = "nodejs";
export const maxDuration = 60; // seconds — prevent Vercel timeout on large images

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
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

async function deleteB2File(auth: any, bucketId: string, key: string) {
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
        prefix: key
      }),
    });

    if (!listResponse.ok) {
      console.error(`[B2Delete] Failed to list file ${key}: ${listResponse.status}`);
      return false;
    }

    const listData = await listResponse.json();
    const file = listData.files?.find((f: { fileName: string; fileId?: string }) => f.fileName === key);
    if (!file || !file.fileId) {
      console.log(`[B2Delete] File ${key} not found or already deleted.`);
      return true;
    }

    const deleteResponse = await fetch(`${auth.apiUrl}/b2api/v3/b2_delete_file_version`, {
      method: "POST",
      headers: {
        Authorization: auth.authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: key,
        fileId: file.fileId
      }),
    });

    if (!deleteResponse.ok) {
      console.error(`[B2Delete] Failed to delete file version for ${key}: ${deleteResponse.status}`);
      return false;
    }

    console.log(`[B2Delete] Successfully deleted file ${key} from B2.`);
    return true;
  } catch (err) {
    console.error(`[B2Delete] Error deleting file ${key}:`, err);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // No auth check needed — this endpoint is only reachable via QStash.
    // QStash requires your secret QSTASH_TOKEN to publish messages, so
    // only QStash can trigger this worker.

    // 2. Parse request payload
    const body = await request.json().catch(() => ({}));
    const { storageKey } = body;

    if (!storageKey) {
      return NextResponse.json({ error: "Missing storageKey in payload" }, { status: 400 });
    }

    console.log(`[Resize Worker] Processing image resizing for: ${storageKey}`);

    // 3. Initialize Supabase Admin Client
    const supabaseAdmin = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    const mediaDomain = requireEnv("MEDIA_DOMAIN").replace(/^https?:\/\//, "").replace(/\/+$/, "");
    const originalUrl = `https://${mediaDomain}/${storageKey}`;

    // 4. Download original file from B2
    console.log(`[Resize Worker] Downloading original file: ${originalUrl}`);
    const downloadResponse = await fetch(originalUrl);
    if (!downloadResponse.ok) {
      throw new Error(`Failed to download original image from ${originalUrl} (status: ${downloadResponse.status})`);
    }

    const arrayBuffer = await downloadResponse.arrayBuffer();
    const bufferBytes = Buffer.from(arrayBuffer);

    // 5. Generate resized WebP buffers
    console.log(`[Resize Worker] Resizing and converting to WebP...`);
    const thumbnailBuffer = await sharp(bufferBytes)
      .resize({ width: 400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();

    const previewBuffer = await sharp(bufferBytes)
      .resize({ width: 900, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();

    // Helper to verify if the photo record still exists in Supabase
    const checkDbRecordExists = async (): Promise<boolean> => {
      const { data, error } = await supabaseAdmin
        .from("photos")
        .select("id")
        .eq("storage_key", storageKey)
        .maybeSingle();
      if (error) {
        console.error(`[Resize Worker] Error checking photo record existence:`, error);
        return false;
      }
      return !!data;
    };

    // 6. Upload generated buffers to B2 (verifying DB state to prevent orphans)
    const thumbnailKey = `${storageKey}-thumbnail.webp`;
    const previewKey = `${storageKey}-preview.webp`;
    const thumbnailUrl = `https://${mediaDomain}/${thumbnailKey}`;

    if (!(await checkDbRecordExists())) {
      console.warn(`[Resize Worker] Aborting: photo record for "${storageKey}" was deleted/rolled back. Skipping thumbnail upload.`);
      return NextResponse.json({ success: true, message: "Upload aborted: photo record was deleted/rolled back" });
    }

    console.log(`[Resize Worker] Uploading generated assets to B2...`);
    await uploadBufferToB2(thumbnailBuffer, thumbnailKey, "image/webp");

    if (!(await checkDbRecordExists())) {
      console.warn(`[Resize Worker] Aborting: photo record for "${storageKey}" was deleted/rolled back after thumbnail upload. Cleaning up thumbnail...`);
      const auth = await getCachedBackblazeAuth();
      const bucketId = requireEnv("B2_BUCKET_ID");
      await deleteB2File(auth, bucketId, thumbnailKey);
      return NextResponse.json({ success: true, message: "Upload aborted and rolled back: photo record was deleted" });
    }

    await uploadBufferToB2(previewBuffer, previewKey, "image/webp");

    // 7. Update database record — match by storage_key, with a retry loop to prevent race conditions
    let updated = false;
    for (let attempt = 1; attempt <= 4; attempt++) {
      console.log(`[Resize Worker] Database update attempt ${attempt} for storage_key: ${storageKey}`);
      const { data: updatedData, error: dbError } = await supabaseAdmin
        .from("photos")
        .update({ thumbnail_url: thumbnailUrl })
        .eq("storage_key", storageKey)
        .select();

      if (dbError) {
        throw dbError;
      }

      if (updatedData && updatedData.length > 0) {
        console.log(`[Resize Worker] Successfully updated database record in attempt ${attempt}`);
        updated = true;
        break;
      }

      if (attempt < 4) {
        console.log(`[Resize Worker] Row not found yet, sleeping 2 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (!updated) {
      console.warn(`[Resize Worker] Warning: No database row found matching storage_key "${storageKey}" after 4 attempts. Cleaning up generated B2 assets to prevent orphans.`);
      const auth = await getCachedBackblazeAuth();
      const bucketId = requireEnv("B2_BUCKET_ID");
      await Promise.all([
        deleteB2File(auth, bucketId, thumbnailKey),
        deleteB2File(auth, bucketId, previewKey)
      ]);
      return NextResponse.json({ error: "Database row not found. Rolled back B2 assets." }, { status: 404 });
    }

    console.log(`[Resize Worker] Successfully finished resizing for key: ${storageKey}`);
    return NextResponse.json({ success: true, message: "Image resized successfully", thumbnailUrl });
  } catch (error: unknown) {
    console.error("[Resize Worker] Resizing process failed:", error);
    const errMessage = error instanceof Error ? error.message : "Resizing failed";
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}
