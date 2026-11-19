import { deleteGalleryMedia } from "./deleteGalleryMedia.js";
import type { getAdminClient } from "./adminAuth.js";

// Reports filed in the apps through file_content_report() (supabase/migrations/20261023000000_content_reports.sql),
// reviewed in the analytics dashboard's Reports tab.
type Db = ReturnType<typeof getAdminClient>;

export const REPORT_STATUSES = ["open", "actioned", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

// Long enough to mean "until lifted": Supabase bans take a duration, not "forever"
const SUSPEND_DURATION = "876000h";

export class ContentReportError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

type ReportRow = {
  id: string;
  reporter_id: string | null;
  target_type: "media" | "comment" | "chat_message" | "business" | "user";
  target_id: string;
  event_id: string | null;
  reported_user_id: string | null;
  target_snapshot: string | null;
  reason: string;
  note: string | null;
  platform: string | null;
  status: ReportStatus;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

const unique = (values: Array<string | null | undefined>) => [...new Set(values.filter((value): value is string => !!value))];

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function listContentReports(db: Db, payload: Record<string, unknown>) {
  const status = payload.status === undefined || payload.status === "all" ? null : payload.status;
  if (status !== null && !REPORT_STATUSES.includes(status as ReportStatus)) {
    throw new ContentReportError("Invalid report status");
  }
  let query = db.from("content_reports").select("*").order("created_at", { ascending: false }).limit(500);
  if (status) query = query.eq("status", status as string);
  const { data, error } = await query;
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      throw new ContentReportError("Reports table is missing. Apply supabase/migrations/20261023000000_content_reports.sql.", 409);
    }
    throw new Error(error.message);
  }
  const reports = (data || []) as ReportRow[];

  // Names and previews so the dashboard can show what was reported without more round trips
  const userIds = unique(reports.flatMap((report) => [report.reporter_id, report.reported_user_id]));
  const eventIds = unique(reports.map((report) => report.event_id));
  const mediaIds = unique(reports.filter((report) => report.target_type === "media").map((report) => report.target_id));
  const [profiles, events, media] = await Promise.all([
    userIds.length ? db.from("profiles").select("id, name, email").in("id", userIds) : { data: [], error: null },
    eventIds.length ? db.from("events").select("id, title").in("id", eventIds) : { data: [], error: null },
    mediaIds.length ? db.from("photos").select("id, url, thumbnail_url, media_type, resource_type").in("id", mediaIds) : { data: [], error: null },
  ]);
  for (const result of [profiles, events, media]) if (result.error) throw new Error(result.error.message);
  const byId = <T extends { id: string }>(rows: T[] | null) => new Map((rows || []).map((row) => [String(row.id), row]));
  const profileMap = byId(profiles.data as Array<{ id: string; name?: string; email?: string }>);
  const eventMap = byId(events.data as Array<{ id: string; title?: string }>);
  const mediaMap = byId(media.data as Array<{ id: string; url?: string; thumbnail_url?: string; media_type?: string; resource_type?: string }>);

  // Whether each reported account is suspended right now
  const suspended = new Map<string, boolean>();
  await Promise.all(unique(reports.map((report) => report.reported_user_id)).slice(0, 100).map(async (uid) => {
    const { data: authUser } = await db.auth.admin.getUserById(uid);
    const until = (authUser?.user as { banned_until?: string } | undefined)?.banned_until;
    suspended.set(uid, !!until && new Date(until).getTime() > Date.now());
  }));

  return reports.map((report) => {
    const reporter = report.reporter_id ? profileMap.get(report.reporter_id) : undefined;
    const reported = report.reported_user_id ? profileMap.get(report.reported_user_id) : undefined;
    const item = report.target_type === "media" ? mediaMap.get(report.target_id) : undefined;
    return {
      ...report,
      reporter_name: reporter?.name || null,
      reporter_email: reporter?.email || null,
      reported_user_name: reported?.name || null,
      reported_user_email: reported?.email || null,
      reported_user_suspended: report.reported_user_id ? suspended.get(report.reported_user_id) ?? null : null,
      event_title: report.event_id ? eventMap.get(report.event_id)?.title || null : null,
      // null for media that has since been deleted
      media: item ? {
        url: item.url || null,
        thumbnail_url: item.thumbnail_url || null,
        is_video: item.media_type === "video" || item.resource_type === "video",
      } : null,
    };
  });
}

async function loadReport(db: Db, reportId: unknown) {
  const id = text(reportId, 100);
  if (!id) throw new ContentReportError("Report id is required");
  const { data, error } = await db.from("content_reports").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new ContentReportError("Report not found", 404);
  return data as ReportRow;
}

export async function reviewContentReport(db: Db, reviewerId: string, payload: Record<string, unknown>) {
  const report = await loadReport(db, payload.reportId);
  const status = payload.status as ReportStatus;
  if (!REPORT_STATUSES.includes(status)) throw new ContentReportError("Invalid report status");
  const adminNote = text(payload.adminNote, 2000);
  const { error } = await db.from("content_reports").update({
    status,
    admin_note: adminNote || report.admin_note,
    reviewed_by: status === "open" ? null : reviewerId,
    reviewed_at: status === "open" ? null : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", report.id);
  if (error) throw new Error(error.message);
}

// Close every open report about the same item, so it leaves the queue once it's dealt with
async function closeReportsForTarget(db: Db, report: ReportRow, reviewerId: string, adminNote: string) {
  const now = new Date().toISOString();
  const { error } = await db.from("content_reports").update({
    status: "actioned", admin_note: adminNote, reviewed_by: reviewerId, reviewed_at: now, updated_at: now,
  }).eq("target_type", report.target_type).eq("target_id", report.target_id).eq("status", "open");
  if (error) throw new Error(error.message);
}

/** Deletes the reported photo, video, comment or chat message and closes its reports. */
export async function removeReportedContent(db: Db, reviewerId: string, payload: Record<string, unknown>) {
  if (payload.confirm !== "REMOVE_REPORTED_CONTENT") throw new ContentReportError("Removal confirmation is required");
  const report = await loadReport(db, payload.reportId);
  if (report.target_type === "media") {
    let eventId = report.event_id;
    if (!eventId) {
      const { data } = await db.from("photos").select("event_id").eq("id", report.target_id).maybeSingle();
      eventId = (data as { event_id?: string } | null)?.event_id || null;
    }
    // Already gone counts as done: the owner may have deleted it first
    if (eventId) await deleteGalleryMedia(db, report.target_id, eventId);
  } else if (report.target_type === "comment" || report.target_type === "chat_message") {
    const table = report.target_type === "comment" ? "comments" : "messages";
    const { error } = await db.from(table).delete().eq("id", report.target_id);
    if (error) throw new Error(error.message);
  } else {
    throw new ContentReportError("Businesses and users can't be removed from here. Suspend the account instead.");
  }
  await closeReportsForTarget(db, report, reviewerId, text(payload.adminNote, 2000) || "Content removed");
}

/** Suspends (or lifts the suspension of) the account behind a report: they can't log in while suspended. */
export async function setReportedUserSuspended(db: Db, reviewerId: string, payload: Record<string, unknown>) {
  const report = await loadReport(db, payload.reportId);
  const uid = report.reported_user_id;
  if (!uid) throw new ContentReportError("This report has no account to suspend");
  if (uid === reviewerId) throw new ContentReportError("You can't suspend your own account");
  const suspend = payload.suspended === true;
  if (suspend && payload.confirm !== "SUSPEND_USER") throw new ContentReportError("Suspension confirmation is required");
  const { error } = await db.auth.admin.updateUserById(uid, { ban_duration: suspend ? SUSPEND_DURATION : "none" });
  if (error) throw new Error(error.message);
  if (suspend) await closeReportsForTarget(db, report, reviewerId, text(payload.adminNote, 2000) || "Account suspended");
}
