-- The picture of the app's guest home (todo #31): the website's Guest Home Preview (Design tab) shows the app too,
-- not only the website. Decided 2026-11-12 (Sarthak): the app sends the picture it takes while a host has Preview
-- Guest Theme open (todo #29) to the backend, and the website shows it next to the website frames.
-- * events.guest_preview_picture: {"url", "templateId", "takenAt", "width", "height"}, or null before the first
--   picture. Written only by the backend (POST /api/media/guest-preview-picture, service role) after it checks that
--   the caller manages the event (owner, guest admins, platform admins). The JPEG is in the media bucket under
--   events/<event id>/guest-preview/; each save replaces the previous file. Read by the website and the app
--   (shared/themes/guestPreviewPicture.ts).
-- Nothing existing changes: the column starts empty for every event, and older app builds never send a picture.
-- Rollback:
--   alter table public.events drop column guest_preview_picture;

begin;

alter table public.events add column if not exists guest_preview_picture jsonb;

alter table public.events drop constraint if exists events_guest_preview_picture_check;
alter table public.events
  add constraint events_guest_preview_picture_check
  check (guest_preview_picture is null
         or (jsonb_typeof(guest_preview_picture) = 'object' and octet_length(guest_preview_picture::text) <= 2048));

comment on column public.events.guest_preview_picture is
  'Picture of the app''s guest home for the Design tab''s Guest Home Preview: {url, templateId, takenAt, width, height}. Written by the backend.';

commit;
