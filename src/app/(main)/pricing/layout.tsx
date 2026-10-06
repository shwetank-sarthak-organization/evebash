import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Pricing",
    description: "Start free with one event. Paid plans from ₹150 a month add more events and storage. Every plan includes Find You and Download All.",
    alternates: { canonical: "/pricing" },
    openGraph: { title: "Pricing · EveBash", description: "Start free with one event. Paid plans from ₹150 a month add more events and storage. Every plan includes Find You and Download All.", url: "/pricing" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}
