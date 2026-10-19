import { ArrowRight } from "lucide-react";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { displayFont, PrimaryButton, SecondaryButton } from "./HomeUI";
import { cn } from "@/lib/utils";

export default function FinalCta() {
    return (
        <section className="bg-[var(--site-bg)] px-4 pb-20 sm:px-6 md:pb-28 lg:px-8">
            <ScrollReveal>
                <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-royal-gold/30 bg-[var(--site-surface)] px-6 py-14 text-center md:px-12 md:py-16">
                    <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-royal-gold/15 blur-3xl" />
                    <div className="relative">
                        <h2 className={cn(displayFont.className, "text-3xl font-semibold leading-tight text-[var(--site-text)] md:text-4xl")}>
                            Ready to deliver your next event?
                        </h2>
                        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[var(--site-subtle)] md:text-lg">
                            Set up your event, upload your photos and videos, and share them with your clients and guests.
                        </p>
                        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                            <PrimaryButton href="/login?mode=signup">
                                Create your event free
                                <ArrowRight className="h-4 w-4" aria-hidden />
                            </PrimaryButton>
                            <SecondaryButton href="/contact-us">Talk to us</SecondaryButton>
                        </div>
                    </div>
                </div>
            </ScrollReveal>
        </section>
    );
}
