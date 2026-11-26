import type { getAdminClient } from "./adminAuth.js";

// Todo #27: who changed what in an event and when. Rows are written by a database trigger
// (supabase/migrations/20261119230000_event_change_log.sql) and shown in the analytics dashboard's Change log.
type Db = ReturnType<typeof getAdminClient>;

const PAGE_SIZE = 200;

export class EventChangeLogError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

type ChangeRow = {
  id: number;
  event_id: string;
  root_event_id: string;
  event_title: string | null;
  action: "created" | "updated" | "deleted";
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  actor_id: string | null;
  actor_email: string | null;
  actor_role: string;
  source: string;
  client: string | null;
  origin: string | null;
  created_at: string;
};

const unique = (values: Array<string | null | undefined>) => [...new Set(values.filter((value): value is string => !!value))];

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

// A gallery's log covers its main event and every sub-gallery. Takes a gallery id or Join ID; a deleted gallery's id
// is used as it is, so its history can still be read.
async function resolveRootEventId(db: Db, ref: string) {
  const byId = await db.from("events").select("id, parent_id").eq("id", ref).maybeSingle();
  if (byId.error) throw new Error(byId.error.message);
  let row = byId.data as { id: string; parent_id: string | null } | null;
  if (!row) {
    const byJoinId = await db.from("events").select("id, parent_id").eq("join_id", ref.toUpperCase()).limit(1).maybeSingle();
    if (byJoinId.error) throw new Error(byJoinId.error.message);
    row = byJoinId.data as typeof row;
  }
  return row ? row.parent_id || row.id : ref;
}

export async function listEventChanges(db: Db, payload: Record<string, unknown>) {
  const eventRef = text(payload.eventId, 200);
  const actor = text(payload.actor, 200);
  const beforeId = Number(payload.beforeId);

  let query = db.from("event_change_log").select("*").order("id", { ascending: false }).limit(PAGE_SIZE + 1);
  if (eventRef) query = query.eq("root_event_id", await resolveRootEventId(db, eventRef));
  if (actor) {
    if (actor.includes("@")) {
      const email = actor.toLowerCase();
      const { data: profile, error } = await db.from("profiles").select("id").eq("email", email).limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      query = profile ? query.eq("actor_id", String(profile.id)) : query.eq("actor_email", email);
    } else {
      query = query.eq("actor_id", actor);
    }
  }
  if (Number.isSafeInteger(beforeId) && beforeId > 0) query = query.lt("id", beforeId);

  const { data, error } = await query;
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      throw new EventChangeLogError("Change log table is missing. Apply supabase/migrations/20261119230000_event_change_log.sql.", 409);
    }
    throw new Error(error.message);
  }
  const rows = (data || []) as ChangeRow[];
  const hasMore = rows.length > PAGE_SIZE;
  const changes = rows.slice(0, PAGE_SIZE);

  // Names for people and current titles for galleries, so the dashboard needs no more round trips
  const actorIds = unique(changes.map((change) => change.actor_id));
  const eventIds = unique(changes.flatMap((change) => [change.event_id, change.root_event_id]));
  const [profiles, events] = await Promise.all([
    actorIds.length ? db.from("profiles").select("id, name, email").in("id", actorIds) : { data: [], error: null },
    eventIds.length ? db.from("events").select("id, title").in("id", eventIds) : { data: [], error: null },
  ]);
  for (const result of [profiles, events]) if (result.error) throw new Error(result.error.message);
  const profileMap = new Map((profiles.data as Array<{ id: string; name?: string; email?: string }> || []).map((row) => [String(row.id), row]));
  const titleMap = new Map((events.data as Array<{ id: string; title?: string }> || []).map((row) => [String(row.id), row.title || ""]));

  return {
    hasMore,
    changes: changes.map((change) => {
      const person = change.actor_id ? profileMap.get(change.actor_id) : undefined;
      return {
        ...change,
        actor_name: person?.name || null,
        actor_email: person?.email || change.actor_email,
        // null once the gallery is deleted; event_title keeps the name it had then
        current_title: titleMap.get(change.event_id) ?? null,
        root_title: titleMap.get(change.root_event_id) ?? null,
      };
    }),
  };
}
