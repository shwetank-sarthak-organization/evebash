import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Digital service delivery policy",
    description: "How EveBash delivers its digital service after purchase.",
    alternates: { canonical: "/digital-service-delivery-policy" },
    openGraph: { title: "Digital service delivery policy · EveBash", description: "How EveBash delivers its digital service after purchase.", url: "/digital-service-delivery-policy" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}
