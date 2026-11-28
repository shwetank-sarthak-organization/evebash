-- Todo #40: switch Realtime (live updates) on for the v1 launch: photos, likes, comments and guests (access
-- requests). Applied on STAGING on 2026-11-28, one table at a time; after each, a signed-in test account received
-- rows only where the table's row-level security lets it read them (its own galleries, its own request, guests of
-- its own event) and nothing from a gallery it has no access to.
--
-- Deletions are never sent: Realtime does not apply row-level security to DELETE events, and our row ids contain the
-- event id, the uploader's user id and the file name, so every listener would get them. Screens reload instead.
--
-- Switch to turn it off fast (no deploy needed; old app builds stop too):
--   alter publication supabase_realtime drop table public.photos, public.likes, public.comments, public.guests;
begin;

alter publication supabase_realtime set (publish = 'insert, update');

do $$
declare
  t text;
begin
  foreach t in array array['photos', 'likes', 'comments', 'guests'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

commit;
