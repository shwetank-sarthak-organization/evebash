import { getApiUrl } from "@/lib/apiBase";
import { supabase } from "@/lib/supabase";

export type VaultFolder = {
    id: string;
    name: string;
    parentFolderId: string | null;
    createdAt: string;
    updatedAt: string;
};

export type VaultItem = {
    id: string;
    folderId: string | null;
    filename: string;
    extension: string;
    mimeType: string;
    sizeBytes: number;
    isStarred: boolean;
    createdAt: string;
    updatedAt: string;
    /** Outside the retained 1 GB while a paid plan is expired. */
    atRisk?: boolean;
};

export type VaultTrashEntry = {
    kind: "file" | "folder";
    id: string;
    name: string;
    sizeBytes: number | null;
    mimeType: string | null;
    deletedAt: string;
    permanentlyDeletedOn: string;
};

export type VaultUsage = {
    limitBytes: number | null;
    usedBytes: { events: number; vault: number; total: number };
    reservedBytes: number;
    maxFileBytes: number;
    overLimit: boolean;
    uploadsBlocked: null | "plan_expired" | "storage_full";
    plan: { state: "active" | "grace" | "hidden" | "deleting"; expiredOn: string | null; graceEndsOn: string | null; deletionOn: string | null };
};

export class VaultApiError extends Error {
    constructor(readonly status: number, readonly code: string, message: string) {
        super(message);
    }
}

async function authHeader(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new VaultApiError(401, "unauthenticated", "Please sign in to use EB Vault.");
    return { Authorization: `Bearer ${token}` };
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
        response = await fetch(getApiUrl(`/api/v1/vault${path}`), {
            method,
            headers: { ...(await authHeader()), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    } catch (error) {
        if (error instanceof VaultApiError) throw error;
        throw new VaultApiError(0, "network", "Couldn't reach EB Vault. Check your connection and try again.");
    }
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.success === false) {
        throw new VaultApiError(response.status, json.code || "error", json.error || "Something went wrong. Please try again.");
    }
    return json as T;
}

export const vaultApi = {
    usage: () => request<VaultUsage>("GET", "/usage"),
    children: (folderId: string | null) => request<{
        folder: VaultFolder | null;
        breadcrumbs: { id: string; name: string }[];
        folders: VaultFolder[];
        items: VaultItem[];
        hiddenCount: number;
    }>("GET", `/folders/${folderId ?? "root"}/children`),
    recent: () => request<{ items: VaultItem[]; hiddenCount: number }>("GET", "/recent"),
    starred: () => request<{ items: VaultItem[]; hiddenCount: number }>("GET", "/starred"),
    search: (q: string) => request<{ items: VaultItem[]; hiddenCount: number }>("GET", `/search?q=${encodeURIComponent(q)}`),
    trash: () => request<{ entries: VaultTrashEntry[]; retentionDays: number }>("GET", "/trash"),

    createFolder: (name: string, parentFolderId: string | null) =>
        request<{ folder: VaultFolder }>("POST", "/folders", { name, parentFolderId }),
    createFolderPaths: (paths: string[], parentFolderId: string | null) =>
        request<{ folders: Record<string, string> }>("POST", "/folders/paths", { paths, parentFolderId }),
    updateFolder: (id: string, patch: { name?: string; parentFolderId?: string | null }) =>
        request<{ folder: VaultFolder }>("PATCH", `/folders/${id}`, patch),
    trashFolder: (id: string) => request("DELETE", `/folders/${id}`),

    updateItem: (id: string, patch: { filename?: string; folderId?: string | null; isStarred?: boolean }) =>
        request<{ item: VaultItem }>("PATCH", `/items/${id}`, patch),
    copyItem: (id: string, folderId: string | null) => request<{ item: VaultItem }>("POST", `/items/${id}/copy`, { folderId }),
    trashItem: (id: string) => request("DELETE", `/items/${id}`),
    link: (id: string, mode: "view" | "download") => request<{ url: string }>("GET", `/items/${id}/link?mode=${mode}`),

    restore: (kind: "file" | "folder", id: string) => request("POST", "/trash/restore", { kind, id }),
    deleteForever: (kind: "file" | "folder", id: string) => request<{ freedBytes: number }>("DELETE", `/trash/${kind}/${id}`),
    emptyTrash: () => request<{ freedBytes: number }>("DELETE", "/trash"),

    startUpload: (input: { filename: string; sizeBytes: number; mimeType: string; folderId: string | null }) =>
        request<{ uploadId: string; mode: "single"; url: string; headers: Record<string, string> } | { uploadId: string; mode: "multipart"; partSize: number; partCount: number }>(
            "POST", "/uploads", input),
    partUrls: (uploadId: string, partNumbers: number[]) =>
        request<{ parts: { partNumber: number; url: string }[] }>("POST", `/uploads/${uploadId}/parts`, { partNumbers }),
    completeUpload: (uploadId: string, parts?: { partNumber: number; etag: string }[]) =>
        request<{ item: VaultItem }>("POST", `/uploads/${uploadId}/complete`, parts ? { parts } : {}),
    abortUpload: (uploadId: string) => request("POST", `/uploads/${uploadId}/abort`),
};
