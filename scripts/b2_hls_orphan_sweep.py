"""
Issue #76: finds video streaming copies in B2 (hls/<storage_key>/...) whose video no longer exists in the
photos table, and with --delete removes every version of their files. Without --delete it only lists them.
Folders with any file changed in the last 2 days are left alone, so a video still being processed is safe.

  modal_engine/venv/bin/python scripts/b2_hls_orphan_sweep.py            # list only
  modal_engine/venv/bin/python scripts/b2_hls_orphan_sweep.py --delete   # delete them

Reads B2_* and the Supabase service key from the root .env (~/EveBash/.env). Prints no secrets.
"""
import collections
import datetime as dt
import json
import os
import re
import sys
import urllib.parse
import urllib.request

import boto3

env = {}
for line in open(os.path.expanduser("~/EveBash/.env")):
    if "=" in line and not line.lstrip().startswith("#"):
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")

endpoint = env["B2_ENDPOINT"] if env["B2_ENDPOINT"].startswith("http") else "https://" + env["B2_ENDPOINT"]
s3 = boto3.client("s3", endpoint_url=endpoint, aws_access_key_id=env["B2_KEY_ID"],
                  aws_secret_access_key=env["B2_APPLICATION_KEY"], region_name=env.get("B2_REGION"))
bucket = env["B2_BUCKET_NAME"]
keep_after = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=2)


def folder_of(key: str) -> str:
    """hls/<storage_key>/master.m3u8, poster.jpg, <quality>p/<file> or audio/<file> -> <storage_key>"""
    parts = key[len("hls/"):].split("/")[:-1]
    if parts and (re.fullmatch(r"\d{3,4}p", parts[-1]) or parts[-1] == "audio"):
        parts = parts[:-1]
    return "/".join(parts)


folders = collections.defaultdict(lambda: {"files": 0, "bytes": 0, "newest": None})
for page in s3.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix="hls/"):
    for obj in page.get("Contents", []):
        f = folders[folder_of(obj["Key"])]
        f["files"] += 1
        f["bytes"] += obj["Size"]
        f["newest"] = max(f["newest"] or obj["LastModified"], obj["LastModified"])

# Every storage key in photos (photos and videos alike), paged: the REST API returns at most 1,000 rows
url, key = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/"), env["SUPABASE_SERVICE_ROLE_KEY"]
live, offset = set(), 0
while True:
    query = urllib.parse.urlencode({"select": "storage_key", "order": "id", "limit": "1000", "offset": str(offset)})
    page = json.load(urllib.request.urlopen(urllib.request.Request(
        f"{url}/rest/v1/photos?{query}", headers={"apikey": key, "Authorization": f"Bearer {key}"}), timeout=60))
    live.update(row["storage_key"] for row in page if row.get("storage_key"))
    offset += 1000
    if len(page) < 1000:
        break



def belongs_to_live_video(name: str) -> bool:
    """Safety net: anything inside an existing video's folder is kept, whatever its sub-folder is called."""
    return name in live or any(name.startswith(k + "/") for k in live)


orphans = {name: f for name, f in folders.items()
           if name and not belongs_to_live_video(name) and f["newest"] < keep_after}
recent = sum(1 for name, f in folders.items() if not belongs_to_live_video(name) and f["newest"] >= keep_after)
print(f"Streaming folders: {len(folders)} ({sum(f['bytes'] for f in folders.values()) / 1e9:.2f} GB); "
      f"photos and videos in the database: {len(live)}")
print(f"No longer in the database: {len(orphans)} folders, {sum(f['files'] for f in orphans.values())} files, "
      f"{sum(f['bytes'] for f in orphans.values()) / 1e9:.2f} GB"
      + (f" (+{recent} changed in the last 2 days, left alone)" if recent else ""))
for name in sorted(orphans)[:10]:
    print(f"  {name[:110]}  {orphans[name]['bytes'] / 1e6:.0f} MB")

if "--delete" not in sys.argv:
    print("\nList only. Run with --delete to remove them.")
    sys.exit(0)

deleted = 0
for name in sorted(orphans):
    prefix = f"hls/{name}/"
    if belongs_to_live_video(name):
        continue
    batch = []
    for page in s3.get_paginator("list_object_versions").paginate(Bucket=bucket, Prefix=prefix):
        for v in page.get("Versions", []) + page.get("DeleteMarkers", []):
            if v["Key"].startswith(prefix):
                batch.append({"Key": v["Key"], "VersionId": v["VersionId"]})
    for i in range(0, len(batch), 1000):
        result = s3.delete_objects(Bucket=bucket, Delete={"Objects": batch[i:i + 1000], "Quiet": True})
        errors = result.get("Errors", [])
        if errors:
            print(f"  {len(errors)} files could not be deleted under {prefix[:80]}: {errors[0].get('Code')}")
        deleted += len(batch[i:i + 1000]) - len(errors)
print(f"\nDeleted {deleted} file versions from {len(orphans)} folders.")
