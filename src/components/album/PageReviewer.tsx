"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Check, ChevronLeft, ChevronRight, Columns2, Heart, Loader2, MessageSquarePlus, Reply, RotateCcw, Trash2, Upload, X, ZoomIn, ZoomOut,
} from "lucide-react";
import {
    ALBUM_COMMENT_KINDS, ALBUM_MAX_PAGE_BYTES, albumApi, albumCommentKindLabel,
    type AlbumComment, type AlbumCommentKind, type AlbumDetail, type AlbumPage, type AlbumPhoto,
} from "@/lib/albumApi";
import { confirmDialog } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import { FavouritePicker } from "./FavouritePicker";
import { VoiceRecorder, type VoiceRecording } from "./VoiceRecorder";
import { albumButton, formatSeconds, PageStatusChip, pinNumbers } from "./albumUi";

export type AlbumMode = "photographer" | "couple";

type Draft = { pinX: number | null; pinY: number | null };

const isTyping = (target: EventTarget | null) =>
    target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

function Pin({ number, state, x, y, onClick, active }: {
    number: number | string;
    state: "draft" | "open" | "done" | "new";
    x: number;
    y: number;
    onClick?: () => void;
    active?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onClick?.(); }}
            className={cn(
                "absolute z-10 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-xs font-black shadow-lg shadow-black/60 transition-transform",
                state === "done" && "border-emerald-200 bg-emerald-500 text-white",
                state === "open" && "border-white bg-[#CA9C68] text-[#13191F]",
                state === "draft" && "border-dashed border-[#CA9C68] bg-[#13191F]/90 text-[#CA9C68]",
                state === "new" && "animate-pulse border-white bg-rose-500 text-white",
                active && "scale-125 ring-4 ring-white/40"
            )}
            style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
            aria-label={`Comment ${number}`}
        >
            {number}
        </button>
    );
}

function CommentCard({ comment, number, replies, album, mode, active, onFocus, onChanged }: {
    comment: AlbumComment;
    number: number | undefined;
    replies: AlbumComment[];
    album: AlbumDetail;
    mode: AlbumMode;
    active: boolean;
    onFocus: () => void;
    onChanged: () => Promise<void>;
}) {
    const [replying, setReplying] = useState(false);
    const [reply, setReply] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const mine = comment.authorId === album.viewer.id;
    const locked = album.status === "approved";

    const run = async (task: () => Promise<unknown>) => {
        setBusy(true);
        setError("");
        try {
            await task();
            await onChanged();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Something went wrong.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            className={cn(
                "rounded-2xl border p-3.5 transition-colors",
                active ? "border-[#CA9C68]/70 bg-[#CA9C68]/[0.07]" : "border-white/10 bg-white/[0.03]",
                comment.status === "done" && !active && "opacity-70"
            )}
            onClick={onFocus}
        >
            <div className="flex items-start gap-2.5">
                {number !== undefined && (
                    <span className={cn(
                        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black",
                        comment.status === "done" ? "bg-emerald-500 text-white" : comment.isDraft ? "border border-dashed border-[#CA9C68] text-[#CA9C68]" : "bg-[#CA9C68] text-[#13191F]"
                    )}>{comment.pinX !== null ? number : "•"}</span>
                )}
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-xs font-black uppercase tracking-wider text-[#E8C9A0]">{albumCommentKindLabel(comment.kind)}</span>
                        {comment.isDraft && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-300">Draft</span>}
                        {comment.status === "done" && <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-300"><Check className="h-3 w-3" /> Done</span>}
                    </div>
                    <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                        {comment.authorName}{comment.version ? ` · on v${comment.version}` : ""}
                    </p>
                    {comment.body && <p className="mt-2 whitespace-pre-wrap break-words text-sm font-medium leading-6 text-slate-100">{comment.body}</p>}
                    {comment.voiceUrl && (
                        <div className="mt-2">
                            <audio src={comment.voiceUrl} controls preload="none" className="h-9 w-full" />
                            {comment.voiceSeconds ? <p className="mt-1 text-[10px] font-bold text-slate-500">Voice note · {formatSeconds(comment.voiceSeconds)}</p> : null}
                        </div>
                    )}
                    {comment.replacementPhoto && (
                        <a
                            href={comment.replacementPhoto.previewUrl ?? undefined}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="mt-2 flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-2 hover:border-[#CA9C68]/50"
                        >
                            {comment.replacementPhoto.thumbnailUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={comment.replacementPhoto.thumbnailUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
                            )}
                            <span className="text-xs font-bold text-slate-300">
                                <Heart className="mr-1 inline h-3 w-3 fill-[#CA9C68] text-[#CA9C68]" />Use this favourite instead
                            </span>
                        </a>
                    )}
                    {comment.status === "done" && comment.resolvedByName && (
                        <p className="mt-2 text-[11px] font-semibold text-emerald-300/80">Marked done by {comment.resolvedByName}</p>
                    )}

                    {replies.length > 0 && (
                        <div className="mt-3 space-y-2 border-l-2 border-white/10 pl-3">
                            {replies.map((r) => (
                                <div key={r.id}>
                                    <p className="text-[11px] font-black text-slate-400">{r.authorName}</p>
                                    {r.body && <p className="whitespace-pre-wrap break-words text-sm text-slate-200">{r.body}</p>}
                                    {r.voiceUrl && <audio src={r.voiceUrl} controls preload="none" className="mt-1 h-9 w-full" />}
                                </div>
                            ))}
                        </div>
                    )}

                    {replying && (
                        <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                            <textarea
                                value={reply}
                                onChange={(e) => setReply(e.target.value)}
                                rows={2}
                                maxLength={2000}
                                autoFocus
                                placeholder="Write a reply"
                                className="w-full resize-none rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#CA9C68]"
                            />
                            <div className="flex justify-end gap-2">
                                <button type="button" className={albumButton.ghost} onClick={() => { setReplying(false); setReply(""); }}>Cancel</button>
                                <button
                                    type="button"
                                    className={albumButton.primary}
                                    disabled={busy || !reply.trim()}
                                    onClick={() => run(async () => {
                                        const pageId = album.pages.find((p) => p.comments.some((c) => c.id === comment.id))!.id;
                                        await albumApi.addComment(album.id, pageId, { parentId: comment.id, body: reply });
                                        setReply("");
                                        setReplying(false);
                                    })}
                                >Reply</button>
                            </div>
                        </div>
                    )}

                    {error && <p className="mt-2 text-xs font-bold text-rose-300">{error}</p>}

                    <div className="mt-2 flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {!comment.isDraft && !locked && (
                            comment.status === "open" ? (
                                <button type="button" className={albumButton.ghost} disabled={busy} onClick={() => run(() => albumApi.setCommentStatus(album.id, comment.id, "done"))}>
                                    <Check className="h-3.5 w-3.5" /> {mode === "photographer" ? "Mark done" : "Resolved"}
                                </button>
                            ) : (
                                <button type="button" className={albumButton.ghost} disabled={busy} onClick={() => run(() => albumApi.setCommentStatus(album.id, comment.id, "open"))}>
                                    <RotateCcw className="h-3.5 w-3.5" /> Reopen
                                </button>
                            )
                        )}
                        {!comment.isDraft && !locked && !replying && (
                            <button type="button" className={albumButton.ghost} onClick={() => setReplying(true)}>
                                <Reply className="h-3.5 w-3.5" /> Reply
                            </button>
                        )}
                        {mine && !locked && (
                            <button
                                type="button"
                                className={cn(albumButton.ghost, "hover:text-rose-300")}
                                disabled={busy}
                                onClick={async () => {
                                    if (!await confirmDialog({ title: "Delete this comment?", message: comment.isDraft ? "It hasn't been sent yet." : "The photographer will no longer see it.", confirmLabel: "Delete", tone: "danger" })) return;
                                    await run(() => albumApi.removeComment(album.id, comment.id));
                                }}
                            >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                            </button>
                        )}
                        {busy && <Loader2 className="h-4 w-4 animate-spin text-[#CA9C68]" />}
                    </div>
                </div>
            </div>
        </div>
    );
}

function Composer({ album, page, version, draft, onCancel, onSaved }: {
    album: AlbumDetail;
    page: AlbumPage;
    version: number;
    draft: Draft;
    onCancel: () => void;
    onSaved: () => Promise<void>;
}) {
    const [kind, setKind] = useState<AlbumCommentKind | null>(null);
    const [body, setBody] = useState("");
    const [voice, setVoice] = useState<VoiceRecording | null>(null);
    const [photo, setPhoto] = useState<AlbumPhoto | null>(null);
    const [picking, setPicking] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const save = async () => {
        if (!body.trim() && !voice && !photo && (kind === null || kind === "note")) {
            setError("Choose what should change, write a comment or record a voice note.");
            return;
        }
        setSaving(true);
        setError("");
        try {
            const { comment } = await albumApi.addComment(album.id, page.id, {
                kind: kind ?? "note", pinX: draft.pinX, pinY: draft.pinY, body: body.trim() || null, replacementPhotoId: photo?.id ?? null, version,
            });
            if (voice) {
                try {
                    await albumApi.attachVoice(album.id, comment.id, voice.blob, voice.seconds);
                } catch (e) {
                    await onSaved();
                    setError(`The comment was saved, but the voice note didn't upload: ${e instanceof Error ? e.message : "try again"}.`);
                    setSaving(false);
                    return;
                }
            }
            if (voice) URL.revokeObjectURL(voice.url);
            await onSaved();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Couldn't save the comment.");
            setSaving(false);
        }
    };

    return (
        <div className="space-y-3 rounded-2xl border border-[#CA9C68]/50 bg-[#CA9C68]/[0.06] p-4">
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-black text-white">{draft.pinX !== null ? "Comment on this spot" : "Comment on the whole page"}</p>
                <button type="button" onClick={onCancel} className={albumButton.ghost} aria-label="Cancel comment"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="What should change">
                {ALBUM_COMMENT_KINDS.map(({ id, label }) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setKind(kind === id ? null : id)}
                        aria-pressed={kind === id}
                        className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                            kind === id ? "border-[#CA9C68] bg-[#CA9C68] text-[#13191F]" : "border-white/15 text-slate-300 hover:border-white/30"
                        )}
                    >{label}</button>
                ))}
            </div>
            {kind === "replace" && (
                <button type="button" onClick={() => setPicking(true)} className="flex w-full items-center gap-3 rounded-xl border border-white/15 bg-black/30 p-2 text-left hover:border-[#CA9C68]/50">
                    {photo?.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo.thumbnailUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    ) : (
                        <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/5"><Heart className="h-5 w-5 text-[#CA9C68]" /></span>
                    )}
                    <span className="text-xs font-bold text-slate-200">{photo ? "Change the replacement photo" : "Pick the new photo from favourites (optional)"}</span>
                </button>
            )}
            <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                maxLength={2000}
                autoFocus
                placeholder="Describe the change (optional)"
                className="w-full resize-none rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[#CA9C68]"
            />
            <VoiceRecorder value={voice} onChange={setVoice} disabled={saving} />
            {error && <p className="text-xs font-bold text-rose-300">{error}</p>}
            <div className="flex gap-2">
                <button type="button" onClick={onCancel} className={cn(albumButton.secondary, "flex-1")} disabled={saving}>Cancel</button>
                <button type="button" onClick={save} className={cn(albumButton.primary, "flex-1")} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save comment
                </button>
            </div>
            {picking && (
                <FavouritePicker albumId={album.id} selectedId={photo?.id ?? null} onClose={() => setPicking(false)} onPick={(p) => { setPhoto(p); setPicking(false); }} />
            )}
        </div>
    );
}

export function PageReviewer({ album, pages, labels, index, mode, onIndexChange, onClose, onAlbum, refresh, onUploadVersion }: {
    album: AlbumDetail;
    pages: AlbumPage[];
    labels: Map<string, string>;
    index: number;
    mode: AlbumMode;
    onIndexChange: (index: number) => void;
    onClose: () => void;
    onAlbum: (album: AlbumDetail) => void;
    refresh: () => Promise<void>;
    onUploadVersion: (page: AlbumPage, file: File) => Promise<void>;
}) {
    const page = pages[index];
    const visibleVersions = useMemo(
        () => (page ? page.versions.filter((v) => mode === "photographer" || v.round > 0) : []),
        [page, mode]
    );
    const defaultVersion = mode === "couple" ? page?.sentVersion ?? page?.latestVersion : page?.latestVersion;
    const [shownVersion, setShownVersion] = useState(defaultVersion ?? 1);
    const [compare, setCompare] = useState(false);
    const [zoom, setZoom] = useState(false);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [activeComment, setActiveComment] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const commentRefs = useRef(new Map<string, HTMLDivElement>());

    // A new page, or a new version arriving, shows the newest version
    useEffect(() => {
        setShownVersion(defaultVersion ?? 1);
        setDraft(null);
        setCompare(false);
        setError("");
    }, [page?.id, defaultVersion]);

    const goTo = useCallback((next: number) => {
        if (next >= 0 && next < pages.length) onIndexChange(next);
    }, [pages.length, onIndexChange]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (isTyping(event.target) || document.querySelector("[role=dialog][aria-modal=true] [role=dialog]")) return;
            if (event.key === "Escape") { if (draft) setDraft(null); else onClose(); }
            if (event.key === "ArrowRight") goTo(index + 1);
            if (event.key === "ArrowLeft") goTo(index - 1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [draft, goTo, index, onClose]);

    useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = previous; };
    }, []);

    if (!page) return null;

    const version = visibleVersions.find((v) => v.version === shownVersion) ?? visibleVersions.at(-1);
    const previousVersion = version ? visibleVersions.filter((v) => v.version < version.version).at(-1) : undefined;
    const numbers = pinNumbers(page.comments);
    const topLevel = page.comments.filter((c) => !c.parentId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const repliesOf = (id: string) => page.comments.filter((c) => c.parentId === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const onThisVersion = topLevel.filter((c) => c.version === version?.version);
    const earlier = topLevel.filter((c) => c.version !== version?.version);
    const locked = album.status === "approved";
    const canComment = !locked && !!version && (mode === "photographer" || version.round > 0);
    const myDrafts = album.pages.reduce((n, p) => n + p.comments.filter((c) => c.isDraft && c.authorId === album.viewer.id).length, 0);
    const label = labels.get(page.id) ?? "Page";

    const placePin = (event: React.MouseEvent<HTMLDivElement>) => {
        if (!canComment) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
        const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
        setDraft({ pinX: Math.round(x * 1000) / 1000, pinY: Math.round(y * 1000) / 1000 });
        setActiveComment(null);
    };

    const focusComment = (id: string) => {
        setActiveComment(id);
        commentRefs.current.get(id)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };

    const act = async (task: () => Promise<{ album: AlbumDetail }>) => {
        setBusy(true);
        setError("");
        try {
            onAlbum((await task()).album);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Something went wrong.");
        } finally {
            setBusy(false);
        }
    };

    const image = (v: typeof version, withPins: boolean) => v && (
        <div
            className={cn("relative", zoom ? "w-[250%] max-w-none" : "w-fit max-w-full", withPins && canComment && "cursor-crosshair")}
            onClick={withPins ? placePin : undefined}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={v.previewUrl}
                alt={`${label}, version ${v.version}`}
                className={cn("block select-none", zoom ? "h-auto w-full" : "max-h-[calc(45vh-2rem)] w-auto max-w-full lg:max-h-[calc(100vh-9rem)]")}
                draggable={false}
            />
            {withPins && topLevel.filter((c) => c.version === v.version && c.pinX !== null && c.pinY !== null).map((c) => (
                <Pin
                    key={c.id}
                    number={numbers.get(c.id) ?? "?"}
                    state={c.isDraft ? "draft" : c.status === "done" ? "done" : "open"}
                    x={c.pinX!}
                    y={c.pinY!}
                    active={activeComment === c.id}
                    onClick={() => focusComment(c.id)}
                />
            ))}
            {withPins && draft?.pinX != null && draft.pinY != null && <Pin number="+" state="new" x={draft.pinX} y={draft.pinY} />}
        </div>
    );

    return (
        <div className="fixed inset-0 z-[95] flex flex-col bg-[#0B0F12] text-white" role="dialog" aria-modal="true" aria-label={`${label} review`}>
            {/* Top bar */}
            <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2.5 sm:px-5">
                <button type="button" onClick={onClose} className={albumButton.ghost} aria-label="Close"><X className="h-5 w-5" /></button>
                {/* On phones the title gets its own row and the controls wrap below it */}
                <div className="min-w-0 flex-1 basis-[70%] sm:basis-auto">
                    <p className="truncate font-serif text-lg font-bold text-[#FFF7EB]">{label}</p>
                    <p className="text-[11px] font-bold text-slate-500">{index + 1} of {pages.length} · {page.layout === "spread" ? "Spread" : "Single page"}</p>
                </div>
                <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                    <PageStatusChip status={page.status} className="hidden sm:inline-flex" />
                    {visibleVersions.length > 1 && (
                        <div className="flex items-center gap-1 rounded-xl border border-white/10 p-1" role="group" aria-label="Versions">
                            {visibleVersions.map((v) => (
                                <button
                                    key={v.version}
                                    type="button"
                                    onClick={() => setShownVersion(v.version)}
                                    aria-pressed={v.version === version?.version}
                                    className={cn("rounded-lg px-2.5 py-1 text-xs font-black", v.version === version?.version ? "bg-[#CA9C68] text-[#13191F]" : "text-slate-300 hover:bg-white/10")}
                                    title={v.round === 0 ? "Not sent yet" : `Sent in round ${v.round}`}
                                >v{v.version}{v.round === 0 ? "*" : ""}</button>
                            ))}
                        </div>
                    )}
                    {previousVersion && (
                        <button type="button" onClick={() => setCompare(!compare)} aria-pressed={compare} className={cn(albumButton.ghost, compare && "bg-white/10 text-white")} title="Compare with the previous version">
                            <Columns2 className="h-4 w-4" /> <span className="hidden sm:inline">Compare</span>
                        </button>
                    )}
                    <button type="button" onClick={() => setZoom(!zoom)} className={albumButton.ghost} title={zoom ? "Fit to screen" : "Zoom in"} aria-label={zoom ? "Fit to screen" : "Zoom in"}>
                        {zoom ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
                    </button>
                    <div className="flex items-center">
                        <button type="button" onClick={() => goTo(index - 1)} disabled={index === 0} className={albumButton.ghost} aria-label="Previous page"><ChevronLeft className="h-5 w-5" /></button>
                        <button type="button" onClick={() => goTo(index + 1)} disabled={index === pages.length - 1} className={albumButton.ghost} aria-label="Next page"><ChevronRight className="h-5 w-5" /></button>
                    </div>
                </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                {/* Page */}
                <div className={cn("relative flex min-h-0 shrink-0 bg-black/40 p-3 sm:p-5 lg:flex-1", zoom ? "h-[45vh] overflow-auto lg:h-auto" : "max-h-[45vh] items-center justify-center lg:h-auto lg:max-h-none")}>
                    <div className={cn("flex gap-4", compare ? "flex-col sm:flex-row" : "", zoom ? "items-start" : "max-h-full max-w-full items-center justify-center")}>
                        {compare && previousVersion && (
                            <div className="relative opacity-80">
                                <span className="absolute left-2 top-2 z-10 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-200">v{previousVersion.version} (before)</span>
                                {image(previousVersion, false)}
                            </div>
                        )}
                        <div className="relative">
                            {compare && <span className="absolute left-2 top-2 z-20 rounded-full bg-[#CA9C68] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#13191F]">v{version?.version} (now)</span>}
                            {image(version, true)}
                        </div>
                    </div>
                    {!version && <p className="m-auto text-sm font-bold text-slate-400">This page hasn&apos;t been sent for review yet.</p>}
                </div>

                {/* Comments */}
                <div className="flex min-h-0 flex-1 flex-col border-t border-white/10 lg:w-[400px] lg:flex-none lg:border-l lg:border-t-0">
                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
                        {mode === "couple" && page.sentVersion !== null && !locked && (
                            page.status === "approved" ? (
                                <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 p-3">
                                    <span className="flex items-center gap-2 text-sm font-black text-emerald-200"><Check className="h-4 w-4" /> You approved this page</span>
                                    <button type="button" className={albumButton.ghost} disabled={busy} onClick={() => act(() => albumApi.approvePage(album.id, page.id, false))}>Undo</button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={async () => {
                                        const open = page.comments.filter((c) => !c.parentId && !c.isDraft && c.status === "open").length;
                                        if (open && !await confirmDialog({ title: "Approve this page?", message: `This also marks ${open === 1 ? "the open request" : `the ${open} open requests`} on it as done.`, confirmLabel: "Approve" })) return;
                                        await act(() => albumApi.approvePage(album.id, page.id, true));
                                    }}
                                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-400 disabled:opacity-50"
                                >
                                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Looks good, approve page
                                </button>
                            )
                        )}

                        {mode === "photographer" && !locked && (
                            <div className="flex items-center gap-2">
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/tiff"
                                    className="hidden"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        e.target.value = "";
                                        if (!file) return;
                                        if (file.size > ALBUM_MAX_PAGE_BYTES) { setError("Pages can be up to 60 MB. Export the page as a JPEG and try again."); return; }
                                        setUploading(true);
                                        setError("");
                                        try { await onUploadVersion(page, file); } catch (err) { setError(err instanceof Error ? err.message : "Upload failed."); } finally { setUploading(false); }
                                    }}
                                />
                                <button type="button" className={cn(albumButton.secondary, "flex-1")} disabled={uploading} onClick={() => fileRef.current?.click()}>
                                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                    {uploading ? "Uploading…" : "Upload new version"}
                                </button>
                            </div>
                        )}
                        {mode === "photographer" && page.latestVersion > (page.sentVersion ?? 0) && (
                            <p className="rounded-xl bg-white/5 px-3 py-2 text-xs font-bold text-slate-300">v{page.latestVersion} isn&apos;t sent yet. Use “Send for review” on the album to share it.</p>
                        )}

                        {error && <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-xs font-bold text-rose-200">{error}</p>}

                        {draft ? (
                            <Composer
                                key={`${draft.pinX}-${draft.pinY}`}
                                album={album}
                                page={page}
                                version={version?.version ?? 1}
                                draft={draft}
                                onCancel={() => setDraft(null)}
                                onSaved={async () => { setDraft(null); await refresh(); }}
                            />
                        ) : canComment && (
                            <div className="rounded-2xl border border-dashed border-white/15 p-3 text-center">
                                <p className="text-xs font-bold text-slate-400">Tap a spot on the page to pin a comment to a photo.</p>
                                <button type="button" className={cn(albumButton.ghost, "mt-1 text-[#E8C9A0]")} onClick={() => setDraft({ pinX: null, pinY: null })}>
                                    <MessageSquarePlus className="h-4 w-4" /> Comment on the whole page
                                </button>
                            </div>
                        )}

                        {onThisVersion.length === 0 && earlier.length === 0 && !draft && (
                            <p className="py-4 text-center text-xs font-semibold text-slate-500">No comments on this page yet.</p>
                        )}
                        {onThisVersion.map((c) => (
                            <div key={c.id} ref={(el) => { if (el) commentRefs.current.set(c.id, el); else commentRefs.current.delete(c.id); }}>
                                <CommentCard comment={c} number={numbers.get(c.id)} replies={repliesOf(c.id)} album={album} mode={mode} active={activeComment === c.id} onFocus={() => setActiveComment(c.id)} onChanged={refresh} />
                            </div>
                        ))}
                        {earlier.length > 0 && (
                            <details className="group" open={onThisVersion.length === 0}>
                                <summary className="cursor-pointer list-none py-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500 hover:text-slate-300">
                                    Other versions ({earlier.length})
                                </summary>
                                <div className="space-y-3">
                                    {earlier.map((c) => (
                                        <div key={c.id} ref={(el) => { if (el) commentRefs.current.set(c.id, el); else commentRefs.current.delete(c.id); }}>
                                            <CommentCard comment={c} number={numbers.get(c.id)} replies={repliesOf(c.id)} album={album} mode={mode} active={activeComment === c.id} onFocus={() => { setActiveComment(c.id); setShownVersion(c.version); }} onChanged={refresh} />
                                        </div>
                                    ))}
                                </div>
                            </details>
                        )}
                    </div>

                    {mode === "couple" && myDrafts > 0 && (
                        <div className="border-t border-white/10 bg-[#CA9C68]/[0.06] p-3 text-center text-xs font-bold text-[#E8C9A0]">
                            {myDrafts === 1 ? "1 comment is" : `${myDrafts} comments are`} waiting. Close this view and tap <span className="font-black">Send feedback</span> when you&apos;ve been through the pages.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
