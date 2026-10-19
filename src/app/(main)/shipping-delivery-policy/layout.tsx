import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Shipping and delivery policy",
    description: "EveBash's shipping and delivery policy.",
    alternates: { canonical: "/shipping-delivery-policy" },
    openGraph: { title: "Shipping and delivery policy · EveBash", description: "EveBash's shipping and delivery policy.", url: "/shipping-delivery-policy" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}
