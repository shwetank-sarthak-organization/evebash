import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Razorpay from "razorpay";
import { normalizeBillingDuration, type RazorpayBillingDuration } from "@/lib/razorpayPricing";

export const runtime = "nodejs";

type VerifyPaymentBody = {
    razorpay_order_id?: unknown;
    razorpay_payment_id?: unknown;
    razorpay_signature?: unknown;
    planId?: unknown;
    duration?: unknown;
};

const DURATION_TO_MONTHS: Record<RazorpayBillingDuration, number> = {
    monthly: 1,
    threeMonths: 3,
    sixMonths: 6,
    yearly: 12,
};

const DURATION_TO_PROFILE_VALUE: Record<RazorpayBillingDuration, string> = {
    monthly: "monthly",
    threeMonths: "quarterly",
    sixMonths: "half_yearly",
    yearly: "yearly",
};

function getSupabaseAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) return null;

    return createClient(url, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

function toDateOnly(date: Date) {
    return date.toISOString().slice(0, 10);
}

function addMonths(date: Date, months: number) {
    const nextDate = new Date(date);
    nextDate.setMonth(nextDate.getMonth() + months);
    return nextDate;
}

function safeCompare(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.length !== rightBuffer.length) return false;
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export async function POST(request: NextRequest) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
        return NextResponse.json({ error: "Razorpay credentials are not configured." }, { status: 500 });
    }

    const supabaseAdmin = getSupabaseAdminClient();
    if (!supabaseAdmin) {
        return NextResponse.json({ error: "Supabase admin configuration is missing." }, { status: 500 });
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
    const requestedPlanId = typeof body.planId === "string" ? body.planId.trim() : "";
    const requestedDuration = normalizeBillingDuration(body.duration);

    if (!orderId || !paymentId || !signature) {
        return NextResponse.json({ error: "Payment id, order id, and signature are required." }, { status: 400 });
    }

    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
    if (!token) {
        return NextResponse.json({ error: "You must be signed in to activate a plan." }, { status: 401 });
    }

    const {
        data: { user },
        error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
        return NextResponse.json({ error: "Your session could not be verified." }, { status: 401 });
    }

    const generatedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

    if (!safeCompare(generatedSignature, signature)) {
        return NextResponse.json({ success: false, error: "Invalid payment signature." }, { status: 400 });
    }

    const razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
    });

    const order = await razorpay.orders.fetch(orderId);
    const notes = order.notes || {};
    const planId = typeof notes.planId === "string" ? notes.planId : requestedPlanId;
    const duration = normalizeBillingDuration(notes.duration || requestedDuration);

    if (!planId || !duration) {
        return NextResponse.json({ error: "Payment order does not include plan details." }, { status: 400 });
    }

    if (requestedPlanId && requestedPlanId !== planId) {
        return NextResponse.json({ error: "Payment plan mismatch." }, { status: 400 });
    }

    if (requestedDuration && requestedDuration !== duration) {
        return NextResponse.json({ error: "Payment duration mismatch." }, { status: 400 });
    }

    const today = new Date();
    const planStartDate = toDateOnly(today);
    const planEndDate = toDateOnly(addMonths(today, DURATION_TO_MONTHS[duration]));

    const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({
            role: planId,
            role_type: "primary",
            subscription_duration: DURATION_TO_PROFILE_VALUE[duration],
            plan_start_date: planStartDate,
            plan_end_date: planEndDate,
        })
        .eq("id", user.id);

    if (updateError) {
        return NextResponse.json({ error: updateError.message || "Payment verified, but plan activation failed." }, { status: 500 });
    }

    return NextResponse.json({
        success: true,
        payment_id: paymentId,
        order_id: orderId,
        plan_id: planId,
        plan_start_date: planStartDate,
        plan_end_date: planEndDate,
    });
}
