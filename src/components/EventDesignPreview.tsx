import { ChevronDown } from "lucide-react";
import { getWebTemplateChrome } from "@/lib/webTemplateTheme";

interface EventDesignPreviewProps {
    eventId: string;
    title: string;
    eventType?: string;
    dateLabel?: string;
    coverUrl: string;
    galleryNames: string[];
    templateId?: string;
}

// Sketch of the guest home page on a phone and a computer, drawn with the template's own colours
// (the same palette the guest page uses). Plain markup only: no iframe, and the cover is the
// image the host page has already loaded.
export function EventDesignPreview({ eventId, title, eventType, dateLabel, coverUrl, galleryNames, templateId }: EventDesignPreviewProps) {
    const chrome = getWebTemplateChrome(templateId);
    const kicker = eventType ? `${eventType} gallery` : "Event gallery";
    const shownTitle = title || "Your event";
    const phoneTabs = ["Home", ...galleryNames.slice(0, 2), "Find You"];

    const coverLayer = (
        <>
            <img src={coverUrl} alt="" draggable={false} loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-50" />
            <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, transparent 35%, ${chrome.background})` }} />
        </>
    );

    return (
        <div aria-hidden="true" className="pointer-events-none grid select-none items-center gap-6 md:grid-cols-12">
            {/* Phone (app) */}
            <div className="flex justify-center md:col-span-4">
                <div className="relative w-[210px] shrink-0 rounded-[2.4rem] border border-white/15 bg-[#050505] p-[7px] shadow-2xl shadow-black/60">
                    <div className="relative h-[420px] overflow-hidden rounded-[2rem]" style={{ backgroundColor: chrome.background, color: chrome.text }}>
                        <div className="absolute left-1/2 top-2 z-20 h-[18px] w-[68px] -translate-x-1/2 rounded-full bg-black" />

                        <div className="relative h-[230px] overflow-hidden">
                            {coverLayer}
                            <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-3 text-center">
                                <p className="truncate text-[8px] font-black uppercase tracking-[0.28em]" style={{ color: chrome.accent }}>{kicker}</p>
                                <p className="mt-1.5 line-clamp-2 break-words font-serif text-[19px] font-bold leading-[1.15]">{shownTitle}</p>
                                {dateLabel && <p className="mt-1.5 truncate text-[8px] font-bold uppercase tracking-[0.2em]" style={{ color: chrome.muted }}>{dateLabel}</p>}
                            </div>
                        </div>

                        <div className="flex gap-1.5 overflow-hidden whitespace-nowrap px-3 pt-2">
                            {phoneTabs.map((tab, index) => (
                                <span
                                    key={`${tab}-${index}`}
                                    className="max-w-[78px] shrink-0 truncate rounded-full border px-2.5 py-1 text-[8px] font-bold"
                                    style={index === 0
                                        ? { backgroundColor: chrome.accent, borderColor: chrome.accent, color: chrome.onAccent }
                                        : { borderColor: chrome.border, color: chrome.muted }}
                                >
                                    {tab}
                                </span>
                            ))}
                        </div>

                        <div className="grid grid-cols-3 gap-1 px-3 pt-3">
                            {Array.from({ length: 6 }).map((_, index) => (
                                <div key={index} className="aspect-square rounded-[4px]" style={{ backgroundColor: chrome.panel, border: `1px solid ${chrome.border}` }} />
                            ))}
                        </div>

                        <div className="absolute bottom-1.5 left-1/2 h-1 w-20 -translate-x-1/2 rounded-full" style={{ backgroundColor: chrome.text, opacity: 0.35 }} />
                    </div>
                </div>
            </div>

            {/* Browser (website) */}
            <div className="min-w-0 md:col-span-8">
                <div className="overflow-hidden rounded-xl border border-white/10 bg-[#1c1c1f] shadow-2xl shadow-black/60">
                    <div className="flex items-center gap-3 border-b border-white/5 px-3 py-2">
                        <div className="flex shrink-0 gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                        </div>
                        <div className="min-w-0 flex-1 truncate rounded-md bg-black/40 px-3 py-1 text-center text-[10px] font-medium text-slate-400">
                            evebash.com/events/{eventId}
                        </div>
                        <div className="w-[42px] shrink-0" />
                    </div>

                    <div style={{ backgroundColor: chrome.background, color: chrome.text }}>
                        <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5" style={{ borderColor: chrome.border }}>
                            <p className="min-w-0 truncate font-serif text-xs font-bold">{shownTitle}</p>
                            <div className="flex shrink-0 items-center gap-1.5 text-[9px] font-bold">
                                <span className="rounded-full px-2.5 py-1" style={{ backgroundColor: chrome.accent, color: chrome.onAccent }}>Home</span>
                                {galleryNames.length > 0 && (
                                    <span className="hidden items-center gap-0.5 px-1.5 py-1 sm:flex" style={{ color: chrome.muted }}>
                                        Collections <ChevronDown className="h-2.5 w-2.5" />
                                    </span>
                                )}
                                <span className="px-1.5 py-1" style={{ color: chrome.muted }}>Find You</span>
                            </div>
                        </div>

                        <div className="relative flex h-[230px] items-end justify-center overflow-hidden sm:h-[260px]">
                            {coverLayer}
                            <div className="relative z-10 max-w-[80%] px-4 pb-6 text-center">
                                <p className="truncate text-[9px] font-black uppercase tracking-[0.3em]" style={{ color: chrome.accent }}>{kicker}</p>
                                <p className="mt-2 line-clamp-2 break-words font-serif text-2xl font-bold leading-[1.15] sm:text-3xl">{shownTitle}</p>
                                {dateLabel && <p className="mt-2 truncate text-[9px] font-bold uppercase tracking-[0.25em]" style={{ color: chrome.muted }}>{dateLabel}</p>}
                                <span className="mt-4 inline-block rounded-full px-5 py-1.5 text-[9px] font-black uppercase tracking-[0.2em]" style={{ backgroundColor: chrome.accent, color: chrome.onAccent }}>
                                    Enter Gallery
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-1.5 px-4 pb-4 pt-1">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <div key={index} className="aspect-[4/3] rounded-[4px]" style={{ backgroundColor: chrome.panel, border: `1px solid ${chrome.border}` }} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
