import { Camera, CalendarCheck, Check, Users } from "lucide-react";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { displayFont, PrimaryButton, SecondaryButton, SectionHeader } from "./HomeUI";
import { cn } from "@/lib/utils";

const audiences = [
    {
        icon: Camera,
        label: "For photographers",
        title: "Deliver galleries your clients will love",
        points: [
            "Upload photos and videos straight after the shoot",
            "Organize every event into albums",
            "Plans from 10 GB to 1 TB as your work grows",
        ],
        cta: { href: "/pricing", label: "Compare plans", primary: false },
    },
    {
        icon: CalendarCheck,
        label: "For event organizers",
        title: "Every photo from your event, in one place",
        points: [
            "One gallery for the whole event",
            "Share it with every guest by link or QR code",
            "Choose who can view each event",
        ],
        cta: { href: "/login?mode=signup", label: "Create an event", primary: true },
    },
    {
        icon: Users,
        label: "For guests and clients",
        title: "Your memories, ready when you are",
        points: [
            "Open the gallery on the web or in the app",
            "Find your own photos with a selfie",
            "Share and download in full quality",
        ],
        cta: { href: "/sample-galleries", label: "See a sample gallery", primary: false },
    },
];

export default function Audiences() {
    return (
        <section className="bg-[var(--site-bg)] py-16 md:py-24">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                <ScrollReveal>
                    <SectionHeader eyebrow="Who it's for" title="One platform for everyone at the event" />
                </ScrollReveal>

                <div className="mt-12 grid gap-6 lg:grid-cols-3">
                    {audiences.map(({ icon: Icon, label, title, points, cta }, index) => {
                        const Button = cta.primary ? PrimaryButton : SecondaryButton;
                        return (
                            <ScrollReveal key={label} delay={index * 0.1} className="h-full">
                                <div className="flex h-full flex-col rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-6 md:p-8">
                                    <div className="flex items-center gap-3 text-royal-gold">
                                        <Icon className="h-5 w-5" aria-hidden />
                                        <p className="text-sm font-semibold">{label}</p>
                                    </div>
                                    <h3 className={cn(displayFont.className, "mt-4 text-2xl font-semibold leading-snug text-[var(--site-text)]")}>{title}</h3>
                                    <ul className="mt-6 flex-1 space-y-3">
                                        {points.map((point) => (
                                            <li key={point} className="flex items-start gap-3 text-[var(--site-subtle)]">
                                                <Check className="mt-0.5 h-5 w-5 shrink-0 text-royal-gold" aria-hidden />
                                                {point}
                                            </li>
                                        ))}
                                    </ul>
                                    <Button href={cta.href} className="mt-8 self-start">{cta.label}</Button>
                                </div>
                            </ScrollReveal>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
