import { NextRequest, NextResponse } from "next/server";
import { getEventFaceEncodings } from "@/lib/database";

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
        try {
            canvasModule = await import("canvas" as any);
            faceapi = await import("face-api.js");
        } catch {
            return NextResponse.json(
                { error: "Server face recognition not available. Install `canvas` package." },
                { status: 503 }
            );
        }

        // Polyfill face-api.js with canvas for Node.js
        faceapi.env.monkeyPatch({
            Canvas: canvasModule.Canvas,
            Image: canvasModule.Image,
            ImageData: canvasModule.ImageData,
            createCanvasElement: () => canvasModule.createCanvas(100, 100),
            createImageElement: () => new canvasModule.Image(),
        });

        // Load models from public/models directory
        const MODEL_PATH = `${process.cwd()}/public/models`;
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_PATH),
            faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH),
            faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH),
        ]);

        // Load and detect face in selfie
        const selfieImage = await canvasModule.loadImage(selfieSrc);
        const selfieDetection = await faceapi
            .detectSingleFace(selfieImage, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!selfieDetection) {
            return NextResponse.json({ matches: [], error: "No face detected in selfie" }, { status: 200 });
        }

        // Fetch face encodings scoped to this event only
        const indexedFaces = await getEventFaceEncodings(eventIds);

        if (indexedFaces.length === 0) {
            return NextResponse.json({ matches: [], message: "No indexed faces for this event" }, { status: 200 });
        }

        // Compare descriptors
        const THRESHOLD = 0.5;
        const matchMap = new Map<string, { imageId: string; imageUrl: string; width?: number; height?: number }>();

        for (const face of indexedFaces) {
            const storedDescriptor = new Float32Array(face.descriptor);
            const distance = faceapi.euclideanDistance(selfieDetection.descriptor, storedDescriptor);
            if (distance < THRESHOLD && !matchMap.has(face.imageId)) {
                matchMap.set(face.imageId, {
                    imageId: face.imageId,
                    imageUrl: face.imageUrl,
                    width: face.width,
                    height: face.height,
                });
            }
        }

        const matches = Array.from(matchMap.values());
        return NextResponse.json({ matches, total: matches.length }, { status: 200 });

    } catch (error: any) {
        console.error("[API /find-you] Error:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
