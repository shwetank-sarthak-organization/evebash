"""
Dry run for supabase/migrations/20261022010000_faces_halfvec.sql (issue #100) on the live database, inside one
transaction that always rolls back (it ends by raising DRYRUN_RESULTS, so nothing is kept). Prints the results.
The faces table is locked for the few seconds the dry run takes, so face saves and Find You wait that long.

  python3 docs/database/faces-halfvec-dryrun.py

Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_MGMT_KEY in the root .env. Prints no secrets.
"""
import json
import os
import re
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
env = {}
for line in open(os.path.join(os.path.expanduser("~/EveBash"), ".env")):
    if "=" in line and not line.lstrip().startswith("#"):
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
ref = env["NEXT_PUBLIC_SUPABASE_URL"].split("//")[1].split(".")[0]
migration = open(os.path.join(ROOT, "supabase/migrations/20261022010000_faces_halfvec.sql")).read()

sql = f"""
-- 20 real faces as selfies, and their Find You results before the change
create temp table dr_probes as
  select id, event_id, descriptor from public.faces order by md5(id::text) limit 20;
create temp table dr_before as
  select p.id, public.match_faces(array[p.event_id], p.descriptor, 0.40) as r from dr_probes p;

-- One photo with faces, to save its faces again through replace_photo_faces afterwards
create temp table dr_photo as
  select f.image_id, count(*) as n,
         jsonb_agg(jsonb_build_object('event_id', f.event_id, 'image_url', f.image_url, 'width', f.width,
                                      'height', f.height, 'descriptor', to_jsonb(f.descriptor))) as faces
    from public.faces f
   where f.image_id = (select image_id from public.faces order by md5(id::text) limit 1)
   group by f.image_id;

{migration}

create temp table dr_after as
  select p.id, public.match_faces(array[p.event_id], p.descriptor, 0.40) as r from dr_probes p;

update public.photos set face_processing_token = 'dryrun-100'
 where id = (select image_id from dr_photo);

do $$
declare
  v_saved boolean;
  v_rest public.halfvec(512);
  v_results jsonb;
begin
  select public.replace_photo_faces(d.image_id, 'dryrun-100', p.asset_version, d.faces) into v_saved
    from dr_photo d join public.photos p on p.id = d.image_id;

  -- What PostgREST does with an insert body (website saveFace, backend findYou.ts)
  select descriptor into v_rest
    from json_populate_record(null::public.faces,
           json_build_object('descriptor', (select array_agg(0.04419417::float8) from generate_series(1, 512))));

  select jsonb_build_object(
    'column_type', (select format_type(atttypid, atttypmod) from pg_attribute
                     where attrelid = 'public.faces'::regclass and attname = 'descriptor'),
    'faces_rows', (select count(*) from public.faces),
    'avg_bytes_per_face', (select round(avg(pg_column_size(descriptor))) from public.faces),
    'searches', (select count(*) from dr_before),
    'searches_same_photos', (select count(*) from dr_before b join dr_after a using (id)
        where (select coalesce(array_agg(x->>'image_id' order by x->>'image_id'), '{{}}') from jsonb_array_elements(b.r->'matches') x)
            = (select coalesce(array_agg(x->>'image_id' order by x->>'image_id'), '{{}}') from jsonb_array_elements(a.r->'matches') x)),
    'searches_same_compared', (select count(*) from dr_before b join dr_after a using (id)
        where (b.r->>'compared') = (a.r->>'compared')),
    'matches_before', (select sum(jsonb_array_length(r->'matches')) from dr_before),
    'matches_after', (select sum(jsonb_array_length(r->'matches')) from dr_after),
    'max_score_change', (select max(abs((x->>'sim')::float8 - (y->>'sim')::float8))
        from dr_before b join dr_after a using (id),
             jsonb_array_elements(b.r->'matches') x, jsonb_array_elements(a.r->'matches') y
        where x->>'image_id' = y->>'image_id'),
    'replace_photo_faces_returned', v_saved,
    'replace_photo_faces_rows', (select count(*) from public.faces where image_id = (select image_id from dr_photo)),
    'replace_photo_faces_expected', (select n from dr_photo),
    'rest_insert_dims', public.vector_dims(v_rest)
  ) into v_results;
  raise exception 'DRYRUN_RESULTS %', v_results;
end $$;
"""

req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{ref}/database/query", method="POST",
                             data=json.dumps({"query": sql}).encode(),
                             headers={"Authorization": "Bearer " + env["SUPABASE_MGMT_KEY"],
                                      "Content-Type": "application/json", "User-Agent": "Mozilla/5.0"})
try:
    urllib.request.urlopen(req, timeout=300)
    print("UNEXPECTED: the dry run did not end with DRYRUN_RESULTS; check the database")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    m = re.search(r"DRYRUN_RESULTS (\{.*?\})(?:\\n|\"|$)", body)
    if m:
        print("Rolled back. Results:")
        print(json.dumps(json.loads(m.group(1).replace('\\"', '"')), indent=1))
    else:
        print("Dry run failed (rolled back):", body[:3000])
