-- Gallery storage is paid by the gallery's owner (issue #6, decided 2026-10-10).
-- vault_event_storage_bytes used to add up media by uploader (photos.user_id), so a guest uploading to someone's
-- gallery used up the guest's own plan. It now adds up every photo and video in galleries the owner owns,
-- whoever uploaded them; a sub-gallery counts towards its main gallery's owner. The plan-expiry functions
-- (vault_retained_item_ids, eb_private.media_plan_limit) already count by gallery owner.
-- Same signature and grants (service_role only); the backend's shared storage pool (events + EB Vault) uses it.

create or replace function public.vault_event_storage_bytes(p_identifiers text[])
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(coalesce(p.size, 0) + coalesce(p.overhead_size, 0)), 0)::bigint
    from public.photos p
    join public.events e on e.id = p.event_id
    left join public.events root on root.id = e.parent_id
   where coalesce(root.created_by, e.created_by) = any(p_identifiers);
$$;
