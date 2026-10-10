import type { Metadata } from "next";
import { defaultPricingPlans, type PricingPlan } from "@/lib/pricingPlans";
import { jsonLd, siteUrl } from "@/lib/seo";

export const metadata: Metadata = {
    title: "Pricing",
    description: "Start free with one event. Paid plans from ₹150 a month add more events and storage. Every plan includes Find You and Download All.",
    alternates: { canonical: "/pricing" },
    openGraph: { title: "Pricing · EveBash", description: "Start free with one event. Paid plans from ₹150 a month add more events and storage. Every plan includes Find You and Download All.", url: "/pricing" },
};

// Same plans the page shows (backend, else the built-in defaults), refreshed hourly for the structured data.
async function getActivePlans(): Promise<PricingPlan[]> {
    const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
    let plans = defaultPricingPlans;
    if (apiBaseUrl) {
        try {
            const response = await fetch(`${apiBaseUrl}/api/v1/pricing-plans`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(5000) });
            const payload = await response.json().catch(() => null);
            if (response.ok && Array.isArray(payload?.plans)) plans = payload.plans;
        } catch {
            // keep the defaults
        }
    }
    return plans.filter((plan) => plan.active).sort((a, b) => a.displayOrder - b.displayOrder);
}

export default async function Layout({ children }: { children: React.ReactNode }) {
    const plans = await getActivePlans();
    const appJsonLd = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "EveBash",
        url: siteUrl,
        applicationCategory: "PhotographyApplication",
        operatingSystem: "Web, Android, iOS",
        description: "Event photo sharing with selfie search: share one link or QR code, and every guest finds their photos with a selfie.",
        publisher: { "@id": `${siteUrl}/#organization` },
        offers: plans.map((plan) => ({
            "@type": "Offer",
            name: `${plan.name} plan`,
            description: `${plan.events} event${plan.events === 1 ? "" : "s"}, ${plan.storageLabel} storage`,
            price: plan.monthlyPrice,
            priceCurrency: "INR",
            url: `${siteUrl}/pricing`,
            ...(plan.monthlyPrice > 0 && {
                priceSpecification: {
                    "@type": "UnitPriceSpecification",
                    price: plan.monthlyPrice,
                    priceCurrency: "INR",
                    referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
                },
            }),
        })),
    };

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(appJsonLd)} />
            {children}
        </>
    );
}
