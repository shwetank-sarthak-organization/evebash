import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Cancellation and refund policy",
    description: "EveBash's cancellation and refund policy for paid plans.",
    alternates: { canonical: "/cancellation-refund-policy" },
    openGraph: { title: "Cancellation and refund policy · EveBash", description: "EveBash's cancellation and refund policy for paid plans.", url: "/cancellation-refund-policy" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}
