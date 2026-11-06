"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, BookImage, CheckCircle2, Clock, Files, Loader2, MessageSquare, Plus } from "lucide-react";
import { albumApi, type AlbumRoles, type AlbumSummary } from "@/lib/albumApi";
import { cn } from "@/lib/utils";
import { albumNextStep, type AlbumNextStepTone } from "../../../shared/text/albumNextStep";
import { AlbumWorkspace } from "./AlbumWorkspace";
import { albumButton, AlbumStatusChip, ProgressBar } from "./albumUi";
import { RolePicker, rolesComplete } from "./RolePicker";

const STEPS = [
    ["Upload the pages", "The photographer adds each page design: one image per page or per spread."],
    ["The client reviews", "They pin comments on photos to replace, enlarge or edit, by text or voice note."],
    ["Send new versions", "Fix what was asked and send the changed pages back, round after round."],
    ["Approved for print", "Once every page is approved, the album is locked with the date."],
] as const;

const NEXT_STEP: Record<AlbumNextStepTone, { className: string; Icon: typeof ArrowRight | null }> = {
    action: { className: "bg-[var(--site-gold)]/10 text-[var(--site-gold-light-text)]", Icon: null },
    urgent: { className: "bg-rose-400/10 text-rose-200 light:text-rose-800", Icon: MessageSquare },
    waiting: { className: "bg-[var(--site-tint)]/[0.04] text-[var(--site-muted)]", Icon: Clock },
    done: { className: "bg-emerald-400/10 text-emerald-200 light:text-emerald-800", Icon: CheckCircle2 },
};

function AlbumCard({ album, onOpen }: { album: AlbumSummary; onOpen: () => void }) {
    const next = albumNextStep(album);
    const role = album.myRole === "viewer" ? null : `You: ${album.myRole === "photographer" ? "Photographer" : "Client"}`;
    const NextIcon = next ? NEXT_STEP[next.tone].Icon : null;
    return (
        <button
            type="button"
            onClick={onOpen}
            className="group flex h-full flex-col overflow-hidden rounded-[1.2rem] border border-[var(--site-border)] bg-[var(--site-card)] text-left transition-colors hover:border-[var(--site-gold)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-gold)]/60"
        >
            <div className="site-noir relative aspect-[3/2] w-full overflow-hidden bg-black/60">
                {album.coverThumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={album.coverThumbnailUrl} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                ) : album.pageCount > 0 ? (
                    <div className="flex h-full items-center justify-center"><BookImage className="h-10 w-10 text-[var(--site-muted)]" /></div>
                ) : (
                    <div className="absolute inset-3 flex flex-col items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-[var(--site-gold)]/40 text-sm font-bold text-[var(--site-gold-light-text)]">
                        {album.myRole === "photographer" ? <><Plus className="h-5 w-5" /> Add pages</> : <><BookImage className="h-6 w-6 text-[var(--site-muted)]" /><span className="text-[var(--site-muted)]">No pages yet</span></>}
                    </div>
                )}
                <span className="absolute right-3 top-3 rounded-full bg-black/75"><AlbumStatusChip status={album.status} /></span>
                {album.pageCount > 0 && (
                    <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-black/70 px-3 py-2 text-xs font-bold text-white/90">
                        <Files className="h-3.5 w-3.5" /> {album.pageCount} {album.pageCount === 1 ? "page" : "pages"}
                    </span>
                )}
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
                <p className="min-w-0 truncate font-serif text-[1.35rem] font-bold text-[var(--site-text)]">{album.title}</p>
                <div className="space-y-1.5">
                    {album.pageCount > 0 && <ProgressBar value={album.approvedCount} total={album.pageCount} />}
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13px] font-semibold text-[var(--site-muted)]">
                        <span>
                            {album.pageCount > 0
                                ? <><span className="text-[var(--site-text)]">{album.approvedCount}</span> of {album.pageCount} approved</>
                                : "No pages yet"}
                        </span>
                        <span>{[album.currentRound > 0 ? `Round ${album.currentRound}` : null, role].filter(Boolean).join(" · ")}</span>
                    </div>
                </div>
                {next && (
                    <span className={cn("mt-auto flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-bold", NEXT_STEP[next.tone].className)}>
                        {NextIcon && <NextIcon className="h-4 w-4 shrink-0" />}
                        <span className="min-w-0 truncate">{next.label}</span>
                        {(next.tone === "action" || next.tone === "urgent") && <ArrowRight className="ml-auto h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />}
                    </span>
                )}
            </div>
        </button>
    );
}

/** The host page's Album tab: album page proofs for one event (owner and admins only). */
export function AlbumProofsPanel({ eventId }: { eventId: string }) {
    const [albums, setAlbums] = useState<AlbumSummary[] | null>(null);
    const [error, setError] = useState("");
    const [openId, setOpenId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [title, setTitle] = useState("");
    const [roles, setRoles] = useState<Partial<AlbumRoles>>({});
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
        if (!title.trim() || !rolesComplete(roles)) return;
        setSaving(true);
        try {
            const { album } = await albumApi.create(eventId, title.trim(), roles);
            setCreating(false);
            setTitle("");
            setRoles({});
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
                    <h4 className="text-xl font-black text-[var(--site-text)]">Album Proofs</h4>
                    <p className="text-sm font-bold text-[var(--site-muted)]">Share album page designs, collect changes on each page and get final approval, all in one place.</p>
                </div>
                {albums && albums.length > 0 && !creating && (
                    <button type="button" className={albumButton.primary} onClick={() => setCreating(true)}>
                        <Plus className="h-4 w-4" /> New album
                    </button>
                )}
            </div>

            {error && <p className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm font-bold text-rose-200 light:text-rose-800">{error}</p>}

            {creating && (
                <form onSubmit={create} className="space-y-5 rounded-[1.2rem] border border-[var(--site-gold)]/40 bg-[var(--site-gold)]/[0.05] p-4 sm:p-5">
                    <label className="block">
                        <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-[var(--site-muted)]">Album name</span>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={80}
                            autoFocus
                            placeholder="Wedding Album"
                            className="w-full rounded-xl border border-[var(--site-tint)]/15 bg-black/40 light:bg-[var(--site-tint)]/[0.04] px-4 py-3 text-base font-bold text-[var(--site-text)] outline-none placeholder:text-[var(--site-muted)] focus:border-[var(--site-gold)]"
                        />
                    </label>
                    <RolePicker eventId={eventId} value={roles} onChange={setRoles} />
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <button type="button" className={albumButton.secondary} onClick={() => { setCreating(false); setTitle(""); setRoles({}); }}>Cancel</button>
                        <button type="submit" className={albumButton.primary} disabled={saving || !title.trim() || !rolesComplete(roles)}>
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Create album
                        </button>
                    </div>
                </form>
            )}

            {!albums && !error ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--site-gold-text)]" /></div>
            ) : albums && albums.length === 0 && !creating ? (
                <div className="rounded-[1.5rem] border border-[var(--site-border)] bg-[var(--site-bg)]/80 p-5 sm:p-8">
                    <div className="flex flex-col items-center text-center">
                        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--site-gold)]/10"><BookImage className="h-7 w-7 text-[var(--site-gold-text)]" /></span>
                        <p className="mt-4 font-serif text-2xl font-bold text-[var(--site-text)]">Proof the album here, not on WhatsApp</p>
                        <p className="mt-2 max-w-lg text-sm font-semibold text-[var(--site-muted)]">Every comment stays pinned to the photo it is about, every version is kept, and the final approval is on record.</p>
                    </div>
                    <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {STEPS.map(([heading, text], i) => (
                            <li key={heading} className="rounded-2xl border border-[var(--site-tint)]/10 bg-[var(--site-tint)]/[0.03] p-4">
                                <span className="text-[11px] font-black text-[var(--site-gold-text)]">STEP {i + 1}</span>
                                <p className="mt-1 text-sm font-black text-[var(--site-text)]">{heading}</p>
                                <p className="mt-1 text-xs font-semibold leading-5 text-[var(--site-muted)]">{text}</p>
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
                    {albums.map((album) => <AlbumCard key={album.id} album={album} onOpen={() => setOpenId(album.id)} />)}
                </div>
            )}
        </div>
    );
}
