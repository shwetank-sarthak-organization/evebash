import { Download, Heart, ScanFace } from "lucide-react";
import { displayFont } from "./HomeUI";
import { cn } from "@/lib/utils";

// Illustrative tiles until real (consented) gallery screenshots are available.
const tiles = [
    "linear-gradient(135deg, #8A4B3C, #D99A6C)",
    "linear-gradient(160deg, #2F4A3F, #7FA38C)",
    "linear-gradient(135deg, #B9775A, #F0C9A0)",
    "linear-gradient(200deg, #5B2F45, #C86F8A)",
    "linear-gradient(135deg, #CA9C68, #F3DDB8)",
    "linear-gradient(160deg, #3B3355, #8E7FB8)",
    "linear-gradient(135deg, #7A2E2E, #D4664F)",
    "linear-gradient(200deg, #2B3F57, #6E93B8)",
    "linear-gradient(135deg, #9C6B2F, #E2B76A)",
];

export default function GalleryPreview() {
    return (
        <div
            role="img"
            aria-label="Preview of an EveBash event gallery on a phone, with a Find You button and a photo grid"
            className="relative mx-auto w-full max-w-[290px] sm:max-w-[320px]"
        >
            <div className="rounded-[2.5rem] border border-[var(--site-border)] bg-[#0E1318] p-3 shadow-2xl shadow-black/50">
                <div className="overflow-hidden rounded-[2rem] bg-[var(--site-surface)]">
                    <div className="px-5 pb-4 pt-6">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-royal-gold">Wedding gallery</p>
                        <p className={cn(displayFont.className, "mt-1 text-xl font-semibold text-[var(--site-text)]")}>Your event</p>
                        <p className="mt-1 text-xs text-[var(--site-muted)]">Photos · Videos</p>
                        <div className="mt-4 flex items-center gap-2 rounded-full bg-royal-gold px-4 py-2 text-xs font-semibold text-[#13191F]">
                            <ScanFace className="h-4 w-4" aria-hidden />
                            Find your photos with a selfie
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1 px-1 pb-1">
                        {tiles.map((background, index) => (
                            <div key={index} className="aspect-square rounded-md" style={{ background }} />
                        ))}
                    </div>
                    <div className="flex items-center justify-between px-5 py-3 text-xs text-[var(--site-muted)]">
                        <span className="flex items-center gap-1.5"><Heart className="h-3.5 w-3.5" aria-hidden />Favourites</span>
                        <span className="flex items-center gap-1.5"><Download className="h-3.5 w-3.5" aria-hidden />Download all</span>
                    </div>
                </div>
            </div>

            <div className="absolute -bottom-5 left-2 flex items-center gap-3 rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface-2)] px-4 py-3 shadow-xl shadow-black/40 sm:-left-10">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-royal-gold/15 text-royal-gold">
                    <ScanFace className="h-5 w-5" aria-hidden />
                </div>
                <div className="text-left">
                    <p className="text-xs font-semibold text-[var(--site-text)]">Your photos are ready</p>
                    <p className="text-[11px] text-[var(--site-muted)]">Matched from one selfie</p>
                </div>
            </div>
        </div>
    );
}
