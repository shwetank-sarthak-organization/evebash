-- Gallery video: the host picks one of a gallery's own videos (usually the photographer's 4-5 minute summary film of
-- the event, or of one album such as Haldi) to show at the top of that gallery's guest page. Website host page:
-- Video actions > "Use as gallery video". Themes show it when one is set (Royal Emerald first).
-- * events.gallery_video_id: the chosen video (photos.id); null = no gallery video. Each gallery and album has its own.
--   Deleting the video clears it automatically (on delete set null).
-- * get_gallery_video(p_event_id): what a guest page needs to play it, for anyone who may view that gallery
--   (its managers, approved members, and everyone on public or sample galleries). It returns nothing when the video
--   is no longer in that gallery (moved elsewhere), is hidden from guests, isn't processed yet, is outside an expired
--   plan's allowance, or the album is hidden from guests (managers still get it), so the page just shows no video.
--   Like get_public_gallery_media it returns the HLS stream, never the uploaded original.
-- Nothing existing changes: no other column, function or policy is touched, and the app ignores the new column.
-- Rollback: drop function public.get_gallery_video(text); alter table public.events drop column gallery_video_id;

begin;

alter table public.events
  add column if not exists gallery_video_id text references public.photos(id) on delete set null;
comment on column public.events.gallery_video_id is
  'Video (photos.id) shown at the top of this gallery''s guest page; chosen by the host; null = none.';

create or replace function public.get_gallery_video(p_event_id text)
returns table (id text, stream_url text, poster_url text, width int, height int, duration numeric)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_event public.events%rowtype;
  v_root public.events%rowtype;
  v_plan jsonb;
begin
  select * into v_event from public.events e where e.id = p_event_id;
  if v_event.id is null or v_event.gallery_video_id is null then return; end if;
  select * into v_root from public.events r where r.id = coalesce(v_event.parent_id, v_event.id);

  if not eb_private.can_manage_event(p_event_id) then
    -- An album the host hid from guests is for the event's managers only
    if v_event.parent_id is not null and coalesce(v_event.is_hidden, false) then return; end if;
    if not (coalesce(v_root.is_public, false) or coalesce(v_root.is_sample_gallery, false)
            or p_event_id in (select eb_private.viewable_event_ids())) then
      return;
    end if;
  end if;

  v_plan := eb_private.media_plan_limit(p_event_id);
  return query
  select p.id, p.url, coalesce(p.thumbnail_url, p.preview_url), p.width, p.height, p.duration
    from public.photos p
   where p.id = v_event.gallery_video_id
     -- Only the gallery's own videos (older uploads may carry the gallery's legacy id)
     and p.event_id in (v_event.id, v_event.legacy_id)
     and p.media_type = 'video'
     and p.status = 'processed'
     and not coalesce(p.is_hidden, false)
     and not coalesce(p.tags @> array['__cover_usage__']::text[], false)
     -- Expired paid plan: only a video kept within the free allowance
     and ((v_plan ->> 'state') is distinct from 'expired'
          or p.id in (select jsonb_array_elements_text(v_plan -> 'retained_ids')));
end $$;

revoke execute on function public.get_gallery_video(text) from public, anon, authenticated;
grant execute on function public.get_gallery_video(text) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
