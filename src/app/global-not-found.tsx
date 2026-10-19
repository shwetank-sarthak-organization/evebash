import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";
import { inter, playfair } from "./fonts";
import NotFoundContent from "@/components/NotFoundContent";

// Unknown addresses match no route group, so this page brings its own <html> (the site has several root layouts).
export const metadata: Metadata = {
    title: "Page not found · EveBash",
    robots: { index: false },
};

export default function GlobalNotFound() {
    return (
        <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
            <body className="antialiased font-sans bg-[var(--site-bg)]">
                <header className="flex justify-center px-4 pt-10">
                    <Link href="/" aria-label="EveBash home">
                        <Image src="/evebash-logo-gold.svg" alt="EveBash" width={56} height={56} priority />
                    </Link>
                </header>
                <main>
                    <NotFoundContent />
                </main>
            </body>
        </html>
    );
}
