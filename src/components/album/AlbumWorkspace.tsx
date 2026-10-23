"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ArrowLeft, Camera, Check, CheckCircle2, GripVertical, Heart, Loader2, MessageSquare, MoreHorizontal, Pencil, RotateCcw, Send, Trash2, Upload, Users, X,
} from "lucide-react";
import {
    ALBUM_MAX_PAGE_BYTES, ALBUM_PAGE_TYPES, albumApi, albumCommentKindLabel, albumPageLabels, sortByFileName,
    type AlbumDetail, type AlbumPage,
} from "@/lib/albumApi";
import { alertDialog, confirmDialog } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import { PageReviewer, type AlbumMode } from "./PageReviewer";
import { albumButton, AlbumStatusChip, PageStatusChip, pinNumbers, ProgressBar } from "./albumUi";
import { RolesDialog } from "./RolePicker";

type UploadItem = { key: string; name: string; progress: number; state: "waiting" | "uploading" | "processing" | "done" | "failed"; error?: string };

const PAGE_EXTENSIONS = /\.(jpe?g|png|webp|tiff?)$/i;
const REFRESH_MS = 30_000;
const UPLOAD_CONCURRENCY = 2;

function checkFile(file: File) {
    if (!ALBUM_PAGE_TYPES.includes(file.type) && !PAGE_EXTENSIONS.test(file.name)) return "Not a JPEG, PNG, WebP or TIFF image";
    if (file.size > ALBUM_MAX_PAGE_BYTES) return "Larger than 60 MB";
    return null;
}

export function AlbumWorkspace({ albumId, onBack }: { albumId: string; onBack: () => void }) {
    const [album, setAlbum] = useState<AlbumDetail | null>(null);
    const [error, setError] = useState("");
    const [uploads, setUploads] = useState<UploadItem[]>([]);
    const [viewing, setViewing] = useState<number | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [dragId, setDragId] = useState<string | null>(null);
    const [dropActive, setDropActive] = useState(false);
    const [editingTitle, setEditingTitle] = useState<string | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [rolesOpen, setRolesOpen] = useState(false);
    // Each person sees their own side: the photographer's, the client's, or (host and other admins) view only
    const mode: AlbumMode | null = album ? album.viewer.role : null;
    const fileRef = useRef<HTMLInputElement>(null);
    const uploading = uploads.some((u) => u.state === "waiting" || u.state === "uploading" || u.state === "processing");

    const refresh = useCallback(async () => {
        try {
            const { album } = await albumApi.get(albumId);
            setAlbum(album);
            setError("");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Couldn't load the album.");
        }
    }, [albumId]);

    useEffect(() => { void refresh(); }, [refresh]);

    // Realtime is off (#49), so check for the other side's changes every 30 s while the tab is visible
    useEffect(() => {
        const timer = window.setInterval(() => {
            if (document.visibilityState === "visible" && !uploading) void refresh();
        }, REFRESH_MS);
        return () => window.clearInterval(timer);
    }, [refresh, uploading]);

    useEffect(() => {
        if (!uploading) return;
        const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [uploading]);

    const labels = useMemo(() => {
        const map = new Map<string, string>();
        if (album) albumPageLabels(album.pages).forEach((label, i) => map.set(album.pages[i].id, label));
        return map;
    }, [album]);

    const visiblePages = useMemo(
        () => (album ? (mode !== "photographer" ? album.pages.filter((p) => p.sentVersion !== null) : album.pages) : []),
        [album, mode]
    );

    const run = async (key: string, task: () => Promise<unknown>) => {
        setBusy(key);
        try {
            await task();
        } catch (e) {
            await alertDialog({ title: "That didn't work", message: e instanceof Error ? e.message : "Please try again." });
        } finally {
            setBusy(null);
        }
    };

    const updateUpload = (key: string, patch: Partial<UploadItem>) =>
        setUploads((items) => items.map((item) => (item.key === key ? { ...item, ...patch } : item)));

    const uploadPages = async (selected: File[]) => {
        if (!album || !selected.length) return;
        const files = sortByFileName(selected);
        const items: UploadItem[] = files.map((file) => {
            const problem = checkFile(file);
            return { key: `${file.name}-${file.size}-${Math.random()}`, name: file.name, progress: 0, state: problem ? "failed" : "waiting", error: problem ?? undefined };
        });
        setUploads((current) => [...current.filter((u) => u.state !== "done"), ...items]);
        const created: (string | null)[] = files.map(() => null);
        let next = 0;
        const worker = async () => {
            while (next < files.length) {
                const i = next++;
                if (items[i].state === "failed") continue;
                updateUpload(items[i].key, { state: "uploading" });
                try {
                    const result = await albumApi.uploadPage(album.id, files[i], (fraction) => {
                        updateUpload(items[i].key, { progress: fraction, state: fraction >= 1 ? "processing" : "uploading" });
                    });
                    created[i] = result.page?.id ?? null;
                    updateUpload(items[i].key, { state: "done", progress: 1 });
                } catch (e) {
                    updateUpload(items[i].key, { state: "failed", error: e instanceof Error ? e.message : "Upload failed" });
                }
            }
        };
        await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, worker));
        // Uploads finish in any order; put the new pages in file-name order after the existing ones
        const added = created.filter((id): id is string => Boolean(id));
        if (added.length > 1) {
            try {
                const ids = (await albumApi.get(album.id)).album.pages.map((p) => p.id);
                if (added.every((id) => ids.includes(id))) {
                    setAlbum((await albumApi.reorder(album.id, [...ids.filter((id) => !added.includes(id)), ...added])).album);
                    return;
                }
            } catch { /* the order can still be fixed by dragging */ }
        }
        await refresh();
    };

    const uploadVersion = async (page: AlbumPage, file: File) => {
        const problem = checkFile(file);
        if (problem) throw new Error(`${problem}.`);
        await albumApi.uploadVersion(albumId, page.id, file);
        await refresh();
    };

    const movePage = async (fromId: string, toId: string) => {
        if (!album || fromId === toId) return;
        // The dragged page takes the target's place; the pages in between shift by one
        const ids = album.pages.map((p) => p.id);
        const to = ids.indexOf(toId);
        ids.splice(ids.indexOf(fromId), 1);
        ids.splice(to, 0, fromId);
        const byId = new Map(album.pages.map((p) => [p.id, p]));
        setAlbum({ ...album, pages: ids.map((id) => byId.get(id)!) });
        await run("reorder", async () => setAlbum((await albumApi.reorder(album.id, ids)).album));
    };

    if (!album || !mode) {
        return (
            <div className="flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
                {error ? (
                    <>
                        <p className="text-sm font-bold text-rose-300">{error}</p>
                        <button type="button" className={albumButton.secondary} onClick={onBack}>Back to albums</button>
                    </>
                ) : <Loader2 className="h-6 w-6 animate-spin text-[#CA9C68]" />}
            </div>
        );
    }

    const locked = album.status === "approved";
    const allApproved = album.pageCount > 0 && album.approvedCount === album.pageCount && album.unsentCount === 0;
    const openRequests = album.pages.flatMap((page) => {
        const numbers = pinNumbers(page.comments);
        return page.comments
            .filter((c) => !c.parentId && !c.isDraft && c.status === "open")
            .map((comment) => ({ page, comment, number: numbers.get(comment.id) }));
    });

    const sendForReview = () => run("send", async () => {
        const n = album.unsentCount;
        if (!await confirmDialog({
            title: `Send ${n === 1 ? "1 page" : `${n} pages`} for review?`,
            message: "The event owner and admins get a notification and can comment on each page.",
            confirmLabel: "Send",
        })) return;
        setAlbum((await albumApi.send(album.id)).album);
    });

    const sendFeedback = () => run("feedback", async () => {
        const n = album.myDraftCount;
        if (!await confirmDialog({
            title: n ? `Send ${n === 1 ? "1 comment" : `${n} comments`} to the photographer?` : "Tell the photographer you're done?",
            message: `${album.approvedCount} of ${album.pageCount} pages approved. The photographer gets a notification.`,
            confirmLabel: "Send feedback",
        })) return;
        setAlbum((await albumApi.sendFeedback(album.id)).album);
    });

    const approveAlbum = () => run("approve", async () => {
        if (!await confirmDialog({
            title: "Approve the album for print?",
            message: "Every page is approved. The album is locked with today's date; it can be reopened if something needs to change.",
            confirmLabel: "Approve album",
        })) return;
        setAlbum((await albumApi.approve(album.id)).album);
    });

    return (
        <div
            className="space-y-5"
            onDragOver={(e) => { if (mode === "photographer" && !locked && e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDropActive(true); } }}
            onDragLeave={(e) => { if (e.currentTarget === e.target) setDropActive(false); }}
            onDrop={(e) => {
                if (!e.dataTransfer.files.length) return;
                e.preventDefault();
                setDropActive(false);
                if (mode === "photographer" && !locked) void uploadPages(Array.from(e.dataTransfer.files));
            }}
        >
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <button type="button" onClick={onBack} className="mb-2 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white">
                        <ArrowLeft className="h-4 w-4" /> All albums
                    </button>
                    {editingTitle !== null ? (
                        <form
                            className="flex items-center gap-2"
                            onSubmit={(e) => {
                                e.preventDefault();
                                void run("rename", async () => { setAlbum((await albumApi.rename(album.id, editingTitle)).album); setEditingTitle(null); });
                            }}
                        >
                            <input value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} maxLength={80} autoFocus className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/40 px-3 py-2 font-serif text-xl font-bold text-white outline-none focus:border-[#CA9C68]" />
                            <button type="submit" className={albumButton.ghost} aria-label="Save name" disabled={busy === "rename"}><Check className="h-5 w-5" /></button>
                            <button type="button" className={albumButton.ghost} aria-label="Cancel" onClick={() => setEditingTitle(null)}><X className="h-5 w-5" /></button>
                        </form>
                    ) : (
                        <h4 className="truncate font-serif text-2xl font-bold text-[#FFF7EB] sm:text-3xl">{album.title}</h4>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-400">
                        <AlbumStatusChip status={album.status} />
                        <span>{album.pageCount} {album.pageCount === 1 ? "page" : "pages"}</span>
                        {album.currentRound > 0 && <span>· Round {album.currentRound}</span>}
                        {locked && album.approvedAt && <span>· Approved by {album.approvedByName} on {new Date(album.approvedAt).toLocaleDateString()}</span>}
                    </div>
                    {album.rolesAssigned && (
                        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-400">
                            <span><Camera className="mr-1 inline h-3.5 w-3.5 text-[#CA9C68]" />Photographer: <span className="font-bold text-slate-200">{album.roles.photographer?.name}</span></span>
                            <span><Heart className="mr-1 inline h-3.5 w-3.5 text-[#CA9C68]" />Client: <span className="font-bold text-slate-200">{album.roles.clients.map((p) => p.name).join(", ")}</span></span>
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-300">
                                {mode === "photographer" ? "You: Photographer" : mode === "client" ? "You: Client" : "View only"}
                            </span>
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <button type="button" className={albumButton.ghost} onClick={() => setMenuOpen(!menuOpen)} aria-label="Album options" aria-expanded={menuOpen}>
                            <MoreHorizontal className="h-5 w-5" />
                        </button>
                        {menuOpen && (
                            <div className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-2xl border border-white/10 bg-[#13191F] py-1 shadow-2xl" onMouseLeave={() => setMenuOpen(false)}>
                                <button type="button" className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-bold text-slate-200 hover:bg-white/5" onClick={() => { setMenuOpen(false); setEditingTitle(album.title); }}>
                                    <Pencil className="h-4 w-4" /> Rename
                                </button>
                                <button type="button" className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-bold text-slate-200 hover:bg-white/5" onClick={() => { setMenuOpen(false); setRolesOpen(true); }}>
                                    <Users className="h-4 w-4" /> {album.rolesAssigned ? "Change roles" : "Assign roles"}
                                </button>
                                {locked && (
                                    <button type="button" className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-bold text-slate-200 hover:bg-white/5" onClick={() => { setMenuOpen(false); void run("reopen", async () => setAlbum((await albumApi.reopen(album.id)).album)); }}>
                                        <RotateCcw className="h-4 w-4" /> Reopen album
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-bold text-rose-300 hover:bg-rose-500/10"
                                    onClick={async () => {
                                        setMenuOpen(false);
                                        if (!await confirmDialog({ title: `Delete “${album.title}”?`, message: "Every page, version, comment and voice note in it is deleted for good.", confirmLabel: "Delete album", tone: "danger" })) return;
                                        await run("delete", async () => { await albumApi.remove(album.id); onBack(); });
                                    }}
                                >
                                    <Trash2 className="h-4 w-4" /> Delete album
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {!album.rolesAssigned && (
                <div className="flex flex-col gap-3 rounded-[1.2rem] border border-[#CA9C68]/50 bg-[#CA9C68]/[0.08] p-4 sm:flex-row sm:items-center sm:p-5">
                    <Users className="h-6 w-6 shrink-0 text-[#CA9C68]" />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-white">Assign the photographer and the client</p>
                        <p className="mt-1 text-xs font-semibold text-slate-400">Pick them from the event host and guests with Admin Access. Nothing can be uploaded or reviewed until then.</p>
                    </div>
                    <button type="button" className={albumButton.primary} onClick={() => setRolesOpen(true)}>Assign roles</button>
                </div>
            )}

            {/* Progress and the main action for this side */}
            <div className="flex flex-col gap-4 rounded-[1.2rem] border border-[#CA9C68]/25 bg-[linear-gradient(135deg,rgba(202,156,104,0.10),rgba(27,33,31,0.5)_60%)] p-4 sm:flex-row sm:items-center sm:p-5">
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-white">
                        {album.approvedCount} of {album.pageCount} pages approved
                        {album.changesCount > 0 && <span className="text-rose-300"> · {album.changesCount} need changes</span>}
                    </p>
                    <ProgressBar value={album.approvedCount} total={album.pageCount} className="mt-2" />
                    <p className="mt-2 text-xs font-semibold text-slate-400">
                        {mode === "photographer"
                            ? album.unsentCount
                                ? `${album.unsentCount} ${album.unsentCount === 1 ? "page isn't" : "pages aren't"} sent yet.`
                                : album.openRequestCount ? `${album.openRequestCount} ${album.openRequestCount === 1 ? "change" : "changes"} to do.` : album.currentRound ? "Waiting for the client." : "Upload the album pages to start."
                            : mode === "viewer"
                                ? "View only: you're not the photographer or the client in this album."
                                : album.myDraftCount
                                ? `${album.myDraftCount} ${album.myDraftCount === 1 ? "comment" : "comments"} not sent yet.`
                                : album.currentRound ? "Open a page to comment on it, or approve it." : "The photographer hasn't sent any pages yet."}
                    </p>
                </div>
                {!locked && (mode === "photographer" ? (
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                            ref={fileRef}
                            type="file"
                            multiple
                            accept="image/jpeg,image/png,image/webp,image/tiff"
                            className="hidden"
                            onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ""; void uploadPages(files); }}
                        />
                        <button type="button" className={albumButton.secondary} onClick={() => fileRef.current?.click()}>
                            <Upload className="h-4 w-4" /> Upload pages
                        </button>
                        <button type="button" className={albumButton.primary} disabled={!album.unsentCount || busy === "send" || uploading} onClick={sendForReview}>
                            {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            Send for review{album.unsentCount ? ` (${album.unsentCount})` : ""}
                        </button>
                    </div>
                ) : mode === "client" && album.currentRound > 0 && (
                    <div className="flex flex-col gap-2 sm:flex-row">
                        {allApproved && (
                            <button type="button" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-emerald-400 disabled:opacity-50" disabled={busy === "approve"} onClick={approveAlbum}>
                                <CheckCircle2 className="h-4 w-4" /> Approve album
                            </button>
                        )}
                        <button type="button" className={albumButton.primary} disabled={busy === "feedback"} onClick={sendFeedback}>
                            {busy === "feedback" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            Send feedback{album.myDraftCount ? ` (${album.myDraftCount})` : ""}
                        </button>
                    </div>
                ))}
                {locked && (
                    <span className="inline-flex items-center gap-2 text-sm font-black text-emerald-200"><CheckCircle2 className="h-5 w-5" /> Approved for print</span>
                )}
            </div>

            {/* Uploads */}
            {uploads.length > 0 && (
                <div className="space-y-2 rounded-[1.2rem] border border-white/10 bg-black/30 p-4">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                            Uploads · {uploads.filter((u) => u.state === "done").length} of {uploads.length} done
                        </p>
                        {!uploading && <button type="button" className={albumButton.ghost} onClick={() => setUploads([])}>Clear</button>}
                    </div>
                    <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                        {uploads.map((u) => (
                            <div key={u.key} className="flex items-center gap-3 text-xs">
                                <span className="min-w-0 flex-1 truncate font-bold text-slate-200">{u.name}</span>
                                {u.state === "failed" ? (
                                    <span className="max-w-[60%] truncate font-bold text-rose-300" title={u.error}>{u.error}</span>
                                ) : u.state === "done" ? (
                                    <Check className="h-4 w-4 text-emerald-300" />
                                ) : (
                                    <span className="flex w-32 items-center gap-2">
                                        <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10"><span className="block h-full bg-[#CA9C68]" style={{ width: `${Math.round(u.progress * 100)}%` }} /></span>
                                        <span className="w-16 text-right font-bold text-slate-400">{u.state === "processing" ? "Processing" : u.state === "waiting" ? "Waiting" : `${Math.round(u.progress * 100)}%`}</span>
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Photographer: what the client asked for */}
            {mode === "photographer" && openRequests.length > 0 && (
                <div className="rounded-[1.2rem] border border-rose-400/25 bg-rose-500/[0.04] p-4 sm:p-5">
                    <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-rose-200">Changes to do · {openRequests.length}</p>
                    <div className="space-y-2">
                        {openRequests.map(({ page, comment, number }) => (
                            <div key={comment.id} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/30 p-3">
                                <button type="button" onClick={() => setViewing(visiblePages.findIndex((p) => p.id === page.id))} className="shrink-0">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={page.versions.find((v) => v.version === comment.version)?.thumbnailUrl ?? page.versions.at(-1)?.thumbnailUrl} alt="" className="h-14 w-24 rounded-lg bg-black object-contain" />
                                </button>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-slate-400">
                                        {labels.get(page.id)} · {comment.pinX !== null ? `pin ${number}` : "whole page"} · {comment.authorName}
                                    </p>
                                    <p className="text-sm font-black text-[#E8C9A0]">{albumCommentKindLabel(comment.kind)}</p>
                                    {comment.body && <p className="mt-0.5 line-clamp-2 text-sm text-slate-200">{comment.body}</p>}
                                    {comment.voiceUrl && <audio src={comment.voiceUrl} controls preload="none" className="mt-1.5 h-8 w-full max-w-xs" />}
                                    {comment.replacementPhoto?.thumbnailUrl && (
                                        <a href={comment.replacementPhoto.previewUrl ?? undefined} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={comment.replacementPhoto.thumbnailUrl} alt="" className="h-8 w-8 rounded object-cover" /> Replacement photo
                                        </a>
                                    )}
                                </div>
                                <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                                    <button type="button" className={albumButton.ghost} onClick={() => setViewing(visiblePages.findIndex((p) => p.id === page.id))}>
                                        <MessageSquare className="h-3.5 w-3.5" /> Open
                                    </button>
                                    <button type="button" className={albumButton.ghost} disabled={busy === comment.id} onClick={() => run(comment.id, async () => { await albumApi.setCommentStatus(album.id, comment.id, "done"); await refresh(); })}>
                                        <Check className="h-3.5 w-3.5" /> Done
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Pages */}
            {visiblePages.length === 0 ? (
                <div className={cn("flex flex-col items-center gap-3 rounded-[1.2rem] border-2 border-dashed p-10 text-center", dropActive ? "border-[#CA9C68] bg-[#CA9C68]/5" : "border-white/10")}>
                    <Upload className="h-8 w-8 text-[#CA9C68]" />
                    {mode === "photographer" ? (
                        <>
                            <p className="font-serif text-xl font-bold text-[#FFF7EB]">Add the album pages</p>
                            <p className="max-w-md text-sm font-semibold text-slate-400">
                                Drop the page designs here, one image per page or per spread. They&apos;re numbered by file name (01.jpg, 02.jpg…). We keep a sharp preview only; your original files aren&apos;t stored.
                            </p>
                            <button type="button" className={albumButton.primary} onClick={() => fileRef.current?.click()} disabled={locked}><Upload className="h-4 w-4" /> Choose files</button>
                        </>
                    ) : (
                        <p className="max-w-md text-sm font-semibold text-slate-400">
                            {mode === "client" ? "No pages to review yet. You'll get a notification when the photographer sends them." : "No pages have been sent for review yet."}
                        </p>
                    )}
                </div>
            ) : (
                <div className={cn("grid grid-cols-1 gap-4 rounded-[1.2rem] sm:grid-cols-2 xl:grid-cols-3", dropActive && "outline-dashed outline-2 outline-offset-4 outline-[#CA9C68]")}>
                    {visiblePages.map((page, index) => {
                        const shown = mode !== "photographer" ? page.versions.find((v) => v.version === page.sentVersion) : page.versions.at(-1);
                        const requests = page.comments.filter((c) => !c.parentId && c.status === "open" && (!c.isDraft || c.authorId === album.viewer.id)).length;
                        const updated = mode !== "photographer" && (page.sentVersion ?? 0) > 1 && page.versions.find((v) => v.version === page.sentVersion)?.round === album.currentRound;
                        return (
                            <div
                                key={page.id}
                                draggable={mode === "photographer" && !locked}
                                onDragStart={(e) => { setDragId(page.id); e.dataTransfer.effectAllowed = "move"; }}
                                onDragOver={(e) => { if (dragId) e.preventDefault(); }}
                                onDrop={(e) => { if (dragId) { e.preventDefault(); e.stopPropagation(); void movePage(dragId, page.id); setDragId(null); } }}
                                onDragEnd={() => setDragId(null)}
                                className={cn(
                                    "group overflow-hidden rounded-[1.2rem] border bg-neutral-950 transition-colors",
                                    dragId === page.id ? "border-[#CA9C68] opacity-50" : "border-white/10 hover:border-white/25"
                                )}
                            >
                                <button type="button" onClick={() => setViewing(index)} className="relative block aspect-[2/1] w-full bg-black/60" aria-label={`Open ${labels.get(page.id)}`}>
                                    {shown && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={shown.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-contain" />
                                    )}
                                    {updated && <span className="absolute left-2 top-2 rounded-full bg-[#CA9C68] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#13191F]">Updated</span>}
                                    {requests > 0 && (
                                        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/75 px-2 py-0.5 text-[11px] font-black text-white">
                                            <MessageSquare className="h-3 w-3" /> {requests}
                                        </span>
                                    )}
                                </button>
                                <div className="flex items-center gap-2 p-3">
                                    {mode === "photographer" && !locked && <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-600" aria-hidden />}
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-black text-white">{labels.get(page.id)}</p>
                                        <p className="truncate text-[11px] font-semibold text-slate-500">
                                            {page.latestVersion > 1 ? `v${mode !== "photographer" ? page.sentVersion : page.latestVersion}` : "v1"}
                                            {mode === "photographer" && page.latestVersion > (page.sentVersion ?? 0) ? " · not sent" : ""}
                                            {page.versions.at(-1)?.fileName ? ` · ${page.versions.at(-1)!.fileName}` : ""}
                                        </p>
                                    </div>
                                    <PageStatusChip status={page.status} />
                                </div>
                                {mode === "photographer" && !locked && (
                                    <div className="flex items-center justify-between gap-1 border-t border-white/5 px-2 py-1.5">
                                        <div className="flex rounded-lg border border-white/10 p-0.5" role="group" aria-label="Layout">
                                            {(["spread", "single"] as const).map((layout) => (
                                                <button
                                                    key={layout}
                                                    type="button"
                                                    aria-pressed={page.layout === layout}
                                                    onClick={() => page.layout !== layout && run(`layout-${page.id}`, async () => setAlbum((await albumApi.setLayout(album.id, page.id, layout)).album))}
                                                    className={cn("rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wider", page.layout === layout ? "bg-white/15 text-white" : "text-slate-500 hover:text-slate-300")}
                                                >{layout === "spread" ? "Spread" : "Single"}</button>
                                            ))}
                                        </div>
                                        <button
                                            type="button"
                                            className={cn(albumButton.ghost, "hover:text-rose-300")}
                                            aria-label={`Delete ${labels.get(page.id)}`}
                                            disabled={busy === `delete-${page.id}`}
                                            onClick={async () => {
                                                if (!await confirmDialog({ title: `Delete ${labels.get(page.id)}?`, message: "All its versions and comments are deleted too.", confirmLabel: "Delete page", tone: "danger" })) return;
                                                await run(`delete-${page.id}`, async () => setAlbum((await albumApi.removePage(album.id, page.id)).album));
                                            }}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {album.rounds.length > 0 && (
                <details className="rounded-[1.2rem] border border-white/10 p-4">
                    <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-slate-400">Review history</summary>
                    <ul className="mt-3 space-y-1.5 text-xs font-semibold text-slate-400">
                        {[...album.rounds].reverse().map((r) => (
                            <li key={r.number}>
                                Round {r.number}: {r.sentByName ?? "Someone"} sent {r.pageCount} {r.pageCount === 1 ? "page" : "pages"}
                                {r.updatedPageCount ? ` (${r.updatedPageCount} updated)` : ""} on {new Date(r.sentAt).toLocaleString()}
                            </li>
                        ))}
                        {album.approvedAt && <li className="text-emerald-300">Approved for print by {album.approvedByName} on {new Date(album.approvedAt).toLocaleString()}</li>}
                    </ul>
                </details>
            )}

            {rolesOpen && (
                <RolesDialog
                    eventId={album.eventId}
                    albumId={album.id}
                    title={album.rolesAssigned ? "Change roles" : "Assign roles"}
                    initial={{ photographerId: album.roles.photographer?.id, clientIds: album.roles.clients.map((p) => p.id) }}
                    onClose={() => setRolesOpen(false)}
                    onSaved={(updated) => { setAlbum(updated); setRolesOpen(false); }}
                />
            )}

            {viewing !== null && visiblePages[viewing] && (
                <PageReviewer
                    album={album}
                    pages={visiblePages}
                    labels={labels}
                    index={viewing}
                    mode={mode}
                    onIndexChange={setViewing}
                    onClose={() => setViewing(null)}
                    onAlbum={setAlbum}
                    refresh={refresh}
                    onUploadVersion={uploadVersion}
                />
            )}
        </div>
    );
}

