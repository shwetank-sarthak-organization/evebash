"""
Issue #136: finds file versions in B2 that are still billed but never served:
  hidden   every version of a file whose newest entry is a delete/hide marker (the file looks deleted)
  older    the older versions of a file that is still there (only the newest one is ever served)
Both come from deletes and rewrites that removed or replaced only the newest version (#134, #136). Removing them
never changes what anyone sees: the newest version of every visible file is always kept.

  modal_engine/venv/bin/python scripts/b2_old_versions_sweep.py                       # list only, whole bucket
  modal_engine/venv/bin/python scripts/b2_old_versions_sweep.py --delete events/ hls/  # delete, only these prefixes

Files changed in the last 2 days are left alone (something may still be writing them). Reads B2_* from the root .env
(~/EveBash/.env). Prints no secrets. Delete only with Sarthak's OK.
"""
import collections
import datetime as dt
import os
import sys

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
delete_prefixes = sys.argv[sys.argv.index("--delete") + 1:] if "--delete" in sys.argv else None
if delete_prefixes is not None and not delete_prefixes:
    sys.exit("--delete needs the prefixes to clean, e.g. --delete events/ hls/")

# Every version and delete marker in the bucket, grouped by file name (newest first per name)
entries = collections.defaultdict(list)
for page in s3.get_paginator("list_object_versions").paginate(Bucket=bucket):
    for v in page.get("Versions", []):
        entries[v["Key"]].append({"id": v["VersionId"], "size": v["Size"], "time": v["LastModified"], "latest": v["IsLatest"], "marker": False})
    for m in page.get("DeleteMarkers", []):
        entries[m["Key"]].append({"id": m["VersionId"], "size": 0, "time": m["LastModified"], "latest": m["IsLatest"], "marker": True})

stats = collections.defaultdict(lambda: {"hidden_files": 0, "hidden_versions": 0, "hidden_bytes": 0,
                                         "older_files": 0, "older_versions": 0, "older_bytes": 0, "recent_skipped": 0})
to_delete = []
examples = collections.defaultdict(list)
live_files = live_bytes = 0
for key, versions in entries.items():
    top = key.split("/", 1)[0] + "/"
    newest = max(versions, key=lambda v: v["time"])
    if not newest["marker"]:
        live_files += 1
        live_bytes += newest["size"]
    if max(v["time"] for v in versions) >= keep_after:
        if len(versions) > 1 or newest["marker"]:
            stats[top]["recent_skipped"] += 1
        continue
    if newest["marker"]:
        # Looks deleted: every real version is billed for nothing
        real = [v for v in versions if not v["marker"]]
        if not real:
            continue
        s = stats[top]
        s["hidden_files"] += 1
        s["hidden_versions"] += len(real)
        s["hidden_bytes"] += sum(v["size"] for v in real)
        if len(examples[top + " hidden"]) < 3:
            examples[top + " hidden"].append(key)
        doomed = versions  # the versions and the marker(s)
    else:
        older = [v for v in versions if v is not newest]
        if not older:
            continue
        s = stats[top]
        s["older_files"] += 1
        s["older_versions"] += len(older)
        s["older_bytes"] += sum(v["size"] for v in older)
        if len(examples[top + " older"]) < 3:
            examples[top + " older"].append(key)
        doomed = older  # never the newest version of a visible file
    if delete_prefixes is not None and any(key.startswith(p) for p in delete_prefixes):
        to_delete += [{"Key": key, "VersionId": v["id"]} for v in doomed]

gb = lambda b: b / 1e9
print(f"Bucket {bucket}: {len(entries)} file names, {live_files} visible files ({gb(live_bytes):.2f} GB)")
print(f"{'prefix':16} {'hidden files':>13} {'versions':>9} {'GB':>7}   {'files w/ older':>14} {'versions':>9} {'GB':>7}   {'skipped (<2 d)':>14}")
total = 0
for top, s in sorted(stats.items(), key=lambda kv: -(kv[1]["hidden_bytes"] + kv[1]["older_bytes"])):
    if not any(s.values()):
        continue
    total += s["hidden_bytes"] + s["older_bytes"]
    print(f"{top:16} {s['hidden_files']:>13} {s['hidden_versions']:>9} {gb(s['hidden_bytes']):>7.2f}   "
          f"{s['older_files']:>14} {s['older_versions']:>9} {gb(s['older_bytes']):>7.2f}   {s['recent_skipped']:>14}")
print(f"Total billed for nothing: {gb(total):.2f} GB (~${gb(total) * 0.006:.2f}/month at B2's $6/TB)")
for name, keys in sorted(examples.items()):
    print(f"  e.g. {name}: " + ", ".join(k[-70:] for k in keys))

if delete_prefixes is None:
    print("\nList only. To remove them (with Sarthak's OK): --delete <prefix> [<prefix> ...]")
    sys.exit(0)

deleted = failed = 0
for i in range(0, len(to_delete), 1000):
    result = s3.delete_objects(Bucket=bucket, Delete={"Objects": to_delete[i:i + 1000], "Quiet": True})
    errors = result.get("Errors", [])
    failed += len(errors)
    deleted += len(to_delete[i:i + 1000]) - len(errors)
    if errors:
        print(f"  {len(errors)} could not be deleted, e.g. {errors[0].get('Key', '')[-60:]}: {errors[0].get('Code')}")
print(f"\nDeleted {deleted} file versions/markers under {', '.join(delete_prefixes)} ({failed} failed).")
