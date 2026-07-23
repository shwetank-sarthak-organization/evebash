import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

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

function parseDateOnly(value?: string | null) {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function isTodayOrPast(value?: string | null) {
    const date = parseDateOnly(value);
    if (!date) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date <= today;
}

export async function POST(request: NextRequest) {
    const supabaseAdmin = getSupabaseAdminClient();
    if (!supabaseAdmin) {
        return NextResponse.json({ error: "Supabase admin configuration is missing." }, { status: 500 });
    }

    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
    if (!token) {
        return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }

    const {
        data: { user },
        error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
        return NextResponse.json({ error: "Your session could not be verified." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("pending_plan_role, pending_subscription_duration, pending_plan_start_date, pending_plan_end_date")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
        return NextResponse.json({ error: profileError.message || "Unable to check pending plan." }, { status: 500 });
    }

    if (!profile?.pending_plan_role || !isTodayOrPast(profile.pending_plan_start_date)) {
        return NextResponse.json({ success: true, applied: false });
    }

    const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({
            role: profile.pending_plan_role,
            role_type: "primary",
            subscription_duration: profile.pending_subscription_duration,
            plan_start_date: profile.pending_plan_start_date,
            plan_end_date: profile.pending_plan_end_date,
            pending_plan_role: null,
            pending_subscription_duration: null,
            pending_plan_start_date: null,
            pending_plan_end_date: null,
        })
        .eq("id", user.id);

    if (updateError) {
        return NextResponse.json({ error: updateError.message || "Unable to activate pending plan." }, { status: 500 });
    }

    return NextResponse.json({ success: true, applied: true });
}
