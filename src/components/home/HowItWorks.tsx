import { CalendarPlus, QrCode, ScanFace } from "lucide-react";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeader } from "./HomeUI";

const steps = [
    {
        icon: CalendarPlus,
        title: "Create your event",
        text: "Sign up free, name your event and upload your photos and videos.",
    },
    {
        icon: QrCode,
        title: "Share one link or QR code",
        text: "Send the link on WhatsApp, or print the QR code for tables and the entrance.",
    },
    {
        icon: ScanFace,
        title: "Guests find their photos",
        text: "Each guest takes a selfie and sees the photos they appear in, ready to save.",
    },
];

export default function HowItWorks() {
    return (
        <section className="bg-[var(--site-surface)] py-16 md:py-24">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                <ScrollReveal>
                    <SectionHeader eyebrow="How it works" title="Three steps from camera to guests" />
                </ScrollReveal>

                <ol className="mt-12 grid gap-6 md:grid-cols-3">
                    {steps.map(({ icon: Icon, title, text }, index) => (
                        <li key={title}>
                            <ScrollReveal delay={index * 0.1} className="h-full">
                                <div className="h-full rounded-2xl border border-[var(--site-border)] bg-[var(--site-bg)] p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-royal-gold/15 text-royal-gold">
                                            <Icon className="h-5 w-5" aria-hidden />
                                        </div>
                                        <span className="text-sm font-semibold text-[var(--site-muted)]">Step {index + 1}</span>
                                    </div>
                                    <h3 className="mt-5 text-lg font-semibold text-[var(--site-text)]">{title}</h3>
                                    <p className="mt-2 leading-relaxed text-[var(--site-subtle)]">{text}</p>
                                </div>
                            </ScrollReveal>
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    );
}
