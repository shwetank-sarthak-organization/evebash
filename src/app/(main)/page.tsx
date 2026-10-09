import type { Metadata } from "next";
import HomeHero from "@/components/home/HomeHero";
import HowItWorks from "@/components/home/HowItWorks";
import FindYouFeature from "@/components/home/FindYouFeature";
import GuestFeatures from "@/components/home/GuestFeatures";
import Audiences from "@/components/home/Audiences";
import PricingPreview from "@/components/home/PricingPreview";
import HomeFaq from "@/components/home/HomeFaq";
import FinalCta from "@/components/home/FinalCta";

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
            <FinalCta />
        </div>
    );
}
