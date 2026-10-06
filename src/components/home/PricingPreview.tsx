import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { displayFont, SecondaryButton, SectionHeader } from "./HomeUI";
import { cn } from "@/lib/utils";

// Mirrors the Free and Starter plans on /pricing; update both together.
export default function PricingPreview() {
    return (
        <section className="bg-[var(--site-surface)] py-16 md:py-24">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                <ScrollReveal>
                    <SectionHeader eyebrow="Pricing" title="Start free. Upgrade when you need more." />
                </ScrollReveal>

                <ScrollReveal delay={0.1}>
                    <div className="mx-auto mt-12 grid max-w-3xl gap-6 md:grid-cols-2">
                        <div className="rounded-2xl border border-[var(--site-border)] bg-[var(--site-bg)] p-6 md:p-8">
                            <p className="text-sm font-semibold text-[var(--site-muted)]">Free</p>
                            <p className={cn(displayFont.className, "mt-2 text-4xl font-semibold text-[var(--site-text)]")}>₹0</p>
                            <p className="mt-1 text-sm text-[var(--site-muted)]">forever</p>
                            <p className="mt-5 leading-relaxed text-[var(--site-subtle)]">1 event and 1 GB of storage, with photos and videos up to 200 MB.</p>
                        </div>
                        <div className="rounded-2xl border border-royal-gold/40 bg-[var(--site-bg)] p-6 md:p-8">
                            <p className="text-sm font-semibold text-royal-gold">Paid plans</p>
                            <p className={cn(displayFont.className, "mt-2 text-4xl font-semibold text-[var(--site-text)]")}>
                                ₹150<span className="font-sans text-base font-normal text-[var(--site-muted)]"> / month</span>
                            </p>
                            <p className="mt-1 text-sm text-[var(--site-muted)]">starting from</p>
                            <p className="mt-5 leading-relaxed text-[var(--site-subtle)]">More events and storage as you grow, up to 1,000 events and 1 TB.</p>
                        </div>
                    </div>
                    <div className="mt-8 flex justify-center">
                        <SecondaryButton href="/pricing">
                            See all plans
                            <ArrowRight className="h-4 w-4" aria-hidden />
                        </SecondaryButton>
                    </div>
                </ScrollReveal>

                <ScrollReveal delay={0.1}>
                    <div className="mx-auto mt-16 flex max-w-3xl flex-col items-center gap-4 rounded-2xl border border-[var(--site-border)] bg-[var(--site-bg)] p-6 text-center md:flex-row md:justify-between md:p-8 md:text-left">
                        <div>
                            <h3 className="text-lg font-semibold text-[var(--site-text)]">See it before you sign up</h3>
                            <p className="mt-1 text-[var(--site-subtle)]">Open a sample gallery and try it the way a guest would.</p>
                        </div>
                        <Link
                            href="/sample-galleries"
                            className="inline-flex shrink-0 items-center gap-2 rounded-full py-2 text-sm font-semibold text-royal-gold hover:text-[#D9AE7E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-gold"
                        >
                            Browse sample galleries
                            <ArrowRight className="h-4 w-4" aria-hidden />
                        </Link>
                    </div>
                </ScrollReveal>
            </div>
        </section>
    );
}
