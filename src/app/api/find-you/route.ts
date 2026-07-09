import { NextRequest, NextResponse } from "next/server";
import { getEventFaceEncodings } from "@/lib/database";
import { getImageUrl } from "@/lib/imageUrl";
import sharp from "sharp";

/**
 * POST /api/find-you
 *
 * Server-side face matching endpoint, primarily used by the mobile app
 * (since face-api.js is browser-only and can't run in React Native).
 *
 * Body: { selfieUrl: string, eventIds: string[] }
 * Returns: { matches: MatchedPhoto[], total: number }
 *
 * NOTE: This route requires the `canvas` npm package for server-side image
 * processing. Install it with: npm install canvas
 * Without it, the route falls back to a "not available" response.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { selfieUrl, selfieBase64, eventIds } = body;

        const selfieSrc = selfieUrl || selfieBase64;

        if (!selfieSrc || !Array.isArray(eventIds) || eventIds.length === 0) {
            return NextResponse.json({ error: "Missing selfie source (selfieUrl or selfieBase64) or eventIds" }, { status: 400 });
        }

        // Dynamically import optional packages
        let canvasModule: any;
        let faceapi: any;
        
        // Mock globals specifically for faceapi.env.createNodejsEnv()
        const hasCanvas = typeof (global as any).Canvas !== 'undefined';
        const hasImage = typeof (global as any).Image !== 'undefined';
        const hasImageData = typeof (global as any).ImageData !== 'undefined';
        const hasCanvas2D = typeof (global as any).CanvasRenderingContext2D !== 'undefined';

        try {
            canvasModule = await import("canvas" as any);
            faceapi = await import("face-api.js");

            if (typeof global !== 'undefined') {
                if (!hasCanvas) (global as any).Canvas = canvasModule.Canvas;
                if (!hasImage) (global as any).Image = canvasModule.Image;
                if (!hasImageData) (global as any).ImageData = canvasModule.ImageData;
                if (!hasCanvas2D) (global as any).CanvasRenderingContext2D = canvasModule.CanvasRenderingContext2D;
            }

            // Directly initialize a Node.js environment on face-api, bypassing isNodejs/isBrowser checks completely!
            const nodeEnv = faceapi.env.createNodejsEnv();
            nodeEnv.createCanvasElement = () => canvasModule.createCanvas(100, 100);
            nodeEnv.createImageElement = () => new canvasModule.Image();

            faceapi.env.setEnv(nodeEnv);
        } catch (err: any) {
            console.error("[FindYou] Import/Patch error:", err);
            return NextResponse.json(
                { error: `Server face recognition not available: ${err.message}` },
                { status: 503 }
            );
        } finally {
            // Clean up global variables
            if (typeof global !== 'undefined') {
                if (!hasCanvas) delete (global as any).Canvas;
                if (!hasImage) delete (global as any).Image;
                if (!hasImageData) delete (global as any).ImageData;
                if (!hasCanvas2D) delete (global as any).CanvasRenderingContext2D;
            }
        }

        // Load models from public/models directory
        const MODEL_PATH = `${process.cwd()}/public/models`;
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_PATH),
            faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH),
            faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH),
        ]);

        // Fetch face encodings scoped to this event only
        const indexedFaces = await getEventFaceEncodings(eventIds);

        if (indexedFaces.length === 0) {
            return NextResponse.json({ 
                matches: [], 
                message: "No indexed faces for this event",
                debug: {
                    indexedFacesCount: 0,
                    selfieDetected: null,
                    matchesCount: 0
                }
            }, { status: 200 });
        }

        // Load and detect face in selfie
        let selfieBuffer: Buffer;
        if (selfieSrc.startsWith("data:") || !selfieSrc.startsWith("http")) {
            const base64Data = selfieSrc.includes("base64,") ? selfieSrc.split("base64,")[1] : selfieSrc;
            selfieBuffer = Buffer.from(base64Data, "base64");
        } else {
            const downloadRes = await fetch(selfieSrc);
            selfieBuffer = Buffer.from(await downloadRes.arrayBuffer());
        }

        const optimizedSelfieBuffer = await sharp(selfieBuffer)
            .rotate()
            .resize({ width: 1000, fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();

        const selfieImage = await canvasModule.loadImage(optimizedSelfieBuffer);
        const selfieDetection = await faceapi
            .detectSingleFace(selfieImage, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!selfieDetection) {
            return NextResponse.json({ 
                matches: [], 
                error: "No face detected in selfie",
                debug: {
                    indexedFacesCount: indexedFaces.length,
                    selfieDetected: false,
                    matchesCount: 0
                }
            }, { status: 200 });
        }

        // Compare descriptors
        const THRESHOLD = 0.6; // face-api.js default matcher threshold is 0.6
        const matchMap = new Map<string, {
            id: string;
            imageId: string;
            url: string;
            imageUrl: string;
            thumbnailUrl: string;
            previewUrl: string;
            width?: number;
            height?: number;
        }>();

        console.log(`[FindYou] Comparing selfie against ${indexedFaces.length} stored faces...`);
        for (const face of indexedFaces) {
            try {
                const descriptorArray = typeof face.descriptor === 'string'
                    ? JSON.parse(face.descriptor)
                    : face.descriptor;
                if (!Array.isArray(descriptorArray) || descriptorArray.length !== 128) {
                    console.warn(`[FindYou] Skipping invalid descriptor for face in image ${face.imageId}: length=${descriptorArray?.length}`);
                    continue;
                }
                const storedDescriptor = new Float32Array(descriptorArray);
                const distance = faceapi.euclideanDistance(selfieDetection.descriptor, storedDescriptor);
                console.log(`[FindYou] Distance for face in image ${face.imageId}: ${distance.toFixed(4)} (threshold: ${THRESHOLD})`);
                if (distance < THRESHOLD && !matchMap.has(face.imageId)) {
                    matchMap.set(face.imageId, {
                        id: face.imageId,
                        imageId: face.imageId,
                        url: face.imageUrl,
                        imageUrl: face.imageUrl,
                        thumbnailUrl: getImageUrl(face.imageUrl, { width: 400 }),
                        previewUrl: getImageUrl(face.imageUrl, { width: 900 }),
                        width: face.width,
                        height: face.height,
                    });
                }
            } catch (err: any) {
                console.error(`[FindYou] Error matching face descriptor for image ${face.imageId}:`, err);
            }
        }

        const matches = Array.from(matchMap.values());
        return NextResponse.json({ 
            matches, 
            total: matches.length,
            debug: {
                indexedFacesCount: indexedFaces.length,
                selfieDetected: true,
                matchesCount: matches.length
            }
        }, { status: 200 });

    } catch (error: any) {
        console.error("[API /find-you] Error:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
