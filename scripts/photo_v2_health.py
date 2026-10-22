"""
Photo pipeline v2 health check (issue #77). Read-only: prints, per UTC day, how photos were processed,
failures, speed, the real Modal bill and QStash usage. Prints no secrets.

  python3 scripts/photo_v2_health.py [first UTC day, default 3 days ago]

Uses NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / QSTASH_TOKEN from the root .env and the Modal
CLI in modal_engine/venv for the bill.
"""
import collections
import datetime as dt
import json
import os
import statistics
import subprocess
import sys
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INR = 95
env = {}
for line in open(os.path.join(ROOT, ".env")):
    if "=" in line and not line.lstrip().startswith("#"):
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
URL, KEY = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/"), env["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}

today = dt.datetime.now(dt.timezone.utc).date()
first = dt.date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else today - dt.timedelta(days=3)
since = f"{first.isoformat()}T00:00:00Z"


def ts(s):
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00"))


def get_all(table, params):
    """PostgREST returns at most 1,000 rows per request, so page through."""
    rows, offset = [], 0
    while True:
        q = list(params.items()) + [("limit", "1000"), ("offset", str(offset))]
        req = urllib.request.Request(f"{URL}/rest/v1/{table}?" + urllib.parse.urlencode(q), headers=H)
        page = json.load(urllib.request.urlopen(req, timeout=60))
        rows += page
        offset += 1000
        if len(page) < 1000:
            return rows


photos = get_all("photos", {"select": "id,media_type,media_status,face_status,media_attempt,face_attempt,uploaded_at,processing_error",
                            "uploaded_at": f"gte.{since}", "order": "uploaded_at.asc"})
logs = get_all("modal_cost_logs", {"select": "photo_id,function_name,created_at", "created_at": f"gte.{since}", "order": "created_at.asc"})

# Real Modal bill per UTC day
bill = collections.defaultdict(float)
try:
    out = subprocess.run([os.path.join(ROOT, "modal_engine/venv/bin/modal"), "billing", "report", "--start", first.isoformat(),
                          "-r", "d", "--json"], capture_output=True, text=True, timeout=120).stdout
    for r in json.loads(out):
        if r["description"] == "wedding-media-engine":
            bill[r["interval_start"][:10]] += float(r["cost"])
except Exception as e:
    print("bill unavailable:", e)

# QStash messages per UTC day (free plan: 1,000/day, then 429s and photos wait for the 5-minute recovery job)
qstash = collections.Counter()
try:
    cursor = None
    for _ in range(30):
        q = {"count": "1000", **({"cursor": cursor} if cursor else {})}
        req = urllib.request.Request("https://qstash-us-east-1.upstash.io/v2/logs?" + urllib.parse.urlencode(q),
                                     headers={"Authorization": f"Bearer {env['QSTASH_TOKEN']}"})
        d = json.load(urllib.request.urlopen(req, timeout=60))
        older = False
        for e in d.get("events", []):
            day = dt.datetime.fromtimestamp(e["time"] / 1000, dt.timezone.utc).date()
            if day < first:
                older = True
                break
            if e.get("state") == "CREATED":
                qstash[day.isoformat()] += 1
        cursor = d.get("cursor")
        if older or not cursor:
            break
except Exception as e:
    print("QStash usage unavailable:", e)

uploaded = {p["id"]: p for p in photos}
by_day = collections.defaultdict(lambda: collections.Counter())
done_s = collections.defaultdict(list)
for l in logs:
    day = l["created_at"][:10]
    by_day[day][l["function_name"]] += 1
    if l["function_name"] == "process_photo_v2" and l["photo_id"] in uploaded:
        done_s[day].append((ts(l["created_at"]) - ts(uploaded[l["photo_id"]]["uploaded_at"])).total_seconds())

print(f"Photo pipeline health, UTC days {first} .. {today} (₹{INR} = $1)\n")
print("| UTC day | Photos on v2 | Photos on v1 | Videos | v2 upload→done median / p90 | Modal bill | ₹ per photo* | QStash msgs |")
print("|---|---|---|---|---|---|---|---|")
day = first
while day <= today:
    k = day.isoformat()
    c = by_day.get(k, {})
    v2, v1 = c.get("process_photo_v2", 0), c.get("process_photo_preview", 0)
    videos = sum(n for fn, n in c.items() if fn.startswith("process_video"))
    ds = sorted(done_s.get(k, []))
    speed = f"{statistics.median(ds):.0f} s / {ds[int(len(ds) * 0.9) - 1 if len(ds) > 1 else 0]:.0f} s" if ds else "-"
    b = bill.get(k)
    per = f"₹{b * INR / (v1 + v2):.3f}" if b and (v1 + v2) else "-"
    q = qstash.get(k, 0)
    print(f"| {k} | {v2} | {v1} | {videos} | {speed} | {'₹%.1f' % (b * INR) if b is not None else 'not closed'} | {per} | {q}{' ⚠️ over 1,000' if q > 1000 else ''} |")
    day += dt.timedelta(days=1)
print("\n* Whole Modal bill ÷ photos, so videos and the maintenance job (~₹1/day) are included.")

now = dt.datetime.now(dt.timezone.utc)
failed = [p for p in photos if p["media_type"] == "photo" and (p["media_status"] == "failed" or p["face_status"] == "failed")]
stuck = [p for p in photos if p["media_type"] == "photo" and p["media_status"] in ("pending", "processing")
         and now - ts(p["uploaded_at"]) > dt.timedelta(minutes=15)]
gave_up = [p for p in failed if (p.get("media_attempt") or 0) >= 3 or (p.get("face_attempt") or 0) >= 3]
print(f"\nPhotos uploaded since {first}: {sum(1 for p in photos if p['media_type'] == 'photo')}")
print(f"Failed right now: {len(failed)} (no retries left: {len(gave_up)})")
print(f"Stuck >15 min in pending/processing: {len(stuck)}")
errs = collections.Counter((p.get("processing_error") or "")[:70] for p in failed)
for e, n in errs.most_common(5):
    print(f"  {n} × {e}")
