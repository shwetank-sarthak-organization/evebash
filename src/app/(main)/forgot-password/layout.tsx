import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Forgot password",
    description: "Reset your EveBash password.",
    robots: { index: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}
