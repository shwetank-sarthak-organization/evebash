# Supabase access lockdown: plan (draft for review)

Status: **draft, nothing applied.** Files: `rls-lockdown-draft.sql` (migration), `rls-lockdown-rollback.sql` (undo).

## Why

The website, mobile app and analytics dashboard talk to Supabase with the public (anon) key, which ships
inside the apps. On 2026-10-06:

- **14 tables had row-level security off** with full anon permissions: events, photos, profiles, guests,
  comments, likes, messages, chat_rooms, allowed_users, pending_requests, profile_assigned_events,
  businesses, business_ratings, enquiries. A request with only the public key and no login returned counts
  for profiles, events, photos and guests.
- Anyone could therefore change `profiles.role` (which is both the **plan** and **admin** flag), list
  private galleries, and read guest phone numbers.
- Tables with RLS on but open policies:
  - `faces`: **anyone could read every face scan**
  - `event_favourite_photos`: any logged-in user could edit any gallery's favourites
  - `modal_cost_logs`, `deleted_events_archive`: public read and write
  - `infra_invoices`: open to delegate admins

The backend (Railway) and Modal use the service role and are not affected by any of this.

## Access model (agreed)

| | Not logged in (link / QR) | Logged in |
|---|---|---|
| **Public gallery** | View previews and video streams only. No download, likes, comments or Find You. | Opening the link joins the gallery: view, download originals, like, comment, Find You |
| **Private gallery** | "Log in to request access" | Request access, then the **host approves**, then the same as public |
| Owner | n/a | Manage the gallery, including deleting it |
| Guest admins (approved guests the owner made admin) | n/a | Manage the gallery, except deleting it |
| Platform admins (role `admin`, no `delegated_by`) | n/a | Everything (dashboard) |

"Only with the link" is enforced because anonymous viewers get one gallery at a time through
`open_gallery()` and have no direct table access, and logged-in users only see galleries they own, help
manage, or have joined.

## What changes in the database

- **Helpers** in a private schema `eb_private` (not exposed by the API): owner, can-manage and
  viewable-galleries checks. Can-manage means owner, guest admin, or platform admin.
- **New columns:** `guests.user_id` (membership tied to an account), `deleted_events_archive.event_created_at` (fix B).
- **New view** `profile_cards` (id, name, avatar) so likes and comments can show names without exposing email or phone.
- **New functions:**

| Function | Who | Purpose |
|---|---|---|
| `open_gallery(ref)` | anyone | Resolve link (id / legacy id / join code); join public galleries; report access status |
| `get_public_gallery_media(event, limit, offset)` | anyone | Previews and video streams of a public gallery; never photo originals |
| `request_gallery_access(ref)` | logged in | Join public, or request private (pending until host approves) |
| `archive_deleted_event(...)` | gallery managers | Deletion record with the real owner |
| `is_phone_allowed(phone)` | anyone | Tenant allowlist check without exposing the list |

- **Protected columns (triggers):**
  - profiles `role`, `role_type`, `delegated_by` and plan/pending-plan fields change only via the server or a
    platform admin; new profiles always start as `user`
  - events: owner can't change; visibility owner only; sample-gallery flag admins only
- **Policies** for every table above, and **no anon writes anywhere** (the tenant access-request exception was dropped
  on 2026-10-09 with the tenant section).

## Code changes needed (before applying)

| # | Where | Change |
|---|---|---|
| 1 | Web `events/[slug]`, tenant event page; mobile gallery screens | Logged out: `open_gallery` + `get_public_gallery_media`. Logged in: `open_gallery` (joins), then the existing queries |
| 2 | Web + mobile gallery UI | Logged out: hide download, like, comment, Find You; show "log in" prompts |
| 3 | Web + mobile guest request flow | Replace phone-based `logGuestLogin` with `request_gallery_access` (requires login) |
| 4 | Web host page, gallery pages, mobile, dashboard | Remove the hidden primary/event manager feature (screen at `/host?view=permissions`, `updateUserRole`, manager checks). Optional cleanup, not required before the lockdown; agree with Shwetank |
| 5 | Web + mobile likes/comments | Embed `profile_cards(name, profile_image)` instead of `profiles(...)` |
| 6 | Web + mobile `deleteEvent` | Use `archive_deleted_event` instead of inserting into the archive table |
| 7 | Web tenant section | **Remove** (inactive: no wildcard DNS; planned replacement is the normal login). Delete `src/app/(tenant)`, `TenantGuard`, the subdomain rewrite in `src/middleware.ts`, and `loginWithPhoneSimple` (it holds a hard-coded admin phone number). `is_phone_allowed` and the allowlist tables can go later |
| 8 | Web | Remove dead `getAllFaceEncodings` / `getEventFaceEncodings` |
| 9 | Mobile business features | `incrementBusinessViewCount` needs a function (it edits someone else's row) |
| — | Dashboard | No change expected: platform-admin policies cover its reads and writes |
| — | Backend, Modal | No change (service role) |

Old app builds would break on the changed flows, but there are no store releases yet, so this is fine pre-launch.

## Relation to Shwetank's 2026-10-05 migrations

`20261004010000_event_video_upload_permissions.sql` and `20261004020000_event_admin_visibility.sql` define the
same manager model (owner; primary managers for all the owner's galleries; event managers for assigned ones;
guest admins). Neither is applied in the live database, and neither can apply as written:

- `profiles.id` (text) is compared with `auth.uid()` (uuid), which has no `=` operator
- they read a `guests.email` column that doesn't exist

As a result the apps' calls to `can_manage_event_visibility` fail today. This draft adopts their rules, with
the type bugs fixed:

- owner **and guest admins** can switch a gallery public/private (his two manager types are dropped, see decisions)
- only the owner can create a gallery that starts public
- sub-galleries inherit visibility
- only managers write photo/video rows

**Don't apply those two migrations separately;** this draft replaces them. Their video restriction is covered
because only managers can write photo rows directly at all (guest uploads go through the backend).

## Decisions (2026-10-06)

1. **Primary and event managers are dropped.** Both have been hidden since 16 June (`b0d29c1` removed the link)
   and nobody uses them; **guest admin** (visible on web and mobile, one gallery, host-controlled) covers the
   "host is busy" case. The rules grant managers nothing, and nobody can make themselves one.
2. Only the owner (or a platform admin) can delete a gallery; guest admins cannot.
3. Phase 2 business features (vendor listings, ratings, enquiries, client-vendor chat): logged-in users
   only for now; revisit public browsing at Phase 2.
4. Nobody signs up with a special role today (all start as `user`; businesses are rows owned by a user,
   not a role), so the signup trigger changes nothing.
5. The 4 existing approved guests will log in and request again.

## Step 3 result (2026-10-06)

Ran the draft plus `rls-lockdown-tests.sql` on the live database inside one transaction that always rolls
back (verified afterwards: no schema, functions, columns or test rows left; RLS unchanged).

**111 / 111 checks passed** across anonymous (31), random logged-in user (35), approved member (10),
guest admin (12), owner (12), platform admin (7) and database facts (4).

The first run found 1 draft bug, now fixed: `guests.can_comment` defaults to false, so joined members couldn't
comment; `request_gallery_access` now sets it true (the host can still turn it off).

Also confirmed:

- face scans, photos, likes, comments and favourites are removed automatically (FK cascade) when a photo or
  gallery is deleted, so the apps' explicit `faces` delete is a harmless no-op
- deletion records get the real owner

Not covered: realtime subscriptions, and the app screens themselves (step 4).

## Part 1: functions only (step 4, 2026-10-07)

`supabase/migrations/20261007000000_rls_part1_gallery_link_functions.sql` is sections 1–3 of the draft without
`can_manage_event_visibility` / `set_event_public_viewing` (those would switch on the host visibility toggle, so
they wait for part 2). New objects only: RLS, triggers and policies are unchanged, so existing screens behave as before.
Tests: `rls-lockdown-part1-tests.sql`. Rollback: `rls-lockdown-part1-rollback.sql`.

Draft changes made while preparing it (both suites re-run):

- `get_public_gallery_media` leaves out cover uploads (`__cover_usage__`) and rows still uploading, and a top-level
  gallery's Home tab returns the host's favourites from its family, as members see it
- `profile_cards`: Supabase's default privileges gave logged-in users insert/update/delete on new views, and the view
  is auto-updatable, so anyone logged in could have renamed or deleted any profile through it. Writes are now revoked.
- `request_gallery_access` / `archive_deleted_event` no longer keep the default anon EXECUTE grant

Dry runs on the live DB (always rolled back, nothing persisted): part 1 **70/70**, full lockdown **118/118**.
Status: **applied 2026-10-09**.

Request rules (decided 2026-10-09, `20261009000000_gallery_requests_after_rejection.sql`): a rejection isn't final.
A rejected guest of a private gallery sees the normal request screen, and asking again makes them pending (no cooldown).
Opening a public gallery joins it, including for anyone whose earlier request was pending or rejected.
Dry runs: part 1 77/77, full lockdown 124/124. Applied 2026-10-09.

Client fixes found by the 2026-10-09 access re-scan (would break for guests or logged-out visitors once RLS is on):

- B `is_username_available`: the username check read every profile (`20261009010000_is_username_available.sql`)
- D `get_media_plan_limit` + `eb_private.media_plan_limit`: the expired-plan media limit is worked out in the database;
  `get_public_gallery_media` applies it for logged-out viewers
- E sample galleries: viewable read-only by anyone through `open_gallery` / `get_public_gallery_media` (never joined),
  listed by `get_sample_galleries` (D and E: `20261009020000_plan_limit_and_sample_galleries.sql`)

Dry runs 2026-10-09 (rolled back): part 1 + migrations 100/100, full lockdown 147/147. B, D, E applied 2026-10-09.

## Test plan (step 3)

Apply to a **copy** of the database first (a Supabase branch or a separate free project with the same
schema), then run scripted checks as four identities: anonymous, a random logged-in user, the host, and
a platform admin.

- **Anonymous:** opens a public gallery (previews only, no originals); private gallery says login
  required; cannot list events/photos/profiles/guests/faces; cannot write anything.
- **Random user:** cannot list galleries they haven't joined; joining a public gallery works; private
  request stays pending; cannot change their own role or plan; cannot read others' phones.
- **Host:** full gallery management, approve guests, add a delegate, favourites, delete gallery
  (archive record written).
- **Admin:** dashboard pages load (users, events, costs, invoices, deletions).
- Then a manual run through the website and the app (login, upload, gallery, guest request/approve,
  Find You, delete).

## Rollout

1. Ship code changes 1–9 (they work with or without the lockdown, since the new functions exist first:
   apply sections 1–3 of the SQL before shipping, sections 4–7 after).
2. Apply sections 4–7 (triggers, policies, grants) in a quiet window.
3. Rollback: `rls-lockdown-rollback.sql` restores the previous access in one transaction.
