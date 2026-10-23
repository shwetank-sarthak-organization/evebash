"use client";

import { useCallback, useEffect, useState } from "react";
import { BookImage, Loader2, MessageSquare, Plus } from "lucide-react";
import { albumApi, type AlbumSummary } from "@/lib/albumApi";
import { cn } from "@/lib/utils";
import { AlbumWorkspace } from "./AlbumWorkspace";
import { albumButton, AlbumStatusChip, ProgressBar } from "./albumUi";

const STEPS = [
    ["Upload the pages", "The photographer adds each page design: one image per page or per spread."],
    ["The couple reviews", "They pin comments on photos to replace, enlarge or edit, by text or voice note."],
    ["Send new versions", "Fix what was asked and send the changed pages back, round after round."],
    ["Approved for print", "Once every page is approved, the album is locked with the date."],
] as const;

/** The host page's Album tab: album page proofs for one event (owner and admins only). */
export function AlbumProofsPanel({ eventId }: { eventId: string }) {
    const [albums, setAlbums] = useState<AlbumSummary[] | null>(null);
    const [error, setError] = useState("");
    const [openId, setOpenId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [title, setTitle] = useState("");
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        try {
            setAlbums((await albumApi.list(eventId)).albums);
            setError("");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Couldn't load albums.");
        }
    }, [eventId]);

    useEffect(() => {
        setOpenId(null);
        setAlbums(null);
        void load();
    }, [load]);

    if (openId) {
        return <AlbumWorkspace albumId={openId} onBack={() => { setOpenId(null); void load(); }} />;
    }

    const create = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!title.trim()) return;
        setSaving(true);
        try {
            const { album } = await albumApi.create(eventId, title.trim());
            setCreating(false);
            setTitle("");
            setOpenId(album.id);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Couldn't create the album.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h4 className="text-xl font-black text-white">Album Proofs</h4>
                    <p className="text-sm font-bold text-slate-400">Share album page designs, collect changes on each page and get final approval, all in one place.</p>
                </div>
                {albums && albums.length > 0 && !creating && (
                    <button type="button" className={albumButton.primary} onClick={() => setCreating(true)}>
                        <Plus className="h-4 w-4" /> New album
                    </button>
                )}
            </div>

            {error && <p className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm font-bold text-rose-200">{error}</p>}

            {creating && (
                <form onSubmit={create} className="flex flex-col gap-3 rounded-[1.2rem] border border-[#CA9C68]/40 bg-[#CA9C68]/[0.05] p-4 sm:flex-row sm:items-end">
                    <label className="min-w-0 flex-1">
                        <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">Album name</span>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={80}
                            autoFocus
                            placeholder="Wedding Album"
                            className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-base font-bold text-white outline-none placeholder:text-slate-600 focus:border-[#CA9C68]"
                        />
                    </label>
                    <div className="flex gap-2">
                        <button type="button" className={albumButton.secondary} onClick={() => { setCreating(false); setTitle(""); }}>Cancel</button>
                        <button type="submit" className={albumButton.primary} disabled={saving || !title.trim()}>
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Create
                        </button>
                    </div>
                </form>
            )}

            {!albums && !error ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#CA9C68]" /></div>
            ) : albums && albums.length === 0 && !creating ? (
                <div className="rounded-[1.5rem] border border-slate-700 bg-slate-950/80 p-5 sm:p-8">
                    <div className="flex flex-col items-center text-center">
                        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#CA9C68]/10"><BookImage className="h-7 w-7 text-[#CA9C68]" /></span>
                        <p className="mt-4 font-serif text-2xl font-bold text-[#FFF7EB]">Proof the album here, not on WhatsApp</p>
                        <p className="mt-2 max-w-lg text-sm font-semibold text-slate-400">Every comment stays pinned to the photo it is about, every version is kept, and the final approval is on record.</p>
                    </div>
                    <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {STEPS.map(([heading, text], i) => (
                            <li key={heading} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                <span className="text-[11px] font-black text-[#CA9C68]">STEP {i + 1}</span>
                                <p className="mt-1 text-sm font-black text-white">{heading}</p>
                                <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">{text}</p>
                            </li>
                        ))}
                    </ol>
                    <div className="mt-6 flex justify-center">
                        <button type="button" className={albumButton.primary} onClick={() => setCreating(true)}>
                            <Plus className="h-4 w-4" /> Create the first album
                        </button>
                    </div>
                </div>
            ) : albums && (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {albums.map((album) => (
                        <button
                            key={album.id}
                            type="button"
                            onClick={() => setOpenId(album.id)}
                            className="group overflow-hidden rounded-[1.2rem] border border-white/10 bg-neutral-950 text-left transition-colors hover:border-[#CA9C68]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CA9C68]/60"
                        >
                            <div className="flex aspect-[2/1] items-center justify-center bg-black/60">
                                {album.coverThumbnailUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={album.coverThumbnailUrl} alt="" className="h-full w-full object-contain" />
                                ) : (
                                    <BookImage className="h-10 w-10 text-slate-700" />
                                )}
                            </div>
                            <div className="space-y-2.5 p-4">
                                <div className="flex items-start justify-between gap-2">
                                    <p className="min-w-0 truncate font-serif text-xl font-bold text-[#FFF7EB]">{album.title}</p>
                                    <AlbumStatusChip status={album.status} />
                                </div>
                                <ProgressBar value={album.approvedCount} total={album.pageCount} />
                                <p className="flex flex-wrap items-center gap-x-2 text-xs font-bold text-slate-400">
                                    <span>{album.approvedCount}/{album.pageCount} approved</span>
                                    {album.currentRound > 0 && <span>· Round {album.currentRound}</span>}
                                    {album.openRequestCount > 0 && (
                                        <span className={cn("inline-flex items-center gap-1 text-rose-300")}>· <MessageSquare className="h-3 w-3" />{album.openRequestCount} to do</span>
                                    )}
                                    {album.myDraftCount > 0 && <span className="text-[#E8C9A0]">· {album.myDraftCount} unsent comments</span>}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
