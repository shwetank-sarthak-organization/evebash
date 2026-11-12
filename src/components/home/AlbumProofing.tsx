import { LazyAlbumDemo } from "./LazyDemos";
import { Reveal, SectionHeader } from "./HomeUI";

export default function AlbumProofing() {
    return (
        <section id="album-proofing" className="relative scroll-mt-20 bg-[var(--site-surface)] py-16 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,rgba(220,181,121,0.45),transparent)] md:py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <Reveal>
                    <SectionHeader
                        title="Album proofing without the WhatsApp back-and-forth"
                        description="Picking album photos takes minutes, not weeks of messages. Photographer and client review every page together, live in the app."
                    />
                </Reveal>
                <Reveal className="mt-10">
                    <LazyAlbumDemo />
                </Reveal>
            </div>
        </section>
    );
}
