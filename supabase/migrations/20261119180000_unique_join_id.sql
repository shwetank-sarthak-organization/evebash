-- Issue #278: two events must never share a join code (the "Join ID" guests type in Join Event).
-- open_gallery (20261007000000_rls_part1_gallery_link_functions.sql) looks a code up with e.join_id = p_ref, so with
-- two matches a guest could open the wrong gallery. On live one pair already shared "REC-2-" (two sub-galleries of
-- wedding-fdd8, checked 2026-11-19); staging had none. All saved codes are capitals with no spaces (checked), so a
-- plain unique index on join_id is enough.
--
-- 1. Where a code is shared, a main event keeps it before a sub-gallery (its code is the one on cards and links), then
--    the event with the most photos, then the lower id; every other one gets a new
--    random code in the same form the website and app make (shared/text/joinCode.ts: 8 characters from
--    ABCDEFGHJKMNPQRSTUVWXYZ23456789, shown as XXXX-XXXX).
-- 2. A unique index on join_id (empty codes are left out). New codes are random 8-character codes (#277), so a clash
--    when saving is about 1 in 10^10 per new event; if one ever happens the save fails and the host tries again.
-- Safe to run more than once.

do $$
declare
  r record;
  new_code text;
begin
  for r in
    select x.id
      from (
        select e.id,
               row_number() over (
                 partition by e.join_id
                 order by (e.parent_id is null) desc,
                          (select count(*) from public.photos p where p.event_id = e.id) desc,
                          e.id
               ) as rn
          from public.events e
         where e.join_id is not null and e.join_id <> ''
      ) x
     where x.rn > 1
  loop
    loop
      select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
        into new_code
        from generate_series(1, 8);
      new_code := substr(new_code, 1, 4) || '-' || substr(new_code, 5, 4);
      exit when not exists (select 1 from public.events where join_id = new_code);
    end loop;
    raise notice 'Event % gets the new join code %', r.id, new_code;
    update public.events set join_id = new_code where id = r.id;
  end loop;
end
$$;

create unique index if not exists events_join_id_unique
  on public.events (join_id)
  where join_id is not null and join_id <> '';
