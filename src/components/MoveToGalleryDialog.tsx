"use client";

import { useEffect, useRef, useState } from "react";
import { Check, FolderInput, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MoveTargetGallery {
    id: string;
    label: string;
}

interface MoveToGalleryDialogProps {
    itemCount: number;
    galleries: MoveTargetGallery[];
    /** Galleries every selected item already belongs to; moving there would be a no-op. */
    currentGalleryIds: string[];
    onClose: () => void;
    onMove: (targetGalleryId: string) => Promise<string | null>;
}

export function MoveToGalleryDialog({ itemCount, galleries, currentGalleryIds, onClose, onMove }: MoveToGalleryDialogProps) {
    const ref = useRef<HTMLDialogElement>(null);
    const [targetId, setTargetId] = useState<string | null>(null);
    const [moving, setMoving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const focused = document.activeElement as HTMLElement | null;
        ref.current?.showModal();
        return () => focused?.focus();
    }, []);

    const handleMove = async () => {
        if (!targetId) return;
        setMoving(true);
        setError(null);
        const failure = await onMove(targetId);
        setMoving(false);
        if (failure) setError(failure);
    };

    return (
        <dialog
            ref={ref}
            onCancel={(event) => { event.preventDefault(); if (!moving) onClose(); }}
            aria-labelledby="move-gallery-title"
            className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 text-white backdrop:bg-black/60"
        >
            <h2 id="move-gallery-title" className="flex items-center gap-2 text-xl font-bold">
                <FolderInput className="h-5 w-5 text-[#CA9C68]" aria-hidden />
                Move {itemCount === 1 ? "1 item" : `${itemCount} items`}
            </h2>
            <p className="mt-1 text-sm text-slate-400">Choose a gallery in this event. Likes and comments move with each item.</p>

            <div role="radiogroup" aria-label="Destination gallery" className="mt-4 max-h-72 space-y-2 overflow-y-auto">
                {galleries.map((gallery) => {
                    const isCurrent = currentGalleryIds.length === 1 && currentGalleryIds[0] === gallery.id;
                    const selected = targetId === gallery.id;
                    return (
                        <button
                            key={gallery.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            disabled={isCurrent || moving}
                            onClick={() => setTargetId(gallery.id)}
                            className={cn(
                                "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                                selected ? "border-[#CA9C68] bg-[#CA9C68]/10 text-white" : "border-slate-700 text-slate-200 hover:border-slate-500"
                            )}
                        >
                            <span className="truncate">{gallery.label}</span>
                            {isCurrent ? (
                                <span className="shrink-0 text-xs text-slate-400">Current</span>
                            ) : selected ? (
                                <Check className="h-4 w-4 shrink-0 text-[#CA9C68]" aria-hidden />
                            ) : null}
                        </button>
                    );
                })}
            </div>

            {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}

            <div className="mt-5 flex justify-end gap-3">
                <button type="button" onClick={onClose} disabled={moving} className="rounded-lg border border-slate-600 px-4 py-3 disabled:opacity-40">Cancel</button>
                <button
                    type="button"
                    onClick={handleMove}
                    disabled={!targetId || moving}
                    className="flex items-center gap-2 rounded-lg bg-[#CA9C68] px-4 py-3 font-bold text-slate-950 disabled:opacity-40"
                >
                    {moving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                    {moving ? "Moving…" : "Move"}
                </button>
            </div>
        </dialog>
    );
}
