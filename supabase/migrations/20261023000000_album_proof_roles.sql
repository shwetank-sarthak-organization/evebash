-- Album proofing roles (2026-10-23). Each album has one photographer and one or more clients, picked from
-- the event's host and approved guest admins (the backend checks that). The photographer uploads pages and sends
-- rounds; the client comments, approves and sends feedback; other managers only view. Albums made before this
-- have no roles until someone assigns them.
begin;

-- An early draft of this migration named the clients "couple_ids"; nothing uses it, so drop it if it was applied
alter table public.album_proofs drop constraint if exists album_proofs_roles_distinct;
alter table public.album_proofs drop column if exists couple_ids;

alter table public.album_proofs
  add column if not exists photographer_id text,
  add column if not exists client_ids text[] not null default '{}';

alter table public.album_proofs add constraint album_proofs_roles_distinct
  check (photographer_id is null or not (photographer_id = any(client_ids)));

notify pgrst, 'reload schema';
commit;
