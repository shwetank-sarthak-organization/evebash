import { ArrowRight } from "lucide-react";
import GalleryPreview from "./GalleryPreview";
import { displayFont, Eyebrow, PrimaryButton, SecondaryButton } from "./HomeUI";
import { cn } from "@/lib/utils";

// No entrance animation here: the hero has to be readable on first paint.
export default function HomeHero() {
    return (
        <section className="relative overflow-hidden bg-[var(--site-bg)]">
            <div aria-hidden className="pointer-events-none absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-royal-gold/10 blur-3xl" />

            <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-12 sm:px-6 md:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:px-8 lg:pb-24 lg:pt-20">
                <div className="text-center lg:text-left">
                    <Eyebrow>Event media platform</Eyebrow>
                    <h1 className={cn(displayFont.className, "mt-4 text-4xl font-semibold leading-[1.1] text-[var(--site-text)] sm:text-5xl lg:text-6xl")}>
                        Deliver every event&apos;s memories, <span className="text-royal-gold">beautifully organized.</span>
                    </h1>
                    <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[var(--site-subtle)] sm:text-lg lg:mx-0">
                        Upload photos and videos, organize them into albums, and give clients and guests their own gallery to view, share and download.
                    </p>

                    <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                        <PrimaryButton href="/login?mode=signup">
                            Create your event free
                            <ArrowRight className="h-4 w-4" aria-hidden />
                        </PrimaryButton>
                        <SecondaryButton href="/sample-galleries">See a sample gallery</SecondaryButton>
                    </div>
                </div>

                <GalleryPreview />
            </div>
        </section>
    );
}
