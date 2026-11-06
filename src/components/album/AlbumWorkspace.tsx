"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ArrowLeft, ArrowRight, ArrowUpDown, BookOpen, Camera, Check, CheckCircle2, Clock, GripVertical, Heart, History, ImageUp, Loader2, MessageSquare,
    MoreHorizontal, Pencil, Play, Plus, RectangleVertical, RotateCcw, Send, Trash2, Upload, Users, X,
} from "lucide-react";
import {
    ALBUM_MAX_PAGE_BYTES, ALBUM_PAGE_TYPES, albumApi, albumCommentKindLabel, albumPageLabels, sortByFileName,
    type AlbumDetail, type AlbumPage, type AlbumPageLayout, type AlbumPageVersion,
} from "@/lib/albumApi";
import { alertDialog, confirmDialog } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import { PageReviewer, type AlbumMode } from "./PageReviewer";
import { albumButton, pinNumbers, ProgressBar } from "./albumUi";
import { RolesDialog } from "./RolePicker";
import type { AlbumNextStepTone } from "../../../shared/text/albumNextStep";
import {
    ALBUM_PAGE_FILTERS, ALBUM_PAGE_STATE, ALBUM_STEPS, albumPageState, albumStep, albumWorkspaceStatus, formatAlbumDay, type AlbumPageState,
} from "../../../shared/text/albumWorkspace";

type UploadItem = { key: string; name: string; progress: number; state: "waiting" | "uploading" | "processing" | "done" | "failed"; error?: string };

const PAGE_EXTENSIONS = /\.(jpe?g|png|webp|tiff?)$/i;
const REFRESH_MS = 30_000;
const UPLOAD_CONCURRENCY = 2;

/** Page tiles are about this tall; their width follows the page's shape. */
const TILE_HEIGHT_REM = 13;

const TONE_TEXT: Record<AlbumNextStepTone, string> = {
    action: "text-[var(--site-gold-light-text)]",
    urgent: "text-rose-300 light:text-rose-700",
    waiting: "text-[var(--site-muted)]",
    done: "text-emerald-300 light:text-emerald-700",
};
const TONE_DOT: Record<AlbumNextStepTone, string> = {
    action: "bg-[var(--site-gold)]",
    urgent: "bg-rose-400",
    waiting: "bg-[var(--site-tint)]/30",
    done: "bg-emerald-400",
};
const TONE_ICON: Record<AlbumNextStepTone, typeof Clock> = { action: ArrowRight, urgent: MessageSquare, waiting: Clock, done: CheckCircle2 };

const menuItem = "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-bold text-[var(--site-text)] hover:bg-[var(--site-tint)]/5";

/** Width over height of the page as uploaded; a guess from its layout when the size is unknown. */
function pageRatio(version: AlbumPageVersion | undefined, layout: AlbumPageLayout) {
    const ratio = version?.width && version.height ? version.width / version.height : layout === "spread" ? 2 : 0.75;
    return Math.min(Math.max(ratio, 0.5), 3);
}

function StepTracker({ step, round }: { step: number; round: number }) {
    const currentLabel = ALBUM_STEPS[step];
    return (
        <div>
            <ol className="flex items-center gap-2" aria-label="Album progress">
                {ALBUM_STEPS.map((label, i) => {
                    const done = i < step;
                    const current = i === step;
                    return (
                        <li key={label} className={cn("flex min-w-0 items-center gap-2", i < ALBUM_STEPS.length - 1 && "flex-1")} aria-current={current ? "step" : undefined}>
                            <span className={cn(
                                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-black",
                                done ? "border-[var(--site-gold)] bg-[var(--site-gold)] text-[var(--site-on-gold)]"
                                    : current ? "border-[var(--site-gold)] text-[var(--site-gold-light-text)]" : "border-[var(--site-tint)]/15 text-[var(--site-muted)]"
                            )}>
                                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                            </span>
                            <span className={cn(
                                "whitespace-nowrap text-xs font-bold",
                                "hidden md:inline", current ? "text-[var(--site-gold-light-text)]" : done ? "text-[var(--site-text)]" : "text-[var(--site-muted)]"
                            )}>
                                {label}{i === 2 && round > 0 ? ` · Round ${round}` : ""}
                            </span>
                            {i < ALBUM_STEPS.length - 1 && <span className="h-px min-w-3 flex-1 bg-[var(--site-tint)]/15" aria-hidden />}
                        </li>
                    );
                })}
            </ol>
            {/* Phones show the dots only, and the current step in words under them */}
            <p className="mt-2 text-xs font-bold text-[var(--site-gold-light-text)] md:hidden">
                {currentLabel ? `Step ${step + 1} of ${ALBUM_STEPS.length}: ${currentLabel}${step === 2 && round > 0 ? ` · Round ${round}` : ""}` : "All steps done"}
            </p>
        </div>
    );
}

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
    const [filter, setFilter] = useState<"all" | AlbumPageState>("all");
    const [reorder, setReorder] = useState(false);
    const [pageMenu, setPageMenu] = useState<string | null>(null);
    const [replaceId, setReplaceId] = useState<string | null>(null);
    const [historyOpen, setHistoryOpen] = useState(false);
    const replaceRef = useRef<HTMLInputElement>(null);
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

    // A page's ⋯ menu closes on Escape or a click anywhere outside it
    useEffect(() => {
        if (!pageMenu) return;
        const onPointer = (e: PointerEvent) => { if (!(e.target as Element).closest?.("[data-page-menu]")) setPageMenu(null); };
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPageMenu(null); };
        document.addEventListener("pointerdown", onPointer);
        document.addEventListener("keydown", onKey);
        return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
    }, [pageMenu]);

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
                        <p className="text-sm font-bold text-rose-300 light:text-rose-700">{error}</p>
                        <button type="button" className={albumButton.secondary} onClick={onBack}>Back to albums</button>
                    </>
                ) : <Loader2 className="h-6 w-6 animate-spin text-[var(--site-gold-text)]" />}
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

    const pageState = (page: AlbumPage) => albumPageState(page, mode, album.viewer.id);
    const stateCounts: Partial<Record<AlbumPageState, number>> = {};
    for (const page of visiblePages) stateCounts[pageState(page)] = (stateCounts[pageState(page)] ?? 0) + 1;
    const filters = ALBUM_PAGE_FILTERS[mode];
    // A tab that empties (its last page was approved or sent) falls back to All
    const activeFilter = filter !== "all" && !stateCounts[filter] ? "all" : filter;
    const shownPages = activeFilter === "all" ? visiblePages : visiblePages.filter((p) => pageState(p) === activeFilter);
    const toCheck = stateCounts.check ?? 0;
    const status = albumWorkspaceStatus(album, mode, toCheck);
    const StatusIcon = TONE_ICON[status.tone];
    const activity = [
        ...album.rounds.map((r) => ({
            at: r.sentAt,
            text: `Round ${r.number}: ${r.sentByName ?? "the photographer"} sent ${r.pageCount === 1 ? "1 page" : `${r.pageCount} pages`}${r.updatedPageCount ? ` (${r.updatedPageCount} updated)` : ""}`,
            done: false,
        })),
        ...album.pages.filter((p) => p.approvedAt).map((p) => ({ at: p.approvedAt!, text: `${p.approvedByName ?? "The client"} approved ${labels.get(p.id)}`, done: false })),
        ...(album.approvedAt ? [{ at: album.approvedAt, text: `${album.approvedByName ?? "The client"} approved the album for print`, done: true }] : []),
    ].sort((a, b) => b.at.localeCompare(a.at));

    const quickApprove = (page: AlbumPage) => run(`approve-${page.id}`, async () => {
        const open = page.comments.filter((c) => !c.parentId && !c.isDraft && c.status === "open").length;
        if (open && !await confirmDialog({ title: `Approve ${labels.get(page.id)}?`, message: `This also marks ${open === 1 ? "the open request" : `the ${open} open requests`} on it as done.`, confirmLabel: "Approve" })) return;
        setAlbum((await albumApi.approvePage(album.id, page.id, true)).album);
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
                    <button type="button" onClick={onBack} className="mb-2 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-[var(--site-muted)] hover:text-[var(--site-text)]">
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
                            <input value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} maxLength={80} autoFocus className="min-w-0 flex-1 rounded-xl border border-[var(--site-tint)]/15 bg-black/40 light:bg-[var(--site-tint)]/[0.04] px-3 py-2 font-serif text-xl font-bold text-[var(--site-text)] outline-none focus:border-[var(--site-gold)]" />
                            <button type="submit" className={albumButton.ghost} aria-label="Save name" disabled={busy === "rename"}><Check className="h-5 w-5" /></button>
                            <button type="button" className={albumButton.ghost} aria-label="Cancel" onClick={() => setEditingTitle(null)}><X className="h-5 w-5" /></button>
                        </form>
                    ) : (
                        <h4 className="truncate font-serif text-2xl font-bold text-[var(--site-text)] sm:text-3xl">{album.title}</h4>
                    )}
                    {album.rolesAssigned && (
                        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-[var(--site-muted)]">
                            <span className="inline-flex items-center gap-1.5" title="Photographer">
                                <Camera className="h-4 w-4 text-[var(--site-gold-text)]" aria-label="Photographer" />
                                <span className="text-[var(--site-text)]">{album.roles.photographer?.name}</span>{mode === "photographer" && " (you)"}
                            </span>
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                            <span className="inline-flex items-center gap-1.5" title="Client">
                                <Heart className="h-4 w-4 text-[var(--site-gold-text)]" aria-label="Client" />
                                <span className="text-[var(--site-text)]">{album.roles.clients.map((p) => p.name).join(", ")}</span>{mode === "client" && " (you)"}
                            </span>
                            {mode === "viewer" && <span className="rounded-full bg-[var(--site-tint)]/10 px-2 py-0.5 text-[11px] font-bold text-[var(--site-subtle)]">View only</span>}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <button type="button" className={albumButton.ghost} onClick={() => setMenuOpen(!menuOpen)} aria-label="Album options" aria-expanded={menuOpen}>
                            <MoreHorizontal className="h-5 w-5" />
                        </button>
                        {menuOpen && (
                            <div className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-2xl border border-[var(--site-tint)]/10 bg-[var(--site-bg)] py-1 shadow-2xl" onMouseLeave={() => setMenuOpen(false)}>
                                <button type="button" className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-bold text-[var(--site-text)] hover:bg-[var(--site-tint)]/5" onClick={() => { setMenuOpen(false); setEditingTitle(album.title); }}>
                                    <Pencil className="h-4 w-4" /> Rename
                                </button>
                                <button type="button" className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-bold text-[var(--site-text)] hover:bg-[var(--site-tint)]/5" onClick={() => { setMenuOpen(false); setRolesOpen(true); }}>
                                    <Users className="h-4 w-4" /> {album.rolesAssigned ? "Change roles" : "Assign roles"}
                                </button>
                                {locked && (
                                    <button type="button" className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-bold text-[var(--site-text)] hover:bg-[var(--site-tint)]/5" onClick={() => { setMenuOpen(false); void run("reopen", async () => setAlbum((await albumApi.reopen(album.id)).album)); }}>
                                        <RotateCcw className="h-4 w-4" /> Reopen album
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-bold text-rose-300 light:text-rose-700 hover:bg-rose-500/10"
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
                <div className="flex flex-col gap-3 rounded-[1.2rem] border border-[var(--site-gold)]/50 bg-[var(--site-gold)]/[0.08] p-4 sm:flex-row sm:items-center sm:p-5">
                    <Users className="h-6 w-6 shrink-0 text-[var(--site-gold-text)]" />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-[var(--site-text)]">Assign the photographer and the client</p>
                        <p className="mt-1 text-xs font-semibold text-[var(--site-muted)]">Pick them from the event host and guests with Admin Access. Nothing can be uploaded or reviewed until then.</p>
                    </div>
                    <button type="button" className={albumButton.primary} onClick={() => setRolesOpen(true)}>Assign roles</button>
                </div>
            )}

            <StepTracker step={albumStep(album)} round={album.currentRound} />

            {/* What now: where the album stands for this side, and at most one main action */}
            <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/tiff"
                className="hidden"
                onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ""; void uploadPages(files); }}
            />
            <div className="flex flex-col gap-4 rounded-[1.2rem] border border-[var(--site-border)] bg-[var(--site-card)] p-4 sm:flex-row sm:items-center sm:p-5">
                <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-base font-black text-[var(--site-text)]">
                        <StatusIcon className={cn("h-5 w-5 shrink-0", TONE_TEXT[status.tone])} /> {status.title}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[var(--site-muted)]">{status.detail}</p>
                    {visiblePages.length > 0 && (
                        <>
                            <ProgressBar value={album.approvedCount} total={visiblePages.length} className="mt-3" />
                            <p className="mt-1.5 text-xs font-semibold text-[var(--site-muted)]">
                                <span className="text-[var(--site-text)]">{album.approvedCount}</span> of {visiblePages.length} pages approved
                                {filters.flatMap((f) => (f.id !== "all" && f.id !== "approved" && stateCounts[f.id] ? [` · ${stateCounts[f.id]} ${ALBUM_PAGE_STATE[f.id].counted}`] : [])).join("")}
                            </p>
                        </>
                    )}
                </div>
                {!locked && album.rolesAssigned && (mode === "photographer" ? (
                    <div className="flex flex-col gap-2 sm:flex-row">
                        {album.openRequestCount > 0 && activeFilter !== "fix" && (
                            <button type="button" className={albumButton.secondary} onClick={() => { setReorder(false); setFilter("fix"); }}>
                                <MessageSquare className="h-4 w-4" /> See changes
                            </button>
                        )}
                        <button type="button" className={albumButton.secondary} onClick={() => fileRef.current?.click()}>
                            <Plus className="h-4 w-4" /> Add pages
                        </button>
                        {album.unsentCount > 0 && (
                            <button type="button" className={albumButton.primary} disabled={busy === "send" || uploading} onClick={sendForReview}>
                                {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                Send {album.unsentCount === 1 ? "1 page" : `${album.unsentCount} pages`}
                            </button>
                        )}
                    </div>
                ) : mode === "client" && album.currentRound > 0 && (
                    <div className="flex flex-col gap-2 sm:flex-row">
                        {allApproved ? (
                            <button type="button" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-emerald-400 disabled:opacity-50" disabled={busy === "approve"} onClick={approveAlbum}>
                                <CheckCircle2 className="h-4 w-4" /> Approve album
                            </button>
                        ) : toCheck > 0 && (
                            <button type="button" className={album.myDraftCount ? albumButton.secondary : albumButton.primary} onClick={() => setViewing(visiblePages.findIndex((p) => pageState(p) === "check"))}>
                                <Play className="h-4 w-4" /> {album.approvedCount || album.changesCount ? "Continue review" : "Start review"}
                            </button>
                        )}
                        {!allApproved && (
                            <button type="button" className={album.myDraftCount ? albumButton.primary : albumButton.secondary} disabled={busy === "feedback"} onClick={sendFeedback}>
                                {busy === "feedback" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                {album.myDraftCount ? `Send ${album.myDraftCount === 1 ? "1 note" : `${album.myDraftCount} notes`}` : "Send feedback"}
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* Uploads */}
            {uploads.length > 0 && (
                <div className="space-y-2 rounded-[1.2rem] border border-[var(--site-tint)]/10 bg-black/30 light:bg-[var(--site-tint)]/[0.04] p-4">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--site-muted)]">
                            Uploads · {uploads.filter((u) => u.state === "done").length} of {uploads.length} done
                        </p>
                        {!uploading && <button type="button" className={albumButton.ghost} onClick={() => setUploads([])}>Clear</button>}
                    </div>
                    <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                        {uploads.map((u) => (
                            <div key={u.key} className="flex items-center gap-3 text-xs">
                                <span className="min-w-0 flex-1 truncate font-bold text-[var(--site-text)]">{u.name}</span>
                                {u.state === "failed" ? (
                                    <span className="max-w-[60%] truncate font-bold text-rose-300 light:text-rose-700" title={u.error}>{u.error}</span>
                                ) : u.state === "done" ? (
                                    <Check className="h-4 w-4 text-emerald-300 light:text-emerald-700" />
                                ) : (
                                    <span className="flex w-32 items-center gap-2">
                                        <span className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--site-tint)]/10"><span className="block h-full bg-[var(--site-gold)]" style={{ width: `${Math.round(u.progress * 100)}%` }} /></span>
                                        <span className="w-16 text-right font-bold text-[var(--site-muted)]">{u.state === "processing" ? "Processing" : u.state === "waiting" ? "Waiting" : `${Math.round(u.progress * 100)}%`}</span>
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {visiblePages.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Show pages">
                        {filters.filter((f) => f.id === "all" || stateCounts[f.id]).map((f) => (
                            <button
                                key={f.id}
                                type="button"
                                role="tab"
                                aria-selected={activeFilter === f.id}
                                onClick={() => { setReorder(false); setFilter(f.id); }}
                                className={cn(
                                    "rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                                    activeFilter === f.id ? "border-[var(--site-text)] bg-[var(--site-text)] text-[var(--site-bg)]" : "border-[var(--site-tint)]/15 text-[var(--site-muted)] hover:border-[var(--site-tint)]/30 hover:text-[var(--site-text)]"
                                )}
                            >
                                {f.label} <span className="opacity-70">{f.id === "all" ? visiblePages.length : stateCounts[f.id]}</span>
                            </button>
                        ))}
                    </div>
                    {mode === "photographer" && !locked && visiblePages.length > 1 && (
                        <button type="button" className={albumButton.ghost} onClick={() => { setFilter("all"); setReorder(!reorder); }}>
                            {reorder ? <><Check className="h-4 w-4" /> Done</> : <><ArrowUpDown className="h-4 w-4" /> Reorder</>}
                        </button>
                    )}
                </div>
            )}
            {reorder && <p className="-mt-2 text-sm font-semibold text-[var(--site-muted)]">Drag the pages into the order they appear in the album.</p>}

            {/* Photographer, To fix tab: what the client asked for */}
            {mode === "photographer" && activeFilter === "fix" && openRequests.length > 0 && (
                <div className="rounded-[1.2rem] border border-rose-400/25 bg-rose-500/[0.04] p-4 sm:p-5">
                    <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-rose-200 light:text-rose-800">Changes to make · {openRequests.length}</p>
                    <div className="space-y-2">
                        {openRequests.map(({ page, comment, number }) => (
                            <div key={comment.id} className="flex items-start gap-3 rounded-2xl border border-[var(--site-tint)]/10 bg-black/30 light:bg-[var(--site-tint)]/[0.04] p-3">
                                <button type="button" onClick={() => setViewing(visiblePages.findIndex((p) => p.id === page.id))} className="shrink-0">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={page.versions.find((v) => v.version === comment.version)?.thumbnailUrl ?? page.versions.at(-1)?.thumbnailUrl} alt="" className="h-14 w-24 rounded-lg bg-black object-contain" />
                                </button>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-[var(--site-muted)]">
                                        {labels.get(page.id)} · {comment.pinX !== null ? `pin ${number}` : "whole page"} · {comment.authorName}
                                    </p>
                                    <p className="text-sm font-black text-[var(--site-gold-light-text)]">{albumCommentKindLabel(comment.kind)}</p>
                                    {comment.body && <p className="mt-0.5 line-clamp-2 text-sm text-[var(--site-text)]">{comment.body}</p>}
                                    {comment.voiceUrl && <audio src={comment.voiceUrl} controls preload="none" className="mt-1.5 h-8 w-full max-w-xs" />}
                                    {comment.replacementPhoto?.thumbnailUrl && (
                                        <a href={comment.replacementPhoto.previewUrl ?? undefined} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-2 text-xs font-bold text-[var(--site-subtle)] hover:text-[var(--site-text)]">
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

            {/* Pages, laid out like the album: each tile keeps its page's shape, so spreads are wide */}
            {visiblePages.length === 0 ? (
                <div className={cn("flex flex-col items-center gap-3 rounded-[1.2rem] border-2 border-dashed p-10 text-center", dropActive ? "border-[var(--site-gold)] bg-[var(--site-gold)]/5" : "border-[var(--site-tint)]/10")}>
                    <Upload className="h-8 w-8 text-[var(--site-gold-text)]" />
                    {mode === "photographer" ? (
                        <>
                            <p className="font-serif text-xl font-bold text-[var(--site-text)]">Add the album pages</p>
                            <p className="max-w-md text-sm font-semibold text-[var(--site-muted)]">
                                Drop the page designs here, one image per page or per spread. They&apos;re numbered by file name (01.jpg, 02.jpg…). We keep a sharp preview only; your original files aren&apos;t stored.
                            </p>
                            <button type="button" className={albumButton.primary} onClick={() => fileRef.current?.click()} disabled={locked || !album.rolesAssigned}><Upload className="h-4 w-4" /> Choose files</button>
                        </>
                    ) : (
                        <p className="max-w-md text-sm font-semibold text-[var(--site-muted)]">
                            {mode === "client" ? "No pages to review yet. You'll get a notification when the photographer sends them." : "No pages have been sent for review yet."}
                        </p>
                    )}
                </div>
            ) : (
                <div className={cn("flex flex-wrap gap-3 rounded-[1.2rem]", dropActive && "outline-dashed outline-2 outline-offset-4 outline-[var(--site-gold)]")}>
                    <input
                        ref={replaceRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/tiff"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            const page = album.pages.find((p) => p.id === replaceId);
                            e.target.value = "";
                            if (file && page) void run(`replace-${page.id}`, () => uploadVersion(page, file));
                        }}
                    />
                    {shownPages.map((page) => {
                        const index = visiblePages.indexOf(page);
                        const label = labels.get(page.id);
                        const state = pageState(page);
                        const shown = mode !== "photographer" ? page.versions.find((v) => v.version === page.sentVersion) : page.versions.at(-1);
                        const ratio = pageRatio(shown, page.layout);
                        const requests = page.comments.filter((c) => !c.parentId && c.status === "open" && (!c.isDraft || c.authorId === album.viewer.id)).length;
                        const updated = mode !== "photographer" && (page.sentVersion ?? 0) > 1 && page.versions.find((v) => v.version === page.sentVersion)?.round === album.currentRound;
                        const canEdit = mode === "photographer" && !locked;
                        return (
                            <div
                                key={page.id}
                                style={{ flexGrow: ratio, flexBasis: `${ratio * TILE_HEIGHT_REM}rem` }}
                                draggable={canEdit && reorder}
                                onDragStart={(e) => { setDragId(page.id); e.dataTransfer.effectAllowed = "move"; }}
                                onDragOver={(e) => { if (dragId) e.preventDefault(); }}
                                onDrop={(e) => { if (dragId) { e.preventDefault(); e.stopPropagation(); void movePage(dragId, page.id); setDragId(null); } }}
                                onDragEnd={() => setDragId(null)}
                                className={cn(
                                    "group relative min-w-0 overflow-hidden rounded-2xl border bg-[var(--site-card)] transition-colors",
                                    dragId === page.id ? "border-[var(--site-gold)] opacity-50" : reorder ? "cursor-grab border-dashed border-[var(--site-gold)]/50" : "border-[var(--site-tint)]/10 hover:border-[var(--site-tint)]/25"
                                )}
                            >
                                <button
                                    type="button"
                                    onClick={() => !reorder && setViewing(index)}
                                    className="relative block w-full bg-black/60"
                                    style={{ aspectRatio: ratio }}
                                    aria-label={reorder ? label : `Open ${label}`}
                                    tabIndex={reorder ? -1 : undefined}
                                >
                                    {shown && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={shown.thumbnailUrl} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
                                    )}
                                    {page.layout === "spread" && <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-black/40 shadow-[1px_0_0_rgba(255,255,255,0.12)]" aria-hidden />}
                                    <span className="absolute left-2 top-2 flex gap-1.5">
                                        {updated && <span className="rounded-full bg-[var(--site-gold)] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[var(--site-on-gold)]">Updated</span>}
                                        {requests > 0 && (
                                            <span className="site-noir inline-flex items-center gap-1 rounded-full bg-black/75 px-2 py-0.5 text-[11px] font-bold text-white">
                                                <MessageSquare className="h-3 w-3" /> {requests}
                                            </span>
                                        )}
                                    </span>
                                    {reorder && <GripVertical className="site-noir absolute inset-0 m-auto h-7 w-7 rounded-lg bg-black/60 p-1 text-white" aria-hidden />}
                                </button>
                                {canEdit && !reorder && (
                                    <div className="absolute right-2 top-2" data-page-menu>
                                        <button
                                            type="button"
                                            className="site-noir flex h-8 w-8 items-center justify-center rounded-lg bg-black/65 text-white hover:bg-black/85"
                                            aria-label={`Options for ${label}`}
                                            aria-expanded={pageMenu === page.id}
                                            onClick={() => setPageMenu(pageMenu === page.id ? null : page.id)}
                                        >
                                            {busy?.endsWith(page.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                                        </button>
                                        {pageMenu === page.id && (
                                            <div className="absolute right-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-2xl border border-[var(--site-tint)]/10 bg-[var(--site-bg)] py-1 shadow-2xl">
                                                <button
                                                    type="button"
                                                    className={menuItem}
                                                    onClick={() => {
                                                        setPageMenu(null);
                                                        const layout = page.layout === "spread" ? "single" : "spread";
                                                        void run(`layout-${page.id}`, async () => setAlbum((await albumApi.setLayout(album.id, page.id, layout)).album));
                                                    }}
                                                >
                                                    {page.layout === "spread" ? <><RectangleVertical className="h-4 w-4" /> Make it a single page</> : <><BookOpen className="h-4 w-4" /> Make it a spread</>}
                                                </button>
                                                <button type="button" className={menuItem} onClick={() => { setPageMenu(null); setReplaceId(page.id); replaceRef.current?.click(); }}>
                                                    <ImageUp className="h-4 w-4" /> Upload a new version
                                                </button>
                                                <button
                                                    type="button"
                                                    className={cn(menuItem, "text-rose-300 light:text-rose-700 hover:bg-rose-500/10")}
                                                    onClick={async () => {
                                                        setPageMenu(null);
                                                        if (!await confirmDialog({ title: `Delete ${label}?`, message: "All its versions and comments are deleted too.", confirmLabel: "Delete page", tone: "danger" })) return;
                                                        await run(`delete-${page.id}`, async () => setAlbum((await albumApi.removePage(album.id, page.id)).album));
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" /> Delete page
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                                    <p className="min-w-0 truncate font-serif text-base font-bold text-[var(--site-text)]">
                                        {label}{page.layout === "spread" && <span className="font-sans text-xs font-semibold text-[var(--site-muted)]"> · spread</span>}
                                    </p>
                                    <span className={cn("inline-flex shrink-0 items-center gap-1.5 text-xs font-bold", TONE_TEXT[ALBUM_PAGE_STATE[state].tone])}>
                                        <span className={cn("h-2 w-2 rounded-full", TONE_DOT[ALBUM_PAGE_STATE[state].tone])} aria-hidden />
                                        {ALBUM_PAGE_STATE[state].label}
                                    </span>
                                </div>
                                {mode === "client" && !locked && state !== "approved" && (
                                    <div className="flex flex-wrap gap-2 border-t border-[var(--site-tint)]/5 p-2">
                                        <button
                                            type="button"
                                            disabled={busy === `approve-${page.id}`}
                                            onClick={() => quickApprove(page)}
                                            className="inline-flex min-w-[7.5rem] flex-1 whitespace-nowrap items-center justify-center gap-1.5 rounded-xl bg-emerald-400/10 px-2 py-2 text-xs font-bold text-emerald-200 light:text-emerald-800 hover:bg-emerald-400/20 disabled:opacity-50"
                                        >
                                            {busy === `approve-${page.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setViewing(index)}
                                            className="inline-flex min-w-[7.5rem] flex-1 whitespace-nowrap items-center justify-center gap-1.5 rounded-xl bg-[var(--site-tint)]/[0.06] px-2 py-2 text-xs font-bold text-[var(--site-subtle)] hover:bg-[var(--site-tint)]/10"
                                        >
                                            <Pencil className="h-3.5 w-3.5" /> Ask for a change
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {mode === "photographer" && !locked && !reorder && activeFilter === "all" && album.rolesAssigned && (
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            style={{ flexGrow: 0.75, flexBasis: `${0.75 * TILE_HEIGHT_REM}rem` }}
                            className="flex min-h-[8rem] flex-col items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-dashed border-[var(--site-gold)]/40 text-sm font-bold text-[var(--site-gold-light-text)] hover:border-[var(--site-gold)] hover:bg-[var(--site-gold)]/5"
                        >
                            <Plus className="h-5 w-5" /> Add pages
                        </button>
                    )}
                    {/* Takes the leftover space in the last row, so its pages keep their size */}
                    <div className="grow-[999]" aria-hidden />
                </div>
            )}

            {activity.length > 0 && (
                <div className="rounded-[1.2rem] border border-[var(--site-tint)]/10 px-4 py-3">
                    <div className="flex items-center gap-3">
                        <History className="h-4 w-4 shrink-0 text-[var(--site-muted)]" />
                        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--site-muted)]">
                            <span className="font-bold text-[var(--site-text)]">Activity</span>
                            {!historyOpen && <> · {activity[0].text} · {formatAlbumDay(activity[0].at)}</>}
                        </p>
                        {activity.length > 1 && (
                            <button type="button" className="shrink-0 text-xs font-bold text-[var(--site-gold-light-text)] hover:text-[var(--site-text)]" onClick={() => setHistoryOpen(!historyOpen)} aria-expanded={historyOpen}>
                                {historyOpen ? "Hide" : `See all ${activity.length}`}
                            </button>
                        )}
                    </div>
                    {historyOpen && (
                        <ul className="mt-3 space-y-2 border-l border-[var(--site-tint)]/10 pl-4">
                            {activity.map((item, i) => (
                                <li key={i} className="text-sm font-semibold text-[var(--site-muted)]">
                                    <span className={item.done ? "text-emerald-200 light:text-emerald-800" : "text-[var(--site-text)]"}>{item.text}</span> · {formatAlbumDay(item.at)}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
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

