"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, X, XCircle } from "lucide-react";
import { vaultApi, VaultApiError } from "@/lib/vaultApi";
import { folderPathsOf, uploadVaultFile } from "@/lib/vaultUpload";
import { cn } from "@/lib/utils";
import { formatBytes } from "./format";

type UploadTask = {
    id: string;
    file: File;
    folderId: string | null;
    loaded: number;
    status: "queued" | "uploading" | "done" | "error" | "cancelled";
    error?: string;
    controller: AbortController;
};

const PARALLEL_FILES = 3;

/** Upload queue: up to three files at a time, each with its own progress and cancel. */
export function useVaultUploads(onUploaded: () => void) {
    const [tasks, setTasks] = useState<UploadTask[]>([]);
    const running = useRef(0);
    const queue = useRef<UploadTask[]>([]);
    const onUploadedRef = useRef(onUploaded);
    onUploadedRef.current = onUploaded;

    const update = useCallback((id: string, patch: Partial<UploadTask>) => {
        setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...patch } : task)));
    }, []);

    const pump = useCallback(function pumpQueue() {
        while (running.current < PARALLEL_FILES && queue.current.length > 0) {
            const task = queue.current.shift()!;
            if (task.controller.signal.aborted) continue;
            running.current += 1;
            update(task.id, { status: "uploading" });
            uploadVaultFile(task.file, task.folderId, (loaded) => update(task.id, { loaded }), task.controller.signal)
                .then(() => {
                    update(task.id, { status: "done", loaded: task.file.size });
                    onUploadedRef.current();
                })
                .catch((error: unknown) => {
                    if (task.controller.signal.aborted) return update(task.id, { status: "cancelled" });
                    update(task.id, { status: "error", error: error instanceof VaultApiError ? error.message : "Upload failed. Please try again." });
                })
                .finally(() => {
                    running.current -= 1;
                    pumpQueue();
                });
        }
    }, [update]);

    const enqueue = useCallback((entries: { file: File; folderId: string | null }[]) => {
        const created = entries.map(({ file, folderId }): UploadTask => ({
            id: crypto.randomUUID(), file, folderId, loaded: 0, status: "queued", controller: new AbortController(),
        }));
        setTasks((current) => [...current, ...created]);
        queue.current.push(...created);
        pump();
    }, [pump]);

    const uploadFiles = useCallback((files: File[], folderId: string | null) => {
        enqueue(files.map((file) => ({ file, folderId })));
    }, [enqueue]);

    /** Recreates the folder structure first, then uploads each file into its folder. */
    const uploadFolder = useCallback(async (files: File[], parentFolderId: string | null) => {
        const { folders } = await vaultApi.createFolderPaths(folderPathsOf(files), parentFolderId);
        enqueue(files.map((file) => {
            const dir = (file.webkitRelativePath || "").split("/").slice(0, -1).join("/");
            return { file, folderId: folders[dir] ?? parentFolderId };
        }));
        onUploadedRef.current();
    }, [enqueue]);

    const cancel = useCallback((id: string) => {
        setTasks((current) => current.map((task) => {
            if (task.id !== id) return task;
            task.controller.abort();
            return task.status === "queued" ? { ...task, status: "cancelled" } : task;
        }));
    }, []);

    const clearFinished = useCallback(() => {
        setTasks((current) => current.filter((task) => task.status === "queued" || task.status === "uploading"));
    }, []);

    // Warn before leaving the page while uploads are still running.
    const active = tasks.some((task) => task.status === "queued" || task.status === "uploading");
    useEffect(() => {
        if (!active) return;
        const warn = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [active]);

    return { tasks, uploadFiles, uploadFolder, cancel, clearFinished };
}

export function UploadTray({ tasks, onCancel, onClear }: { tasks: UploadTask[]; onCancel: (id: string) => void; onClear: () => void }) {
    const [collapsed, setCollapsed] = useState(false);
    if (tasks.length === 0) return null;
    const active = tasks.filter((task) => task.status === "queued" || task.status === "uploading").length;
    const failed = tasks.filter((task) => task.status === "error").length;

    return (
        <section aria-label="Uploads" className="fixed bottom-4 right-4 z-40 w-[calc(100%-2rem)] max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#141B22] shadow-2xl shadow-black/50">
            <header className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
                <p className="flex-1 text-sm font-semibold text-white" aria-live="polite">
                    {active > 0 ? `Uploading ${active} ${active === 1 ? "file" : "files"}…` : failed > 0 ? `${failed} ${failed === 1 ? "upload" : "uploads"} failed` : "Uploads complete"}
                </p>
                {active === 0 && <button type="button" onClick={onClear} className="rounded px-2 py-1 text-xs text-slate-300 hover:bg-white/10">Clear</button>}
                <button type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Show uploads" : "Hide uploads"} className="rounded p-1 text-slate-300 hover:bg-white/10">
                    {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
            </header>
            {!collapsed && (
                <ul className="max-h-72 divide-y divide-white/5 overflow-y-auto">
                    {tasks.map((task) => {
                        const percent = task.file.size ? Math.round((task.loaded / task.file.size) * 100) : task.status === "done" ? 100 : 0;
                        return (
                            <li key={task.id} className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <p className="min-w-0 flex-1 truncate text-sm text-slate-200">{task.file.name}</p>
                                    {task.status === "done" && <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-label="Uploaded" />}
                                    {task.status === "error" && <XCircle className="h-4 w-4 text-red-400" aria-label="Failed" />}
                                    {task.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-[#CA9C68]" aria-hidden />}
                                    {(task.status === "queued" || task.status === "uploading") && (
                                        <button type="button" onClick={() => onCancel(task.id)} aria-label={`Cancel ${task.file.name}`} className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                                <p className={cn("mt-1 text-xs", task.status === "error" ? "text-red-300" : "text-slate-400")}>
                                    {task.status === "error" ? task.error
                                        : task.status === "cancelled" ? "Cancelled"
                                        : task.status === "queued" ? `Waiting · ${formatBytes(task.file.size)}`
                                        : task.status === "done" ? formatBytes(task.file.size)
                                        : `${formatBytes(task.loaded)} of ${formatBytes(task.file.size)} · ${percent}%`}
                                </p>
                                {task.status === "uploading" && (
                                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${task.file.name} upload progress`}>
                                        <div className="h-full bg-[#CA9C68] transition-[width]" style={{ width: `${percent}%` }} />
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
