import { Download, FolderTree, Heart, Images, LayoutTemplate, LockKeyhole, QrCode, ScanFace, Smartphone } from "lucide-react";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeader } from "./HomeUI";

const features = [
    { icon: Images, title: "Photos and videos", text: "Upload both. Videos play right inside the gallery." },
    { icon: FolderTree, title: "Albums and categories", text: "Organize each event into albums, so every ceremony has its own place." },
    { icon: LockKeyhole, title: "Access control", text: "Decide who sees each event: an open gallery, or one only invited guests can view." },
    { icon: QrCode, title: "Link or QR code", text: "Share it in a message, or print it for the venue." },
    { icon: ScanFace, title: "Find You", text: "Guests upload a selfie and see the photos they appear in." },
    { icon: Download, title: "Download all", text: "Clients and guests save a single photo or the whole gallery in one go." },
    { icon: Heart, title: "Favourites, likes and comments", text: "Guests mark the shots they love and leave a note." },
    { icon: LayoutTemplate, title: "Gallery designs", text: "Pick a template that matches the feel of your event." },
    { icon: Smartphone, title: "Web, Android and iOS", text: "Open galleries in any browser, or in the EveBash app on Android and iOS." },
];

export default function GuestFeatures() {
    return (
        <section className="bg-[var(--site-surface)] py-16 md:py-24">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                <ScrollReveal>
                    <SectionHeader
                        eyebrow="The platform"
                        title="Everything an event's photos and videos need"
                        description="Upload, organize, share and download, all in one place."
                    />
                </ScrollReveal>

                <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {features.map(({ icon: Icon, title, text }, index) => (
                        <li key={title}>
                            <ScrollReveal delay={(index % 3) * 0.08} className="h-full">
                                <div className="flex h-full gap-4 rounded-2xl border border-[var(--site-border)] bg-[var(--site-bg)] p-5">
                                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-royal-gold" aria-hidden />
                                    <div>
                                        <h3 className="font-semibold text-[var(--site-text)]">{title}</h3>
                                        <p className="mt-1 text-sm leading-relaxed text-[var(--site-subtle)]">{text}</p>
                                    </div>
                                </div>
                            </ScrollReveal>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
