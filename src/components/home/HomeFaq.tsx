import { ChevronDown } from "lucide-react";
import { Reveal, SectionHeader } from "./HomeUI";

export const faqs = [
    {
        question: "What is EveBash?",
        answer: "An event media platform. Photographers and event organizers upload an event's photos and videos, organize them into albums, and share one gallery where clients and guests view, find and download their memories.",
    },
    {
        question: "What kinds of events is EveBash for?",
        answer: "Any event with photos and videos: weddings, birthdays, college fests, sports days, corporate events and more. Each gallery can use a design that fits the occasion.",
    },
    {
        question: "Is there a mobile app?",
        answer: "The EveBash app for Android and iOS is coming soon. Until then, everything works in the browser: guests open a gallery link or scan its QR code on any phone or computer.",
    },
    {
        question: "How does Find You work?",
        answer: "A guest logs in to their free EveBash account, uploads a selfie, and EveBash matches it against the event's photos to show the ones they appear in. Only guests with access to the gallery can use it.",
    },
    {
        question: "How does album proofing work?",
        answer: "The photographer uploads the album's page designs. The client reviews each page in EveBash, pins comments on photos, replies or leaves a voice note, and approves pages one by one. Once every page is approved, the album is locked for printing.",
    },
    {
        question: "Can guests download photos?",
        answer: "Yes. They can save photos one at a time, or download the whole gallery with Download All.",
    },
    {
        question: "Who can see my gallery?",
        answer: "You decide for each event: an open gallery anyone with the link can view, or one that only invited guests can see.",
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
        <section className="bg-[var(--site-bg)] py-16 md:py-20">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
                <Reveal>
                    <SectionHeader title="Questions, answered" />
                </Reveal>

                <div className="mt-10 divide-y divide-[var(--site-border)] border-y border-[var(--site-border)]">
                    {faqs.map(({ question, answer }) => (
                        <details key={question} className="group py-5">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md text-left font-semibold text-[var(--site-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-accent)] [&::-webkit-details-marker]:hidden">
                                {question}
                                <ChevronDown className="h-5 w-5 shrink-0 text-[var(--home-accent)] transition-transform group-open:rotate-180" aria-hidden />
                            </summary>
                            <p className="mt-3 leading-relaxed text-[var(--site-subtle)]">{answer}</p>
                        </details>
                    ))}
                </div>
            </div>
        </section>
    );
}
