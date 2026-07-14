import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type VerifyPaymentBody = {
    razorpay_order_id?: unknown;
    razorpay_payment_id?: unknown;
    razorpay_signature?: unknown;
};

function safeCompare(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.length !== rightBuffer.length) return false;
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export async function POST(request: NextRequest) {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
        return NextResponse.json({ error: "Razorpay credentials are not configured." }, { status: 500 });
    }

    let body: VerifyPaymentBody;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const orderId = typeof body.razorpay_order_id === "string" ? body.razorpay_order_id : "";
    const paymentId = typeof body.razorpay_payment_id === "string" ? body.razorpay_payment_id : "";
    const signature = typeof body.razorpay_signature === "string" ? body.razorpay_signature : "";

    if (!orderId || !paymentId || !signature) {
        return NextResponse.json({ error: "Payment id, order id, and signature are required." }, { status: 400 });
    }

    const generatedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

    if (!safeCompare(generatedSignature, signature)) {
        return NextResponse.json({ success: false, error: "Invalid payment signature." }, { status: 400 });
    }

    return NextResponse.json({
        success: true,
        payment_id: paymentId,
        order_id: orderId,
    });
}
