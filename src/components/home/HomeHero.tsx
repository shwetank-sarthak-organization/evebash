import { BookOpen, ScanFace, Sparkles } from "lucide-react";
import HeroShowcase from "./HeroShowcase";
import { displayFont, PrimaryButton, SecondaryButton } from "./HomeUI";
import { cn } from "@/lib/utils";

const highlights = [
    { icon: Sparkles, label: "Free for your first event" },
    { icon: ScanFace, label: "Find You face search" },
    { icon: BookOpen, label: "Album proofing" },
];

// No entrance animation on the text: the headline has to be readable on first paint.
export default function HomeHero() {
    return (
        <section className="relative overflow-hidden bg-[var(--site-bg)]">
            <div aria-hidden className="home-bokeh pointer-events-none absolute inset-0" />

            <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-10 sm:px-6 md:pt-14 lg:grid-cols-[1fr_1.1fr] lg:gap-16 lg:px-8 lg:pb-20 lg:pt-12">
                <div>
                    <h1 className={cn(displayFont.className, "home-gold-text pb-1 text-[2.5rem] font-semibold leading-[1.02] tracking-[-0.02em] sm:text-[3.375rem] lg:text-[4rem]")}>
                        One gallery for every moment of every event.
                    </h1>
                    <p className="mt-6 max-w-lg text-lg leading-relaxed text-[var(--site-subtle)]">
                        Share photos and videos from weddings, college fests, sports days and corporate events in a gallery that fits the occasion. Guests find their own photos with one selfie.
                    </p>

                    <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                        <PrimaryButton href="/login?mode=signup" className="px-7 py-3.5 text-base">
                            Create event for free
                        </PrimaryButton>
                        <SecondaryButton href="/sample-galleries" className="px-7 py-3.5 text-base">See a sample gallery</SecondaryButton>
                    </div>

                    <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-[var(--site-muted)]">
                        {highlights.map(({ icon: Icon, label }) => (
                            <li key={label} className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-[var(--home-accent)]" aria-hidden />
                                {label}
                            </li>
                        ))}
                    </ul>
                </div>

                <HeroShowcase />
            </div>
        </section>
    );
}
