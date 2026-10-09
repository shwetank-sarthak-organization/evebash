import type { MetadataRoute } from "next";

const siteUrl = "https://www.evebash.com";

const marketingPaths = [
    "",
    "/sample-galleries",
    "/pricing",
    "/contact-us",
    "/privacy-policy",
    "/terms-and-conditions",
    "/cancellation-refund-policy",
    "/digital-service-delivery-policy",
    "/shipping-delivery-policy",
];

// Sample gallery albums only; event galleries are never listed.
async function getSampleGalleryIds(): Promise<string[]> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) return [];

    try {
        // get_sample_galleries: the events table isn't readable with the public key once RLS is on
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_sample_galleries`, {
            method: "POST",
            headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
            body: "{}",
            next: { revalidate: 3600 },
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return [];
        const rows = (await response.json()) as { id: string }[];
        return rows.map((row) => row.id);
    } catch {
        return [];
    }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const sampleIds = await getSampleGalleryIds();
    return [
        ...marketingPaths.map((path) => ({ url: `${siteUrl}${path}` })),
        ...sampleIds.map((id) => ({ url: `${siteUrl}/sample-galleries/${encodeURIComponent(id)}` })),
    ];
}
