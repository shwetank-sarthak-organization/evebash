import type { Metadata } from "next";
import HomeHero from "@/components/home/HomeHero";
import HowItWorks from "@/components/home/HowItWorks";
import FindYouFeature from "@/components/home/FindYouFeature";
import GuestFeatures from "@/components/home/GuestFeatures";
import Audiences from "@/components/home/Audiences";
import PricingPreview from "@/components/home/PricingPreview";
import HomeFaq, { faqs } from "@/components/home/HomeFaq";
import FinalCta from "@/components/home/FinalCta";
import { jsonLd } from "@/lib/seo";

const title = "EveBash | Event media platform for photographers and organizers";
const description =
    "Upload an event's photos and videos, organize them into albums, and share one gallery where clients and guests view, find and download their memories.";

export const metadata: Metadata = {
    title: { absolute: title },
    description,
    alternates: { canonical: "/" },
    openGraph: { title, description, type: "website", siteName: "EveBash", url: "/" },
    twitter: { card: "summary_large_image", title, description },
};

// The FAQ section's questions, as structured data.
const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
    })),
};

export default function Home() {
    return (
        <div className="flex flex-col bg-[var(--site-bg)] font-sans text-[var(--site-text)] selection:bg-royal-gold/30">
            <HomeHero />
            <HowItWorks />
            <FindYouFeature />
            <GuestFeatures />
            <Audiences />
            <PricingPreview />
            <HomeFaq />
            <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(faqJsonLd)} />
            <FinalCta />
        </div>
    );
}
