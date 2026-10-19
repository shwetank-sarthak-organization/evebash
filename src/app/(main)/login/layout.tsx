import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Log in or sign up",
    description: "Log in to EveBash, or create a free account to set up your first event gallery.",
    // A form, not content: kept out of search results, but its links are still followed.
    robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}
