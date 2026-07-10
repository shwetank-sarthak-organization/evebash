import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

export const runtime = "nodejs";
export const maxDuration = 60; // seconds — prevent Vercel timeout on large images

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

// In-memory queue to limit CPU/RAM usage of AI operations in a single container
class IndexingQueue {
  private activeCount = 0;
  private maxConcurrency = Number(process.env.MAX_CONCURRENT_INDEXING || "1");
  private waiting: (() => void)[] = [];

  async acquire() {
    if (this.activeCount < this.maxConcurrency) {
      this.activeCount++;
      return;
    }
    await new Promise<void>(resolve => {
      this.waiting.push(resolve);
    });
    this.activeCount++;
  }

  release() {
    this.activeCount--;
    const next = this.waiting.shift();
    if (next) {
      next();
    }
  }
}

const indexingQueue = new IndexingQueue();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { storageKey } = body;

    if (!storageKey) {
      return NextResponse.json({ error: "Missing storageKey in payload" }, { status: 400 });
    }

    console.log(`[Face Indexing Worker] Processing photo: ${storageKey}`);

    const supabaseAdmin = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    // Get the photo record from the database
    const { data: photoData, error: dbError } = await supabaseAdmin
      .from("photos")
      .select("*")
      .eq("storage_key", storageKey)
      .maybeSingle();

    if (dbError || !photoData) {
      console.warn(`[Face Indexing Worker] Photo record not found for ${storageKey}. Aborting.`);
      return NextResponse.json({ error: "Database row not found." }, { status: 404 });
    }

    // Download original file from B2 via the media domain
    const mediaDomain = requireEnv("MEDIA_DOMAIN").replace(/^https?:\/\//, "").replace(/\/+$/, "");
    const originalUrl = `https://${mediaDomain}/${storageKey}`;
    
    console.log(`[Face Indexing Worker] Downloading file: ${originalUrl}`);
    const downloadResponse = await fetch(originalUrl);
    if (!downloadResponse.ok) {
      throw new Error(`Failed to download original image from ${originalUrl} (status: ${downloadResponse.status})`);
    }

    const arrayBuffer = await downloadResponse.arrayBuffer();
    const bufferBytes = Buffer.from(arrayBuffer);

    console.log(`[Face Indexing Worker] Waiting for AI queue slot for: ${storageKey}`);
    await indexingQueue.acquire();

    try {
      console.log(`[Face Indexing Worker] Starting background face indexing for photo: ${photoData.id}`);
      
      // Setup face-api environment
      const hasCanvas = typeof (global as any).Canvas !== 'undefined';
      const hasImage = typeof (global as any).Image !== 'undefined';
      const hasImageData = typeof (global as any).ImageData !== 'undefined';
      const hasCanvas2D = typeof (global as any).CanvasRenderingContext2D !== 'undefined';

      let canvasModule: any;
      let faceapi: any;

      try {
        canvasModule = await import("canvas" as any);
        try {
          await import("@tensorflow/tfjs-node" as any);
          console.log("[Face Indexing Worker] Successfully loaded @tensorflow/tfjs-node native bindings");
        } catch (tfErr) {
          console.warn("[Face Indexing Worker] Failed to load @tensorflow/tfjs-node, falling back to pure JS backend", tfErr);
        }
        faceapi = await import("face-api.js");

        if (typeof global !== 'undefined') {
          if (!hasCanvas) (global as any).Canvas = canvasModule.Canvas;
          if (!hasImage) (global as any).Image = canvasModule.Image;
          if (!hasImageData) (global as any).ImageData = canvasModule.ImageData;
          if (!hasCanvas2D) (global as any).CanvasRenderingContext2D = canvasModule.CanvasRenderingContext2D;
        }

        const nodeEnv = faceapi.env.createNodejsEnv();
        nodeEnv.createCanvasElement = () => canvasModule.createCanvas(100, 100);
        nodeEnv.createImageElement = () => new canvasModule.Image();
        faceapi.env.setEnv(nodeEnv);

        const MODEL_PATH = `${process.cwd()}/public/models`;
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_PATH),
          faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH),
          faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH),
        ]);

        // Resize original buffer to max 1000px JPEG to avoid memory OOM crashes on large DSLR images
        console.log(`[Face Indexing Worker] Resizing buffer to 1000px JPEG for face indexing...`);
        const detectionBuffer = await sharp(bufferBytes)
          .rotate()
          .resize({ width: 1000, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();

        const img = await canvasModule.loadImage(detectionBuffer);
        const detections = await faceapi.detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptors();

        if (detections.length > 0) {
          console.log(`[Face Indexing Worker] Found ${detections.length} faces in ${photoData.id}. Saving to index...`);
          const faceRecords = detections.map((det: any) => ({
            image_id: photoData.id,
            descriptor: Array.from(det.descriptor),
            event_id: photoData.event_id,
            image_url: photoData.url,
            width: photoData.width || 0,
            height: photoData.height || 0
          }));

          const { error: facesErr } = await supabaseAdmin
            .from('faces')
            .insert(faceRecords);

          if (facesErr) {
            console.error(`[Face Indexing Worker] Error saving faces to index:`, facesErr);
          } else {
            console.log(`[Face Indexing Worker] Successfully indexed ${detections.length} faces for photo: ${photoData.id}`);
          }
        } else {
          console.log(`[Face Indexing Worker] No faces detected in photo: ${photoData.id}`);
        }
      } finally {
        if (typeof global !== 'undefined') {
          if (!hasCanvas) delete (global as any).Canvas;
          if (!hasImage) delete (global as any).Image;
          if (!hasImageData) delete (global as any).ImageData;
          if (!hasCanvas2D) delete (global as any).CanvasRenderingContext2D;
        }
      }
    } finally {
      indexingQueue.release();
    }

    return NextResponse.json({ success: true, message: "Face indexing completed successfully" });
  } catch (error: unknown) {
    console.error("[Face Indexing Worker] Process failed:", error);
    const errMessage = error instanceof Error ? error.message : "Face indexing failed";
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}
