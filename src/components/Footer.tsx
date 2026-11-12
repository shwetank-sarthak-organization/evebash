"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Facebook, Instagram, Linkedin, Mail, MapPin, Phone, Youtube } from "lucide-react";
import { playfair } from "@/app/fonts";
import { EveBashLogo } from "@/components/EveBashLogo";
import { cn } from "@/lib/utils";

// Add each account's URL when it's ready; until then the icon shows but isn't a link.
const socials: { label: string; icon: typeof Instagram; href?: string }[] = [
    { label: "Instagram", icon: Instagram },
    { label: "YouTube", icon: Youtube },
    { label: "Facebook", icon: Facebook },
    { label: "LinkedIn", icon: Linkedin },
];

const columns = [
    {
        title: "Product",
        links: [
            { label: "Find You", href: "/#find-you" },
            { label: "Album proofing", href: "/#album-proofing" },
            { label: "Gallery designs", href: "/#features" },
            { label: "Sample galleries", href: "/sample-galleries" },
            { label: "Pricing", href: "/pricing" },
        ],
    },
    {
        title: "Company",
        links: [
            { label: "EB Network", href: "/eb-network" },
            { label: "Contact us", href: "/contact-us" },
        ],
    },
    {
        title: "Legal",
        links: [
            { label: "Privacy policy", href: "/privacy-policy" },
            { label: "Terms and conditions", href: "/terms-and-conditions" },
            { label: "Cancellation and refund", href: "/cancellation-refund-policy" },
            { label: "Digital service delivery", href: "/digital-service-delivery-policy" },
        ],
    },
];

export default function Footer() {
    const pathname = usePathname();
    const isEventPage = pathname.startsWith("/events/");

    if (pathname === '/login') return null;

    // Guests on an event gallery get a light brand line instead of the marketing footer.
    if (isEventPage) {
        return (
            <footer
                className="event-footer border-t py-8"
                style={{
                    backgroundColor: "var(--event-template-primary)",
                    borderColor: "var(--event-template-border)",
                    color: "var(--event-template-muted)",
                }}
            >
                <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 text-sm sm:flex-row sm:px-6 lg:px-8">
                    <p>
                        Made with{" "}
                        <Link href="/" className="font-semibold underline-offset-4 hover:underline">EveBash</Link>
                        {" · "}
                        <Link href="/login?mode=signup" className="font-semibold underline-offset-4 hover:underline">Create your own event free</Link>
                    </p>
                    <div className="flex gap-5">
                        <Link href="/privacy-policy" className="underline-offset-4 hover:underline">Privacy</Link>
                        <Link href="/terms-and-conditions" className="underline-offset-4 hover:underline">Terms</Link>
                    </div>
                </div>
            </footer>
        );
    }

    return (
        <footer className="relative bg-[var(--site-bg)] pb-8 pt-10 text-[var(--site-muted)] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,rgba(220,181,121,0.45),transparent)]">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-2 gap-x-8 gap-y-12 md:grid-cols-4 lg:grid-cols-[1.5fr_0.9fr_0.8fr_1.1fr_1.4fr]">
                    {/* Brand, tagline and the main action */}
                    <div className="col-span-2 lg:col-span-1">
                        <Link href="/" className="group inline-flex h-10 items-center gap-3">
                            <span className="rounded-xl border border-[var(--site-brand-mark)]/35 bg-[var(--site-brand-mark)]/10 p-2 transition-colors group-hover:border-[var(--site-brand-mark)]/65">
                                <EveBashLogo className="h-6 w-6 text-[var(--site-brand-mark)]" aria-hidden="true" />
                            </span>
                            <span className="font-brand text-[1.75rem] leading-none tracking-wide text-[var(--site-text)] transition-colors group-hover:text-[var(--site-brand-mark)]">EveBash</span>
                        </Link>
                        <p className={cn(playfair.className, "mt-4 max-w-xs text-base leading-snug text-[var(--site-text)]")}>
                            One gallery for every moment of every event.
                        </p>
                        <div className="mt-5 flex gap-2.5">
                            {socials.map(({ label, icon: Icon, href }) => {
                                const className = "flex h-9 w-9 items-center justify-center rounded-full border border-[var(--site-brand-mark)]/30 text-[var(--site-brand-text)] transition-colors";
                                return href ? (
                                    <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={`EveBash on ${label}`} className={cn(className, "hover:border-[var(--site-brand-text)] hover:bg-[var(--site-brand-mark)]/10")}>
                                        <Icon className="h-4 w-4" aria-hidden />
                                    </a>
                                ) : (
                                    <span key={label} title={`${label} coming soon`} aria-label={`${label}, coming soon`} role="img" className={className}>
                                        <Icon className="h-4 w-4" aria-hidden />
                                    </span>
                                );
                            })}
                        </div>
                    </div>

                    {columns.map(({ title, links }) => (
                        <div key={title}>
                            <h3 className={cn(playfair.className, "flex h-10 items-center text-lg text-[var(--site-text)]")}>{title}</h3>
                            <ul className="mt-4 space-y-2.5 text-sm">
                                {links.map(({ label, href }) => (
                                    <li key={label}>
                                        <Link href={href} className="transition-colors hover:text-[var(--site-brand-text)]">{label}</Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}

                    {/* Contact */}
                    <div className="col-span-2 md:col-span-1">
                        <h3 className={cn(playfair.className, "flex h-10 items-center text-lg text-[var(--site-text)]")}>Contact</h3>
                        <div className="mt-4 space-y-3 text-sm">
                            <p className="flex items-start gap-2.5">
                                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--site-brand-mark)]" aria-hidden />
                                Dehradun, Uttarakhand, India 248001
                            </p>
                            <div className="flex items-start gap-2.5">
                                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[var(--site-brand-mark)]" aria-hidden />
                                <div className="space-y-1">
                                    <a href="tel:+919871264964" className="block whitespace-nowrap transition-colors hover:text-[var(--site-brand-text)]">+91 98712 64964</a>
                                    <a href="tel:+918535029872" className="block whitespace-nowrap transition-colors hover:text-[var(--site-brand-text)]">+91 85350 29872</a>
                                </div>
                            </div>
                            <p className="flex items-start gap-2.5">
                                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[var(--site-brand-mark)]" aria-hidden />
                                <a href="mailto:support@evebash.com" className="whitespace-nowrap transition-colors hover:text-[var(--site-brand-text)]">support@evebash.com</a>
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-[var(--site-border)] pt-6 text-sm md:flex-row">
                    <p>&copy; {new Date().getFullYear()} EveBash. All rights reserved.</p>
                    <p>Made in India</p>
                </div>
            </div>
        </footer>
    );
}
