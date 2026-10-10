import type { MetadataRoute } from "next";
import { getSampleGallerySummaries, siteUrl } from "@/lib/seo";

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    // Sample gallery albums only; event galleries are never listed.
    const samples = await getSampleGallerySummaries();
    return [
        ...marketingPaths.map((path) => ({ url: `${siteUrl}${path}` })),
        ...samples.map(({ id }) => ({ url: `${siteUrl}/sample-galleries/${encodeURIComponent(id)}` })),
    ];
}
