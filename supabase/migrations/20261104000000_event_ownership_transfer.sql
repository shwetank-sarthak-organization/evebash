-- Event ownership transfer (todo #24): the owner offers an event to another EveBash user, who accepts or declines.
-- * event_transfers: the requests. Backend only (service role): no client reads or writes it directly.
-- * event_transfer_size_bytes: what the whole event counts on its owner's storage. Same parts as
--   vault_event_storage_bytes (photos and videos with their previews and streams, album designs, voice notes).
-- * complete_event_transfer: moves the event in one transaction: the owner of the event and its sub-galleries, the
--   owner recorded on guest rows, the new owner's old guest rows (an owner isn't a guest), and optionally keeps the
--   old owner as an approved admin. Storage follows the owner (vault_event_storage_bytes), so the space moves too.
-- The backend checks the new owner's space, plan and event slots before calling it.
-- Rollback: drop function public.complete_event_transfer(uuid, text); drop function
-- public.event_transfer_size_bytes(text); drop table public.event_transfers.

begin;

create table if not exists public.event_transfers (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events(id) on delete cascade,
  from_user_id text not null,      -- the owner when the request was made
  requested_by text not null,      -- who pressed the button (the owner, or a platform admin helping)
  to_user_id text not null,
  keep_old_owner_as_admin boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  decided_at timestamptz
);
comment on table public.event_transfers is 'Requests to hand an event to another user. Uploads to the event pause while one is pending.';

-- At most one open request per event, and quick lookups for "requests waiting for me"
create unique index if not exists event_transfers_one_pending on public.event_transfers (event_id) where status = 'pending';
create index if not exists event_transfers_to_user_pending on public.event_transfers (to_user_id) where status = 'pending';

alter table public.event_transfers enable row level security;
revoke all on public.event_transfers from public, anon, authenticated;
grant all on public.event_transfers to service_role;

create or replace function public.event_transfer_size_bytes(p_event_id text)
returns bigint
language sql
stable
set search_path = ''
as $$
  with family as (
    select r.id
      from public.events r
     where r.id = p_event_id
    union
    select s.id
      from public.events s
      join public.events r on r.id = p_event_id and (s.parent_id = r.id or (r.legacy_id is not null and s.parent_id = r.legacy_id))
  )
  select ((
    select coalesce(sum(coalesce(p.size, 0) + coalesce(p.overhead_size, 0)), 0)
      from public.photos p
     where p.event_id in (select id from family)
  ) + (
    select coalesce(sum(coalesce(v.bytes, 0)), 0)
      from public.album_proof_page_versions v
      join public.album_proof_pages pg on pg.id = v.page_id
      join public.album_proofs a on a.id = pg.album_id
     where a.event_id in (select id from family)
  ) + (
    select coalesce(sum(coalesce(c.voice_bytes, 0)), 0)
      from public.album_proof_comments c
      join public.album_proof_pages pg on pg.id = c.page_id
      join public.album_proofs a on a.id = pg.album_id
     where a.event_id in (select id from family)
  ))::bigint;
$$;

create or replace function public.complete_event_transfer(p_transfer_id uuid, p_to_user_id text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_transfer public.event_transfers%rowtype;
  v_root public.events%rowtype;
  v_family text[];
begin
  select * into v_transfer from public.event_transfers where id = p_transfer_id for update;
  if not found then raise exception 'Transfer not found' using errcode = 'P0002'; end if;
  if v_transfer.status <> 'pending' then raise exception 'Transfer is no longer open' using errcode = 'P0001'; end if;
  if v_transfer.expires_at <= now() then raise exception 'Transfer has expired' using errcode = 'P0001'; end if;
  if v_transfer.to_user_id is distinct from p_to_user_id then raise exception 'Transfer is for someone else' using errcode = '42501'; end if;

  select * into v_root from public.events where id = v_transfer.event_id for update;
  if not found then raise exception 'Event not found' using errcode = 'P0002'; end if;

  select array_agg(e.id) into v_family
    from public.events e
   where e.id = v_root.id or e.parent_id = v_root.id or (v_root.legacy_id is not null and e.parent_id = v_root.legacy_id);

  update public.events set created_by = p_to_user_id where id = any(v_family);

  -- An owner isn't a guest of their own event
  delete from public.guests where user_id = p_to_user_id and event_id = any(v_family);

  update public.guests set parent_event_owner_id = p_to_user_id where event_id = any(v_family);

  if v_transfer.keep_old_owner_as_admin then
    insert into public.guests (id, name, phone, event_id, parent_event_owner_id, event_title, status, user_id, login_at,
                               can_upload, can_comment, can_admin)
    values ('u_' || v_transfer.from_user_id || '_' || v_root.id,
            coalesce((select p.name from public.profiles p where p.id = v_transfer.from_user_id), 'Guest'),
            coalesce((select p.phone from public.profiles p where p.id = v_transfer.from_user_id), ''),
            v_root.id, p_to_user_id, v_root.title, 'approved', v_transfer.from_user_id, now(), true, true, true)
    on conflict (id) do update
      set status = 'approved', can_upload = true, can_comment = true, can_admin = true,
          parent_event_owner_id = excluded.parent_event_owner_id;
  end if;

  update public.event_transfers set status = 'accepted', decided_at = now() where id = p_transfer_id;
  return v_root.id;
end $$;

revoke all on function public.event_transfer_size_bytes(text) from public, anon, authenticated;
grant execute on function public.event_transfer_size_bytes(text) to service_role;
revoke all on function public.complete_event_transfer(uuid, text) from public, anon, authenticated;
grant execute on function public.complete_event_transfer(uuid, text) to service_role;

notify pgrst, 'reload schema';
commit;
