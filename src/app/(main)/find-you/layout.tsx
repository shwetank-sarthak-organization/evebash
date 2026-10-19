import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Find your photos",
    description: "Upload a selfie to find the event photos you appear in.",
    robots: { index: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}
