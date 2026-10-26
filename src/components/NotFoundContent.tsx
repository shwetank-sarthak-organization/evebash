import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { displayFont, PrimaryButton, SecondaryButton } from "@/components/home/HomeUI";
import { cn } from "@/lib/utils";

const helpfulLinks = [
    { href: "/sample-galleries", label: "Sample galleries" },
    { href: "/pricing", label: "Pricing" },
    { href: "/contact-us", label: "Contact us" },
];

// Shared by the 404 inside the site layout and the global 404 for unknown addresses.
export default function NotFoundContent() {
    return (
        <section className="flex min-h-[70vh] items-center justify-center bg-[var(--site-bg)] px-4 py-24 text-center font-sans text-[var(--site-text)] sm:px-6">
            <div className="max-w-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-royal-gold">Error 404</p>
                <h1 className={cn(displayFont.className, "mt-4 text-4xl font-semibold leading-tight sm:text-5xl")}>
                    We couldn&apos;t find that page
                </h1>
                <p className="mt-4 text-base leading-relaxed text-[var(--site-subtle)] md:text-lg">
                    The link may be old or mistyped. If you were opening an event gallery, ask the host to share its link or QR code again.
                </p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                    <PrimaryButton href="/">
                        Go to the homepage
                        <ArrowRight className="h-4 w-4" aria-hidden />
                    </PrimaryButton>
                    {/* Find You searches one event, so it starts from the event page; the dashboard lists the user's events */}
                    <SecondaryButton href="/dashboard">Go to my events</SecondaryButton>
                </div>
                <nav aria-label="Helpful links" className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
                    {helpfulLinks.map(({ href, label }) => (
                        <Link key={href} href={href} className="text-[var(--site-muted)] transition-colors hover:text-royal-gold">
                            {label}
                        </Link>
                    ))}
                </nav>
            </div>
        </section>
    );
}
