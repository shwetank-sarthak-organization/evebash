import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Terms and conditions",
    description: "The terms for using EveBash.",
    alternates: { canonical: "/terms-and-conditions" },
    openGraph: { title: "Terms and conditions · EveBash", description: "The terms for using EveBash.", url: "/terms-and-conditions" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}
