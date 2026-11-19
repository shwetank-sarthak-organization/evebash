import { test } from "node:test";
import assert from "node:assert/strict";
import {
  listContentReports,
  removeReportedContent,
  reviewContentReport,
  setReportedUserSuspended,
} from "../src/contentReports.js";

type Row = Record<string, any>;

// Minimal stand-in for the service-role Supabase client: eq/in filters, select/update/delete, and auth bans
function fakeDb(tables: Record<string, Row[]>, bans: Record<string, string | null> = {}) {
  const banCalls: Array<{ uid: string; ban_duration: string }> = [];
  const db: any = {
    from(table: string) {
      let mode: "select" | "update" | "delete" = "select";
      let patch: Row = {};
      const filters: Array<(row: Row) => boolean> = [];
      const rows = () => (tables[table] ||= []).filter((row) => filters.every((filter) => filter(row)));
      const run = () => {
        if (mode === "update") rows().forEach((row) => Object.assign(row, patch));
        if (mode === "delete") {
          const doomed = new Set(rows());
          tables[table] = tables[table].filter((row) => !doomed.has(row));
        }
        return { data: mode === "select" ? rows() : null, error: null };
      };
      const query: any = {
        select() { return query; },
        order() { return query; },
        limit() { return query; },
        update(values: Row) { mode = "update"; patch = values; return query; },
        delete() { mode = "delete"; return query; },
        eq(column: string, value: unknown) { filters.push((row) => row[column] === value); return query; },
        in(column: string, values: unknown[]) { filters.push((row) => values.includes(row[column])); return query; },
        async maybeSingle() { return { data: rows()[0] || null, error: null }; },
        then(resolve: any, reject: any) { return Promise.resolve(run()).then(resolve, reject); },
      };
      return query;
    },
    auth: { admin: {
      async getUserById(uid: string) { return { data: { user: { id: uid, banned_until: bans[uid] ?? null } }, error: null }; },
      async updateUserById(uid: string, attrs: { ban_duration: string }) { banCalls.push({ uid, ...attrs }); return { error: null }; },
    } },
  };
  return { db, tables, banCalls };
}

const report = (overrides: Row): Row => ({
  id: "r1", reporter_id: "reporter", target_type: "comment", target_id: "c1", event_id: "e1",
  reported_user_id: "bad", target_snapshot: "rude words", reason: "harassment", note: null, platform: "web",
  status: "open", admin_note: null, reviewed_by: null, reviewed_at: null, created_at: "2026-10-23T10:00:00Z",
  ...overrides,
});

test("listing filters by status and adds names, gallery titles, media previews and suspension state", async () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const { db } = fakeDb({
    content_reports: [
      report({}),
      report({ id: "r2", target_type: "media", target_id: "p1", reported_user_id: "uploader" }),
      report({ id: "r3", status: "dismissed" }),
    ],
    profiles: [{ id: "reporter", name: "Riya", email: "riya@example.com" }, { id: "bad", name: "Bad Actor", email: "bad@example.com" }],
    events: [{ id: "e1", title: "Sangeet" }],
    photos: [{ id: "p1", url: "https://cdn/p1.jpg", thumbnail_url: "https://cdn/p1-thumb.webp", media_type: "video" }],
  }, { bad: future });

  await assert.rejects(listContentReports(db, { status: "pending" }), /Invalid report status/);

  const open = await listContentReports(db, { status: "open" });
  assert.deepEqual(open.map((row) => row.id), ["r1", "r2"]);
  assert.equal(open[0].reporter_name, "Riya");
  assert.equal(open[0].reported_user_name, "Bad Actor");
  assert.equal(open[0].reported_user_suspended, true);
  assert.equal(open[0].event_title, "Sangeet");
  assert.equal(open[0].media, null);
  assert.deepEqual(open[1].media, { url: "https://cdn/p1.jpg", thumbnail_url: "https://cdn/p1-thumb.webp", is_video: true });
  assert.equal(open[1].reported_user_suspended, false);

  assert.equal((await listContentReports(db, { status: "all" })).length, 3);
});

test("reviewing sets the status and who reviewed it; reopening clears the review", async () => {
  const { db, tables } = fakeDb({ content_reports: [report({})] });
  await assert.rejects(reviewContentReport(db, "admin", { reportId: "r1", status: "closed" }), /Invalid report status/);
  await assert.rejects(reviewContentReport(db, "admin", { reportId: "missing", status: "dismissed" }), /Report not found/);

  await reviewContentReport(db, "admin", { reportId: "r1", status: "dismissed", adminNote: " Not a violation " });
  assert.equal(tables.content_reports[0].status, "dismissed");
  assert.equal(tables.content_reports[0].admin_note, "Not a violation");
  assert.equal(tables.content_reports[0].reviewed_by, "admin");
  assert.ok(tables.content_reports[0].reviewed_at);

  await reviewContentReport(db, "admin", { reportId: "r1", status: "open" });
  assert.equal(tables.content_reports[0].reviewed_by, null);
  assert.equal(tables.content_reports[0].reviewed_at, null);
  assert.equal(tables.content_reports[0].admin_note, "Not a violation");
});

test("removing a comment deletes only that comment and closes every open report about it", async () => {
  const { db, tables } = fakeDb({
    content_reports: [
      report({}),
      report({ id: "r2", reporter_id: "someone-else" }),
      report({ id: "r3", target_id: "c2" }),
      report({ id: "r4", status: "dismissed" }),
    ],
    comments: [{ id: "c1", text: "rude words" }, { id: "c2", text: "fine" }],
  });

  await assert.rejects(removeReportedContent(db, "admin", { reportId: "r1" }), /confirmation is required/);
  assert.equal(tables.comments.length, 2);

  await removeReportedContent(db, "admin", { reportId: "r1", confirm: "REMOVE_REPORTED_CONTENT" });
  assert.deepEqual(tables.comments.map((row) => row.id), ["c2"]);
  const status = Object.fromEntries(tables.content_reports.map((row) => [row.id, row.status]));
  assert.deepEqual(status, { r1: "actioned", r2: "actioned", r3: "open", r4: "dismissed" });
  assert.equal(tables.content_reports[0].admin_note, "Content removed");
});

test("chat messages are removable; businesses and users are not", async () => {
  const { db, tables } = fakeDb({
    content_reports: [
      report({ id: "m", target_type: "chat_message", target_id: "msg1" }),
      report({ id: "b", target_type: "business", target_id: "biz_1" }),
    ],
    messages: [{ id: "msg1" }, { id: "msg2" }],
  });
  await removeReportedContent(db, "admin", { reportId: "m", confirm: "REMOVE_REPORTED_CONTENT" });
  assert.deepEqual(tables.messages.map((row) => row.id), ["msg2"]);
  await assert.rejects(
    removeReportedContent(db, "admin", { reportId: "b", confirm: "REMOVE_REPORTED_CONTENT" }),
    /Suspend the account instead/
  );
});

test("suspending bans the reported account until lifted, and lifting it unbans", async () => {
  const { db, tables, banCalls } = fakeDb({
    content_reports: [report({ target_type: "user", target_id: "bad" }), report({ id: "self", reported_user_id: "admin" })],
  });
  await assert.rejects(setReportedUserSuspended(db, "admin", { reportId: "r1", suspended: true }), /confirmation is required/);
  await assert.rejects(
    setReportedUserSuspended(db, "admin", { reportId: "self", suspended: true, confirm: "SUSPEND_USER" }),
    /your own account/
  );
  assert.equal(banCalls.length, 0);

  await setReportedUserSuspended(db, "admin", { reportId: "r1", suspended: true, confirm: "SUSPEND_USER" });
  assert.deepEqual(banCalls, [{ uid: "bad", ban_duration: "876000h" }]);
  assert.equal(tables.content_reports[0].status, "actioned");

  await setReportedUserSuspended(db, "admin", { reportId: "r1", suspended: false });
  assert.deepEqual(banCalls[1], { uid: "bad", ban_duration: "none" });
});
