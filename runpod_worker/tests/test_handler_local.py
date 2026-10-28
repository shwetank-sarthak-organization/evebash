"""
End-to-end test of runpod_worker/handler.py on this machine's ffmpeg (CPU path), against a fake backend that
serves the original, signs "upload links" that store files locally, and records the completion report.

  python runpod_worker/tests/test_handler_local.py <video file>

Needs ffmpeg/ffprobe on PATH and the packages in runpod_worker/requirements.txt (modal is only imported).
"""
import http.server
import json
import pathlib
import re
import subprocess
import sys
import tempfile
import threading
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "modal_engine"))
import handler  # noqa: E402

STORAGE_KEY = "events/test-gallery/videos/test-video.mp4"
TOKEN = "test-token"


def make_server(source, store, log):
    class Fake(http.server.BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def _json(self, code, body):
            data = json.dumps(body).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if self.path != "/source":
                return self._json(404, {})
            data = source.read_bytes()
            rng = self.headers.get("Range")
            start = int(re.match(r"bytes=(\d+)-", rng).group(1)) if rng else 0
            self.send_response(206 if rng else 200)
            if rng:
                self.send_header("Content-Range", f"bytes {start}-{len(data) - 1}/{len(data)}")
            self.send_header("Content-Length", str(len(data) - start))
            self.end_headers()
            self.wfile.write(data[start:])

        def do_PUT(self):
            rel = self.path[len("/put/"):]
            body = self.rfile.read(int(self.headers["Content-Length"]))
            log.append(("put", time.monotonic(), rel, self.headers.get("Content-Type"), self.headers.get("Cache-Control")))
            dest = store / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(body)
            self.send_response(200)
            self.end_headers()

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            if body.get("job_token") != TOKEN:
                return self._json(401, {"error": "bad token"})
            route = self.path.rsplit("/", 1)[1]
            log.append((route, time.monotonic(), body))
            if route == "start":
                return self._json(200, {"proceed": True})
            if route == "upload-urls":
                links = {}
                for rel in body["keys"]:
                    if not re.fullmatch(r"(?:(?:1080p|720p|480p|audio)/(?:seg_\d+\.ts|playlist\.m3u8)|master\.m3u8|poster\.jpg)", rel):
                        return self._json(400, {"error": f"key not allowed: {rel}"})
                    links[rel] = {"url": f"http://127.0.0.1:{self.server.server_port}/put/{rel}",
                                  "headers": {"Content-Type": "video/MP2T" if rel.endswith(".ts") else "x"}}
                return self._json(200, {"links": links})
            if route == "complete":
                return self._json(200, {"ok": True})
            return self._json(404, {})

    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Fake)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def main(video):
    ok = True

    def check(name, cond, extra=""):
        nonlocal ok
        ok &= bool(cond)
        print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra else ""))

    with tempfile.TemporaryDirectory() as tmp:
        store = pathlib.Path(tmp) / "bucket"
        log = []
        server = make_server(pathlib.Path(video), store, log)
        base = f"http://127.0.0.1:{server.server_port}"
        job = {"photo_id": "p1", "storage_key": STORAGE_KEY, "event_id": "test-gallery", "source_url": f"{base}/source",
               "callback_url": f"{base}/api/v1/video-worker", "job_token": TOKEN, "hardware": "cpu", "worker": "runpod_cpu32"}
        t0 = time.monotonic()
        result = handler.transcode_job(job)
        print(json.dumps({k: v for k, v in result.items()}, indent=1)[:900])

        complete = [e for e in log if e[0] == "complete"]
        puts = [e for e in log if e[0] == "put"]
        check("job succeeded", result["status"] == "success")
        check("reported complete once", len(complete) == 1)
        summary = complete[0][2] if complete else {}
        master_t = max(t for kind, t, rel, *_ in puts if rel == "master.m3u8")
        check("master.m3u8 uploaded last", all(t <= master_t for _k, t, *_ in puts))
        check("playlists after every segment", min(t for _k, t, rel, *_ in puts if rel.endswith("playlist.m3u8")) >= max(t for _k, t, rel, *_ in puts if rel.endswith(".ts")))
        check("segments uploaded while encoding", summary.get("uploaded_while_encoding", 0) > 0, summary.get("uploaded_while_encoding"))
        check("keyframe interval = 6 s of frames", summary.get("gop") not in (None, "48"), summary.get("gop"))
        check("poster uploaded", (store / "poster.jpg").exists())
        listed = summary.get("files", [])
        check("every reported file is in storage", all((store / rel).exists() for rel in listed), len(listed))
        check("no file in storage that wasn't reported", sorted(str(p.relative_to(store)) for p in store.rglob("*") if p.is_file()) == sorted(listed))
        for tier in [d for d in ("1080p", "720p", "480p") if (store / d / "playlist.m3u8").exists()]:
            segs = [l.strip() for l in (store / tier / "playlist.m3u8").read_text().splitlines() if l.strip().endswith(".ts")]
            starts = inner = 0
            for s in segs:
                fl = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "packet=flags", "-of", "csv=p=0", str(store / tier / s)], capture_output=True, text=True).stdout.split()
                starts += bool(fl and fl[0].startswith("K"))
                inner += sum(f.startswith("K") for f in fl[1:])
            dec = subprocess.run(["ffmpeg", "-v", "error", "-i", str(store / tier / "playlist.m3u8"), "-f", "null", "-"], capture_output=True, text=True).stderr.strip()
            check(f"{tier}: {len(segs)} segments start on a keyframe, none inside, plays", starts == len(segs) and inner == 0 and not dec, (starts, inner, dec[:80]))
        print(f"took {time.monotonic() - t0:.0f} s")
        server.shutdown()
    print("ALL PASS" if ok else "SOME FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
