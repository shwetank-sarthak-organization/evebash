import FinalCtaDemo from "./FinalCtaDemo";
import { displayFont, PrimaryButton, Reveal, SecondaryButton } from "./HomeUI";
import { cn } from "@/lib/utils";

export default function FinalCta() {
    return (
        <section className="relative overflow-hidden bg-[var(--site-surface)] py-16 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,rgba(220,181,121,0.45),transparent)] md:py-20">
            <div aria-hidden className="pointer-events-none absolute left-[-10%] top-1/2 h-[480px] w-[480px] -translate-y-1/2 rounded-full bg-[#DCB579]/10 blur-3xl" />
            <Reveal>
                <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:px-8">
                    <div>
                        <h2 className={cn(displayFont.className, "home-gold-text pb-1 text-[2rem] font-semibold leading-[1.05] tracking-[-0.015em] md:text-[3.25rem]")}>
                            Your next event deserves better than a Drive link or a WhatsApp group.
                        </h2>
                        <p className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--site-subtle)]">
                            No more chasing links, access requests or blurry forwards. One gallery link for every guest, in full quality.
                        </p>
                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <PrimaryButton href="/login?mode=signup" className="px-7 py-3.5 text-base">
                                Create event for free
                            </PrimaryButton>
                            <SecondaryButton href="/contact-us" className="px-7 py-3.5 text-base">Talk to us</SecondaryButton>
                        </div>
                    </div>

                    <FinalCtaDemo />
                </div>
            </Reveal>
        </section>
    );
}
