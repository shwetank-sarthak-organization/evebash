import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { publishModalBatchTask } from "@/lib/qstash";

export const runtime = "edge";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export async function POST() {
  try {
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

    // 1. Fetch photos that have a preview (resizing is complete) but haven't been sent to Modal
    // Note: This requires a `face_indexed` boolean column on the `photos` table in Supabase.
    // Default value should be FALSE.
    const { data: pendingPhotos, error } = await supabaseAdmin
      .from("photos")
      .select("id, url, storage_key, event_id, thumbnail_url, uploaded_at")
      .not("thumbnail_url", "is", null) // Ensure resizing finished
      .eq("face_indexed", false)
      .eq("media_type", "photo"); // Only process photos, not videos

    if (error) {
      console.error("[Modal Batcher] Error fetching pending photos:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!pendingPhotos || pendingPhotos.length === 0) {
      console.log("[Modal Batcher] No pending photos found. Skipping batch run.");
      return NextResponse.json({ success: true, message: "No pending photos" });
    }

    // Cost Optimization: "Size OR Time" Logic
    const BATCH_SIZE_THRESHOLD = 50;
    const MAX_WAIT_TIME_MS = 5 * 60 * 1000; // 5 minutes

    const now = new Date().getTime();
    const oldestPhoto = pendingPhotos.reduce((oldest, p) => {
      const pTime = new Date(p.uploaded_at).getTime();
      const oldestTime = new Date(oldest.uploaded_at).getTime();
      return pTime < oldestTime ? p : oldest;
    }, pendingPhotos[0]);

    const oldestAgeMs = now - new Date(oldestPhoto.uploaded_at).getTime();

    if (pendingPhotos.length < BATCH_SIZE_THRESHOLD && oldestAgeMs < MAX_WAIT_TIME_MS) {
      console.log(`[Modal Batcher] Only ${pendingPhotos.length} photos ready. Oldest is ${Math.round(oldestAgeMs/1000)}s old. Waiting for ${BATCH_SIZE_THRESHOLD} photos or 5 mins to save Modal costs.`);
      return NextResponse.json({ success: true, message: "Waiting for larger batch to optimize costs" });
    }

    console.log(`[Modal Batcher] Found ${pendingPhotos.length} photos ready for face indexing (Cost Optimization Criteria Met).`);

    // 2. Format the payload for Modal with necessary keys (id, storage_key, event_id, url)
    const modalPhotos = pendingPhotos.map(p => {
      const url = p.thumbnail_url
        ? p.thumbnail_url.replace("-thumbnail.webp", "-preview.webp")
        : p.url;
      return {
        id: p.id,
        storage_key: p.storage_key,
        event_id: p.event_id,
        url: url
      };
    });

    // 3. Publish massive batch to Modal via QStash
    const success = await publishModalBatchTask(modalPhotos);

    if (!success) {
      throw new Error("Failed to publish batch to QStash");
    }

    // 4. Mark these photos as `face_indexed = true` so we don't process them again
    // We chunk these updates to avoid URL query parameter length limits in Supabase PostgREST (since photo IDs are very long).
    const photoIds = pendingPhotos.map(p => p.id);
    const chunkSize = 40;
    let updateFailed = false;
    let lastError = null;

    for (let i = 0; i < photoIds.length; i += chunkSize) {
      const chunk = photoIds.slice(i, i + chunkSize);
      const { error: chunkUpdateError } = await supabaseAdmin
        .from("photos")
        .update({ face_indexed: true })
        .in("id", chunk);

      if (chunkUpdateError) {
        updateFailed = true;
        lastError = chunkUpdateError;
        console.error(`[Modal Batcher] Warning: Failed to update face_indexed flag for chunk ${Math.floor(i / chunkSize)}:`, chunkUpdateError);
      }
    }

    if (updateFailed) {
      console.error("[Modal Batcher] One or more database update chunks failed. Last error:", lastError);
    }

    console.log(`[Modal Batcher] Successfully batched and dispatched ${modalPhotos.length} photos.`);
    return NextResponse.json({ success: true, count: modalPhotos.length });
  } catch (error: any) {
    console.error("[Modal Batcher] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
