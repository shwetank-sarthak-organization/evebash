-- Defense in depth for clients that write photos metadata directly via Supabase.
-- Service-role processing remains protected by the backend upload checks.
begin;
create or replace function public.can_post_event_video(p_event_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  with event_scope as (
    select e.id, e.created_by from public.events e
    where e.id::text = p_event_id or e.id in (select parent_id from public.events where id::text = p_event_id)
  ), caller as (
    select id, case when email_confirmed_at is not null then lower(email) end as email,
      case when phone_confirmed_at is not null then phone end as phone
    from auth.users where id = auth.uid()
  )
  select auth.uid() is not null and (
    exists(select 1 from event_scope where created_by::text = auth.uid()::text)
    or (not exists(select 1 from event_scope) and p_event_id like 'business-%' and exists(
      select 1 from public.businesses b, caller c where b.id::text = substring(p_event_id from 10)
      and (b.created_by::text = c.id::text or coalesce(to_jsonb(b.admins), '[]'::jsonb) ? c.id::text
        or coalesce(to_jsonb(b.allowed_users), '[]'::jsonb) ? c.id::text or b.owner_email = c.email)))
    or exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_type = 'primary' and p.delegated_by::text in (select created_by::text from event_scope))
    or exists(select 1 from public.profiles p join public.profile_assigned_events a on a.profile_id = p.id where p.id = auth.uid() and p.role_type = 'event' and a.event_id::text in (select id::text from event_scope))
    or exists(select 1 from public.guests g, caller c where g.status = 'approved' and g.can_admin = true
      and (g.event_id::text in (select id::text from event_scope) or g.parent_event_id::text in (select id::text from event_scope))
      and (g.email in (c.id::text, c.email, c.phone) or g.phone in (c.id::text, c.email, c.phone)))
  );
$$;
revoke all on function public.can_post_event_video(text) from public;
grant execute on function public.can_post_event_video(text) to authenticated, anon;
create policy event_video_insert_requires_admin on public.photos as restrictive for insert to authenticated, anon with check (
  not (coalesce(media_type, '') = 'video' or coalesce(resource_type, '') = 'video'
    or coalesce(storage_key, '') like '%/videos/%'
    or coalesce(storage_key, '') ~* '\.(mp4|mov|m4v|webm|avi|mkv|3gp|mpeg|mpg|m3u8|flv|wmv|mts|m2ts|ts|ogv)$')
  or public.can_post_event_video(event_id::text)
);
create policy event_video_update_requires_admin on public.photos as restrictive for update to authenticated, anon with check (
  not (coalesce(media_type, '') = 'video' or coalesce(resource_type, '') = 'video'
    or coalesce(storage_key, '') like '%/videos/%'
    or coalesce(storage_key, '') ~* '\.(mp4|mov|m4v|webm|avi|mkv|3gp|mpeg|mpg|m3u8|flv|wmv|mts|m2ts|ts|ogv)$')
  or public.can_post_event_video(event_id::text)
);
commit;
