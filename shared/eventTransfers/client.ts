// Calls to the backend's event ownership transfer routes (apps/backend/src/routes/eventTransfers.ts), used by the
// website and the app. Each wraps it with its own API address and sign-in (src/lib, apps/mobile/lib).

export type TransferBlock = "plan_expired" | "needs_space" | "no_event_slot";

/** The owner's view. `null` from fetchEventTransfer means this user can't transfer the event, so nothing is shown. */
export type EventTransferStatus = {
    eventId: string;
    sizeBytes: number;
    pending: {
        id: string;
        toName: string | null;
        toEmail: string | null;
        expiresAt: string;
        receiverReady: boolean;
    } | null;
};

/** A request waiting for the signed-in user. */
export type IncomingTransfer = {
    id: string;
    eventId: string;
    eventTitle: string;
    fromName: string;
    keepOldOwnerAsAdmin: boolean;
    expiresAt: string;
    sizeBytes: number;
    freeBytes: number | null;
    canAccept: boolean;
    block: TransferBlock | null;
    blockMessage: string;
};

export type TransferResult = { ok: true } | { ok: false; error: string };

/** What the routes reply with; each call reads the fields of its own route. */
type Reply = {
    error?: string;
    eventId: string;
    sizeBytes: number;
    pending: EventTransferStatus["pending"];
    requests: IncomingTransfer[];
};

type ClientOptions = {
    apiUrl: (path: string) => string;
    getToken: () => Promise<string | null | undefined>;
};

const SERVER_ERROR = "Something went wrong. Please try again.";

export function createEventTransfersClient({ apiUrl, getToken }: ClientOptions) {
    const call = async (path: string, method: "GET" | "POST", body?: object): Promise<{ ok: boolean; result: Reply }> => {
        const token = await getToken();
        if (!token) return { ok: false, result: { error: "Please log in again." } as Reply };
        const response = await fetch(apiUrl(`/api/v1/event-transfers${path}`), {
            method,
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: body ? JSON.stringify(body) : undefined,
        });
        const result = await response.json().catch(() => ({}));
        return { ok: response.ok && !!result.success, result };
    };

    const action = async (path: string, body?: object): Promise<TransferResult> => {
        try {
            const { ok, result } = await call(path, "POST", body);
            return ok ? { ok: true } : { ok: false, error: result.error || SERVER_ERROR };
        } catch {
            return { ok: false, error: SERVER_ERROR };
        }
    };

    return {
        fetchEventTransfer: async (eventId: string): Promise<EventTransferStatus | null> => {
            try {
                const { ok, result } = await call(`/event/${encodeURIComponent(eventId)}`, "GET");
                return ok ? { eventId: result.eventId, sizeBytes: result.sizeBytes, pending: result.pending } : null;
            } catch {
                return null;
            }
        },
        fetchIncomingTransfers: async (): Promise<IncomingTransfer[]> => {
            try {
                const { ok, result } = await call("/incoming", "GET");
                return ok ? result.requests : [];
            } catch {
                return [];
            }
        },
        startTransfer: (eventId: string, toEmail: string, keepOldOwnerAsAdmin: boolean) =>
            action("", { eventId, toEmail, keepOldOwnerAsAdmin }),
        acceptTransfer: (id: string) => action(`/${id}/accept`),
        declineTransfer: (id: string) => action(`/${id}/decline`),
        cancelTransfer: (id: string) => action(`/${id}/cancel`),
    };
}

/** "11 Nov" */
export function formatTransferExpiry(expiresAt: string) {
    return new Date(expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
