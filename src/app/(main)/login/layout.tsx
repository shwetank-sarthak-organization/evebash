import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Log in or sign up",
    description: "Log in to EveBash, or create a free account to set up your first event gallery.",
    alternates: { canonical: "/login" },
    openGraph: { title: "Log in or sign up · EveBash", description: "Log in to EveBash, or create a free account to set up your first event gallery.", url: "/login" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}
