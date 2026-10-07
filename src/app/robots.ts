import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
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
