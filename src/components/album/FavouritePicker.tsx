"use client";

import { useEffect, useState } from "react";
import { Heart, Loader2 } from "lucide-react";
import { albumApi, type AlbumPhoto } from "@/lib/albumApi";
import { ModalHeader, modalStyles } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

const cache = new Map<string, AlbumPhoto[]>();

/** The couple's favourites (their album picks), to choose the photo that should go in instead. */
export function FavouritePicker({ albumId, selectedId, onPick, onClose }: {
    albumId: string;
    selectedId: string | null;
    onPick: (photo: AlbumPhoto) => void;
    onClose: () => void;
}) {
    const [photos, setPhotos] = useState<AlbumPhoto[] | null>(cache.get(albumId) ?? null);
    const [error, setError] = useState("");

    useEffect(() => {
        if (cache.has(albumId)) return;
        albumApi.favourites(albumId)
            .then(({ photos }) => { cache.set(albumId, photos); setPhotos(photos); })
            .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load favourites."));
    }, [albumId]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } };
        window.addEventListener("keydown", onKey, true);
        return () => window.removeEventListener("keydown", onKey, true);
    }, [onClose]);

    return (
        <div className={cn(modalStyles.overlay, "z-[110]")} onClick={onClose}>
            <div className={cn(modalStyles.panel, "max-w-3xl")} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="favourite-picker-title">
                <ModalHeader titleId="favourite-picker-title" eyebrow="Replace with" title="Pick from favourites" subtitle="The photos marked as favourites in this event's galleries." onClose={onClose} />
                {error ? (
                    <p className={modalStyles.error}>{error}</p>
                ) : !photos ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#CA9C68]" /></div>
                ) : photos.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-center">
                        <Heart className="h-8 w-8 text-[#CA9C68]" />
                        <p className="text-sm font-bold text-slate-300">No favourites yet.</p>
                        <p className="max-w-sm text-xs font-semibold text-slate-500">Mark photos as favourites in the galleries, then pick one here. You can also describe the photo you want in the comment.</p>
                    </div>
                ) : (
                    <div className="grid max-h-[60vh] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-5">
                        {photos.map((photo) => (
                            <button
                                key={photo.id}
                                type="button"
                                onClick={() => onPick(photo)}
                                className={cn(
                                    "relative aspect-square overflow-hidden rounded-xl border-2 bg-black/40 transition-colors",
                                    photo.id === selectedId ? "border-[#CA9C68]" : "border-transparent hover:border-white/30"
                                )}
                                aria-pressed={photo.id === selectedId}
                            >
                                {photo.thumbnailUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={photo.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
