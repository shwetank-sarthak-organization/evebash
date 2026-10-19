import { cache } from "react";

export const siteUrl = "https://www.evebash.com";

export type SampleGallerySummary = {
    id: string;
    title: string | null;
    description: string | null;
    category: string | null;
    cover_image: string | null;
};

// Server-side list of sample galleries for metadata, the sitemap and first render. get_sample_galleries is readable
// by logged-out visitors (it keeps working once RLS lockdown part 2 is on); cached so crawls stay cheap.
export const getSampleGallerySummaries = cache(async (): Promise<SampleGallerySummary[]> => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) return [];

    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_sample_galleries`, {
            method: "POST",
            headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
            body: "{}",
            next: { revalidate: 3600 },
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return [];
        const rows = (await response.json()) as SampleGallerySummary[];
        return Array.isArray(rows) ? rows : [];
    } catch {
        return [];
    }
});

export async function getSampleGallerySummary(id: string): Promise<SampleGallerySummary | null> {
    const galleries = await getSampleGallerySummaries();
    return galleries.find((gallery) => gallery.id === id) ?? null;
}

// Serialises structured data for a <script type="application/ld+json">; escaping "<" keeps it from closing the tag.
export function jsonLd(data: unknown) {
    return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
