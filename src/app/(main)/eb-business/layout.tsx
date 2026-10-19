import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "EB Business",
    description: "Set up your business on EveBash, whether you're a photographer, venue, caterer or decorator, and get listed on EB Network.",
    // Coming soon with EB Network: kept out of search results until it opens.
    robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}
