import { NextRequest, NextResponse } from "next/server";
import { getEventFaceEncodings } from "@/lib/database";
import { getImageUrl } from "@/lib/imageUrl";

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

        // Force environment detection to recognize Browser/Node by mocking global browser variables
        const hasWindow = typeof (global as any).window !== 'undefined';
        const hasDocument = typeof (global as any).document !== 'undefined';
        const hasHTMLImage = typeof (global as any).HTMLImageElement !== 'undefined';
        const hasHTMLCanvas = typeof (global as any).HTMLCanvasElement !== 'undefined';

        if (typeof global !== 'undefined') {
            if (!hasWindow) (global as any).window = {};
            if (!hasDocument) (global as any).document = {};
            if (!hasHTMLImage) (global as any).HTMLImageElement = class {};
            if (!hasHTMLCanvas) (global as any).HTMLCanvasElement = class {};
        }

        // Dynamically import optional packages
        let canvasModule: any;
        let faceapi: any;
        try {
            canvasModule = await import("canvas" as any);
            faceapi = await import("face-api.js");

            // Polyfill face-api.js with canvas for Node.js
            faceapi.env.monkeyPatch({
                Canvas: canvasModule.Canvas,
                Image: canvasModule.Image,
                ImageData: canvasModule.ImageData,
                createCanvasElement: () => canvasModule.createCanvas(100, 100),
                createImageElement: () => new canvasModule.Image(),
            });
        } catch (err: any) {
            console.error("[FindYou] Import/Patch error:", err);
            return NextResponse.json(
                { error: `Server face recognition not available: ${err.message}` },
                { status: 503 }
            );
        } finally {
            // Clean up global mocks immediately so they don't break Next.js server runtime
            if (typeof global !== 'undefined') {
                if (!hasWindow) delete (global as any).window;
                if (!hasDocument) delete (global as any).document;
                if (!hasHTMLImage) delete (global as any).HTMLImageElement;
                if (!hasHTMLCanvas) delete (global as any).HTMLCanvasElement;
            }
        }

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

        for (const face of indexedFaces) {
            const storedDescriptor = new Float32Array(face.descriptor);
            const distance = faceapi.euclideanDistance(selfieDetection.descriptor, storedDescriptor);
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
