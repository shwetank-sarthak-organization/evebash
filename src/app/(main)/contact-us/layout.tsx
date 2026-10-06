import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Contact us",
    description: "Questions about EveBash, pricing or setting up your event? Get in touch with the EveBash team in Dehradun.",
    alternates: { canonical: "/contact-us" },
    openGraph: { title: "Contact us · EveBash", description: "Questions about EveBash, pricing or setting up your event? Get in touch with the EveBash team in Dehradun.", url: "/contact-us" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}
