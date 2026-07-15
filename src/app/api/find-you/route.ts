import { NextRequest, NextResponse } from "next/server";
import { getImageUrl } from "@/lib/imageUrl";
import sharp from "sharp";

export const runtime = "nodejs";

/**
 * POST /api/find-you
 *
 * Server-side face matching endpoint, primarily used by the mobile app
 * and guest search pages. Runs dlib-based face matching on Modal.com.
 *
 * Body: { selfieUrl?: string, selfieBase64?: string, eventIds: string[] }
 * Returns: { matches: MatchedPhoto[], total: number }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { selfieUrl, selfieBase64, eventIds } = body;

        const selfieSrc = selfieUrl || selfieBase64;

        if (!selfieSrc || !Array.isArray(eventIds) || eventIds.length === 0) {
            return NextResponse.json({ error: "Missing selfie source (selfieUrl or selfieBase64) or eventIds" }, { status: 400 });
        }

        // 1. Get selfie buffer
        let selfieBuffer: Buffer;
        if (selfieSrc.startsWith("data:") || !selfieSrc.startsWith("http")) {
            const base64Data = selfieSrc.includes("base64,") ? selfieSrc.split("base64,")[1] : selfieSrc;
            selfieBuffer = Buffer.from(base64Data, "base64");
        } else {
            const downloadRes = await fetch(selfieSrc);
            selfieBuffer = Buffer.from(await downloadRes.arrayBuffer());
        }

        // Optimize selfie: fix EXIF rotation, resize to 1000px, save as lossless PNG.
        // PNG (lossless) avoids the JPEG compression artifact mismatch that caused
        // cosine similarity drift between selfie encoding and indexed photo encoding.
        const optimizedSelfieBuffer = await sharp(selfieBuffer)
            .rotate()
            .resize({ width: 1000, fit: "inside", withoutEnlargement: true })
            .png()
            .toBuffer();

        const selfieBase64Str = optimizedSelfieBuffer.toString("base64");

        // 3. Request face matching on Modal.com
        const targetUrl = "https://shwetank-sarthak--wedding-media-engine-find-matching-photos.modal.run";
        console.log(`[FindYou] Sending selfie to Modal.com for matching across events: ${eventIds.join(", ")}`);
        
        const modalResponse = await fetch(targetUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                selfie_base64: selfieBase64Str,
                event_ids: eventIds
            })
        });

        if (!modalResponse.ok) {
            const errText = await modalResponse.text();
            throw new Error(`Modal search request failed: ${modalResponse.status} - ${errText}`);
        }

        const result = await modalResponse.json();

        if (result.error) {
            console.warn(`[FindYou] Modal returned error: ${result.error}`);
            return NextResponse.json({
                matches: [],
                error: result.error,
                debug: {
                    indexedFacesCount: result.debug?.indexedFacesCount || 0,
                    selfieDetected: false,
                    matchesCount: 0
                }
            }, { status: 200 });
        }

        // 4. Map matching photo results and format URL paths
        const matches = (result.matches || []).map((m: any) => ({
            id: m.imageId,
            imageId: m.imageId,
            url: m.imageUrl,
            imageUrl: m.imageUrl,
            thumbnailUrl: getImageUrl(m.imageUrl, { width: 400 }),
            previewUrl: getImageUrl(m.imageUrl, { width: 900 }),
            width: m.width,
            height: m.height,
        }));

        return NextResponse.json({
            matches,
            total: matches.length,
            debug: {
                indexedFacesCount: result.debug?.indexedFacesCount || 0,
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
