"use client";

import { DragEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
    AlertTriangle, ArrowLeft, ChevronRight, Clock, Copy, Download, Eye, Folder, FolderInput, FolderPlus, FolderUp,
    HardDrive, Home, Loader2, Menu, MoreVertical, Pencil, Plus, RotateCcw, Search, Star, Trash2, Upload, X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { EveBashLogo } from "@/components/EveBashLogo";
import { vaultApi, VaultApiError, type VaultFolder, type VaultItem, type VaultTrashEntry, type VaultUsage } from "@/lib/vaultApi";
import { cn } from "@/lib/utils";
import { ConfirmDialog, FolderPickerDialog, NameDialog } from "./Dialogs";
import { formatBytes, formatDate } from "./format";
import { FileTypeIcon } from "./FileTypeIcon";
import { PreviewPanel } from "./PreviewPanel";
import { UploadTray, useVaultUploads } from "./UploadTray";

type View = "files" | "recent" | "starred" | "trash" | "search";
type Row = { kind: "folder"; folder: VaultFolder } | { kind: "file"; item: VaultItem };

type DialogState =
    | { type: "new-folder" }
    | { type: "rename"; row: Row }
    | { type: "move"; row: Row }
    | { type: "copy"; item: VaultItem }
    | { type: "delete-forever"; entry: VaultTrashEntry }
    | { type: "empty-trash" }
    | null;

const NAV: { view: View; label: string; icon: typeof Home }[] = [
    { view: "files", label: "My Files", icon: Home },
    { view: "recent", label: "Recent", icon: Clock },
    { view: "starred", label: "Starred", icon: Star },
    { view: "trash", label: "Trash", icon: Trash2 },
];

const FILE_INPUT_ID = "vault-upload-files";
const FOLDER_INPUT_ID = "vault-upload-folder";

const errorText = (error: unknown) => (error instanceof VaultApiError ? error.message : "Something went wrong. Please try again.");

export function VaultApp() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useSearchParams();
    const view = (["recent", "starred", "trash", "search"].includes(params.get("view") ?? "") ? params.get("view") : "files") as View;
    const folderId = view === "files" ? params.get("folder") : null;
    const query = params.get("q") ?? "";

    const [usage, setUsage] = useState<(VaultUsage & { fetchedAt: number }) | null>(null);
    // Each result remembers which view it belongs to, so a slow response for an old view is never shown.
    const viewKey = `${view}|${folderId ?? ""}|${query}`;
    const [listing, setListing] = useState<{ key: string; rows: Row[]; breadcrumbs: { id: string; name: string }[]; hiddenCount: number } | null>(null);
    const [trashListing, setTrashListing] = useState<{ key: string; entries: VaultTrashEntry[] } | null>(null);
    const [failure, setFailure] = useState<{ key: string; error: VaultApiError } | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [notice, setNotice] = useState<string | null>(null);
    const [dialog, setDialog] = useState<DialogState>(null);
    const [preview, setPreview] = useState<VaultItem | null>(null);
    const [menuFor, setMenuFor] = useState<string | null>(null);
    const [newMenuOpen, setNewMenuOpen] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [dragging, setDragging] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) router.replace("/login?returnTo=/vault");
    }, [authLoading, user, router]);

    const go = useCallback((next: { view?: View; folder?: string | null; q?: string }) => {
        const search = new URLSearchParams();
        const nextView = next.view ?? "files";
        if (nextView !== "files") search.set("view", nextView);
        if (nextView === "files" && next.folder) search.set("folder", next.folder);
        if (nextView === "search" && next.q) search.set("q", next.q);
        setSidebarOpen(false);
        setMenuFor(null);
        router.push(`/vault${search.size ? `?${search}` : ""}`);
    }, [router]);

    const refreshUsage = useCallback(() => {
        vaultApi.usage().then((result) => setUsage({ ...result, fetchedAt: Date.now() })).catch(() => null);
    }, []);

    const refresh = useCallback(() => {
        setReloadKey((key) => key + 1);
        refreshUsage();
    }, [refreshUsage]);

    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        const key = viewKey;
        (async () => {
            try {
                if (view === "trash") {
                    const result = await vaultApi.trash();
                    if (!cancelled) setTrashListing({ key, entries: result.entries });
                    return;
                }
                const result: { items: VaultItem[]; hiddenCount: number; folders?: VaultFolder[]; breadcrumbs?: { id: string; name: string }[] } =
                    view === "files" ? await vaultApi.children(folderId)
                    : view === "recent" ? await vaultApi.recent()
                    : view === "starred" ? await vaultApi.starred()
                    : query ? await vaultApi.search(query) : { items: [], hiddenCount: 0 };
                if (cancelled) return;
                const folders = result.folders ?? [];
                setListing({
                    key,
                    rows: [...folders.map((folder): Row => ({ kind: "folder", folder })), ...result.items.map((item): Row => ({ kind: "file", item }))],
                    breadcrumbs: result.breadcrumbs ?? [],
                    hiddenCount: result.hiddenCount,
                });
                setFailure(null);
            } catch (error) {
                if (!cancelled) setFailure({ key, error: error instanceof VaultApiError ? error : new VaultApiError(0, "error", errorText(error)) });
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [user, view, folderId, query, viewKey, reloadKey]);

    const current = listing?.key === viewKey ? listing : null;
    const rows = current?.rows ?? null;
    const breadcrumbs = current?.breadcrumbs ?? [];
    const hiddenCount = current?.hiddenCount ?? 0;
    const trash = trashListing?.key === viewKey ? trashListing.entries : null;
    const loadError = failure?.key === viewKey ? failure.error : null;

    useEffect(() => {
        if (user) refreshUsage();
    }, [user, refreshUsage]);


    useEffect(() => {
        if (!notice) return;
        const timer = setTimeout(() => setNotice(null), 4000);
        return () => clearTimeout(timer);
    }, [notice]);

    useEffect(() => {
        if (!menuFor && !newMenuOpen) return;
        const close = () => { setMenuFor(null); setNewMenuOpen(false); };
        window.addEventListener("click", close);
        return () => window.removeEventListener("click", close);
    }, [menuFor, newMenuOpen]);

    const uploads = useVaultUploads(refresh);
    const uploadTarget = view === "files" ? folderId : null;
    const uploadsBlockedMessage = usage?.uploadsBlocked === "plan_expired"
        ? "Uploads are paused because your plan has expired. Renew your plan to upload again."
        : usage?.uploadsBlocked === "storage_full" ? "Your storage is full. Free up space or upgrade your plan to upload more." : null;

    const startUpload = (files: File[], asFolder = false) => {
        if (files.length === 0) return;
        if (uploadsBlockedMessage) return setNotice(uploadsBlockedMessage);
        if (asFolder) {
            uploads.uploadFolder(files, uploadTarget).catch((error) => setNotice(errorText(error)));
        } else {
            uploads.uploadFiles(files, uploadTarget);
        }
        if (view !== "files") go({ view: "files", folder: uploadTarget });
    };

    const run = async (action: () => Promise<unknown>, success?: string): Promise<string | null> => {
        try {
            await action();
            if (success) setNotice(success);
            refresh();
            return null;
        } catch (error) {
            return errorText(error);
        }
    };

    const download = async (item: VaultItem) => {
        try {
            const { url } = await vaultApi.link(item.id, "download");
            window.location.assign(url);
        } catch (error) {
            setNotice(errorText(error));
        }
    };

    const openRow = (row: Row) => {
        if (row.kind === "folder") go({ view: "files", folder: row.folder.id });
        else setPreview(row.item);
    };

    const onDrop = (event: DragEvent) => {
        event.preventDefault();
        setDragging(false);
        startUpload(Array.from(event.dataTransfer.files));
    };

    const submitSearch = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
        if (q) go({ view: "search", q });
    };

    const title = view === "files" ? (breadcrumbs.at(-1)?.name ?? "My Files")
        : view === "search" ? `Search results for “${query}”`
        : NAV.find((entry) => entry.view === view)!.label;

    const usageSummary = useMemo(() => {
        if (!usage) return null;
        const limit = usage.limitBytes;
        const percent = limit ? Math.min(100, (usage.usedBytes.total / limit) * 100) : 0;
        return { limit, percent };
    }, [usage]);

    if (authLoading || !user) {
        return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#CA9C68]" aria-label="Loading" /></div>;
    }

    const sidebar = (
        <nav aria-label="EB Vault" className="flex h-full flex-col gap-4 p-4">
            <div className="flex items-center gap-3 px-1">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7FA38C]/15 text-[#7FA38C]">
                    <HardDrive className="h-5 w-5" aria-hidden />
                </span>
                <div>
                    <p className="font-semibold leading-tight text-white">EB Vault</p>
                    <p className="text-xs text-slate-400">Your personal storage</p>
                </div>
            </div>

            <div className="relative">
                <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); setNewMenuOpen((open) => !open); }}
                    aria-haspopup="menu"
                    aria-expanded={newMenuOpen}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#CA9C68] px-4 py-3 font-semibold text-[#13191F] hover:bg-[#D9AE7E]"
                >
                    <Plus className="h-5 w-5" aria-hidden /> New
                </button>
                {newMenuOpen && (
                    <div role="menu" className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-white/10 bg-[#1B232C] shadow-xl">
                        {/* Labels open the hidden file inputs natively, which also works on iOS Safari. */}
                        <label htmlFor={FILE_INPUT_ID} role="menuitem" tabIndex={0} onClick={() => { setNewMenuOpen(false); setSidebarOpen(false); }}
                            className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left text-sm text-slate-200 hover:bg-white/10">
                            <Upload className="h-4 w-4 text-slate-400" aria-hidden /> Upload files
                        </label>
                        <label htmlFor={FOLDER_INPUT_ID} role="menuitem" tabIndex={0} onClick={() => { setNewMenuOpen(false); setSidebarOpen(false); }}
                            className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left text-sm text-slate-200 hover:bg-white/10">
                            <FolderUp className="h-4 w-4 text-slate-400" aria-hidden /> Upload folder
                        </label>
                        <button type="button" role="menuitem" onClick={() => { setNewMenuOpen(false); setSidebarOpen(false); setDialog({ type: "new-folder" }); }}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-200 hover:bg-white/10">
                            <FolderPlus className="h-4 w-4 text-slate-400" aria-hidden /> New folder
                        </button>
                    </div>
                )}
            </div>

            <ul className="space-y-1">
                {NAV.map(({ view: target, label, icon: Icon }) => (
                    <li key={target}>
                        <button
                            type="button"
                            onClick={() => go({ view: target })}
                            aria-current={view === target ? "page" : undefined}
                            className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                                view === target ? "bg-[#7FA38C]/15 text-white" : "text-slate-300 hover:bg-white/5")}
                        >
                            <Icon className={cn("h-4 w-4", view === target ? "text-[#7FA38C]" : "text-slate-500")} aria-hidden /> {label}
                        </button>
                    </li>
                ))}
            </ul>

            {usage && usageSummary && (
                <div className="mt-auto rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-sm text-slate-200">
                        {formatBytes(usage.usedBytes.total)} of {usageSummary.limit === null ? "Unlimited" : formatBytes(usageSummary.limit)}
                    </p>
                    {usageSummary.limit !== null && (
                        <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Storage used" aria-valuenow={Math.round(usageSummary.percent)} aria-valuemin={0} aria-valuemax={100}>
                            <div className="h-full bg-[#CA9C68]" style={{ width: `${usage.usedBytes.total ? (usage.usedBytes.events / usage.usedBytes.total) * usageSummary.percent : 0}%` }} />
                            <div className="h-full bg-[#7FA38C]" style={{ width: `${usage.usedBytes.total ? (usage.usedBytes.vault / usage.usedBytes.total) * usageSummary.percent : 0}%` }} />
                        </div>
                    )}
                    <p className="mt-2 text-xs text-slate-400">Vault {formatBytes(usage.usedBytes.vault)} · Events {formatBytes(usage.usedBytes.events)}</p>
                    <Link href="/pricing" className="mt-2 inline-block text-xs font-semibold text-[#CA9C68] hover:underline">Get more storage</Link>
                </div>
            )}

            <Link href="/profile" className="flex items-center gap-2 px-1 text-xs text-slate-400 hover:text-white">
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                <EveBashLogo className="h-3.5 w-3.5 text-[#CA9C68]" aria-hidden /> Back to EveBash
            </Link>
        </nav>
    );

    const rowName = (row: Row) => (row.kind === "folder" ? row.folder.name : row.item.filename);
    const rowId = (row: Row) => (row.kind === "folder" ? row.folder.id : row.item.id);

    return (
        <div className="flex min-h-screen bg-[#0E1318]">
            <input id={FILE_INPUT_ID} type="file" multiple hidden onChange={(event) => { startUpload(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
            <input
                id={FOLDER_INPUT_ID}
                type="file"
                multiple
                hidden
                // Non-standard attribute supported by all major browsers for picking a whole folder.
                {...{ webkitdirectory: "", directory: "" }}
                onChange={(event) => { startUpload(Array.from(event.target.files ?? []), true); event.target.value = ""; }}
            />

            <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-[#121920] md:block">{sidebar}</aside>
            {sidebarOpen && (
                <div className="fixed inset-0 z-40 md:hidden">
                    <button type="button" aria-label="Close menu" onClick={() => setSidebarOpen(false)} className="absolute inset-0 bg-black/60" />
                    <aside className="absolute inset-y-0 left-0 w-72 bg-[#121920] shadow-2xl">{sidebar}</aside>
                </div>
            )}

            <main
                className="relative flex min-w-0 flex-1 flex-col"
                onDragOver={(event) => { if (view === "files" && event.dataTransfer.types.includes("Files")) { event.preventDefault(); setDragging(true); } }}
                onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
                onDrop={onDrop}
            >
                <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/10 bg-[#0E1318]/95 px-4 py-3 backdrop-blur">
                    <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Open menu" className="rounded-lg p-2 text-slate-300 hover:bg-white/10 md:hidden">
                        <Menu className="h-5 w-5" />
                    </button>
                    {/* Keyed by the current query so the box shows it after navigation, without syncing state. */}
                    <form key={query} role="search" onSubmit={submitSearch} className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
                        <input
                            type="search"
                            name="q"
                            defaultValue={query}
                            placeholder="Search your Vault"
                            aria-label="Search your Vault by file name"
                            className="w-full rounded-full border border-white/10 bg-[#141B22] py-2.5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[#7FA38C]"
                        />
                    </form>
                </header>

                <div className="flex-1 px-4 py-5 md:px-8">
                    {usage?.plan.state && usage.plan.state !== "active" && <PlanBanner usage={usage} />}
                    {usage?.plan.state === "active" && usage.overLimit && (
                        <Banner tone="red" title="You're over your plan's storage">
                            Your files are safe and you can still view, download and delete them, but new uploads are paused until you free up space or <Link href="/pricing" className="font-semibold underline">upgrade your plan</Link>.
                        </Banner>
                    )}

                    <div className="mb-4 flex flex-wrap items-center gap-2">
                        {view === "files" && breadcrumbs.length > 0 ? (
                            <nav aria-label="Folder path" className="flex min-w-0 flex-wrap items-center gap-1 text-lg">
                                <button type="button" onClick={() => go({ view: "files" })} className="rounded px-1.5 text-slate-400 hover:bg-white/5 hover:text-white">My Files</button>
                                {breadcrumbs.map((crumb, index) => (
                                    <span key={crumb.id} className="flex min-w-0 items-center gap-1">
                                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />
                                        {index === breadcrumbs.length - 1
                                            ? <h1 className="truncate font-semibold text-white">{crumb.name}</h1>
                                            : <button type="button" onClick={() => go({ view: "files", folder: crumb.id })} className="truncate rounded px-1.5 text-slate-400 hover:bg-white/5 hover:text-white">{crumb.name}</button>}
                                    </span>
                                ))}
                            </nav>
                        ) : (
                            <h1 className="text-lg font-semibold text-white">{title}</h1>
                        )}
                        {view === "trash" && trash && trash.length > 0 && (
                            <button type="button" onClick={() => setDialog({ type: "empty-trash" })} className="ml-auto rounded-full border border-red-400/30 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10">
                                Empty Trash
                            </button>
                        )}
                    </div>

                    {view === "trash" && <p className="mb-4 text-sm text-slate-400">Items in Trash are permanently deleted after 30 days. They still count toward your storage until then.</p>}
                    {hiddenCount > 0 && view !== "trash" && (
                        <p className="mb-4 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                            {hiddenCount} {hiddenCount === 1 ? "file is" : "files are"} hidden here because your plan expired. Renew to restore {hiddenCount === 1 ? "it" : "them"}.
                        </p>
                    )}

                    {loadError ? (
                        <LoadError error={loadError} onRetry={refresh} />
                    ) : view === "trash" ? (
                        <TrashList
                            entries={trash}
                            onRestore={(entry) => void run(() => vaultApi.restore(entry.kind, entry.id), `Restored “${entry.name}”.`).then((error) => error && setNotice(error))}
                            onDeleteForever={(entry) => setDialog({ type: "delete-forever", entry })}
                        />
                    ) : rows === null ? (
                        <div className="flex items-center justify-center gap-2 py-24 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Loading…</div>
                    ) : rows.length === 0 ? (
                        <EmptyState view={view} query={query} />
                    ) : (
                        <ul className="divide-y divide-white/5 rounded-xl border border-white/10 bg-[#121920]">
                            {rows.map((row) => {
                                const id = rowId(row);
                                return (
                                    <li key={id} className="group relative flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.03] sm:px-4">
                                        <button type="button" onClick={() => openRow(row)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                                            {row.kind === "folder"
                                                ? <Folder className="h-5 w-5 shrink-0 text-[#CA9C68]" aria-hidden />
                                                : <FileTypeIcon mimeType={row.item.mimeType} extension={row.item.extension} className="h-5 w-5 shrink-0 text-[#7FA38C]" />}
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm text-slate-100">{rowName(row)}</span>
                                                <span className="block text-xs text-slate-500 sm:hidden">
                                                    {row.kind === "file" ? `${formatBytes(row.item.sizeBytes)} · ${formatDate(row.item.updatedAt)}` : formatDate(row.folder.updatedAt)}
                                                </span>
                                                {row.kind === "file" && row.item.atRisk && (
                                                    <span className="mt-0.5 block text-xs text-amber-300">Plan expired · hidden after {formatDate(usage?.plan.graceEndsOn)}</span>
                                                )}
                                            </span>
                                        </button>
                                        <span className="hidden w-24 shrink-0 text-right text-xs text-slate-500 sm:block">{row.kind === "file" ? formatBytes(row.item.sizeBytes) : "—"}</span>
                                        <span className="hidden w-28 shrink-0 text-right text-xs text-slate-500 md:block">{formatDate(row.kind === "file" ? row.item.updatedAt : row.folder.updatedAt)}</span>
                                        {row.kind === "file" && (
                                            <button
                                                type="button"
                                                aria-label={row.item.isStarred ? `Unstar ${row.item.filename}` : `Star ${row.item.filename}`}
                                                aria-pressed={row.item.isStarred}
                                                onClick={() => void run(() => vaultApi.updateItem(row.item.id, { isStarred: !row.item.isStarred })).then((e) => e && setNotice(e))}
                                                className={cn("rounded p-1.5 hover:bg-white/10", row.item.isStarred ? "text-[#CA9C68]" : "text-slate-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100")}
                                            >
                                                <Star className={cn("h-4 w-4", row.item.isStarred && "fill-current")} />
                                            </button>
                                        )}
                                        <div className="relative">
                                            <button
                                                type="button"
                                                aria-label={`Actions for ${rowName(row)}`}
                                                aria-haspopup="menu"
                                                aria-expanded={menuFor === id}
                                                onClick={(event) => { event.stopPropagation(); setMenuFor(menuFor === id ? null : id); }}
                                                className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                                            >
                                                <MoreVertical className="h-4 w-4" />
                                            </button>
                                            {menuFor === id && (
                                                <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-xl border border-white/10 bg-[#1B232C] py-1 shadow-xl">
                                                    {(row.kind === "folder"
                                                        ? [
                                                            { label: "Open", icon: FolderInput, onClick: () => openRow(row) },
                                                            { label: "Rename", icon: Pencil, onClick: () => setDialog({ type: "rename", row }) },
                                                            { label: "Move", icon: FolderInput, onClick: () => setDialog({ type: "move", row }) },
                                                            { label: "Move to Trash", icon: Trash2, onClick: () => void run(() => vaultApi.trashFolder(row.folder.id), `Moved “${row.folder.name}” to Trash.`).then((e) => e && setNotice(e)) },
                                                        ]
                                                        : [
                                                            { label: "Preview", icon: Eye, onClick: () => setPreview(row.item) },
                                                            { label: "Download", icon: Download, onClick: () => void download(row.item) },
                                                            { label: "Rename", icon: Pencil, onClick: () => setDialog({ type: "rename", row }) },
                                                            { label: "Move", icon: FolderInput, onClick: () => setDialog({ type: "move", row }) },
                                                            { label: "Make a copy", icon: Copy, onClick: () => setDialog({ type: "copy", item: row.item }) },
                                                            { label: "Move to Trash", icon: Trash2, onClick: () => void run(() => vaultApi.trashItem(row.item.id), `Moved “${row.item.filename}” to Trash.`).then((e) => e && setNotice(e)) },
                                                        ]
                                                    ).map(({ label, icon: ItemIcon, onClick }) => (
                                                        <button key={label} type="button" role="menuitem" onClick={() => { setMenuFor(null); onClick(); }}
                                                            className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-white/10", label === "Move to Trash" ? "text-red-300" : "text-slate-200")}>
                                                            <ItemIcon className="h-4 w-4 opacity-70" aria-hidden /> {label}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {dragging && (
                    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center border-2 border-dashed border-[#7FA38C] bg-[#7FA38C]/10">
                        <p className="rounded-full bg-[#121920] px-5 py-3 text-sm font-semibold text-white">Drop files to upload</p>
                    </div>
                )}
            </main>

            {notice && (
                <div role="status" className="fixed bottom-4 left-1/2 z-50 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-xl border border-white/10 bg-[#1B232C] px-4 py-3 text-sm text-slate-100 shadow-xl">
                    {notice}
                    <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="rounded p-0.5 text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
                </div>
            )}

            <UploadTray tasks={uploads.tasks} onCancel={uploads.cancel} onClear={uploads.clearFinished} />
            {preview && <PreviewPanel key={preview.id} item={preview} onClose={() => setPreview(null)} onDownload={(item) => void download(item)} />}

            {dialog?.type === "new-folder" && (
                <NameDialog title="New folder" label="Folder name" initial="Untitled folder" confirmLabel="Create" onClose={() => setDialog(null)}
                    onSubmit={async (name) => {
                        const error = await run(() => vaultApi.createFolder(name, view === "files" ? folderId : null));
                        if (!error) { setDialog(null); if (view !== "files") go({ view: "files" }); }
                        return error;
                    }} />
            )}
            {dialog?.type === "rename" && (
                <NameDialog title="Rename" label="New name" initial={rowName(dialog.row)} confirmLabel="Rename" onClose={() => setDialog(null)}
                    onSubmit={async (name) => {
                        const row = dialog.row;
                        const error = await run(() => row.kind === "folder" ? vaultApi.updateFolder(row.folder.id, { name }) : vaultApi.updateItem(row.item.id, { filename: name }));
                        if (!error) setDialog(null);
                        return error;
                    }} />
            )}
            {dialog?.type === "move" && (
                <FolderPickerDialog title={`Move “${rowName(dialog.row)}”`} confirmLabel="Move" excludeFolderIds={dialog.row.kind === "folder" ? [dialog.row.folder.id] : []} onClose={() => setDialog(null)}
                    onPick={async (target) => {
                        const row = dialog.row;
                        const error = await run(() => row.kind === "folder" ? vaultApi.updateFolder(row.folder.id, { parentFolderId: target }) : vaultApi.updateItem(row.item.id, { folderId: target }), `Moved “${rowName(row)}”.`);
                        if (!error) setDialog(null);
                        return error;
                    }} />
            )}
            {dialog?.type === "copy" && (
                <FolderPickerDialog title={`Copy “${dialog.item.filename}”`} confirmLabel="Copy" excludeFolderIds={[]} onClose={() => setDialog(null)}
                    onPick={async (target) => {
                        const error = await run(() => vaultApi.copyItem(dialog.item.id, target), `Copied “${dialog.item.filename}”.`);
                        if (!error) setDialog(null);
                        return error;
                    }} />
            )}
            {dialog?.type === "delete-forever" && (
                <ConfirmDialog title="Delete forever?" destructive confirmLabel="Delete forever" onClose={() => setDialog(null)}
                    message={`“${dialog.entry.name}”${dialog.entry.kind === "folder" ? " and everything in it" : ""} will be permanently deleted. This can't be undone.`}
                    onConfirm={async () => {
                        const error = await run(() => vaultApi.deleteForever(dialog.entry.kind, dialog.entry.id), "Deleted forever.");
                        if (!error) setDialog(null);
                        return error;
                    }} />
            )}
            {dialog?.type === "empty-trash" && (
                <ConfirmDialog title="Empty Trash?" destructive confirmLabel="Empty Trash" onClose={() => setDialog(null)}
                    message="Everything in Trash will be permanently deleted. This can't be undone."
                    onConfirm={async () => {
                        const error = await run(() => vaultApi.emptyTrash(), "Trash emptied.");
                        if (!error) setDialog(null);
                        return error;
                    }} />
            )}
        </div>
    );
}

function Banner({ tone, title, children }: { tone: "amber" | "red" | "grey"; title: string; children: React.ReactNode }) {
    return (
        <div role="status" className={cn("mb-5 flex gap-3 rounded-xl border p-4", {
            amber: "border-amber-400/30 bg-amber-500/10 text-amber-100",
            red: "border-red-400/30 bg-red-500/10 text-red-100",
            grey: "border-white/10 bg-white/5 text-slate-200",
        }[tone])}>
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <div className="text-sm leading-relaxed">
                <p className="font-semibold">{title}</p>
                <p className="mt-1">{children}</p>
            </div>
        </div>
    );
}

/** Messages agreed for the plan-expiry timeline (grace → hidden → deletion). */
function PlanBanner({ usage }: { usage: VaultUsage & { fetchedAt: number } }) {
    const { state, expiredOn, graceEndsOn, deletionOn } = usage.plan;
    const renew = <Link href="/pricing" className="font-semibold underline">Renew plan</Link>;
    if (state === "grace") {
        return (
            <Banner tone="amber" title="Your plan has expired">
                Your plan expired on {formatDate(expiredOn)}, and uploads are paused. Renew by <strong>{formatDate(graceEndsOn)}</strong> to keep all your files visible. After that, only your oldest 1 GB stays visible, and <strong>the rest will be permanently deleted on {formatDate(deletionOn)}</strong>. {renew}
            </Banner>
        );
    }
    if (state === "hidden") {
        const daysLeft = deletionOn ? Math.ceil((new Date(deletionOn).getTime() - usage.fetchedAt) / 86400000) : null;
        return (
            <Banner tone="red" title={daysLeft !== null && daysLeft <= 1 ? "Deleting tomorrow" : daysLeft !== null && daysLeft <= 7 ? `Deleting in ${daysLeft} days` : "Some of your files are hidden"}>
                Only your oldest 1 GB is visible now. Files beyond it are hidden and <strong>will be permanently deleted on {formatDate(deletionOn)}</strong>. Renew before then to restore everything. {renew}
            </Banner>
        );
    }
    return (
        <Banner tone="grey" title="Files beyond your free 1 GB are being deleted">
            Your plan expired on {formatDate(expiredOn)}. Hidden files are permanently deleted from {formatDate(deletionOn)}. Your oldest 1 GB of files is safe on the Free plan. <Link href="/pricing" className="font-semibold underline">See plans</Link>
        </Banner>
    );
}

function LoadError({ error, onRetry }: { error: VaultApiError; onRetry: () => void }) {
    const disabled = error.code === "disabled";
    return (
        <div className="mx-auto mt-16 max-w-md rounded-2xl border border-white/10 bg-[#121920] p-6 text-center">
            <HardDrive className="mx-auto h-10 w-10 text-[#7FA38C]" aria-hidden />
            <p className="mt-3 font-semibold text-white">{disabled ? "EB Vault is coming soon" : "Couldn't load your files"}</p>
            <p className="mt-1 text-sm text-slate-400">{disabled ? "Your personal storage isn't available yet. Check back soon." : error.message}</p>
            {!disabled && <button type="button" onClick={onRetry} className="mt-4 rounded-full border border-white/15 px-4 py-2 text-sm text-slate-200 hover:border-white/30">Try again</button>}
        </div>
    );
}

function EmptyState({ view, query }: { view: View; query: string }) {
    const content = {
        files: { title: "Nothing here yet", text: "Upload files or drag them here. Anything you store is private to you." },
        recent: { title: "No recent files", text: "Files you upload or change will show up here." },
        starred: { title: "No starred files", text: "Star files to find them quickly here." },
        search: { title: query ? "No matching files" : "Search your Vault", text: query ? `Nothing in your Vault is named like “${query}”.` : "Type a file name above." },
        trash: { title: "", text: "" },
    }[view];
    return (
        <div className="mx-auto mt-16 max-w-sm text-center">
            <HardDrive className="mx-auto h-10 w-10 text-slate-600" aria-hidden />
            <p className="mt-3 font-semibold text-white">{content.title}</p>
            <p className="mt-1 text-sm text-slate-400">{content.text}</p>
            {view === "files" && (
                <label htmlFor={FILE_INPUT_ID} className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#CA9C68] px-5 py-2.5 text-sm font-semibold text-[#13191F]">
                    <Upload className="h-4 w-4" aria-hidden /> Upload files
                </label>
            )}
        </div>
    );
}

function TrashList({ entries, onRestore, onDeleteForever }: {
    entries: VaultTrashEntry[] | null;
    onRestore: (entry: VaultTrashEntry) => void;
    onDeleteForever: (entry: VaultTrashEntry) => void;
}) {
    if (entries === null) return <div className="flex items-center justify-center gap-2 py-24 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Loading…</div>;
    if (entries.length === 0) return <p className="mt-16 text-center text-sm text-slate-400">Trash is empty.</p>;
    return (
        <ul className="divide-y divide-white/5 rounded-xl border border-white/10 bg-[#121920]">
            {entries.map((entry) => {
                return (
                    <li key={`${entry.kind}-${entry.id}`} className="flex flex-wrap items-center gap-3 px-3 py-3 sm:px-4">
                        {entry.kind === "folder"
                            ? <Folder className="h-5 w-5 shrink-0 text-[#CA9C68]" aria-hidden />
                            : <FileTypeIcon mimeType={entry.mimeType ?? ""} extension={entry.name.split(".").pop()?.toLowerCase() ?? ""} className="h-5 w-5 shrink-0 text-slate-500" />}
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-slate-200">{entry.name}</p>
                            <p className="text-xs text-slate-500">
                                {entry.sizeBytes !== null ? `${formatBytes(entry.sizeBytes)} · ` : ""}Deleted {formatDate(entry.deletedAt)} · Gone forever on {formatDate(entry.permanentlyDeletedOn)}
                            </p>
                        </div>
                        <button type="button" onClick={() => onRestore(entry)} className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs text-slate-200 hover:border-white/30">
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Restore
                        </button>
                        <button type="button" onClick={() => onDeleteForever(entry)} className="rounded-full px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10">
                            Delete forever
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}
