"""
EveBash video worker for RunPod serverless (todo #18, issue #133). One RunPod job = one video.

The backend (apps/backend/src/services/runpodVideo.ts) starts the job with this input:
  photo_id, storage_key, event_id   which video
  source_url                        a signed link that can only download this video's original
  callback_url, job_token           where to report, and the proof that this job may do so
  hardware                          "gpu" (NVENC, the all-formats GPU steps) or "cpu" (libx264)
  worker                            name for logs and the cost log, e.g. "runpod_ada"
  duration                          length the upload reported, in seconds (optional)
  options                           recipe switches; the defaults are the recipe live on Modal

The streams are made exactly as on the Modal workers: the command builders are imported from
modal_engine/main.py (copied into the image as /app/main.py), not copied. The worker never holds a storage or
database key. Each output file goes up through a link the backend signs for that one file under
hls/<storage_key>/, and the backend updates the database, logs the cost and sends the push when the worker
reports success. Any failure raises, so the RunPod job ends FAILED and the backend hands the video to the next
worker in its backup chain.
"""
import concurrent.futures
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import threading
import time

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import main as recipe  # noqa: E402  (modal_engine/main.py)

DEFAULT_OPTIONS = {"gop_6s": True, "upload_early": True, "sdr_8bit": True, "poster_sdr": True}
SEGMENT_TYPE = "video/MP2T"
PLAYLIST_TYPE = "application/x-mpegURL"
USER_AGENT = "evebash-video-worker/1.0"


def log(message):
    print(f"[RunPodVideo] {message}", flush=True)


class Backend:
    """The backend's worker routes (/api/v1/video-worker/...), authorised by this job's token."""

    def __init__(self, base_url, job_token, session=None):
        self.base_url = base_url.rstrip("/")
        self.job_token = job_token
        self.session = session or requests.Session()

    def post(self, path, body=None, attempts=5):
        last = None
        for attempt in range(attempts):
            try:
                response = self.session.post(
                    f"{self.base_url}/{path.lstrip('/')}",
                    json={**(body or {}), "job_token": self.job_token},
                    headers={"User-Agent": USER_AGENT},
                    timeout=60,
                )
                if response.status_code < 500:
                    if response.status_code >= 400:
                        raise RuntimeError(f"backend {path} answered {response.status_code}: {response.text[:300]}")
                    return response.json()
                last = f"HTTP {response.status_code}: {response.text[:200]}"
            except requests.RequestException as err:
                last = str(err)
            time.sleep(min(30, 2 ** attempt))
        raise RuntimeError(f"backend {path} unreachable after {attempts} tries: {last}")


class SignedUploader:
    """Uploads output files through links the backend signs for each file (fetched in batches)."""

    def __init__(self, backend, hls_prefix, session=None, batch=400):
        self.backend = backend
        self.hls_prefix = hls_prefix.rstrip("/")
        self.session = session or requests.Session()
        self.batch = batch
        self.links = {}
        self.lock = threading.Lock()
        self.uploaded_bytes = 0

    def rel(self, key):
        """hls/<storage_key>/1080p/seg_000.ts -> 1080p/seg_000.ts (what the backend signs)."""
        prefix = self.hls_prefix + "/"
        return key[len(prefix):] if key.startswith(prefix) else key

    def presign(self, rels, refresh=False):
        with self.lock:
            missing = [r for r in dict.fromkeys(rels) if refresh or r not in self.links]
        for i in range(0, len(missing), self.batch):
            answer = self.backend.post("upload-urls", {"keys": missing[i:i + self.batch]})
            with self.lock:
                self.links.update(answer.get("links") or {})

    def upload(self, args):
        """(file path, key, content type): the call the shared _EarlySegmentUploader makes."""
        path, key, _content_type = args
        rel = self.rel(key)
        if rel not in self.links:
            self.presign([rel])
        last = None
        for attempt in range(5):
            link = self.links[rel]
            try:
                with open(path, "rb") as body:
                    response = self.session.put(link["url"], data=body, headers=link.get("headers") or {}, timeout=900)
                if response.status_code in (200, 201):
                    with self.lock:
                        self.uploaded_bytes += pathlib.Path(path).stat().st_size
                    return
                last = f"HTTP {response.status_code}: {response.text[:200]}"
                if response.status_code in (401, 403):
                    self.presign([rel], refresh=True)  # the link expired (very long job): get a fresh one
            except requests.RequestException as err:
                last = str(err)
            time.sleep(min(20, 2 ** attempt))
        raise RuntimeError(f"upload of {rel} failed: {last}")


def download(url, dest, session=None, attempts=6):
    """Downloads the original, resuming after a dropped connection. Checks the final size."""
    session = session or requests.Session()
    total = None
    for attempt in range(attempts):
        have = dest.stat().st_size if dest.exists() else 0
        if total is not None and have >= total:
            break
        headers = {"User-Agent": USER_AGENT}
        if have:
            headers["Range"] = f"bytes={have}-"
        try:
            with session.get(url, headers=headers, stream=True, timeout=(20, 120)) as response:
                if response.status_code == 416 and have:
                    break
                response.raise_for_status()
                if response.status_code == 206:
                    total = int(response.headers["Content-Range"].rsplit("/", 1)[1])
                    mode = "ab"
                else:
                    total = int(response.headers.get("Content-Length") or 0) or None
                    mode = "wb"
                with open(dest, mode) as out:
                    for chunk in response.iter_content(8 * 1024 * 1024):
                        out.write(chunk)
        except (requests.RequestException, OSError) as err:
            log(f"download attempt {attempt + 1} broke off: {err}")
            time.sleep(min(30, 2 ** attempt))
            continue
        if total is None or dest.stat().st_size >= total:
            break
    size = dest.stat().st_size if dest.exists() else 0
    if size == 0 or (total is not None and size != total):
        raise RuntimeError(f"download incomplete: {size} of {total} bytes")
    return size


def probe(input_path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries",
         "stream=index,codec_type,codec_name,pix_fmt,color_transfer,color_primaries,width,height,avg_frame_rate,"
         "r_frame_rate:stream_side_data=rotation:format=duration", "-of", "json", str(input_path)],
        capture_output=True, text=True)
    data = json.loads(out.stdout or "{}")
    video = next((s for s in data.get("streams") or [] if s.get("codec_type") == "video"), None)
    if not video:
        raise RuntimeError(f"no video stream found: {(out.stderr or '')[-300:]}")
    has_audio, height = recipe._video_basics_from_probe(data)
    try:
        duration = float((data.get("format") or {}).get("duration") or 0) or None
    except ValueError:
        duration = None
    return video, has_audio, height or int(video.get("height") or 1080), duration


def gpu_name():
    try:
        out = subprocess.run(["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"], capture_output=True, text=True, timeout=10)
        return out.stdout.strip().splitlines()[0] if out.returncode == 0 and out.stdout.strip() else None
    except (OSError, subprocess.SubprocessError):
        return None


def host_size():
    """(CPU count, memory in GB) of this worker, for the cost log."""
    memory_gb = None
    try:
        with open("/proc/meminfo") as meminfo:
            kb = next(int(line.split()[1]) for line in meminfo if line.startswith("MemTotal:"))
        memory_gb = round(kb / 1024 / 1024, 1)
    except (OSError, StopIteration, ValueError):
        pass
    return os.cpu_count(), memory_gb


def make_poster(input_path, poster_path, video, use_sdr_poster):
    cmd = ["ffmpeg", "-y", "-i", str(input_path), "-ss", "00:00:01", "-vframes", "1", "-q:v", "2", str(poster_path)]
    vf = recipe._poster_filter(video) if use_sdr_poster else ""
    if vf:
        proc = subprocess.run(cmd[:-1] + ["-vf", vf, str(poster_path)], capture_output=True, text=True)
        if proc.returncode == 0 and poster_path.exists() and poster_path.stat().st_size > 0:
            return True
        log(f"poster conversion failed, using the plain frame: {(proc.stderr or '')[-200:]}")
    subprocess.run(cmd, capture_output=True, text=True)
    return poster_path.exists() and poster_path.stat().st_size > 0


def transcode_job(job_input, session=None, workdir=None):
    """Runs one job. Returns a summary; raises on any failure (the backend then tries the next worker)."""
    started = time.time()
    timings = {}
    photo_id = job_input["photo_id"]
    storage_key = job_input["storage_key"]
    hardware = job_input.get("hardware") or "cpu"
    worker = job_input.get("worker") or f"runpod_{hardware}"
    options = {**DEFAULT_OPTIONS, **(job_input.get("options") or {})}
    session = session or requests.Session()
    backend = Backend(job_input["callback_url"], job_input["job_token"], session)
    hls_prefix = f"hls/{storage_key}"

    start = backend.post("start", {"worker": worker})
    if not start.get("proceed", True):
        log(f"{photo_id}: not converting ({start.get('reason')})")
        return {"status": "skipped", "photo_id": photo_id, "reason": start.get("reason")}

    tmp_dir = tempfile.mkdtemp(prefix="evebash-video-", dir=workdir)
    try:
        tmp_path = pathlib.Path(tmp_dir)
        input_path = tmp_path / "input"
        poster_path = tmp_path / "poster.jpg"

        t = time.time()
        source_bytes = download(job_input["source_url"], input_path, session)
        timings["download_s"] = round(time.time() - t, 1)
        log(f"{photo_id}: downloaded {source_bytes // 2 ** 20} MB in {timings['download_s']} s")

        video, has_audio, src_height, duration = probe(input_path)
        duration = duration or (float(job_input["duration"]) if job_input.get("duration") else None)
        out_dirs = recipe._hls_out_dirs(src_height, has_audio)
        for out_dir in out_dirs:
            (tmp_path / out_dir).mkdir(parents=True, exist_ok=True)
        gop = recipe._gop_from_rates(video.get("avg_frame_rate"), video.get("r_frame_rate")) if options["gop_6s"] else "48"

        uploader = SignedUploader(backend, hls_prefix, session)
        # Sign the expected files up front (a few hundred per call); any extra segment is signed when it appears
        expected = int((duration or 0) // 6) + 3
        uploader.presign([f"{d}/seg_{i:03d}.ts" for d in out_dirs for i in range(expected)]
                         + [f"{d}/playlist.m3u8" for d in out_dirs] + ["master.m3u8", "poster.jpg"])

        if make_poster(input_path, poster_path, video, options["poster_sdr"]):
            uploader.upload((poster_path, f"{hls_prefix}/poster.jpg", "image/jpeg"))

        early = {"last": set(), "failed": set()}

        def run_ffmpeg(cmd):
            if not options["upload_early"]:
                return subprocess.run(cmd, capture_output=True, text=True)
            early["failed"] |= early["last"]
            recipe._clear_hls_dirs(tmp_path, out_dirs)  # a retry must not read the failed run's files as its own
            early_uploader = recipe._EarlySegmentUploader(uploader.upload, tmp_path, out_dirs, hls_prefix).start()
            try:
                return subprocess.run(cmd, capture_output=True, text=True)
            finally:
                early["last"] = early_uploader.finish()

        t = time.time()
        path_used = None
        failures = []
        if hardware == "gpu":
            for name, build, stream in recipe._gpu_all_attempts(video):
                proc = run_ffmpeg(build(str(input_path), tmp_path, out_dirs, has_audio, stream, gop))
                problem = (f"ffmpeg failed: {(proc.stderr or '')[-300:]}" if proc.returncode != 0
                           else recipe._hls_length_problem(tmp_path, out_dirs, duration))
                if not problem:
                    path_used = name
                    break
                failures.append(f"{name}: {problem}")
                log(f"{photo_id}: {name} did not work: {problem}")
                recipe._clear_hls_dirs(tmp_path, out_dirs)
        else:
            sdr_prefix = recipe._sdr_8bit_filter(video) if options["sdr_8bit"] else ""
            cmd = recipe._cpu_ffmpeg_cmd(str(input_path), tmp_path, out_dirs, has_audio, sdr_prefix, gop, "cpu")
            proc = run_ffmpeg(cmd)
            if proc.returncode != 0 and "tonemap" in sdr_prefix:
                log(f"{photo_id}: HDR conversion failed, retrying as plain 8-bit: {(proc.stderr or '')[-200:]}")
                proc = run_ffmpeg(recipe._without_tone_map(cmd, sdr_prefix))
            problem = (f"ffmpeg failed: {(proc.stderr or '')[-300:]}" if proc.returncode != 0
                       else recipe._hls_length_problem(tmp_path, out_dirs, duration))
            if problem:
                failures.append(problem)
            else:
                path_used = "libx264"
        timings["ffmpeg_s"] = round(time.time() - t, 1)
        if not path_used:
            raise RuntimeError(" | ".join(failures)[:1500])

        master = tmp_path / "master.m3u8"
        if not master.exists():
            raise RuntimeError("ffmpeg did not write master.m3u8")

        # Same order as the Modal workers: remaining segments, then the variant playlists, master.m3u8 last
        t = time.time()
        segments = [p for d in out_dirs for p in sorted((tmp_path / d).glob("seg_*.ts"))]
        final_keys = {f"{hls_prefix}/{p.parent.name}/{p.name}" for p in segments}
        todo = [(p, f"{hls_prefix}/{p.parent.name}/{p.name}", SEGMENT_TYPE) for p in segments
                if f"{hls_prefix}/{p.parent.name}/{p.name}" not in early["last"]]
        uploader.presign([uploader.rel(k) for _p, k, _c in todo])
        with concurrent.futures.ThreadPoolExecutor(16) as pool:
            list(pool.map(uploader.upload, todo))
        playlists = [(tmp_path / d / "playlist.m3u8", f"{hls_prefix}/{d}/playlist.m3u8", PLAYLIST_TYPE)
                     for d in out_dirs if (tmp_path / d / "playlist.m3u8").exists()]
        with concurrent.futures.ThreadPoolExecutor(8) as pool:
            list(pool.map(uploader.upload, playlists))
        uploader.upload((master, f"{hls_prefix}/master.m3u8", PLAYLIST_TYPE))
        timings["upload_after_s"] = round(time.time() - t, 1)
        timings["total_s"] = round(time.time() - started, 1)

        files = sorted(uploader.rel(k) for k in final_keys | {k for _p, k, _c in playlists}) + ["master.m3u8"]
        if poster_path.exists():
            files.append("poster.jpg")
        cpu_count, memory_gb = host_size()
        summary = {
            "worker": worker,
            "hardware": hardware,
            "cpu_count": cpu_count,
            "memory_gb": memory_gb,
            "gpu_name": gpu_name() if hardware == "gpu" else None,
            "path": path_used,
            "gop": gop,
            "duration": round(duration, 2) if duration else None,
            "source_bytes": source_bytes,
            "segments": len(segments),
            "uploaded_while_encoding": len(early["last"]),
            "timings": timings,
            "files": files,
        }
        backend.post("complete", summary)
        log(f"{photo_id}: done in {timings['total_s']} s ({path_used}, {len(early['last'])}/{len(segments)} segments uploaded while encoding)")
        return {"status": "success", "photo_id": photo_id, **{k: v for k, v in summary.items() if k != "files"}}
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def handler(job):
    return transcode_job(job["input"])


if __name__ == "__main__":
    import runpod

    runpod.serverless.start({"handler": handler})
