import React from "react";
import type { Metadata } from "next";
import { EventRouteShell } from "./EventRouteShell";

const genericMetadata: Metadata = {
    title: { absolute: "Event gallery · EveBash" },
    description: "View the photos from this event and find the ones you're in with a selfie.",
};

type EventPreview = { title: string | null; cover_image: string | null; is_public: boolean | null };

// Same anon access the gallery page already uses in the browser; cached so page loads stay fast.
async function getEventPreview(slug: string): Promise<EventPreview | null> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) return null;

    try {
        const url = `${supabaseUrl}/rest/v1/events?select=title,cover_image,is_public&id=eq.${encodeURIComponent(slug)}&limit=1`;
        const response = await fetch(url, {
            headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
            next: { revalidate: 300 },
            signal: AbortSignal.timeout(3000),
        });
        if (!response.ok) return null;
        const rows = (await response.json()) as EventPreview[];
        return rows[0] ?? null;
    } catch {
        return null;
    }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const event = await getEventPreview(decodeURIComponent(slug));

    // Only public events expose their name and cover in link previews.
    if (!event?.is_public || !event.title) return genericMetadata;

    const title = `${event.title} · EveBash`;
    const description = `Photos from ${event.title}. Find the ones you're in with a selfie.`;
    const images = event.cover_image ? [{ url: event.cover_image }] : undefined;

    return {
        title: { absolute: title },
        description,
        openGraph: { title, description, type: "website", siteName: "EveBash", images },
        twitter: { card: images ? "summary_large_image" : "summary", title, description, images: event.cover_image ? [event.cover_image] : undefined },
    };
}

export default async function EventLayout({
    children,
    params,
}: Readonly<{
    children: React.ReactNode;
    params: Promise<{ slug: string }>;
}>) {
    const { slug } = await params;
    return <EventRouteShell slug={slug}>{children}</EventRouteShell>;
}
