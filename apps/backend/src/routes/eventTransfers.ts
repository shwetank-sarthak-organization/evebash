import type { Request, Response } from "express";
import { Router } from "express";
import { verifySupabaseUser } from "../auth.js";
import { checkReceiverCapacity, findRootEvent, type ReceiverCapacity } from "../services/eventTransfers.js";
import type { VaultUser } from "../vault/access.js";
import { findPushProfile, sendExpoPush, wantsEventInvites } from "./notifications.js";

/**
 * Event ownership transfer (todo #24). The owner offers an event to another EveBash user, who sees its size and their
 * free space, and accepts or declines. Requests expire after 7 days. Only the owner (or a platform admin helping)
 * can start or cancel one; only the receiver can accept or decline. The move itself is one database transaction
 * (complete_event_transfer). The event_transfers table is backend only.
 */

type Verified = NonNullable<Awaited<ReturnType<typeof verifySupabaseUser>>>;
type Admin = Verified["supabaseAdmin"];
type TransferRow = {
  id: string;
  event_id: string;
  from_user_id: string;
  requested_by: string;
  to_user_id: string;
  keep_old_owner_as_admin: boolean;
  status: string;
  created_at: string;
  expires_at: string;
};
type PushMessage = { title: string; body: string; eventId: string };

type Deps = {
  verifyUser: typeof verifySupabaseUser;
  checkCapacity: (user: VaultUser, neededBytes: number) => Promise<ReceiverCapacity>;
  notify: (admin: Admin, userId: string, message: PushMessage) => Promise<void>;
};

const TRANSFER_COLUMNS = "id, event_id, from_user_id, requested_by, to_user_id, keep_old_owner_as_admin, status, created_at, expires_at";
const GB = 1024 * 1024 * 1024;
const formatGb = (bytes: number) => `${parseFloat((bytes / GB).toFixed(2))} GB`;

async function notifyUser(admin: Admin, userId: string, message: PushMessage) {
  try {
    const profile = await findPushProfile(admin, "id", userId);
    if (!profile?.push_token || !wantsEventInvites(profile.notification_preferences)) return;
    // Opens the Dashboard, where requests show: the receiver can't open the event itself yet
    await sendExpoPush({ token: profile.push_token, title: message.title, body: message.body, data: { type: "event_transfer", eventId: message.eventId } });
  } catch (error) {
    // A failed push never blocks a transfer: the request also shows in the receiver's Dashboard
    console.warn("[EventTransfers] Could not send a notification:", error);
  }
}

function blockMessage(capacity: ReceiverCapacity) {
  switch (capacity.block) {
    case "plan_expired":
      return "Your plan has expired. Renew it to accept this event.";
    case "needs_space":
      return `You need ${formatGb(capacity.neededBytes - (capacity.freeBytes ?? 0))} more. Free up space or upgrade your plan to accept this event.`;
    case "no_event_slot":
      return "Your plan has reached its event limit. Upgrade your plan to accept this event.";
    default:
      return "";
  }
}

const isOwner = (createdBy: string | null, user: { id: string; email?: string | null; phone?: string | null }) =>
  !!createdBy && (createdBy === user.id || createdBy === user.phone || (!!user.email && createdBy.toLowerCase() === user.email.toLowerCase()));

async function isPlatformAdmin(admin: Admin, userId: string) {
  const { data } = await admin.from("profiles").select("role, delegated_by").eq("id", userId).maybeSingle();
  return data?.role === "admin" && !data.delegated_by;
}

async function eventSize(admin: Admin, eventId: string) {
  const { data, error } = await admin.rpc("event_transfer_size_bytes", { p_event_id: eventId });
  if (error) throw error;
  return Number(data) || 0;
}

/** Requests past their 7 days stop being open, so the event's uploads resume and a new request can be made. */
async function expireOldRequests(admin: Admin, now: Date) {
  const { error } = await admin
    .from("event_transfers")
    .update({ status: "expired", decided_at: now.toISOString() })
    .eq("status", "pending")
    .lt("expires_at", now.toISOString());
  if (error) throw error;
}

async function loadProfile(admin: Admin, userId: string) {
  const { data } = await admin.from("profiles").select("id, name, email, phone").eq("id", userId).maybeSingle();
  return data as { id: string; name?: string | null; email?: string | null; phone?: string | null } | null;
}

/** Emails are matched whole and without regard to case; the wildcard characters of ilike are escaped. */
async function findProfileByEmail(admin: Admin, email: string) {
  const pattern = email.replace(/[\\%_]/g, (character) => `\\${character}`);
  const { data, error } = await admin.from("profiles").select("id, name, email, phone").ilike("email", pattern).limit(1);
  if (error) throw error;
  return (data?.[0] ?? null) as { id: string; name?: string | null; email?: string | null; phone?: string | null } | null;
}

export function createEventTransfersRouter(overrides: Partial<Deps> = {}, now: () => Date = () => new Date()) {
  const deps: Deps = { verifyUser: verifySupabaseUser, checkCapacity: checkReceiverCapacity, notify: notifyUser, ...overrides };
  const router = Router();

  const handle = (run: (request: Request, response: Response, verified: Verified) => Promise<unknown>) =>
    async (request: Request, response: Response) => {
      try {
        const verified = await deps.verifyUser(request);
        if (!verified) return response.status(401).json({ success: false, error: "Please log in again." });
        return await run(request, response, verified);
      } catch (error) {
        console.error("[EventTransfers] Request failed:", error);
        return response.status(500).json({ success: false, error: "Something went wrong. Please try again." });
      }
    };

  /** Whether this user may start or cancel transfers for the event: its owner or a platform admin. */
  const canManageTransfer = async (admin: Admin, createdBy: string | null, user: Verified["user"]) =>
    isOwner(createdBy, user) || isPlatformAdmin(admin, user.id);

  // The owner's view: the event's size and any open request
  router.get("/event/:eventId", handle(async (request, response, { user, supabaseAdmin: admin }) => {
    const root = await findRootEvent(admin, String(request.params.eventId));
    if (!root) return response.status(404).json({ success: false, error: "Event not found." });
    if (!(await canManageTransfer(admin, root.created_by, user))) {
      return response.status(403).json({ success: false, error: "Only the event's owner can transfer it." });
    }
    await expireOldRequests(admin, now());
    const [sizeBytes, { data: pending, error }] = await Promise.all([
      eventSize(admin, root.id),
      admin.from("event_transfers").select(TRANSFER_COLUMNS).eq("event_id", root.id).eq("status", "pending").maybeSingle(),
    ]);
    if (error) throw error;
    if (!pending) return response.json({ success: true, eventId: root.id, sizeBytes, pending: null });

    const transfer = pending as TransferRow;
    const receiver = await loadProfile(admin, transfer.to_user_id);
    const capacity = receiver ? await deps.checkCapacity(receiver, sizeBytes) : null;
    return response.json({
      success: true,
      eventId: root.id,
      sizeBytes,
      pending: {
        id: transfer.id,
        toName: receiver?.name || null,
        toEmail: receiver?.email || null,
        expiresAt: transfer.expires_at,
        // Yes or no only: the owner doesn't see how much of the other person's plan is used
        receiverReady: !!capacity?.canAccept,
      },
    });
  }));

  // Requests waiting for the signed-in user, with what they need to decide
  router.get("/incoming", handle(async (_request, response, { user, supabaseAdmin: admin }) => {
    await expireOldRequests(admin, now());
    const { data, error } = await admin
      .from("event_transfers")
      .select(TRANSFER_COLUMNS)
      .eq("to_user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const requests = await Promise.all(((data || []) as TransferRow[]).map(async (transfer) => {
      const [root, sender, sizeBytes] = await Promise.all([
        findRootEvent(admin, transfer.event_id),
        loadProfile(admin, transfer.from_user_id),
        eventSize(admin, transfer.event_id),
      ]);
      const capacity = await deps.checkCapacity(user, sizeBytes);
      return {
        id: transfer.id,
        eventId: transfer.event_id,
        eventTitle: root?.title || "Event",
        fromName: sender?.name || sender?.email || "Someone",
        keepOldOwnerAsAdmin: transfer.keep_old_owner_as_admin,
        expiresAt: transfer.expires_at,
        sizeBytes,
        freeBytes: capacity.freeBytes,
        canAccept: capacity.canAccept,
        block: capacity.block,
        blockMessage: blockMessage(capacity),
      };
    }));
    return response.json({ success: true, requests });
  }));

  // Start a transfer
  router.post("/", handle(async (request, response, { user, supabaseAdmin: admin }) => {
    const body = (request.body || {}) as { eventId?: unknown; toEmail?: unknown; keepOldOwnerAsAdmin?: unknown };
    const eventId = typeof body.eventId === "string" ? body.eventId : "";
    const toEmail = typeof body.toEmail === "string" ? body.toEmail.trim() : "";
    if (!eventId || !toEmail) return response.status(400).json({ success: false, error: "Enter the new owner's email." });

    const root = await findRootEvent(admin, eventId);
    if (!root) return response.status(404).json({ success: false, error: "Event not found." });
    if (!(await canManageTransfer(admin, root.created_by, user))) {
      return response.status(403).json({ success: false, error: "Only the event's owner can transfer it." });
    }

    // The owner of record, who loses the event (a platform admin may be the one pressing the button)
    const owner = isOwner(root.created_by, user)
      ? { id: user.id }
      : root.created_by?.includes("@")
        ? await findProfileByEmail(admin, root.created_by)
        : await loadProfile(admin, root.created_by || "");
    if (!owner) return response.status(409).json({ success: false, error: "This event has no owner account to transfer from." });

    const receiver = await findProfileByEmail(admin, toEmail);
    if (!receiver) {
      return response.status(404).json({ success: false, code: "no_account", error: "No EveBash account uses this email. Ask them to sign up first." });
    }
    if (receiver.id === owner.id) return response.status(400).json({ success: false, error: "You already own this event." });

    await expireOldRequests(admin, now());
    const expiresAt = new Date(now().getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: created, error } = await admin
      .from("event_transfers")
      .insert({
        event_id: root.id,
        from_user_id: owner.id,
        requested_by: user.id,
        to_user_id: receiver.id,
        keep_old_owner_as_admin: body.keepOldOwnerAsAdmin !== false,
        expires_at: expiresAt,
      })
      .select(TRANSFER_COLUMNS)
      .single();
    if (error) {
      if (error.code === "23505") {
        return response.status(409).json({ success: false, code: "already_pending", error: "This event already has a transfer waiting. Cancel it to start a new one." });
      }
      throw error;
    }

    const sizeBytes = await eventSize(admin, root.id);
    const capacity = await deps.checkCapacity(receiver, sizeBytes);
    await deps.notify(admin, receiver.id, {
      title: "An event is being transferred to you",
      body: `Tap to review "${root.title || "an event"}" (${formatGb(sizeBytes)}) and accept or decline.`,
      eventId: root.id,
    });
    return response.json({ success: true, transfer: { id: (created as TransferRow).id, expiresAt }, receiverReady: capacity.canAccept });
  }));

  const loadOpenTransfer = async (admin: Admin, id: string) => {
    await expireOldRequests(admin, now());
    const { data, error } = await admin.from("event_transfers").select(TRANSFER_COLUMNS).eq("id", id).maybeSingle();
    if (error) throw error;
    return data as TransferRow | null;
  };

  const closedReply = (response: Response, transfer: TransferRow | null) => response.status(transfer ? 409 : 404).json({
    success: false,
    code: transfer?.status ?? "not_found",
    error: transfer?.status === "expired" ? "This transfer request has expired." : "This transfer request is no longer open.",
  });

  // The receiver accepts: space, plan and event slot are checked again at this moment
  router.post("/:id/accept", handle(async (request, response, { user, supabaseAdmin: admin }) => {
    const transfer = await loadOpenTransfer(admin, String(request.params.id));
    if (transfer && transfer.to_user_id !== user.id) return response.status(403).json({ success: false, error: "This request is for someone else." });
    if (!transfer || transfer.status !== "pending") return closedReply(response, transfer);

    const sizeBytes = await eventSize(admin, transfer.event_id);
    const capacity = await deps.checkCapacity(user, sizeBytes);
    if (!capacity.canAccept) {
      return response.status(409).json({
        success: false,
        code: capacity.block,
        error: blockMessage(capacity),
        neededBytes: capacity.neededBytes,
        freeBytes: capacity.freeBytes,
      });
    }

    const { data: eventId, error } = await admin.rpc("complete_event_transfer", { p_transfer_id: transfer.id, p_to_user_id: user.id });
    if (error) throw error;

    const root = await findRootEvent(admin, transfer.event_id);
    await deps.notify(admin, transfer.from_user_id, {
      title: "Event transferred",
      body: `"${root?.title || "Your event"}" now belongs to its new owner, and its space is free on your plan again.`,
      eventId: transfer.event_id,
    });
    return response.json({ success: true, eventId });
  }));

  router.post("/:id/decline", handle(async (request, response, { user, supabaseAdmin: admin }) => {
    const transfer = await loadOpenTransfer(admin, String(request.params.id));
    if (transfer && transfer.to_user_id !== user.id) return response.status(403).json({ success: false, error: "This request is for someone else." });
    if (!transfer || transfer.status !== "pending") return closedReply(response, transfer);

    const { error } = await admin.from("event_transfers").update({ status: "declined", decided_at: now().toISOString() }).eq("id", transfer.id).eq("status", "pending");
    if (error) throw error;
    const root = await findRootEvent(admin, transfer.event_id);
    await deps.notify(admin, transfer.from_user_id, {
      title: "Transfer declined",
      body: `The transfer of "${root?.title || "your event"}" was declined. It stays with you, and uploads are open again.`,
      eventId: transfer.event_id,
    });
    return response.json({ success: true });
  }));

  router.post("/:id/cancel", handle(async (request, response, { user, supabaseAdmin: admin }) => {
    const transfer = await loadOpenTransfer(admin, String(request.params.id));
    if (transfer && transfer.from_user_id !== user.id && transfer.requested_by !== user.id && !(await isPlatformAdmin(admin, user.id))) {
      return response.status(403).json({ success: false, error: "Only the event's owner can cancel this." });
    }
    if (!transfer || transfer.status !== "pending") return closedReply(response, transfer);

    const { error } = await admin.from("event_transfers").update({ status: "cancelled", decided_at: now().toISOString() }).eq("id", transfer.id).eq("status", "pending");
    if (error) throw error;
    return response.json({ success: true });
  }));

  return router;
}

export const eventTransfersRouter = createEventTransfersRouter();
