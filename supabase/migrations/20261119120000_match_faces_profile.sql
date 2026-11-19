-- Issue #111: a smarter Find You search, used only while the Modal switch is on (photo-pipeline-switch,
-- key "find_you_profile"); match_faces stays as it is.
--
-- Today a selfie only finds faces that look like that one selfie (score >= 0.40), so a person whose look changes
-- between events (haldi, turban, reception, side views) misses many photos. This also builds a "profile": the selfie
-- plus the average of the faces that match it strongly (>= 0.55), and searches again with it; with 2 rounds the
-- profile is rebuilt once more from what the first profile matches strongly. A photo is a match when the selfie
-- scores >= p_threshold OR any profile scores >= p_profile_threshold. Everything today's search finds is kept.
-- Offline test on a 3,048-photo wedding (2026-11-19): groom 421 -> ~1,350 photos, the groom's brother 252 -> 345,
-- 0 wrong in 100 photos judged by eye.
-- Same output as match_faces ('compared', 'matches' with image_id, image_url, width, height, sim = the selfie's own
-- score), plus 'profile_sim' per match and 'rounds_used'.

create or replace function public.match_faces_profile(
  p_event_ids text[],
  p_embedding float8[],
  p_threshold float8 default 0.40,
  p_profile_threshold float8 default 0.45,
  p_strong float8 default 0.55,
  p_rounds integer default 2
)
returns jsonb
language plpgsql stable
set search_path = ''
as $$
declare
  probe public.halfvec(512) := p_embedding::public.vector(512)::public.halfvec(512);
  prof1 public.halfvec(512);
  prof2 public.halfvec(512);
  m public.halfvec(512);
  used integer := 0;
begin
  if coalesce(p_rounds, 0) >= 1 then
    select public.avg(f.descriptor) into m
      from public.faces f
     where f.event_id = any(p_event_ids)
       and -(f.descriptor operator(public.<#>) probe) >= p_strong;
    if m is not null then
      prof1 := public.l2_normalize(probe operator(public.+) public.l2_normalize(m));
      used := 1;
    end if;
  end if;

  if coalesce(p_rounds, 0) >= 2 and prof1 is not null then
    select public.avg(f.descriptor) into m
      from public.faces f
     where f.event_id = any(p_event_ids)
       and -(f.descriptor operator(public.<#>) prof1) >= p_strong;
    if m is not null then
      prof2 := public.l2_normalize(probe operator(public.+) public.l2_normalize(m));
      used := 2;
    end if;
  end if;

  return (
    with scored as (
      select f.image_id, f.image_url, f.width, f.height,
             -(f.descriptor operator(public.<#>) probe) as sim,
             greatest(
               case when prof1 is null then -1 else -(f.descriptor operator(public.<#>) prof1) end,
               case when prof2 is null then -1 else -(f.descriptor operator(public.<#>) prof2) end
             ) as profile_sim
        from public.faces f
       where f.event_id = any(p_event_ids)
    ),
    best as (
      select distinct on (image_id) image_id, image_url, width, height, sim, profile_sim
        from scored
       where sim >= p_threshold or profile_sim >= p_profile_threshold
       order by image_id, greatest(sim, profile_sim) desc
    )
    select jsonb_build_object(
      'compared', (select count(*) from scored),
      'rounds_used', used,
      'matches', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'image_id', image_id, 'image_url', image_url, 'width', width, 'height', height,
                 'sim', sim, 'profile_sim', profile_sim)
               order by sim desc)
          from best), '[]'::jsonb)
    )
  );
end
$$;

revoke all on function public.match_faces_profile(text[], float8[], float8, float8, float8, integer) from public, anon, authenticated;
grant execute on function public.match_faces_profile(text[], float8[], float8, float8, float8, integer) to service_role;
