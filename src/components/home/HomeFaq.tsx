import { ChevronDown } from "lucide-react";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeader } from "./HomeUI";

const faqs = [
    {
        question: "Do guests need to install an app?",
        answer: "No. Guests open the gallery link, or scan the QR code, in their phone's browser.",
    },
    {
        question: "How does Find You work?",
        answer: "A guest uploads a selfie, and EveBash matches it against the event's photos to show the ones they appear in.",
    },
    {
        question: "Can guests download photos?",
        answer: "Yes. They can save photos one at a time, or download the whole gallery with Download All.",
    },
    {
        question: "Can I upload videos?",
        answer: "Yes. Videos play inside the gallery. On the free plan, each video can be up to 200 MB.",
    },
    {
        question: "Is there a free plan?",
        answer: "Yes. One event and 1 GB of storage, free forever. Paid plans start at ₹150 a month.",
    },
];

export default function HomeFaq() {
    return (
        <section className="bg-[var(--site-bg)] py-16 md:py-24">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
                <ScrollReveal>
                    <SectionHeader eyebrow="FAQ" title="Questions, answered" />
                </ScrollReveal>

                <div className="mt-10 divide-y divide-[var(--site-border)] border-y border-[var(--site-border)]">
                    {faqs.map(({ question, answer }) => (
                        <details key={question} className="group py-5">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md text-left font-semibold text-[var(--site-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-gold [&::-webkit-details-marker]:hidden">
                                {question}
                                <ChevronDown className="h-5 w-5 shrink-0 text-royal-gold transition-transform group-open:rotate-180" aria-hidden />
                            </summary>
                            <p className="mt-3 leading-relaxed text-[var(--site-subtle)]">{answer}</p>
                        </details>
                    ))}
                </div>
            </div>
        </section>
    );
}
