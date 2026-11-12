import { Check } from "lucide-react";
import { LazyFindYouVisual } from "./LazyDemos";
import { Reveal, SectionHeader } from "./HomeUI";

const points = [
    "Guests just need a free EveBash account",
    "Guests can still browse the full gallery",
    "Save one photo or download them all",
];

export default function FindYouFeature() {
    return (
        <section id="find-you" className="scroll-mt-20 bg-[var(--site-bg)] py-16 md:py-20">
            <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20 lg:px-8">
                <Reveal>
                    <SectionHeader
                        align="left"
                        title="Guests skip the scrolling. Their photos come to them."
                        description="A big event can mean thousands of photos: a wedding, a marathon, a three-day fest. With Find You, guests upload one selfie and see every photo they're in."
                    />
                    <ul className="mt-8 space-y-3">
                        {points.map((point) => (
                            <li key={point} className="flex items-start gap-3 text-[var(--site-subtle)]">
                                <Check className="mt-0.5 h-5 w-5 shrink-0 text-[var(--home-accent)]" aria-hidden />
                                {point}
                            </li>
                        ))}
                    </ul>
                </Reveal>

                {/* Visual on the left on large screens (sections alternate sides); text stays first on phones */}
                <div className="lg:order-first">
                    <LazyFindYouVisual />
                </div>
            </div>
        </section>
    );
}
