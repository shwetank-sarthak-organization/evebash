import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Sample galleries",
    description: "Open a real EveBash event gallery and try it the way your guests will: browse, find your photos with a selfie, and download.",
    alternates: { canonical: "/sample-galleries" },
    openGraph: { title: "Sample galleries · EveBash", description: "Open a real EveBash event gallery and try it the way your guests will: browse, find your photos with a selfie, and download.", url: "/sample-galleries" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}
