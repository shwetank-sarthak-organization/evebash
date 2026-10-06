import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Privacy policy",
    description: "How EveBash collects, uses and protects your information.",
    alternates: { canonical: "/privacy-policy" },
    openGraph: { title: "Privacy policy · EveBash", description: "How EveBash collects, uses and protects your information.", url: "/privacy-policy" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}
