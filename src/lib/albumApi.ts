import { getApiUrl } from "@/lib/apiBase";
import { supabase } from "@/lib/supabase";

// Album proofing: the photographer uploads album page designs, the client reviews them (backend: /api/v1/albums).

export type AlbumStatus = "draft" | "in_review" | "changes_requested" | "approved";
export type AlbumPageStatus = "draft" | "pending" | "approved" | "changes_requested";
export type AlbumPageLayout = "spread" | "single";
export type AlbumCommentKind = "replace" | "bigger" | "smaller" | "edit" | "remove" | "note";
/** The photographer uploads and sends rounds, the client reviews, everyone else (host, other admins) only views. */
export type AlbumRole = "photographer" | "client" | "viewer";
/** Someone who can be given a role: the event host or a guest with Admin Access. */
export type AlbumRoleCandidate = { id: string; name: string; email: string | null; isHost: boolean };
export type AlbumRoles = { photographerId: string; clientIds: string[] };

export type AlbumPhoto = { id: string; eventId: string; thumbnailUrl: string | null; previewUrl: string | null };

export type AlbumSummary = {
    id: string;
    eventId: string;
    title: string;
    status: AlbumStatus;
    currentRound: number;
    pageCount: number;
    approvedCount: number;
    changesCount: number;
    unsentCount: number;
    openRequestCount: number;
    myDraftCount: number;
    myRole: AlbumRole;
    rolesAssigned: boolean;
    coverThumbnailUrl: string | null;
    createdBy: string | null;
    approvedAt: string | null;
    approvedByName: string | null;
    updatedAt: string;
};

export type AlbumComment = {
    id: string;
    version: number;
    parentId: string | null;
    authorId: string;
    authorName: string;
    kind: AlbumCommentKind;
    pinX: number | null;
    pinY: number | null;
    body: string | null;
    voiceUrl: string | null;
    voiceSeconds: number | null;
    replacementPhoto: AlbumPhoto | null;
    status: "open" | "done";
    isDraft: boolean;
    sentAt: string | null;
    resolvedByName: string | null;
    resolvedAt: string | null;
    createdAt: string;
};

export type AlbumPageVersion = {
    version: number;
    /** 0 until it is sent for review */
    round: number;
    fileName: string | null;
    previewUrl: string;
    thumbnailUrl: string;
    width: number | null;
    height: number | null;
    createdAt: string;
};

export type AlbumPage = {
    id: string;
    position: number;
    layout: AlbumPageLayout;
    status: AlbumPageStatus;
    sentVersion: number | null;
    latestVersion: number;
    approvedVersion: number | null;
    approvedByName: string | null;
    approvedAt: string | null;
    versions: AlbumPageVersion[];
    comments: AlbumComment[];
};

export type AlbumRound = { number: number; sentBy: string | null; sentByName: string | null; sentAt: string; pageCount: number; updatedPageCount: number };

export type AlbumDetail = AlbumSummary & {
    viewer: { id: string; isCreator: boolean; role: AlbumRole };
    roles: { photographer: { id: string; name: string } | null; clients: { id: string; name: string }[] };
    rounds: AlbumRound[];
    pages: AlbumPage[];
};

export type NewAlbumComment = {
    kind?: AlbumCommentKind;
    pinX?: number | null;
    pinY?: number | null;
    body?: string | null;
    replacementPhotoId?: string | null;
    parentId?: string | null;
    version?: number;
};

export const ALBUM_MAX_PAGE_BYTES = 60 * 1024 * 1024;
export const ALBUM_MAX_VOICE_SECONDS = 120;
export const ALBUM_PAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/tiff"];

export class AlbumApiError extends Error {
    constructor(readonly status: number, readonly code: string, message: string) {
        super(message);
    }
}

async function authHeader(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new AlbumApiError(401, "unauthenticated", "Please sign in to use album proofing.");
    return { Authorization: `Bearer ${token}` };
}

const url = (path: string) => getApiUrl(`/api/v1/albums${path}`);

async function request<T>(method: string, path: string, body?: unknown, raw?: { data: Blob; contentType: string }): Promise<T> {
    let response: Response;
    try {
        response = await fetch(url(path), {
            method,
            headers: {
                ...(await authHeader()),
                ...(raw ? { "Content-Type": raw.contentType } : body !== undefined ? { "Content-Type": "application/json" } : {}),
            },
            body: raw ? raw.data : body !== undefined ? JSON.stringify(body) : undefined,
        });
    } catch (error) {
        if (error instanceof AlbumApiError) throw error;
        throw new AlbumApiError(0, "network", "Couldn't reach EveBash. Check your connection and try again.");
    }
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.success === false) {
        throw new AlbumApiError(response.status, json.code || "error", json.error || "Something went wrong. Please try again.");
    }
    return json as T;
}

type UploadResponse = {
    success?: boolean;
    code?: string;
    error?: string;
    page?: { id: string; layout: AlbumPageLayout; thumbnailUrl: string; width: number; height: number };
    version?: { pageId: string; version: number; thumbnailUrl: string };
};

/** Uploads one page design (the file itself is the request body), reporting progress from 0 to 1. */
async function uploadPageFile(path: string, file: File, onProgress?: (fraction: number) => void) {
    const headers = await authHeader();
    return new Promise<UploadResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url(path));
        Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) onProgress?.(event.loaded / event.total);
        };
        xhr.onload = () => {
            let json: UploadResponse = {};
            try { json = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
            if (xhr.status >= 200 && xhr.status < 300 && json.success !== false) resolve(json);
            else reject(new AlbumApiError(xhr.status, json.code || "error", json.error || "The upload failed. Please try again."));
        };
        xhr.onerror = () => reject(new AlbumApiError(0, "network", "The upload stopped. Check your connection and try again."));
        xhr.send(file);
    });
}

let enabledCheck: Promise<boolean> | null = null;

export const albumApi = {
    /** Whether the backend has album proofing switched on (checked once per page load). */
    enabled: () => {
        enabledCheck ??= fetch(url("/enabled"))
            .then((response) => response.json())
            .then((json) => json?.enabled === true)
            .catch(() => false);
        return enabledCheck;
    },
    list: (eventId: string) => request<{ albums: AlbumSummary[] }>("GET", `/?eventId=${encodeURIComponent(eventId)}`),
    candidates: (eventId: string) => request<{ candidates: AlbumRoleCandidate[] }>("GET", `/candidates?eventId=${encodeURIComponent(eventId)}`),
    create: (eventId: string, title: string, roles: AlbumRoles) => request<{ album: AlbumDetail }>("POST", "/", { eventId, title, ...roles }),
    setRoles: (albumId: string, roles: AlbumRoles) => request<{ album: AlbumDetail }>("PUT", `/${albumId}/roles`, roles),
    get: (albumId: string) => request<{ album: AlbumDetail }>("GET", `/${albumId}`),
    rename: (albumId: string, title: string) => request<{ album: AlbumDetail }>("PATCH", `/${albumId}`, { title }),
    remove: (albumId: string) => request("DELETE", `/${albumId}`),
    favourites: (albumId: string) => request<{ photos: AlbumPhoto[] }>("GET", `/${albumId}/favourites`),

    uploadPage: (albumId: string, file: File, onProgress?: (fraction: number) => void) =>
        uploadPageFile(`/${albumId}/pages?fileName=${encodeURIComponent(file.name)}`, file, onProgress),
    uploadVersion: (albumId: string, pageId: string, file: File, onProgress?: (fraction: number) => void) =>
        uploadPageFile(`/${albumId}/pages/${pageId}/versions?fileName=${encodeURIComponent(file.name)}`, file, onProgress),
    setLayout: (albumId: string, pageId: string, layout: AlbumPageLayout) =>
        request<{ album: AlbumDetail }>("PATCH", `/${albumId}/pages/${pageId}`, { layout }),
    removePage: (albumId: string, pageId: string) => request<{ album: AlbumDetail }>("DELETE", `/${albumId}/pages/${pageId}`),
    reorder: (albumId: string, pageIds: string[]) => request<{ album: AlbumDetail }>("PUT", `/${albumId}/order`, { pageIds }),

    send: (albumId: string) => request<{ album: AlbumDetail; round: { round: number; pages: number; updatedPages: number } }>("POST", `/${albumId}/send`),
    sendFeedback: (albumId: string) => request<{ album: AlbumDetail; sent: number }>("POST", `/${albumId}/feedback`),
    approvePage: (albumId: string, pageId: string, approved: boolean) =>
        request<{ album: AlbumDetail }>("POST", `/${albumId}/pages/${pageId}/approval`, { approved }),
    approve: (albumId: string) => request<{ album: AlbumDetail }>("POST", `/${albumId}/approve`),
    reopen: (albumId: string) => request<{ album: AlbumDetail }>("POST", `/${albumId}/reopen`),

    addComment: (albumId: string, pageId: string, comment: NewAlbumComment) =>
        request<{ comment: AlbumComment }>("POST", `/${albumId}/pages/${pageId}/comments`, comment),
    updateComment: (albumId: string, commentId: string, patch: Omit<NewAlbumComment, "parentId" | "version">) =>
        request<{ comment: AlbumComment }>("PATCH", `/${albumId}/comments/${commentId}`, patch),
    setCommentStatus: (albumId: string, commentId: string, status: "open" | "done") =>
        request<{ comment: AlbumComment }>("PATCH", `/${albumId}/comments/${commentId}`, { status }),
    removeComment: (albumId: string, commentId: string) => request("DELETE", `/${albumId}/comments/${commentId}`),
    attachVoice: (albumId: string, commentId: string, recording: Blob, seconds: number) =>
        request<{ comment: AlbumComment }>("PUT", `/${albumId}/comments/${commentId}/voice?seconds=${seconds.toFixed(1)}`, undefined,
            { data: recording, contentType: recording.type || "audio/webm" }),
    removeVoice: (albumId: string, commentId: string) => request<{ comment: AlbumComment }>("DELETE", `/${albumId}/comments/${commentId}/voice`),
};

/** "Page 3" or "Pages 4-5": a spread shows two album pages. */
export function albumPageLabels(pages: Pick<AlbumPage, "layout">[]) {
    let next = 1;
    return pages.map((page) => {
        const first = next;
        next += page.layout === "spread" ? 2 : 1;
        return page.layout === "spread" ? `Pages ${first}–${first + 1}` : `Page ${first}`;
    });
}

export const ALBUM_COMMENT_KINDS: { id: AlbumCommentKind; label: string }[] = [
    { id: "replace", label: "Replace photo" },
    { id: "bigger", label: "Make bigger" },
    { id: "smaller", label: "Make smaller" },
    { id: "edit", label: "Edit photo" },
    { id: "remove", label: "Remove" },
    { id: "note", label: "Other" },
];

export const albumCommentKindLabel = (kind: AlbumCommentKind) => ALBUM_COMMENT_KINDS.find((k) => k.id === kind)?.label ?? "Comment";

/** Files in the order a designer numbers them: "2.jpg" before "10.jpg". */
export function sortByFileName<T extends { name: string }>(files: T[]) {
    return [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}
