import { NextRequest, NextResponse } from "next/server";
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    // eventId is required — the dedup key in qstash.ts is per-event, and now the query is too.
    const eventId = body.eventId as string | undefined;

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

    // 1. Fetch photos that have a preview (resizing is complete) but haven't been face-indexed yet.
    //    CRITICAL: Filter by event_id so we ONLY process photos from the event that just uploaded.
    //    Without this filter, old failed photos from other events pollute the batch and consume
    //    Modal capacity that should have gone to the new photos.
    let query = supabaseAdmin
      .from("photos")
      .select("id, url, storage_key, event_id, thumbnail_url, uploaded_at")
      .not("thumbnail_url", "is", null) // Ensure resizing finished
      .eq("face_indexed", false)
      .eq("media_type", "photo"); // Only process photos, not videos

    if (eventId) {
      query = query.eq("event_id", eventId);
      console.log(`[Modal Batcher] Triggered for event: ${eventId}`);
    } else {
      // Fallback: no event_id provided — process all pending (legacy behaviour, avoid if possible)
      console.warn("[Modal Batcher] No eventId in request body — processing all pending photos globally. This may mix events.");
    }

    const { data: pendingPhotos, error } = await query;

    if (error) {
      console.error("[Modal Batcher] Error fetching pending photos:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!pendingPhotos || pendingPhotos.length === 0) {
      console.log("[Modal Batcher] No pending photos found. Skipping batch run.");
      return NextResponse.json({ success: true, message: "No pending photos" });
    }

    // Process all pending photos that are ready (have finished resizing)
    console.log(`[Modal Batcher] Found ${pendingPhotos.length} photos ready for face indexing. Triggering Modal batch process...`);

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

    // 3. Publish batch to Modal via QStash
    const success = await publishModalBatchTask(modalPhotos);

    if (!success) {
      throw new Error("Failed to publish batch to QStash");
    }

    console.log(`[Modal Batcher] Successfully batched and dispatched ${modalPhotos.length} photos.`);
    return NextResponse.json({ success: true, count: modalPhotos.length });
  } catch (error: any) {
    console.error("[Modal Batcher] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
