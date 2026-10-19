-- Undo part 1 (supabase/migrations/20261007000000_rls_part1_gallery_link_functions.sql). One transaction.
--
-- Only for part 1 on its own. Once part 2 is applied, use rls-lockdown-rollback.sql instead (it also removes these).
-- Ship the app rollback first: the gallery pages call open_gallery and get_public_gallery_media.
--
-- Kept on purpose: guests.user_id (would lose memberships made through the new functions) and
-- deleted_events_archive.event_created_at (the apps already send it). Both are nullable and unused by old code.

begin;

drop function if exists public.open_gallery(text);
drop function if exists public.get_public_gallery_media(text, int, int);
drop function if exists public.request_gallery_access(text);
drop function if exists public.archive_deleted_event(text, int, int, bigint, text, timestamptz);
drop function if exists public.is_phone_allowed(text);
drop view if exists public.profile_cards;
drop index if exists public.guests_user_event_key;
drop schema if exists eb_private cascade;

commit;
