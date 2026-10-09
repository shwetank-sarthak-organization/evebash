import { ArrowRight, Check, ScanFace } from "lucide-react";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeader } from "./HomeUI";

const matches = [
    "linear-gradient(135deg, #B9775A, #F0C9A0)",
    "linear-gradient(160deg, #5B2F45, #C86F8A)",
    "linear-gradient(135deg, #9C6B2F, #E2B76A)",
    "linear-gradient(200deg, #2F4A3F, #7FA38C)",
];

const points = [
    "Works on the web and in the EveBash app for Android and iOS",
    "Guests can still browse the full gallery",
    "Save one photo or download them all",
];

export default function FindYouFeature() {
    return (
        <section className="bg-[var(--site-bg)] py-16 md:py-24">
            <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
                <ScrollReveal>
                    <SectionHeader
                        align="left"
                        eyebrow="Find You"
                        title={<>Guests skip the scrolling. <span className="text-royal-gold">Their photos come to them.</span></>}
                        description="A big event can mean thousands of photos. With Find You, a guest uploads one selfie and EveBash shows the photos they appear in."
                    />
                    <ul className="mt-8 space-y-3">
                        {points.map((point) => (
                            <li key={point} className="flex items-start gap-3 text-[var(--site-subtle)]">
                                <Check className="mt-0.5 h-5 w-5 shrink-0 text-royal-gold" aria-hidden />
                                {point}
                            </li>
                        ))}
                    </ul>
                </ScrollReveal>

                <ScrollReveal delay={0.1}>
                    <div
                        role="img"
                        aria-label="A selfie matched to four event photos"
                        className="flex flex-col items-center gap-6 rounded-3xl border border-[var(--site-border)] bg-[var(--site-surface)] p-6 sm:flex-row sm:p-8"
                    >
                        <div className="flex shrink-0 flex-col items-center gap-3">
                            <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-royal-gold/60 bg-royal-gold/10 text-royal-gold">
                                <ScanFace className="h-10 w-10" aria-hidden />
                            </div>
                            <span className="text-sm font-semibold text-[var(--site-text)]">One selfie</span>
                        </div>
                        <ArrowRight className="h-6 w-6 rotate-90 text-royal-gold sm:rotate-0" aria-hidden />
                        <div className="w-full">
                            <div className="grid grid-cols-2 gap-2">
                                {matches.map((background, index) => (
                                    <div key={index} className="aspect-[4/3] rounded-lg" style={{ background }} />
                                ))}
                            </div>
                            <p className="mt-3 text-center text-sm font-semibold text-[var(--site-text)] sm:text-left">Every photo you&apos;re in</p>
                        </div>
                    </div>
                </ScrollReveal>
            </div>
        </section>
    );
}
