"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ChevronRight, Folder, Home, Loader2 } from "lucide-react";
import { vaultApi, type VaultFolder } from "@/lib/vaultApi";
import { cn } from "@/lib/utils";

function useModal(onClose: () => void) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const focused = document.activeElement as HTMLElement | null;
        ref.current?.showModal();
        return () => focused?.focus();
    }, []);
    return { ref, onCancel: (event: React.SyntheticEvent) => { event.preventDefault(); onClose(); } };
}

const dialogClass = "m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-white/10 bg-[#141B22] p-5 text-white backdrop:bg-black/60";
const primaryButton = "flex items-center gap-2 rounded-lg bg-[#CA9C68] px-4 py-2.5 font-semibold text-[#13191F] disabled:opacity-40";
const secondaryButton = "rounded-lg border border-white/15 px-4 py-2.5 text-slate-200 disabled:opacity-40";

/** New folder and rename. Returns an error message to show, or null on success. */
export function NameDialog({ title, label, initial, confirmLabel, onClose, onSubmit }: {
    title: string; label: string; initial: string; confirmLabel: string;
    onClose: () => void; onSubmit: (name: string) => Promise<string | null>;
}) {
    const { ref, onCancel } = useModal(onClose);
    const [value, setValue] = useState(initial);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const input = inputRef.current;
        if (!input) return;
        input.focus();
        // Select the name without its extension, like a desktop file manager.
        const dot = initial.lastIndexOf(".");
        input.setSelectionRange(0, dot > 0 ? dot : initial.length);
    }, [initial]);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (!value.trim()) return;
        setBusy(true);
        setError(await onSubmit(value.trim()));
        setBusy(false);
    };

    return (
        <dialog ref={ref} onCancel={onCancel} aria-labelledby="vault-name-title" className={dialogClass}>
            <form onSubmit={submit}>
                <h2 id="vault-name-title" className="text-lg font-semibold">{title}</h2>
                <label className="mt-4 block text-sm text-slate-400" htmlFor="vault-name-input">{label}</label>
                <input
                    id="vault-name-input"
                    ref={inputRef}
                    value={value}
                    maxLength={255}
                    onChange={(event) => setValue(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-[#0E1318] px-3 py-2.5 text-white outline-none focus:border-[#CA9C68]"
                />
                {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
                <div className="mt-5 flex justify-end gap-3">
                    <button type="button" onClick={onClose} disabled={busy} className={secondaryButton}>Cancel</button>
                    <button type="submit" disabled={busy || !value.trim()} className={primaryButton}>
                        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{confirmLabel}
                    </button>
                </div>
            </form>
        </dialog>
    );
}

export function ConfirmDialog({ title, message, confirmLabel, destructive, onClose, onConfirm }: {
    title: string; message: string; confirmLabel: string; destructive?: boolean;
    onClose: () => void; onConfirm: () => Promise<string | null>;
}) {
    const { ref, onCancel } = useModal(onClose);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    return (
        <dialog ref={ref} onCancel={onCancel} aria-labelledby="vault-confirm-title" className={dialogClass}>
            <h2 id="vault-confirm-title" className="text-lg font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-slate-300">{message}</p>
            {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
            <div className="mt-5 flex justify-end gap-3">
                <button type="button" onClick={onClose} disabled={busy} className={secondaryButton}>Cancel</button>
                <button
                    type="button"
                    disabled={busy}
                    onClick={async () => { setBusy(true); setError(await onConfirm()); setBusy(false); }}
                    className={cn(primaryButton, destructive && "bg-red-500 text-white")}
                >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{confirmLabel}
                </button>
            </div>
        </dialog>
    );
}

/** Folder picker for Move and Copy. Folders being moved (and anything inside them) can't be chosen. */
export function FolderPickerDialog({ title, confirmLabel, excludeFolderIds, onClose, onPick }: {
    title: string; confirmLabel: string; excludeFolderIds: string[];
    onClose: () => void; onPick: (folderId: string | null) => Promise<string | null>;
}) {
    const { ref, onCancel } = useModal(onClose);
    const [current, setCurrent] = useState<string | null>(null);
    const [listing, setListing] = useState<{ folderId: string | null; folders: VaultFolder[]; trail: { id: string; name: string }[] } | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        vaultApi.children(current)
            .then((result) => !cancelled && setListing({ folderId: current, folders: result.folders, trail: result.breadcrumbs }))
            .catch((err: Error) => !cancelled && setError(err.message));
        return () => { cancelled = true; };
    }, [current]);

    const folders = listing && listing.folderId === current ? listing.folders : null;
    const trail = listing?.trail ?? [];

    const insideExcluded = trail.some((crumb) => excludeFolderIds.includes(crumb.id));

    return (
        <dialog ref={ref} onCancel={onCancel} aria-labelledby="vault-picker-title" className={dialogClass}>
            <h2 id="vault-picker-title" className="text-lg font-semibold">{title}</h2>
            <nav aria-label="Folder path" className="mt-3 flex flex-wrap items-center gap-1 text-sm">
                <button type="button" onClick={() => setCurrent(null)} className="flex items-center gap-1 rounded px-1.5 py-1 text-slate-300 hover:bg-white/10">
                    <Home className="h-4 w-4" aria-hidden /> My Files
                </button>
                {trail.map((crumb) => (
                    <span key={crumb.id} className="flex items-center gap-1">
                        <ChevronRight className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                        <button type="button" onClick={() => setCurrent(crumb.id)} className="rounded px-1.5 py-1 text-slate-300 hover:bg-white/10">{crumb.name}</button>
                    </span>
                ))}
            </nav>
            <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-1">
                {folders === null ? (
                    <li className="flex items-center gap-2 px-3 py-3 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…</li>
                ) : folders.length === 0 ? (
                    <li className="px-3 py-3 text-sm text-slate-400">No folders here.</li>
                ) : folders.map((folder) => {
                    const blocked = excludeFolderIds.includes(folder.id);
                    return (
                        <li key={folder.id}>
                            <button
                                type="button"
                                disabled={blocked}
                                onClick={() => setCurrent(folder.id)}
                                className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <Folder className="h-4 w-4 shrink-0 text-[#CA9C68]" aria-hidden />
                                <span className="truncate">{folder.name}</span>
                                <ChevronRight className="ml-auto h-4 w-4 text-slate-500" aria-hidden />
                            </button>
                        </li>
                    );
                })}
            </ul>
            {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
            <div className="mt-5 flex justify-end gap-3">
                <button type="button" onClick={onClose} disabled={busy} className={secondaryButton}>Cancel</button>
                <button
                    type="button"
                    disabled={busy || insideExcluded}
                    onClick={async () => { setBusy(true); setError(await onPick(current)); setBusy(false); }}
                    className={primaryButton}
                >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                    {confirmLabel} {current ? "here" : "to My Files"}
                </button>
            </div>
        </dialog>
    );
}
