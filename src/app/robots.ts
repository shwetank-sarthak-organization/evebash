import type { MetadataRoute } from "next";
import { headers } from "next/headers";

// Only the live site may be indexed; staging and preview hosts tell crawlers to stay out.
const PRODUCTION_HOSTS = new Set(["www.evebash.com", "evebash.com"]);

export default async function robots(): Promise<MetadataRoute.Robots> {
    const host = ((await headers()).get("host") || "").split(":")[0].toLowerCase();
    if (!PRODUCTION_HOSTS.has(host)) {
        return { rules: { userAgent: "*", disallow: "/" } };
    }
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            // Event galleries contain guests' photos; keep them out of search results.
            disallow: ["/api/", "/events/", "/dashboard", "/host", "/profile"],
        },
        sitemap: "https://www.evebash.com/sitemap.xml",
    };
}
