-- Issue #61: every profile gets a username.
-- The website picks one at sign-up (createUserProfile in src/lib/database.ts), but the app creates the profile
-- without one (apps/mobile/context/AuthContext.tsx), so app sign-ups showed "Username: not set". This fills it in the
-- database, for every sign-up path (including app builds already in the stores), with the same rules the website and
-- app check in Profile > Edit: 3-12 characters, a-z 0-9 . _, starting and ending with a letter or number, no two
-- dots/underscores in a row. It starts from the email's name part (as the website does), adds a number if taken.
-- An existing username is never changed. Safe to run more than once.

create or replace function eb_private.default_username(p_email text, p_name text, p_id text)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  base text;
  candidate text;
  n integer := 1;
  suffix text;
begin
  base := lower(coalesce(nullif(split_part(coalesce(p_email, ''), '@', 1), ''), p_name, ''));
  base := regexp_replace(base, '[^a-z0-9_.]', '_', 'g');
  base := regexp_replace(base, '[._]{2,}', '_', 'g');
  base := regexp_replace(base, '^[._]+|[._]+$', '', 'g');
  if length(base) < 3 then
    base := case when base = '' then 'user' else 'user_' || base end;
  end if;
  base := regexp_replace(left(base, 12), '[._]+$', '');
  if length(base) < 3 then
    base := rpad(base, 3, '0');
  end if;

  candidate := base;
  while exists (select 1 from public.profiles p where p.username = candidate and p.id is distinct from p_id) loop
    n := n + 1;
    if n <= 999 then
      suffix := n::text;
    else
      suffix := (1000 + floor(random() * 9000))::int::text;
    end if;
    candidate := regexp_replace(left(base, 12 - length(suffix)), '[._]+$', '') || suffix;
    exit when n > 1100;
  end loop;
  return candidate;
end
$$;

revoke all on function eb_private.default_username(text, text, text) from public, anon, authenticated;

create or replace function eb_private.fill_profile_username()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if coalesce(trim(new.username), '') <> '' then
    return new;
  end if;
  -- A save that leaves the username out keeps the one already stored
  if tg_op = 'UPDATE' and coalesce(trim(old.username), '') <> '' then
    new.username := old.username;
    return new;
  end if;
  new.username := eb_private.default_username(new.email, new.name, new.id);
  return new;
end
$$;

revoke all on function eb_private.fill_profile_username() from public, anon, authenticated;

drop trigger if exists eb_set_profile_username on public.profiles;
create trigger eb_set_profile_username
  before insert or update on public.profiles
  for each row execute function eb_private.fill_profile_username();

-- Profiles that have none yet get one now (the trigger picks it)
update public.profiles set username = null where coalesce(trim(username), '') = '';
