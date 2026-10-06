import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Delete account",
    description: "How to delete your EveBash account.",
    robots: { index: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}
