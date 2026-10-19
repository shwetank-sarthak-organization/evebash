import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "EB Network",
    description: "Find trusted event vendors, all in one place. EB Network is coming soon to EveBash.",
    // Coming soon: kept out of search results until the directory opens.
    robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}
