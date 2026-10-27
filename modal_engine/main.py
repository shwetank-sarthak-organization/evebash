import modal
import os
import io

try:
    import fastapi
except ImportError:
    fastapi = None

app = modal.App("wedding-media-engine")

# Define the Modal image with system OpenCV dependencies and InsightFace + ONNX Runtime.
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1-mesa-glx", "libglib2.0-0", "ffmpeg")
    .pip_install(
        "fastapi[standard]",
        "boto3",
        "Pillow",
        "insightface",        # SOTA face analysis library code (MIT license)
        "onnxruntime",        # CPU execution engine for ONNX models
        "huggingface_hub",    # CLI/SDK for downloading weights from HF
        "supabase",
        "requests",
        "numpy",
    )
    .run_commands(
        # Download AuraFace weights from fal/AuraFace-v1 to the standard model folder
        "python -c 'from huggingface_hub import snapshot_download; snapshot_download(\"fal/AuraFace-v1\", local_dir=\"/root/.insightface/models/auraface\")'"
    )
)

# PhotoProcessorV2 only: the same image plus rawpy (LibRaw) for RAW camera files. A separate image so the
# old workers keep the exact image they run on today.
photo_v2_image = image.pip_install("rawpy==0.27.1")

# Lightweight image for Fast Media resizing (Zero AI dependencies, instant cold starts)
media_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1-mesa-glx", "libglib2.0-0")
    .pip_install(
        "fastapi[standard]",
        "boto3",
        "Pillow",
        "supabase",
        "requests",
    )
)

def verify_qstash_signature(body: bytes, signature: str, url: str) -> bool:
    """
    Verifies Upstash-Signature JWT header against raw body bytes.
    Validates HMAC-SHA256, expiration, not-before, and body SHA-256 hash.
    Checks QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY for key rotation.
    """
    import hmac
    import hashlib
    import base64
    import json
    import time

    current_key = (os.environ.get("QSTASH_CURRENT_SIGNING_KEY") or "").strip().strip("\"'")
    next_key = (os.environ.get("QSTASH_NEXT_SIGNING_KEY") or "").strip().strip("\"'")

    if not current_key and not next_key:
        print("[QStash Auth] Notice: No QStash signing keys configured in env. Skipping signature check.")
        return True

    if not signature:
        print("[QStash Auth] Missing Upstash-Signature header.")
        if fastapi:
            raise fastapi.HTTPException(status_code=401, detail="Missing Upstash-Signature header")
        raise RuntimeError("Missing Upstash-Signature header")

    parts = signature.strip().split(".")
    if len(parts) != 3:
        print("[QStash Auth] Invalid Upstash-Signature JWT format.")
        if fastapi:
            raise fastapi.HTTPException(status_code=401, detail="Invalid Upstash-Signature JWT format")
        raise RuntimeError("Invalid Upstash-Signature JWT format")

    def b64url_decode(s: str) -> bytes:
        rem = len(s) % 4
        if rem > 0:
            s += "=" * (4 - rem)
        try:
            return base64.urlsafe_b64decode(s)
        except Exception:
            return base64.b64decode(s)

    signed_content = f"{parts[0]}.{parts[1]}".encode("utf-8")
    provided_sig = b64url_decode(parts[2])

    verified = False
    for key in [current_key, next_key]:
        if not key:
            continue
        expected_sig = hmac.new(key.encode("utf-8"), signed_content, hashlib.sha256).digest()
        if hmac.compare_digest(provided_sig, expected_sig):
            verified = True
            break

    if not verified:
        print("[QStash Auth] HMAC signature verification failed.")
        if fastapi:
            raise fastapi.HTTPException(status_code=401, detail="Upstash-Signature verification failed")
        raise RuntimeError("Upstash-Signature verification failed")

    # Validate JWT claims
    try:
        claims = json.loads(b64url_decode(parts[1]).decode("utf-8"))
    except Exception as e:
        print(f"[QStash Auth] Invalid JWT claims: {e}")
        if fastapi:
            raise fastapi.HTTPException(status_code=401, detail=f"Invalid JWT claims: {e}")
        raise RuntimeError(f"Invalid JWT claims: {e}")

    now = int(time.time())
    if "exp" in claims and claims["exp"] < now - 60:
        print("[QStash Auth] Upstash-Signature expired.")
        if fastapi:
            raise fastapi.HTTPException(status_code=401, detail="Upstash-Signature expired")
        raise RuntimeError("Upstash-Signature expired")

    if "nbf" in claims and claims["nbf"] > now + 300:
        print("[QStash Auth] Upstash-Signature not yet valid.")
        if fastapi:
            raise fastapi.HTTPException(status_code=401, detail="Upstash-Signature not yet valid")
        raise RuntimeError("Upstash-Signature not yet valid")

    # Validate body hash
    # QStash sends SHA-256 hash encoded as Base64 (or b64url) in claims["body"]
    body_bytes = body if isinstance(body, bytes) else str(body).encode("utf-8")
    raw_digest = hashlib.sha256(body_bytes).digest()
    body_hash_b64 = base64.b64encode(raw_digest).decode("utf-8")
    body_hash_b64url = base64.urlsafe_b64encode(raw_digest).decode("utf-8").rstrip("=")
    body_hash_hex = hashlib.sha256(body_bytes).hexdigest()

    claim_body = claims.get("body")
    if claim_body:
        normalized_claim = claim_body.rstrip("=")
        valid_hashes = {
            body_hash_b64,
            body_hash_b64url,
            body_hash_hex,
            body_hash_b64.rstrip("="),
            body_hash_b64url.rstrip("=")
        }
        if claim_body not in valid_hashes and normalized_claim not in valid_hashes:
            print(f"[QStash Auth] Body hash mismatch: claim={claim_body}, expected_b64={body_hash_b64}")
            if fastapi:
                raise fastapi.HTTPException(status_code=401, detail="Upstash-Signature body hash mismatch")
            raise RuntimeError("Upstash-Signature body hash mismatch")

    return True

# Global model caches to persist AuraFace in memory across warm container invocations.
_indexing_model = None
_selfie_model = None

def get_indexing_model():
    """
    Lazy-loads the indexing model (1280x1280) once and keeps it warm.
    """
    global _indexing_model
    if _indexing_model is None:
        from insightface.app import FaceAnalysis
        print("[Container Init] Loading AuraFace Indexing model (1280x1280)...")
        _indexing_model = FaceAnalysis(
            name="auraface",
            root="/root/.insightface",
            providers=["CPUExecutionProvider"]
        )
        _indexing_model.prepare(ctx_id=-1, det_size=(1280, 1280), det_thresh=0.25)
    return _indexing_model

def get_selfie_model():
    """
    Lazy-loads the selfie matching model (640x640) once and keeps it warm.
    """
    global _selfie_model
    if _selfie_model is None:
        from insightface.app import FaceAnalysis
        print("[Container Init] Loading AuraFace Selfie model (640x640)...")
        _selfie_model = FaceAnalysis(
            name="auraface",
            root="/root/.insightface",
            providers=["CPUExecutionProvider"]
        )
        _selfie_model.prepare(ctx_id=-1, det_size=(640, 640), det_thresh=0.25)
    return _selfie_model


def _hand_off_to_fast_pipeline(photos: list) -> dict:
    """
    Sends photos the 2-stage pipeline hasn't started yet (e.g. web uploads over 20 MB, which skip the
    fast-media trigger) to the photo worker: process_photo_preview, or PhotoProcessorV2 per the photo
    pipeline switch. Photos already in that pipeline are left alone instead of being resized and
    face-indexed a second time.
    """
    from supabase import create_client

    ids = [p.get("id") for p in photos if isinstance(p, dict) and p.get("id")]
    supabase = create_client(os.environ.get("NEXT_PUBLIC_SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))
    mode, v2_events = _read_photo_pipeline_switch() if ids else ("v1", [])
    handed_off = 0
    for i in range(0, len(ids), 20):  # photo ids are long, so keep each request URL short
        rows = (
            supabase.table("photos")
            .select("id, storage_key, event_id, user_id, asset_version")
            .in_("id", ids[i:i + 20])
            .eq("media_type", "photo")
            .in_("media_status", ["pending", "failed"])
            .lt("media_attempt", 3)
            .execute()
        ).data or []
        for p in rows:
            _spawn_photo_job({
                "id": p["id"],
                "photo_id": p["id"],
                "storage_key": p.get("storage_key"),
                "event_id": p.get("event_id"),
                "user_id": p.get("user_id"),
                "asset_version": p.get("asset_version") or 1,
            }, mode, v2_events)
        handed_off += len(rows)
    print(f"[Batch] {len(ids)} photo(s): {handed_off} handed to the 2-stage pipeline, {len(ids) - handed_off} already in it")
    return {"status": "success", "processed": len(ids), "handed_off": handed_off}


@app.function(
    # Only hands photos off to the 2-stage pipeline, so it doesn't need the face-recognition image
    image=media_image,
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
@modal.fastapi_endpoint(method="POST")
def process_media_batch(request: dict):
    """
    QStash Webhook Entrypoint.
    Accepts a batch of photos and fans them out to parallel CPU workers.
    """
    import time
    start_time = time.time()

    photos = request.get("photos", [])
    if not photos:
        return {"status": "no photos provided"}

    return _hand_off_to_fast_pipeline(photos)


# ==============================================================================
# DECOUPLED 2-STAGE PIPELINE: STAGE 1 - FAST MEDIA PATH
# ==============================================================================

@app.function(
    image=media_image,
    cpu=0.5,
    memory=768,
    max_containers=15,
    scaledown_window=60,
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
def process_photo_preview(photo_data: dict):
    """
    STAGE 1: FAST MEDIA WORKER
    Resizes raw original from B2 to 1600p preview & 480p thumbnail WebP.
    Zero AI dependencies. Completes in seconds, immediately updating the gallery.
    """
    import time
    import io
    import uuid
    import boto3
    from PIL import Image, ImageOps
    from supabase import create_client, Client

    start_time = time.time()
    photo_id = photo_data.get("id") or photo_data.get("photo_id")
    asset_version = int(photo_data.get("asset_version") or 1)
    storage_key = photo_data.get("storage_key") or photo_data.get("object_key")
    event_id = photo_data.get("event_id")
    user_id = photo_data.get("user_id")

    if not photo_id or not storage_key:
        print(f"[Preview] Missing required parameters: photo_id={photo_id}, storage_key={storage_key}")
        return {"status": "error", "error": "Missing photo_id or storage_key"}

    supabase: Client = create_client(
        os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    )

    token = str(uuid.uuid4())
    claimed = supabase.rpc("claim_media_job", {
        "p_photo_id": photo_id,
        "p_token": token,
        "p_asset_version": asset_version
    }).execute()

    if not claimed.data:
        print(f"[{photo_id}] Media job already claimed or exceeded max retries. Skipping.")
        return {"status": "skipped", "photo_id": photo_id}

    try:
        b2_client = boto3.client(
            's3',
            endpoint_url=f"https://{os.environ.get('B2_ENDPOINT')}",
            aws_access_key_id=os.environ.get('B2_KEY_ID'),
            aws_secret_access_key=os.environ.get('B2_APPLICATION_KEY')
        )
        bucket_name = os.environ.get('B2_BUCKET_NAME')

        print(f"[{photo_id}] Downloading original photo for preview: {storage_key}")
        resp = b2_client.get_object(Bucket=bucket_name, Key=storage_key)
        raw_bytes = resp['Body'].read()

        # Pillow decompression bomb protection
        Image.MAX_IMAGE_PIXELS = 100_000_000
        pil_img = Image.open(io.BytesIO(raw_bytes))
        try:
            pil_img = ImageOps.exif_transpose(pil_img)
        except Exception:
            pass
        if pil_img.mode != "RGB":
            pil_img = pil_img.convert("RGB")
        orig_w, orig_h = pil_img.size

        # 1600p Preview WebP (high-fidelity sweet spot for gallery & face detector)
        preview_img = pil_img.copy()
        preview_img.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
        preview_buf = io.BytesIO()
        preview_img.save(preview_buf, format="WEBP", quality=70, method=4)
        preview_bytes = preview_buf.getvalue()

        # 480p Thumbnail WebP (Retina-ready gallery feed cards)
        thumb_img = pil_img.copy()
        thumb_img.thumbnail((480, 480), Image.Resampling.LANCZOS)
        thumb_buf = io.BytesIO()
        thumb_img.save(thumb_buf, format="WEBP", quality=68, method=4)
        thumb_bytes = thumb_buf.getvalue()

        preview_key = f"{storage_key}-preview.webp"
        thumb_key   = f"{storage_key}-thumbnail.webp"

        b2_client.put_object(Bucket=bucket_name, Key=preview_key, Body=preview_bytes, ContentType="image/webp")
        b2_client.put_object(Bucket=bucket_name, Key=thumb_key, Body=thumb_bytes, ContentType="image/webp")

        media_domain = (
            os.environ.get("MEDIA_DOMAIN")
            or os.environ.get("CLOUDFLARE_DOMAIN")
            or os.environ.get("NEXT_PUBLIC_MEDIA_DOMAIN")
            or "media.evebash.com"
        ).strip().replace("https://", "").replace("http://", "").rstrip("/")

        preview_url = f"https://{media_domain}/{preview_key}"
        thumbnail_url = f"https://{media_domain}/{thumb_key}"
        overhead_bytes = len(preview_bytes) + len(thumb_bytes)

        # Atomic completion in database
        supabase.rpc("complete_media_job", {
            "p_photo_id": photo_id,
            "p_token": token,
            "p_asset_version": asset_version,
            "p_thumbnail_url": thumbnail_url,
            "p_preview_url": preview_url,
            "p_width": orig_w,
            "p_height": orig_h,
            "p_overhead_size": overhead_bytes
        }).execute()

        duration = time.time() - start_time
        cpu_cores = 0.5
        memory_gb = 0.75
        rate_per_sec = (cpu_cores * 0.0000131) + (memory_gb * 0.00000222)
        cost_inr = duration * rate_per_sec * 100.0

        try:
            log_payload = {
                "photo_id": photo_id,
                "event_id": event_id,
                "function_name": "process_photo_preview",
                "worker_type": "Modal Preview Worker (0.5 vCPU • 768MB)",
                "media_type": "photo",
                "media_size": len(raw_bytes),
                "cpu_cores": cpu_cores,
                "memory_gb": memory_gb,
                "gpu_type": "None",
                "execution_time_seconds": duration,
                "estimated_cost_inr": cost_inr,
                "faces_detected": 0
            }
            if user_id:
                log_payload["user_id"] = user_id
            supabase.table("modal_cost_logs").insert(log_payload).execute()
        except Exception as log_err:
            print(f"[{photo_id}] Cost logging failed: {log_err}")

        print(f"[{photo_id}] Fast Preview complete in {duration:.2f}s, ₹{cost_inr:.5f}. Photo is now live in gallery.")

        # Immediately trigger FaceIndexer for fast async indexing
        FaceIndexer().process.spawn({
            "id": photo_id,
            "photo_id": photo_id,
            "asset_version": asset_version,
            "storage_key": storage_key,
            "event_id": event_id,
            "user_id": user_id,
            "preview_url": preview_url
        })

        return {"status": "success", "photo_id": photo_id, "preview_url": preview_url}

    except Exception as e:
        print(f"[{photo_id}] Fast Preview generation failed: {e}")
        failed_update = {
            "media_status": "failed",
            "processing_error": str(e)[:1000]
        }
        error_code = (getattr(e, "response", None) or {}).get("Error", {}).get("Code")
        if error_code in ("NoSuchKey", "404"):
            # The original isn't in B2, so retrying can't succeed; use up the attempts now
            failed_update["media_attempt"] = 3
        try:
            supabase.table("photos").update(failed_update).eq("id", photo_id).execute()
        except Exception:
            pass
        return {"status": "error", "photo_id": photo_id, "error": str(e)}


@app.function(
    image=media_image,
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
@modal.fastapi_endpoint(method="POST")
async def generate_photo_preview(request: fastapi.Request):
    """
    QStash webhook endpoint for Fast Media Path.
    Verifies Upstash-Signature and spawns the photo worker asynchronously (process_photo_preview, or
    PhotoProcessorV2 when the photo pipeline switch says so).
    Returns HTTP 202 Accepted in ~10ms. Zero QStash timeout risk.
    """
    import json
    body = await request.body()
    signature = request.headers.get("Upstash-Signature", "")
    url = str(request.url)
    verify_qstash_signature(body, signature, url)

    payload = json.loads(body.decode("utf-8")) if body else {}
    photo_items = payload.get("photos") or ([payload] if payload.get("storage_key") or payload.get("id") or payload.get("photo_id") else [])

    # process_photo_preview (v1, default) or PhotoProcessorV2, per the photo pipeline switch (issue #77)
    mode, v2_events = _read_photo_pipeline_switch() if photo_items else ("v1", [])
    for item in photo_items:
        _spawn_photo_job(item, mode, v2_events)

    return {"accepted": True, "count": len(photo_items)}, 202


# ==============================================================================
# DECOUPLED 2-STAGE PIPELINE: STAGE 2 - ASYNC AI FACE PATH (FaceIndexer)
# ==============================================================================

@app.function(
    image=media_image,
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
@modal.fastapi_endpoint(method="POST")
async def face_index_ingress(request: fastapi.Request):
    """
    Thin HTTP webhook for Stage 2 (Face Indexing).
    Verifies Upstash-Signature and spawns FaceIndexer asynchronously.
    Returns HTTP 202 Accepted in ~10ms. Zero QStash timeout risk.
    """
    import json
    body = await request.body()
    signature = request.headers.get("Upstash-Signature", "")
    url = str(request.url)
    verify_qstash_signature(body, signature, url)

    payload = json.loads(body.decode("utf-8")) if body else {}
    FaceIndexer().process.spawn(payload)
    return {"accepted": True, "photo_id": payload.get("photo_id") or payload.get("id")}, 202


@app.cls(
    image=image,
    cpu=1.0,
    memory=2048,
    max_containers=12,
    scaledown_window=45,
    retries=0,
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
class FaceIndexer:
    @modal.enter()
    def load_model(self):
        """AuraFace model loads ONCE per container lifetime and stays warm in RAM."""
        from insightface.app import FaceAnalysis
        print("[FaceIndexer] Warming up AuraFace indexing model (640x640)...")
        self.face_app = FaceAnalysis(
            name="auraface",
            root="/root/.insightface",
            providers=["CPUExecutionProvider"]
        )
        self.face_app.prepare(ctx_id=-1, det_size=(640, 640), det_thresh=0.25)
        print("[FaceIndexer] AuraFace model warm and ready in container RAM.")

    @modal.method()
    def process(self, photo_data: dict):
        """
        STAGE 2: ASYNCHRONOUS AI FACE VECTOR EXTRACTION
        Processes a single photo's face embeddings with atomic replacement.
        """
        import time
        import io
        import uuid
        import boto3
        import numpy as np
        import cv2
        from PIL import Image
        from supabase import create_client, Client

        start_time = time.time()
        photo_id = photo_data.get("id") or photo_data.get("photo_id")
        asset_version = int(photo_data.get("asset_version") or 1)
        storage_key = photo_data.get("storage_key") or photo_data.get("object_key")
        event_id = photo_data.get("event_id")
        user_id = photo_data.get("user_id")
        preview_url = photo_data.get("preview_url")

        if not photo_id or not storage_key:
            return {"status": "error", "error": "Missing photo_id or storage_key"}

        supabase: Client = create_client(
            os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        )

        token = str(uuid.uuid4())
        claimed = supabase.rpc("claim_face_job", {
            "p_photo_id": photo_id,
            "p_token": token,
            "p_asset_version": asset_version
        }).execute()

        if not claimed.data:
            print(f"[{photo_id}] Face indexing job already claimed or max attempts reached.")
            return {"status": "skipped", "photo_id": photo_id}

        try:
            b2_client = boto3.client(
                's3',
                endpoint_url=f"https://{os.environ.get('B2_ENDPOINT')}",
                aws_access_key_id=os.environ.get('B2_KEY_ID'),
                aws_secret_access_key=os.environ.get('B2_APPLICATION_KEY')
            )
            bucket_name = os.environ.get('B2_BUCKET_NAME')

            preview_key = f"{storage_key}-preview.webp"
            try:
                resp = b2_client.get_object(Bucket=bucket_name, Key=preview_key)
                img_bytes = resp['Body'].read()
            except Exception:
                resp = b2_client.get_object(Bucket=bucket_name, Key=storage_key)
                img_bytes = resp['Body'].read()

            Image.MAX_IMAGE_PIXELS = 100_000_000
            pil_img = Image.open(io.BytesIO(img_bytes))
            if pil_img.mode != "RGB":
                pil_img = pil_img.convert("RGB")
            img_rgb = np.array(pil_img)
            img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
            h, w, _ = img_bgr.shape

            faces = self.face_app.get(img_bgr)
            print(f"[{photo_id}] FaceIndexer found {len(faces)} face(s).")

            face_records = []
            for face in faces:
                embedding = face.normed_embedding
                if embedding is not None:
                    face_records.append({
                        "event_id": event_id,
                        "image_url": preview_url or f"https://{os.environ.get('MEDIA_DOMAIN', 'media.evebash.com')}/{preview_key}",
                        "width": w,
                        "height": h,
                        "descriptor": embedding.tolist()
                    })

            # Atomic face replacement protected by token and asset_version
            supabase.rpc("replace_photo_faces", {
                "p_photo_id": photo_id,
                "p_token": token,
                "p_asset_version": asset_version,
                "p_faces": face_records
            }).execute()

            duration = time.time() - start_time
            cpu_cores = 1.0
            memory_gb = 2.0
            rate_per_sec = (cpu_cores * 0.0000131) + (memory_gb * 0.00000222)
            cost_inr = duration * rate_per_sec * 100.0

            try:
                log_payload = {
                    "photo_id": photo_id,
                    "event_id": event_id,
                    "function_name": "FaceIndexer.process",
                    "worker_type": "Modal Face Worker (1 vCPU • 2GB RAM)",
                    "media_type": "photo",
                    "media_size": len(img_bytes),
                    "cpu_cores": cpu_cores,
                    "memory_gb": memory_gb,
                    "gpu_type": "None",
                    "execution_time_seconds": duration,
                    "estimated_cost_inr": cost_inr,
                    "faces_detected": len(face_records)
                }
                if user_id:
                    log_payload["user_id"] = user_id
                supabase.table("modal_cost_logs").insert(log_payload).execute()
            except Exception as log_err:
                print(f"[{photo_id}] Face cost log failed: {log_err}")

            print(f"[{photo_id}] Face indexing finished: {len(face_records)} faces saved in {duration:.2f}s (₹{cost_inr:.5f})")
            return {"status": "success", "photo_id": photo_id, "faces": len(face_records)}

        except Exception as e:
            print(f"[{photo_id}] Face indexing error: {e}")
            try:
                supabase.table("photos").update({
                    "face_status": "failed",
                    "processing_error": str(e)[:1000]
                }).eq("id", photo_id).execute()
            except Exception:
                pass
            return {"status": "error", "photo_id": photo_id, "error": str(e)}


# ==============================================================================
# PHOTO PIPELINE V2: ONE WORKER FOR PREVIEW + FACES (issue #77)
# ==============================================================================
# Same work as process_photo_preview followed by FaceIndexer.process, in one container: the original is
# downloaded once, faces are found on the preview already in memory, only the 2 face models we use are
# loaded, containers idle 15 s and handle up to 4 photos at once. Measured 2026-10-13 on 40 real photos:
# 75% (bulk uploads) to 86% (guest uploads) cheaper, with identical faces.
#
# It sits behind a runtime switch (a Modal Dict, so no deploy and no .env line is needed to flip it).
# The default is "v1", today's two workers. process_photo_preview and FaceIndexer stay deployed and
# unchanged, and the 5-minute maintenance job keeps recovering stuck photos with them either way.
# modal_engine/photo_pipeline_switch.py shows and sets the switch:
#   mode       "v1" (default) or "v2" for every photo
#   v2_events  gallery ids that use v2 while mode is "v1", for testing on one gallery

PHOTO_PIPELINE_SWITCH = "photo-pipeline-switch"


def _pick_photo_pipeline(event_id, mode, v2_events) -> str:
    if mode == "v2" or (event_id and event_id in (v2_events or [])):
        return "v2"
    return "v1"


def _read_photo_pipeline_switch():
    """Returns (mode, v2_events). If the switch can't be read, photos go to today's pipeline."""
    try:
        switch = modal.Dict.from_name(PHOTO_PIPELINE_SWITCH, create_if_missing=True)
        return switch.get("mode", "v1"), switch.get("v2_events", [])
    except Exception as err:
        print(f"[PhotoPipeline] Could not read the switch, using v1: {err}")
        return "v1", []


def _read_face_filter():
    """The junk-face filter for PhotoProcessorV2 (issue #101), from the switch's "face_filter" key:
    {"min_score": 0.5, "min_px": 24} drops faces the detector is unsure of or whose box is smaller than that
    on the 1600 px preview. Missing or unreadable = off, so every detected face is saved as before."""
    try:
        value = modal.Dict.from_name(PHOTO_PIPELINE_SWITCH, create_if_missing=True).get("face_filter")
        return value if isinstance(value, dict) else None
    except Exception as err:
        print(f"[PhotoV2] Could not read the face filter, saving every face: {err}")
        return None


GRID_SUFFIX = "-grid.webp"  # same name the backend deletes and the website grid loads


def _read_grid_setting():
    """The 1000 px grid image (issue #121), from the switch's "grid" key: "all" for every photo, or a list of
    gallery ids to test on. Missing or unreadable = off, so no grid image is made, as before."""
    try:
        value = modal.Dict.from_name(PHOTO_PIPELINE_SWITCH, create_if_missing=True).get("grid")
        return value if value == "all" or isinstance(value, list) else None
    except Exception as err:
        print(f"[PhotoV2] Could not read the grid switch, no grid image: {err}")
        return None


def _grid_on_for(event_id, setting) -> bool:
    return setting == "all" or (isinstance(setting, list) and bool(event_id) and event_id in setting)


def _make_grid_image(preview_img) -> bytes:
    """1000 px on the long side, WebP q75 (tested 2026-10-24 on 10 real photos: median 66 KB vs 128 KB for the
    1600 px preview). Made from the preview, as the thumbnail is."""
    from PIL import Image
    grid_img = preview_img.copy()
    grid_img.thumbnail((1000, 1000), Image.Resampling.LANCZOS)
    grid_buf = io.BytesIO()
    grid_img.save(grid_buf, format="WEBP", quality=75, method=4)
    return grid_buf.getvalue()


def _spawn_photo_job(item: dict, mode, v2_events):
    if _pick_photo_pipeline(item.get("event_id"), mode, v2_events) == "v2":
        PhotoProcessorV2().process.spawn(item)
    else:
        process_photo_preview.spawn(item)


def _spawn_face_job(item: dict, mode, v2_events):
    """Faces only (the preview is done): v2's face step for galleries on v2, else the old FaceIndexer."""
    if _pick_photo_pipeline(item.get("event_id"), mode, v2_events) == "v2":
        PhotoProcessorV2().index_faces.spawn(item)
    else:
        FaceIndexer().process.spawn(item)


def _load_two_model_face_app():
    """AuraFace with only the models whose output we save: detection (boxes + 5 key points, also used to
    align each face) and recognition (the 512 numbers). The pack's 3D landmark, 2D landmark and gender/age
    models run on every face otherwise, and nothing reads their results."""
    from insightface.app import FaceAnalysis
    face_app = FaceAnalysis(
        name="auraface",
        root="/root/.insightface",
        providers=["CPUExecutionProvider"],
        allowed_modules=["detection", "recognition"],
    )
    face_app.prepare(ctx_id=-1, det_size=(640, 640), det_thresh=0.25)
    return face_app


RAW_EXTENSIONS = (".cr3", ".cr2", ".crw", ".arw", ".srf", ".sr2", ".nef", ".nrw", ".dng", ".raf", ".orf",
                  ".rw2", ".pef", ".srw", ".3fr", ".iiq", ".rwl", ".x3f")


def _open_raw_photo(raw_bytes: bytes):
    """RAW camera files (Canon .CR3, Sony .ARW, Nikon .NEF, .DNG...): Pillow can't read them, so use the
    full-size JPEG the camera stores inside every RAW file (6000x4000 on the Canon and 7008x4672 on the Sony
    files tested 2026-10-22, found in ~0.01 s) instead of developing the sensor data. rawpy is imported here
    only, so JPEG photos load and cost the same as before."""
    import rawpy
    from PIL import Image

    with rawpy.imread(io.BytesIO(raw_bytes)) as raw:
        thumb = raw.extract_thumb()
        flip = raw.sizes.flip
    if thumb.format == rawpy.ThumbFormat.JPEG:
        img = Image.open(io.BytesIO(thumb.data))
        img.load()
    else:
        img = Image.fromarray(thumb.data)
    # The built-in JPEG is stored the way the sensor sees it. If it carries no rotation of its own, turn it
    # the way the camera was held (LibRaw's flip: 3 = 180°, 5 = 90° anticlockwise, 6 = 90° clockwise).
    if (img.getexif().get(274) or 1) == 1 and flip in (3, 5, 6):
        img = img.transpose({3: Image.Transpose.ROTATE_180, 5: Image.Transpose.ROTATE_90,
                             6: Image.Transpose.ROTATE_270}[flip])
    return img


def _media_domain() -> str:
    return (
        os.environ.get("MEDIA_DOMAIN")
        or os.environ.get("CLOUDFLARE_DOMAIN")
        or os.environ.get("NEXT_PUBLIC_MEDIA_DOMAIN")
        or "media.evebash.com"
    ).strip().replace("https://", "").replace("http://", "").rstrip("/")


def _db_execute(query):
    """Runs a Supabase call and, if the connection dropped (not a timeout), tries once more on a fresh
    connection. The job RPCs are safe to repeat: a retry of a call that did go through just returns False."""
    try:
        return query.execute()
    except Exception as err:
        if type(err).__name__ not in ("RemoteProtocolError", "ReadError", "WriteError", "ConnectError"):
            raise
        print(f"[PhotoV2] Database connection dropped ({err}); retrying once")
        return query.execute()


class _PhotoProgress:
    """Remembers which step a v2 photo is on. If the photo is still running after V2_SLOW_WARNING_SECONDS it prints
    the step, the time spent and where the worker's code is waiting, so a stalled photo shows its cause in the
    logs before the time limit stops it (2026-10-22: two photos stalled with nothing in the logs)."""

    def __init__(self, photo_id, photos_in_container):
        import threading
        import time
        self.photo_id, self.photos_in_container = photo_id, photos_in_container
        self.thread_id = threading.get_ident()
        self.started = self.step_started = time.time()
        self.current = "start"
        self.timer = threading.Timer(V2_SLOW_WARNING_SECONDS, self.warn)
        self.timer.daemon = True
        self.timer.start()

    def step(self, name):
        import time
        self.current, self.step_started = name, time.time()

    def warn(self):
        import sys
        import time
        import traceback
        frame = sys._current_frames().get(self.thread_id)
        where = "".join(traceback.format_stack(frame)[-4:]) if frame else "(thread not found)"
        now = time.time()
        print(f"[PhotoV2] SLOW [{self.photo_id}] still running after {now - self.started:.0f}s, "
              f"{now - self.step_started:.0f}s in step '{self.current}', {self.photos_in_container()} photos in this "
              f"container. Waiting at:\n{where}", flush=True)

    def stop(self):
        self.timer.cancel()


# A v2 photo normally takes 1-6 s. The worker gives up after V2_TIME_LIMIT_SECONDS, and its claim on the photo
# lasts V2_LEASE_SECONDS, so the maintenance job can retry a stuck photo ~2.5 min after it started instead of 5
# (it runs every 5 minutes). The lease must stay longer than the time limit, or two workers could hold one photo.
V2_TIME_LIMIT_SECONDS = 120
V2_LEASE_SECONDS = 150
V2_SLOW_WARNING_SECONDS = 60


def _process_photo_v2(photo_data: dict, face_app, supabase, b2_client, bucket_name: str, media_domain: str, photos_in_container=lambda: 1, face_filter=None, on_step=lambda step: None, make_grid=False):
    """
    One photo start to finish, making the same database calls in the same order as process_photo_preview
    followed by FaceIndexer.process: claim_media_job, complete_media_job (the photo shows in the gallery),
    claim_face_job, replace_photo_faces. Clients are passed in so the pre-deploy test can run it with fakes.
    """
    import time
    import uuid
    import numpy as np
    import cv2
    from PIL import Image, ImageOps

    start_time = time.time()
    sharing_at_start = photos_in_container()
    photo_id = photo_data.get("id") or photo_data.get("photo_id")
    asset_version = int(photo_data.get("asset_version") or 1)
    storage_key = photo_data.get("storage_key") or photo_data.get("object_key")
    event_id = photo_data.get("event_id")
    user_id = photo_data.get("user_id")

    if not photo_id or not storage_key:
        print(f"[PhotoV2] Missing required parameters: photo_id={photo_id}, storage_key={storage_key}")
        return {"status": "error", "error": "Missing photo_id or storage_key"}

    # ---- Preview and thumbnail (as process_photo_preview) ----
    media_token = str(uuid.uuid4())
    on_step("claim_media_job")
    claimed = _db_execute(supabase.rpc("claim_media_job", {
        "p_photo_id": photo_id,
        "p_token": media_token,
        "p_asset_version": asset_version,
        "p_lease_duration_seconds": V2_LEASE_SECONDS
    }))
    if not claimed.data:
        print(f"[{photo_id}] Media job already claimed or exceeded max retries. Skipping.")
        return {"status": "skipped", "photo_id": photo_id}

    try:
        on_step("download original")
        resp = b2_client.get_object(Bucket=bucket_name, Key=storage_key)
        raw_bytes = resp['Body'].read()
        original_size = len(raw_bytes)

        on_step("make preview and thumbnail")
        Image.MAX_IMAGE_PIXELS = 100_000_000
        if storage_key.lower().endswith(RAW_EXTENSIONS):
            pil_img = _open_raw_photo(raw_bytes)
        else:
            pil_img = Image.open(io.BytesIO(raw_bytes))
            pil_img.load()  # full-size decode, as today (also stops thumbnail() from using JPEG draft mode)
        del raw_bytes
        try:
            pil_img = ImageOps.exif_transpose(pil_img)
        except Exception:
            pass
        if pil_img.mode != "RGB":
            pil_img = pil_img.convert("RGB")
        orig_w, orig_h = pil_img.size

        # Resized in place rather than from a copy: the image is already fully decoded, so the output is the
        # same as today's, and it saves a full-size copy while up to 4 photos share the container's memory.
        preview_img = pil_img
        preview_img.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
        preview_buf = io.BytesIO()
        preview_img.save(preview_buf, format="WEBP", quality=70, method=4)
        preview_bytes = preview_buf.getvalue()

        # Thumbnail from the 1600 px preview instead of the full image (tested 2026-10-13; looks the same)
        thumb_img = preview_img.copy()
        thumb_img.thumbnail((480, 480), Image.Resampling.LANCZOS)
        thumb_buf = io.BytesIO()
        thumb_img.save(thumb_buf, format="WEBP", quality=68, method=4)
        thumb_bytes = thumb_buf.getvalue()

        # Grid image (issue #121), also from the preview, for the website grid on big screens; only when the
        # switch's "grid" key covers this gallery
        grid_bytes = _make_grid_image(preview_img) if make_grid else b""
        del pil_img, preview_img, thumb_img

        preview_key = f"{storage_key}-preview.webp"
        thumb_key = f"{storage_key}-thumbnail.webp"
        on_step("upload preview and thumbnail")
        b2_client.put_object(Bucket=bucket_name, Key=preview_key, Body=preview_bytes, ContentType="image/webp")
        b2_client.put_object(Bucket=bucket_name, Key=thumb_key, Body=thumb_bytes, ContentType="image/webp")
        if grid_bytes:
            b2_client.put_object(Bucket=bucket_name, Key=f"{storage_key}{GRID_SUFFIX}", Body=grid_bytes, ContentType="image/webp")

        preview_url = f"https://{media_domain}/{preview_key}"
        thumbnail_url = f"https://{media_domain}/{thumb_key}"

        on_step("complete_media_job")
        _db_execute(supabase.rpc("complete_media_job", {
            "p_photo_id": photo_id,
            "p_token": media_token,
            "p_asset_version": asset_version,
            "p_thumbnail_url": thumbnail_url,
            "p_preview_url": preview_url,
            "p_width": orig_w,
            "p_height": orig_h,
            "p_overhead_size": len(preview_bytes) + len(thumb_bytes) + len(grid_bytes)
        }))
        preview_seconds = time.time() - start_time
        print(f"[{photo_id}] Preview ready in {preview_seconds:.2f}s. Photo is now live in gallery.")

    except Exception as e:
        print(f"[{photo_id}] Fast Preview generation failed: {e}")
        failed_update = {
            "media_status": "failed",
            "processing_error": str(e)[:1000]
        }
        error_code = (getattr(e, "response", None) or {}).get("Error", {}).get("Code")
        if error_code in ("NoSuchKey", "404"):
            # The original isn't in B2, so retrying can't succeed; use up the attempts now
            failed_update["media_attempt"] = 3
        try:
            _db_execute(supabase.table("photos").update(failed_update).eq("id", photo_id))
        except Exception:
            pass
        return {"status": "error", "photo_id": photo_id, "error": str(e)}

    # ---- Faces (as FaceIndexer.process, on the preview already in memory) ----
    return _save_faces_v2(photo_id, asset_version, event_id, user_id, preview_url, lambda: preview_bytes, face_app,
                          supabase, start_time, sharing_at_start, photos_in_container, original_size, face_filter,
                          on_step)

def _index_faces_v2(photo_data: dict, face_app, supabase, b2_client, bucket_name: str, media_domain: str,
                    photos_in_container=lambda: 1, face_filter=None, on_step=lambda step: None):
    """Faces only, for a photo whose preview is already in B2 (the maintenance job's retries of stuck or failed
    face jobs, which went to the old FaceIndexer before). Same models, filter and database calls as v2's face
    step; reads the saved preview instead of making one."""
    import time
    start_time = time.time()
    photo_id = photo_data.get("id") or photo_data.get("photo_id")
    asset_version = int(photo_data.get("asset_version") or 1)
    storage_key = photo_data.get("storage_key") or photo_data.get("object_key")
    if not photo_id or not storage_key:
        print(f"[PhotoV2] Missing required parameters: photo_id={photo_id}, storage_key={storage_key}")
        return {"status": "error", "error": "Missing photo_id or storage_key"}
    preview_key = f"{storage_key}-preview.webp"
    preview_url = photo_data.get("preview_url") or f"https://{media_domain}/{preview_key}"

    def load_preview():
        on_step("download preview")
        return b2_client.get_object(Bucket=bucket_name, Key=preview_key)["Body"].read()

    return _save_faces_v2(photo_id, asset_version, photo_data.get("event_id"), photo_data.get("user_id"), preview_url,
                          load_preview, face_app, supabase, start_time, photos_in_container(), photos_in_container,
                          None, face_filter, on_step, function_name="index_faces_v2",
                          finished_label="Photo v2 faces finished: ")


def _save_faces_v2(photo_id, asset_version, event_id, user_id, preview_url, load_preview, face_app, supabase,
                   start_time, sharing_at_start, photos_in_container, original_size, face_filter, on_step,
                   function_name="process_photo_v2", finished_label="Photo v2 finished: preview + "):
    """v2's face step (claim_face_job, find faces on the 1600 px preview, replace_photo_faces, one cost-log row).
    Used right after the preview in _process_photo_v2, and on its own by _index_faces_v2 when the maintenance
    job retries a photo whose preview is done but whose faces are not."""
    import time
    import uuid
    import numpy as np
    import cv2
    from PIL import Image

    face_token = str(uuid.uuid4())
    on_step("claim_face_job")
    claimed = _db_execute(supabase.rpc("claim_face_job", {
        "p_photo_id": photo_id,
        "p_token": face_token,
        "p_asset_version": asset_version,
        "p_lease_duration_seconds": V2_LEASE_SECONDS
    }))
    if not claimed.data:
        print(f"[{photo_id}] Face indexing job already claimed or max attempts reached.")
        return {"status": "success", "photo_id": photo_id, "preview_url": preview_url, "faces": None}

    try:
        preview_bytes = load_preview()
        # Decoding the WebP bytes, not using the resized image directly, gives the face model exactly the
        # pixels FaceIndexer gets when it downloads the preview, so faces match today's
        face_img = Image.open(io.BytesIO(preview_bytes))
        if face_img.mode != "RGB":
            face_img = face_img.convert("RGB")
        img_bgr = cv2.cvtColor(np.array(face_img), cv2.COLOR_RGB2BGR)
        h, w, _ = img_bgr.shape

        on_step("find faces")
        faces = face_app.get(img_bgr)
        face_records = []
        min_score = (face_filter or {}).get("min_score")
        min_px = (face_filter or {}).get("min_px")
        skipped = 0
        for face in faces:
            embedding = face.normed_embedding
            if embedding is not None and (min_score is not None and float(face.det_score) < min_score
                                          or min_px is not None and min(face.bbox[2] - face.bbox[0], face.bbox[3] - face.bbox[1]) < min_px):
                # Blurry, hidden or tiny faces: their numbers are unreliable and caused false Find You matches
                # (measured 2026-10-22 on 796 previews: 22.5% of faces, 0.1% of matches, mostly wrong ones)
                skipped += 1
            elif embedding is not None:
                face_records.append({
                    "event_id": event_id,
                    "image_url": preview_url,
                    "width": w,
                    "height": h,
                    "descriptor": embedding.tolist()
                })

        on_step("replace_photo_faces")
        _db_execute(supabase.rpc("replace_photo_faces", {
            "p_photo_id": photo_id,
            "p_token": face_token,
            "p_asset_version": asset_version,
            "p_faces": face_records
        }))

        # One cost-log row for both steps. Photos running at the same time share the container, so each is
        # charged its share of the time.
        duration = time.time() - start_time
        sharing = max(1.0, (sharing_at_start + photos_in_container()) / 2)
        cpu_cores = 1.0
        memory_gb = 2.0
        rate_per_sec = (cpu_cores * 0.0000131) + (memory_gb * 0.00000222)
        cost_inr = duration / sharing * rate_per_sec * 100.0
        on_step("cost log")
        try:
            log_payload = {
                "photo_id": photo_id,
                "event_id": event_id,
                "function_name": function_name,
                "worker_type": "Modal Photo Worker v2 (1 vCPU • 2GB RAM • up to 4 photos)",
                "media_type": "photo",
                "media_size": original_size,
                "cpu_cores": cpu_cores,
                "memory_gb": memory_gb,
                "gpu_type": "None",
                "execution_time_seconds": duration,
                "estimated_cost_inr": cost_inr,
                "faces_detected": len(face_records)
            }
            if user_id:
                log_payload["user_id"] = user_id
            supabase.table("modal_cost_logs").insert(log_payload).execute()
        except Exception as log_err:
            print(f"[{photo_id}] Cost logging failed: {log_err}")

        skipped_note = f", {skipped} unclear faces skipped" if skipped else ""
        print(f"[{photo_id}] {finished_label}{len(face_records)} faces{skipped_note} in {duration:.2f}s (₹{cost_inr:.5f})")
        return {"status": "success", "photo_id": photo_id, "preview_url": preview_url, "faces": len(face_records)}

    except Exception as e:
        # The preview is already live; only the faces failed, and the maintenance job retries just the faces
        print(f"[{photo_id}] Face indexing error: {e}")
        try:
            _db_execute(supabase.table("photos").update({
                "face_status": "failed",
                "processing_error": str(e)[:1000]
            }).eq("id", photo_id))
        except Exception:
            pass
        return {"status": "error", "photo_id": photo_id, "preview_url": preview_url, "error": str(e)}



@app.cls(
    image=photo_v2_image,
    cpu=1.0,
    memory=2048,
    max_containers=12,
    scaledown_window=15,
    retries=0,
    timeout=V2_TIME_LIMIT_SECONDS,
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
@modal.concurrent(max_inputs=4)
class PhotoProcessorV2:
    @modal.enter()
    def load_model(self):
        import threading
        self.face_app = _load_two_model_face_app()
        self._lock = threading.Lock()
        self._in_flight = 0
        self._face_filter, self._face_filter_read_at = None, 0.0
        self._grid, self._grid_read_at = None, 0.0
        print("[PhotoV2] AuraFace (detection + recognition) warm and ready.")

    def face_filter(self):
        """Read from the switch at most once a minute per container, so a change applies within a minute."""
        import time
        with self._lock:
            if time.time() - self._face_filter_read_at > 60:
                self._face_filter, self._face_filter_read_at = _read_face_filter(), time.time()
            return self._face_filter

    def grid_setting(self):
        """The switch's "grid" key, read at most once a minute per container, like the face filter."""
        import time
        with self._lock:
            if time.time() - self._grid_read_at > 60:
                self._grid, self._grid_read_at = _read_grid_setting(), time.time()
            return self._grid

    @modal.method()
    def process(self, photo_data: dict):
        return self._run(_process_photo_v2, photo_data,
                         make_grid=_grid_on_for(photo_data.get("event_id"), self.grid_setting()))

    @modal.method()
    def index_faces(self, photo_data: dict):
        """Faces only, for the maintenance job's retries (the preview is already done)."""
        return self._run(_index_faces_v2, photo_data)

    def _run(self, worker, photo_data: dict, **extra):
        import boto3
        from supabase import create_client, ClientOptions

        with self._lock:
            self._in_flight += 1
        progress = _PhotoProgress(photo_data.get("id") or photo_data.get("photo_id"), lambda: self._in_flight)
        try:
            # 20 s instead of the client's 120 s default, so a hanging database can't keep the container
            # (billed per second) waiting for minutes; the maintenance job retries the photo later
            supabase = create_client(
                os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
                os.environ.get("SUPABASE_SERVICE_ROLE_KEY"),
                options=ClientOptions(postgrest_client_timeout=20),
            )
            b2_client = boto3.client(
                's3',
                endpoint_url=f"https://{os.environ.get('B2_ENDPOINT')}",
                aws_access_key_id=os.environ.get('B2_KEY_ID'),
                aws_secret_access_key=os.environ.get('B2_APPLICATION_KEY')
            )
            return worker(
                photo_data, self.face_app, supabase, b2_client, os.environ.get('B2_BUCKET_NAME'),
                _media_domain(), photos_in_container=lambda: self._in_flight, face_filter=self.face_filter(),
                on_step=progress.step, **extra,
            )
        finally:
            progress.stop()
            with self._lock:
                self._in_flight -= 1


# ==============================================================================
# SELF-HEALING RECONCILER & OUTBOX DISPATCHER
# ==============================================================================

def _close_outbox_row_if_unrunnable(supabase, row: dict, photo: dict) -> bool:
    """
    Closes an outbox row whose worker would refuse it (claim_media_job / claim_face_job), so it isn't
    re-dispatched every minute forever. Returns True when the row was closed and must not be dispatched.
    """
    from datetime import datetime, timezone

    job_type = row.get("job_type")
    asset_version = int(row.get("asset_version") or 1)
    if job_type == "media_preview":
        status, attempts, done_status = photo.get("media_status"), int(photo.get("media_attempt") or 0), "ready"
    elif job_type == "face_index":
        status, attempts, done_status = photo.get("face_status"), int(photo.get("face_attempt") or 0), "indexed"
    else:
        return False

    now_iso = datetime.now(timezone.utc).isoformat()
    if int(photo.get("asset_version") or 1) != asset_version:
        update = {"status": "failed", "last_error": "Superseded by a newer asset version"}
    elif status == done_status:
        # Work already finished (e.g. a later save reset this row to 'pending')
        update = {"status": "published", "published_at": row.get("published_at") or now_iso}
    elif status == "failed" and attempts >= 3:
        update = {"status": "failed", "last_error": "Worker gave up after 3 attempts"}
    else:
        return False

    update.update({"lease_until": None, "updated_at": now_iso})
    try:
        supabase.table("processing_outbox").update(update).eq("id", row["id"]).execute()
    except Exception as err:
        # Fall back to dispatching as before
        print(f"[Outbox] Could not close {job_type} row for {photo.get('id')}: {err}")
        return False
    print(f"[Outbox] Closed {job_type} row for {photo.get('id')} as {update['status']} (worker would skip it)")
    return True


def sweep_stuck_jobs():
    """
    SELF-HEALING RECONCILER (every 5 minutes, inside run_media_maintenance).
    Recovers any stuck or orphaned jobs across both Fast Media and Face AI paths.
    """
    import os
    import time
    from datetime import datetime, timezone, timedelta
    from supabase import create_client, Client

    start_time = time.time()
    supabase: Client = create_client(
        os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    )
    now = datetime.now(timezone.utc)
    two_min_ago = (now - timedelta(minutes=2)).isoformat()
    five_min_ago = (now - timedelta(minutes=5)).isoformat()

    recovered_media = 0
    recovered_face = 0
    recovered_outbox = 0
    # Retries go to the same pipeline as new uploads (issue #77): v2 for galleries on v2
    mode, v2_events = _read_photo_pipeline_switch()

    # 1. Sweep stuck media jobs
    try:
        query = (
            supabase.table("photos")
            .select("id, storage_key, event_id, user_id, asset_version, media_status, media_lease_until")
            .in_("media_status", ["pending", "failed", "processing"])
            .lt("media_attempt", 3)
            .lte("uploaded_at", two_min_ago)
        )
        # Videos never get a media_status; without this they were sent to the photo worker 3 times
        query = query.eq("media_type", "photo")
        res = query.limit(100).execute()
        for p in (res.data or []):
            lease = p.get("media_lease_until")
            is_expired = lease is None or lease < now.isoformat()
            if p.get("media_status") in ["pending", "failed"] or is_expired:
                print(f"[Reconciler] Recovering stuck media job for photo: {p['id']}")
                _spawn_photo_job({
                    "id": p["id"],
                    "photo_id": p["id"],
                    "storage_key": p.get("storage_key"),
                    "event_id": p.get("event_id"),
                    "user_id": p.get("user_id"),
                    "asset_version": p.get("asset_version", 1)
                }, mode, v2_events)
                recovered_media += 1
    except Exception as err:
        print(f"[Reconciler] Media sweep error: {err}")

    # 2. Sweep stuck face jobs
    try:
        query = (
            supabase.table("photos")
            .select("id, storage_key, event_id, user_id, asset_version, preview_url, face_status, face_lease_until")
            .eq("media_status", "ready")
            .in_("face_status", ["pending", "failed", "indexing"])
            .lt("face_attempt", 3)
        )
        # Skip videos, and photos whose first face job (spawned by the preview worker) may still be on its way
        query = query.eq("media_type", "photo").lte("uploaded_at", two_min_ago)
        res = query.limit(100).execute()
        for p in (res.data or []):
            lease = p.get("face_lease_until")
            is_expired = lease is None or lease < now.isoformat()
            if p.get("face_status") in ["pending", "failed"] or is_expired:
                print(f"[Reconciler] Recovering stuck face job for photo: {p['id']}")
                _spawn_face_job({
                    "id": p["id"],
                    "photo_id": p["id"],
                    "storage_key": p.get("storage_key"),
                    "event_id": p.get("event_id"),
                    "user_id": p.get("user_id"),
                    "asset_version": p.get("asset_version", 1),
                    "preview_url": p.get("preview_url")
                }, mode, v2_events)
                recovered_face += 1
    except Exception as err:
        print(f"[Reconciler] Face sweep error: {err}")

    # 3. Stuck outbox rows: run_media_maintenance runs dispatch_outbox_jobs just before this, and it already
    # re-claims every pending row and expired lease, so a sweep here would only spawn duplicates.

    if recovered_media > 0 or recovered_face > 0 or recovered_outbox > 0:
        print(f"[Reconciler] Sweep complete: recovered {recovered_media} media, {recovered_face} face, {recovered_outbox} outbox jobs.")

    duration = time.time() - start_time
    cpu_cores = 0.125
    memory_gb = 0.75
    rate_per_sec = (cpu_cores * 0.0000131) + (memory_gb * 0.00000222)
    cost_inr = duration * rate_per_sec * 100.0

    if recovered_media > 0 or recovered_face > 0 or recovered_outbox > 0 or now.minute % 15 == 0:
        try:
            supabase.table("modal_cost_logs").insert({
                "function_name": "sweep_stuck_jobs",
                "worker_type": "Modal Watchdog Reconciler (0.125 vCPU • 768MB)",
                "media_type": "cron",
                "cpu_cores": cpu_cores,
                "memory_gb": memory_gb,
                "gpu_type": "None",
                "execution_time_seconds": duration,
                "estimated_cost_inr": cost_inr,
                "faces_detected": 0
            }).execute()
        except Exception as log_err:
            print(f"[Reconciler] Cost log notice: {log_err}")


def dispatch_outbox_jobs():
    """
    OUTBOX DISPATCHER (every 5 minutes, inside run_media_maintenance).
    Claims pending outbox rows atomically and dispatches them to their workers.
    """
    import os
    import time
    from datetime import datetime, timezone, timedelta
    from supabase import create_client, Client

    start_time = time.time()
    supabase: Client = create_client(
        os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    )

    claimed = supabase.rpc("claim_outbox_batch", {"p_batch_size": 50, "p_lease_seconds": 60}).execute()
    rows = claimed.data or []
    if not rows:
        now = datetime.now(timezone.utc)
        if now.minute % 15 == 0:
            duration = time.time() - start_time
            rate_per_sec = (0.125 * 0.0000131) + (0.75 * 0.00000222)
            try:
                supabase.table("modal_cost_logs").insert({
                    "function_name": "dispatch_outbox_jobs",
                    "worker_type": "Modal Outbox Dispatcher (0.125 vCPU • 768MB)",
                    "media_type": "cron",
                    "cpu_cores": 0.125,
                    "memory_gb": 0.75,
                    "gpu_type": "None",
                    "execution_time_seconds": duration,
                    "estimated_cost_inr": duration * rate_per_sec * 100.0,
                    "faces_detected": 0
                }).execute()
            except Exception:
                pass
        return {"dispatched": 0}

    dispatched = 0
    two_min_ago = datetime.now(timezone.utc) - timedelta(minutes=2)
    mode, v2_events = _read_photo_pipeline_switch()
    for row in rows:
        photo_id = row.get("photo_id")
        job_type = row.get("job_type")
        asset_ver = row.get("asset_version", 1)

        # Rows this new were just queued by the upload or the preview worker, and that job is most
        # likely still in flight. The claim lease expires and the next run checks the row again.
        try:
            if datetime.fromisoformat(row["created_at"]) > two_min_ago:
                continue
        except (KeyError, TypeError, ValueError):
            pass

        photo_res = supabase.table("photos").select("*").eq("id", photo_id).maybe_single().execute()
        photo = photo_res.data
        if not photo:
            continue
        if _close_outbox_row_if_unrunnable(supabase, row, photo):
            continue

        payload = {
            "id": photo["id"],
            "photo_id": photo["id"],
            "asset_version": asset_ver,
            "storage_key": photo.get("storage_key"),
            "event_id": photo.get("event_id"),
            "user_id": photo.get("user_id"),
            "preview_url": photo.get("preview_url"),
            "url": photo.get("url")
        }

        if job_type == "media_preview":
            _spawn_photo_job(payload, mode, v2_events)
            dispatched += 1
        elif job_type == "face_index":
            _spawn_face_job(payload, mode, v2_events)
            dispatched += 1

    print(f"[OutboxDispatcher] Dispatched {dispatched} queued jobs.")

    duration = time.time() - start_time
    cpu_cores = 0.125
    memory_gb = 0.75
    rate_per_sec = (cpu_cores * 0.0000131) + (memory_gb * 0.00000222)
    cost_inr = duration * rate_per_sec * 100.0

    try:
        supabase.table("modal_cost_logs").insert({
            "function_name": "dispatch_outbox_jobs",
            "worker_type": "Modal Outbox Dispatcher (0.125 vCPU • 768MB)",
            "media_type": "cron",
            "cpu_cores": cpu_cores,
            "memory_gb": memory_gb,
            "gpu_type": "None",
            "execution_time_seconds": duration,
            "estimated_cost_inr": cost_inr,
            "faces_detected": 0
        }).execute()
    except Exception as log_err:
        print(f"[OutboxDispatcher] Cost log notice: {log_err}")

    return {"dispatched": dispatched}


_maintenance_secrets = [modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]

# One container every 5 minutes instead of two every minute. QStash and the direct spawns are the
# main path; this only picks up jobs they dropped, so a few minutes of delay is fine.
@app.function(image=media_image, schedule=modal.Cron("*/5 * * * *"), scaledown_window=2, secrets=_maintenance_secrets)
def run_media_maintenance():
    for job in (dispatch_outbox_jobs, sweep_stuck_jobs):
        try:
            job()
        except Exception as err:
            print(f"[Maintenance] {job.__name__} failed: {err}")


def _find_matching_photos_core(request: dict):
    """
    Guest Selfie Matching endpoint.
    Accepts selfie_base64 + event_ids, returns matched photos.
    Uses AuraFace cosine similarity.
    """
    import time
    start_time = time.time()

    import base64
    import numpy as np
    import cv2
    from supabase import create_client, Client

    selfie_base64 = request.get("selfie_base64", "")
    event_ids     = request.get("event_ids", [])

    if not selfie_base64 or not event_ids:
        return {"error": "Missing selfie_base64 or event_ids", "matches": []}

    # Resolve primary event_id and user_id (event creator/photographer)
    user_id = request.get("user_id")
    event_id = None
    if event_ids:
        for candidate in event_ids:
            if candidate and isinstance(candidate, str) and candidate.strip():
                event_id = candidate.strip()
                break

    supabase: Client = create_client(
        os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    )

    if not user_id and event_ids:
        try:
            clean_ids = [str(eid).strip() for eid in event_ids if eid and str(eid).strip()]
            # 1. Try matching events table by id
            e_res = supabase.table("events").select("id, created_by").in_("id", clean_ids).limit(1).execute()
            if e_res and e_res.data and len(e_res.data) > 0:
                user_id = e_res.data[0].get("created_by")
                if e_res.data[0].get("id"):
                    event_id = e_res.data[0].get("id")
            else:
                # 2. Try matching by legacy_id
                e_res_leg = supabase.table("events").select("id, created_by").in_("legacy_id", clean_ids).limit(1).execute()
                if e_res_leg and e_res_leg.data and len(e_res_leg.data) > 0:
                    user_id = e_res_leg.data[0].get("created_by")
                    if e_res_leg.data[0].get("id"):
                        event_id = e_res_leg.data[0].get("id")
                else:
                    # 3. Try matching by title (slug fallback)
                    e_res_title = supabase.table("events").select("id, created_by").in_("title", clean_ids).limit(1).execute()
                    if e_res_title and e_res_title.data and len(e_res_title.data) > 0:
                        user_id = e_res_title.data[0].get("created_by")
                        if e_res_title.data[0].get("id"):
                            event_id = e_res_title.data[0].get("id")
        except Exception as lookup_err:
            print(f"[Selfie] Failed to lookup event owner: {lookup_err}")

    def log_selfie_cost(faces_detected_count: int):
        duration = time.time() - start_time
        cpu_cores = 0.125
        memory_gb = 1.0
        estimated_cost_inr = duration * ((cpu_cores * 0.00131) + (memory_gb * 0.000222))
        try:
            log_p = {
                "function_name":           "find_matching_photos",
                "worker_type":             "Modal Selfie Worker (0.125 vCPU • 1GB RAM)",
                "media_type":              "selfie",
                "media_size":              len(selfie_bytes) if 'selfie_bytes' in locals() and selfie_bytes else None,
                "cpu_cores":               cpu_cores,
                "memory_gb":               memory_gb,
                "gpu_type":                "None",
                "execution_time_seconds":  duration,
                "estimated_cost_inr":      estimated_cost_inr,
                "faces_detected":          faces_detected_count
            }
            if user_id: log_p["user_id"] = user_id
            if event_id: log_p["event_id"] = event_id
            supabase.table("modal_cost_logs").insert(log_p).execute()
            print(f"[Selfie] Cost logged: {duration:.2f}s, ₹{estimated_cost_inr:.5f}, user_id={user_id}, event_id={event_id}")
        except Exception as log_err:
            print(f"[Selfie] Cost log failed: {log_err}")

    try:
        # ── 1. Decode and load selfie ────────────────────────────────────
        selfie_bytes = base64.b64decode(selfie_base64)
        nparr = np.frombuffer(selfie_bytes, np.uint8)
        selfie_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if selfie_bgr is None:
            raise ValueError("cv2 failed to decode selfie image bytes")
            
        print(f"[Selfie] Loaded selfie: {selfie_bgr.shape}")

        # Retrieve the global in-memory selfie model instance
        face_analysis = get_selfie_model()
        
        selfie_faces = face_analysis.get(selfie_bgr)
        if not selfie_faces:
            print("[Selfie] No face detected in selfie.")
            log_selfie_cost(0)
            return {"error": "No face detected in selfie", "matches": []}

        # Sort by box area descending to pick the closest/largest face
        sorted_faces = sorted(selfie_faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]), reverse=True)
        selfie_vec = sorted_faces[0].normed_embedding
        if selfie_vec is None:
            print("[Selfie] Failed to generate face vector.")
            log_selfie_cost(0)
            return {"error": "Failed to generate face vector", "matches": []}
            
        print("[Selfie] Embedding successfully generated.")

        # Threshold set to 0.40 (maximum recall for side profiles, group shots).
        THRESHOLD = 0.40

        # ── 3. Match inside the database (public.match_faces, pgvector) ──
        # Returns only the matching photos instead of downloading every descriptor (about 18 MB for
        # 1,751 faces). Falls back to comparing here if the function is missing or fails.
        matches, compared = None, 0
        try:
            rpc = supabase.rpc("match_faces", {
                "p_event_ids":   event_ids,
                "p_embedding":   [float(x) for x in selfie_vec],
                "p_threshold":   THRESHOLD,
            }).execute()
            result = rpc.data or {}
            compared = int(result.get("compared") or 0)
            matches = [{
                "id":       m.get("image_id"),
                "imageId":  m.get("image_id"),
                "imageUrl": m.get("image_url"),
                "width":    m.get("width"),
                "height":   m.get("height"),
            } for m in (result.get("matches") or [])]
            print(f"[Selfie] match_faces compared {compared} faces in the database.")
        except Exception as rpc_err:
            print(f"[Selfie] match_faces unavailable, comparing here instead: {rpc_err}")

        def compare_in_python():
            # Fallback: fetch every indexed face descriptor for these events and compare here.
            # Supabase returns at most 1,000 rows per request, so page through them (ordered by id so pages
            # don't overlap); a single request silently missed every face after the first 1,000.
            PAGE_SIZE = 1000
            db_faces = []
            while True:
                page = (
                    supabase.table("faces")
                    .select("id, image_id, descriptor, image_url, width, height")
                    .in_("event_id", event_ids)
                    .order("id")
                    .range(len(db_faces), len(db_faces) + PAGE_SIZE - 1)
                    .execute()
                ).data or []
                if not page:  # stop on an empty page, not a short one, in case the server's row cap is lower
                    break
                db_faces.extend(page)
            print(f"[Selfie] Fetched {len(db_faces)} indexed face records to compare.")

            # Cosine similarity matching
            matches_map = {}

            for face in db_faces:
                db_descriptor = face.get("descriptor")
                if not db_descriptor:
                    continue

                try:
                    if isinstance(db_descriptor, str):
                        import json
                        db_descriptor = json.loads(db_descriptor)

                    db_vec = np.array(db_descriptor, dtype=np.float32)

                    if len(db_vec) != 512:
                        print(f"[Match] Skipping old vector {face.get('id')} — incorrect dim ({len(db_vec)})")
                        continue

                    # Cosine similarity of L2-normalized vectors
                    cosine_sim = float(np.dot(selfie_vec, db_vec))

                    if cosine_sim >= THRESHOLD:
                        image_id = face.get("image_id")
                        if image_id not in matches_map or cosine_sim > matches_map[image_id]["sim"]:
                            matches_map[image_id] = {
                                "id":       image_id,
                                "imageId":  image_id,
                                "imageUrl": face.get("image_url"),
                                "width":    face.get("width"),
                                "height":   face.get("height"),
                                "sim":      cosine_sim
                            }
                except Exception as e:
                    print(f"[Match] Error on face {face.get('id')}: {e}")

            matches = []
            for m in matches_map.values():
                del m["sim"]
                matches.append(m)
            return matches, len(db_faces)

        if matches is None:
            matches, compared = compare_in_python()

        print(f"[Selfie] Returning {len(matches)} match(es).")
        
        # Log infrastructure cost
        log_selfie_cost(len(selfie_faces))

        return {
            "success": True,
            "matches": matches,
            "debug": {
                "indexedFacesCount": compared,
                "selfieDetected":    True,
                "matchesCount":      len(matches)
            }
        }

    except Exception as e:
        print(f"[find_matching_photos] Error: {e}")
        log_selfie_cost(0)
        return {"error": str(e), "matches": []}


def _find_you_secret_ok(provided: str) -> bool:
    """Same secret precedence as the backend's getInternalJobSecret (apps/backend/src/auth.ts)."""
    import hmac
    expected = (os.environ.get("INTERNAL_JOB_SECRET") or os.environ.get("CRON_SECRET") or os.environ.get("QSTASH_TOKEN") or "").strip()
    return bool(expected) and hmac.compare_digest((provided or "").strip().encode("utf-8"), expected.encode("utf-8"))


_find_you_secrets = [modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
# 2 cores for the selfie face detection (the default 0.125 core made each search take seconds longer).

@app.function(image=image, secrets=_find_you_secrets, cpu=2.0, memory=2048)
@modal.fastapi_endpoint(method="POST")
async def find_matching_photos(request: fastapi.Request):
    # The backend checks the caller's gallery access first; anything else calling this URL is refused
    import asyncio
    if not _find_you_secret_ok(request.headers.get("X-EveBash-Secret", "")):
        raise fastapi.HTTPException(status_code=401, detail="Unauthorized")
    try:
        body = await request.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        body = {}
    return await asyncio.to_thread(_find_matching_photos_core, body)


# ---------------------------------------------------------------------------
# Cloud Video Transcoding & HLS Manifest Assembly
# ---------------------------------------------------------------------------

transcode_image = (
    modal.Image.from_registry("jrottenberg/ffmpeg:7.0-nvidia2204", add_python="3.11")
    # jrottenberg/ffmpeg images have ENTRYPOINT ["ffmpeg"] which intercepts Modal's
    # `python -u worker.py` startup — FFmpeg sees `-u` as an unknown flag and crashes.
    # Clear it so Modal can launch its Python runtime normally.
    .dockerfile_commands(["ENTRYPOINT []", "CMD []"])
    .pip_install("boto3", "supabase", "fastapi[standard]")
)

# Issue #141: the GPU worker that takes every video format needs CUDA filters the image above lacks (scale_cuda
# with 10-bit input, tonemap_cuda, transpose_cuda). The Jellyfin project's ffmpeg build has them. Official
# release, pinned and checked against the SHA-256 GitHub publishes for it.
_JELLYFIN_FFMPEG_URL = ("https://github.com/jellyfin/jellyfin-ffmpeg/releases/download/v7.1.4-3/"
                        "jellyfin-ffmpeg_7.1.4-3_portable_linux64-gpl.tar.xz")
_JELLYFIN_FFMPEG_SHA256 = "cab9ff40a47e4232d231e4eb7e4e85fabfeec56c6905266bc94291fc0881f83f"
gpu_all_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("wget", "xz-utils", "ca-certificates")
    .run_commands(
        f"wget -q -O /tmp/jellyfin-ffmpeg.tar.xz {_JELLYFIN_FFMPEG_URL}",
        f"echo '{_JELLYFIN_FFMPEG_SHA256}  /tmp/jellyfin-ffmpeg.tar.xz' | sha256sum -c -",
        "mkdir -p /opt/jellyfin-ffmpeg && tar -xJf /tmp/jellyfin-ffmpeg.tar.xz -C /opt/jellyfin-ffmpeg && rm /tmp/jellyfin-ffmpeg.tar.xz",
        "ln -s /opt/jellyfin-ffmpeg/ffmpeg /usr/local/bin/ffmpeg && ln -s /opt/jellyfin-ffmpeg/ffprobe /usr/local/bin/ffprobe",
    )
    .pip_install("boto3", "supabase", "fastapi[standard]")
)

def _notify_video_processed(photo_id: str):
    """Tells the backend the video is playable so it can send the event owner's push. Best effort: never raises."""
    import json
    import urllib.request

    backend_url = (os.environ.get("BACKEND_API_URL") or "").strip().rstrip("/")
    # Same precedence as the backend's getInternalJobSecret (apps/backend/src/auth.ts)
    secret = (os.environ.get("INTERNAL_JOB_SECRET") or os.environ.get("CRON_SECRET") or os.environ.get("QSTASH_TOKEN") or "").strip()
    if not backend_url or not secret or not photo_id:
        return

    try:
        req = urllib.request.Request(
            f"{backend_url}/api/v1/media/internal/video-processed",
            data=json.dumps({"photoId": photo_id}).encode("utf-8"),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {secret}"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"[TranscodeVideo] Video-ready callback for {photo_id}: HTTP {resp.status}")
    except Exception as e:
        print(f"[TranscodeVideo] Video-ready callback failed for {photo_id} (non-fatal): {e}")

# ---------------------------------------------------------------------------
# Full-GPU transcode for long videos (issue #112)
# ---------------------------------------------------------------------------
# NVDEC decode -> scale_npp resize -> NVENC encode on an L4, so frames never leave the GPU. Measured
# 2026-10-24 (real Modal bill, 3 runs each, same quality): 48.7-min 1080p25 ₹19.2 vs ₹23.6 on the 16-core
# worker and 20% faster; 33-min 1080p60 ₹17.8 vs ₹18.3 but 12% slower (the L4's encoder is the limit at 60 fps);
# 10-min 4K and HEVC 60 fps 8-11% cheaper; 10-min portrait 4K 8% dearer. Those bills include the upload to B2
# (network egress, ₹2.4-10.9 per video, the same on both), which is free within the plan's 1 TiB/month. Compute
# alone: GPU ₹8.3 vs ₹12.7 on test_5. Short videos stay on the 4-core worker (cheapest for them).
#
# Behind a runtime switch (a Modal Dict, no deploy needed to flip it); modal_engine/video_gpu_switch.py
# shows and sets it:
#   mode        "off" (default: every long video on the 16-core worker, as before) or "on"
#   gpu_events  gallery ids whose long videos use the GPU while mode is "off", for testing on one gallery
#   gpu_wait_s  how long a video may wait for an L4 before it goes to the 16-core worker (default 180)
# Anything the GPU can't take (10-bit, 4:2:2, rotated phone videos, other codecs), any GPU ffmpeg error and any
# output whose length doesn't match the source go to the 16-core worker, which is unchanged.

VIDEO_GPU_SWITCH = "video-gpu-switch"
VIDEO_GPU_STARTS = "video-gpu-starts"  # function call id -> "gpu" (started) or "cpu" (gave up waiting)
_DEFAULT_GPU_WAIT_S = 180

# (name, max width, max height, bitrate, maxrate, bufsize): same ladder as the CPU command
_HLS_TIERS = [
    ("1080p", 1920, 1080, "4000k", "4500k", "8000k"),
    ("720p", 1280, 720, "2500k", "3000k", "5000k"),
    ("480p", 854, 480, "1000k", "1200k", "2000k"),
]


class _UseCpuWorker(Exception):
    """The GPU can't (or didn't) transcode this video: hand it to the 16-core worker instead."""


def _pick_long_video_worker(event_id, mode, gpu_events) -> str:
    if mode == "on" or (event_id and event_id in (gpu_events or [])):
        return "gpu"
    return "cpu"


async def _read_video_gpu_switch():
    """Returns (mode, gpu_events, gpu_wait_s, all_formats). If the switch can't be read, long videos go to the
    16-core worker."""
    try:
        switch = modal.Dict.from_name(VIDEO_GPU_SWITCH, create_if_missing=True)
        mode = await switch.get.aio("mode", "off")
        gpu_events = await switch.get.aio("gpu_events", [])
        wait_s = await switch.get.aio("gpu_wait_s", _DEFAULT_GPU_WAIT_S)
        all_formats = bool(await switch.get.aio("gpu_all_formats", False))
        return mode, gpu_events, float(wait_s), all_formats
    except Exception as err:
        print(f"[VideoGPU] Could not read the switch, using the 16-core worker: {err}")
        return "off", [], float(_DEFAULT_GPU_WAIT_S), False


def _gpu_decode_problem(stream: dict):
    """Why the full-GPU command can't take this video stream (ffprobe fields), or None if it can. Tested
    2026-10-24: scale_npp rejects the p010 frames NVDEC makes from 10-bit video, and turning a phone video's
    rotation flag on the GPU (transpose_npp) leaves a green strip along one edge, so both go to the CPU."""
    codec = stream.get("codec_name")
    pix_fmt = stream.get("pix_fmt")
    if codec not in ("h264", "hevc") or pix_fmt not in ("yuv420p", "yuvj420p"):
        return f"{codec} {pix_fmt} is not transcoded on the GPU"
    rotation = next((s["rotation"] for s in stream.get("side_data_list", []) if "rotation" in s), 0)
    if rotation and float(rotation) % 360:
        return f"rotated video ({rotation})"
    return None


def _full_gpu_ffmpeg_cmd(input_path, tmp_path, out_dirs, has_audio, gop="48"):
    """The full-GPU ffmpeg command: same tiers, bitrates, 6 s keyframes and HLS layout as the CPU command.
    The production image's ffmpeg has libnpp but no scale_cuda, so resizing uses scale_npp."""
    tiers = [t for t in _HLS_TIERS if t[0] in out_dirs]

    cmd = ["ffmpeg", "-y", "-hwaccel", "cuda", "-hwaccel_output_format", "cuda", "-i", input_path]
    filter_str = f"[0:v]split={len(tiers)}" + "".join(f"[v{i}]" for i in range(1, len(tiers) + 1)) + ";"
    for i, (_name, w, h, *_rates) in enumerate(tiers, start=1):
        filter_str += (f"[v{i}]scale_npp=w={w}:h={h}:force_original_aspect_ratio=decrease:force_divisible_by=2"
                       f":format=nv12:interp_algo=super[v{i}out];")
    cmd += ["-filter_complex", filter_str.rstrip(";")]

    var_stream_parts = []
    for m, (name, _w, _h, bitrate, maxrate, bufsize) in enumerate(tiers):
        cmd += ["-map", f"[v{m + 1}out]", f"-c:v:{m}", "h264_nvenc", "-preset", "p4", "-profile:v", "high",
                "-rc", "vbr", "-g", gop, "-no-scenecut", "1", "-forced-idr", "1",
                "-force_key_frames", "expr:gte(t,n_forced*6)",
                f"-b:v:{m}", bitrate, f"-maxrate:{m}", maxrate, f"-bufsize:{m}", bufsize]
        var_stream_parts.append(f"v:{m},agroup:audio,name:{name}" if has_audio else f"v:{m},name:{name}")
    if has_audio:
        cmd += ["-map", "0:a?", "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2"]
        var_stream_parts.insert(0, "a:0,agroup:audio,default:yes,name:audio")

    cmd += [
        "-f", "hls", "-hls_time", "6", "-hls_playlist_type", "vod",
        "-hls_flags", "independent_segments",
        "-hls_segment_filename", str(tmp_path / "%v/seg_%03d.ts"),
        "-master_pl_name", "master.m3u8",
        "-var_stream_map", " ".join(var_stream_parts),
        str(tmp_path / "%v/playlist.m3u8"),
    ]
    return cmd


def _hls_length_problem(tmp_path, out_dirs, source_seconds):
    """Checks every variant playlist covers the whole source (a GPU run that stops early can still exit 0)."""
    import re

    if not source_seconds:
        return None
    for out_dir in out_dirs:
        playlist = tmp_path / out_dir / "playlist.m3u8"
        if not playlist.exists():
            return f"{out_dir} playlist missing"
        seconds = sum(float(x) for x in re.findall(r"#EXTINF:([0-9.]+)", playlist.read_text()))
        if abs(seconds - source_seconds) > max(2.0, source_seconds * 0.01):
            return f"{out_dir} is {seconds:.1f}s long, source is {source_seconds:.1f}s"
    return None


# ---------------------------------------------------------------------------
# GPU worker for every video format (issue #141)
# ---------------------------------------------------------------------------
# With the switch's "gpu_all_formats" key on, long videos go to transcode_video_long_gpu_all (Jellyfin ffmpeg)
# instead of transcode_video_long_gpu, and it keeps every video on the L4 instead of handing 10-bit, HDR,
# rotated and other formats to the 16-core worker:
#   1. GPU path: NVDEC decode when the L4 can (8-bit H.264, 8/10-bit HEVC, VP9, AV1, MPEG-2; else the CPU decodes
#      and uploads), then on the GPU: turn by the rotation flag (transpose_cuda), HDR to SDR (tonemap_cuda),
#      10-bit to 8-bit and resize (scale_cuda), NVENC encode.
#   2. If that fails or comes out short: mixed path in the same container: CPU decode and filters (the same
#      8-bit/HDR conversion as the CPU workers), NVENC encode.
#   3. Only if both fail (or no L4 starts in time) does the video go to the 16-core worker, and every such
#      handoff is logged to modal_cost_logs as process_video_gpu_fallback with the reason (issue #129).

# (codec, pix_fmt) the L4's NVDEC decodes and scale_cuda/tonemap_cuda take as CUDA frames
_GPU_DECODE = {
    "h264": ("yuv420p", "yuvj420p"),
    "hevc": ("yuv420p", "yuvj420p", "yuv420p10le"),
    "vp9": ("yuv420p", "yuv420p10le"),
    "av1": ("yuv420p", "yuv420p10le"),
    "mpeg2video": ("yuv420p",),
}
# ffprobe rotation (display matrix, counter-clockwise degrees) -> transpose_cuda direction, the same turn the
# CPU path's automatic rotation makes (checked 2026-10-24)
_GPU_TURNS = {90: "cclock", -270: "cclock", -90: "clock", 270: "clock", 180: "reversal", -180: "reversal"}
_GPU_TONEMAP = "mobius"  # tested 2026-10-25: PQ vs the SDR original SSIM 0.970 (bt2390 0.954, hable 0.887)
_GPU_SCALER = "lanczos"


def _gpu_all_plan(stream: dict) -> dict:
    """How the GPU path handles this video stream (ffprobe fields)."""
    codec, pix_fmt = stream.get("codec_name"), stream.get("pix_fmt") or ""
    hdr = stream.get("color_transfer") in _HDR_TRANSFERS
    high_bit = any(x in pix_fmt for x in ("10", "12", "16")) or hdr
    rotation = next((d["rotation"] for d in stream.get("side_data_list", []) if "rotation" in d), 0)
    return {
        "gpu_decode": pix_fmt in _GPU_DECODE.get(codec, ()),
        "upload_format": "p010le" if high_bit else "nv12",
        "hdr": hdr,
        "turn": _GPU_TURNS.get(int(round(float(rotation or 0)))),
        "av1": codec == "av1",
    }


def _nvenc_tier_args(m, bitrate, maxrate, bufsize, gop="48"):
    """Same bitrates, 6 s keyframes and 8-bit High profile as the other workers' tiers."""
    return [f"-c:v:{m}", "h264_nvenc", "-preset", "p4", "-profile:v", "high", "-rc", "vbr",
            "-g", gop, "-no-scenecut", "1", "-forced-idr", "1",
            "-force_key_frames", "expr:gte(t,n_forced*6)",
            f"-b:v:{m}", bitrate, f"-maxrate:{m}", maxrate, f"-bufsize:{m}", bufsize]


def _hls_output_args(tmp_path, out_dirs, has_audio, tiers):
    var_stream_parts = [f"v:{m},agroup:audio,name:{name}" if has_audio else f"v:{m},name:{name}"
                        for m, (name, *_rest) in enumerate(tiers)]
    args = []
    if has_audio:
        args += ["-map", "0:a?", "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2"]
        var_stream_parts.insert(0, "a:0,agroup:audio,default:yes,name:audio")
    return args + [
        "-f", "hls", "-hls_time", "6", "-hls_playlist_type", "vod",
        "-hls_flags", "independent_segments",
        "-hls_segment_filename", str(tmp_path / "%v/seg_%03d.ts"),
        "-master_pl_name", "master.m3u8",
        "-var_stream_map", " ".join(var_stream_parts),
        str(tmp_path / "%v/playlist.m3u8"),
    ]


def _gpu_all_ffmpeg_cmd(input_path, tmp_path, out_dirs, has_audio, stream, gop="48"):
    """Step 1: everything after decoding runs on the L4 (and decoding too when NVDEC can)."""
    plan = _gpu_all_plan(stream)
    tiers = [t for t in _HLS_TIERS if t[0] in out_dirs]
    cmd = ["ffmpeg", "-y", "-noautorotate"]
    if plan["gpu_decode"]:
        cmd += ["-hwaccel", "cuda", "-hwaccel_output_format", "cuda"]
        if plan["av1"]:
            cmd += ["-c:v", "av1"]  # the native decoder uses NVDEC; libdav1d would decode on the CPU
        chain = ""
    else:
        cmd += ["-init_hw_device", "cuda=gpu", "-filter_hw_device", "gpu"]
        chain = f"format={plan['upload_format']},hwupload_cuda,"
    cmd += ["-i", input_path]
    if plan["turn"]:
        chain += f"transpose_cuda=dir={plan['turn']},"
    if plan["hdr"]:
        # Shrink to the largest tier first so the tone map runs on fewer pixels, then HDR -> 8-bit SDR
        chain += ("scale_cuda=w=1920:h=1080:force_original_aspect_ratio=decrease:force_divisible_by=2,"
                  f"tonemap_cuda=tonemap={_GPU_TONEMAP}:format=nv12:desat=0:p=bt709:t=bt709:m=bt709,")
    filter_str = f"[0:v]{chain}split={len(tiers)}" + "".join(f"[v{i}]" for i in range(1, len(tiers) + 1)) + ";"
    for i, (_name, w, h, *_rates) in enumerate(tiers, start=1):
        filter_str += (f"[v{i}]scale_cuda=w={w}:h={h}:force_original_aspect_ratio=decrease:force_divisible_by=2"
                       f":format=nv12:interp_algo={_GPU_SCALER}[v{i}out];")
    cmd += ["-filter_complex", filter_str.rstrip(";")]
    for m, (_name, _w, _h, bitrate, maxrate, bufsize) in enumerate(tiers):
        cmd += ["-map", f"[v{m + 1}out]"] + _nvenc_tier_args(m, bitrate, maxrate, bufsize, gop)
    return cmd + _hls_output_args(tmp_path, out_dirs, has_audio, tiers)


def _mixed_gpu_ffmpeg_cmd(input_path, tmp_path, out_dirs, has_audio, stream, gop="48"):
    """Step 2, still on the L4 container: the CPU decodes, turns and converts to 8-bit SDR (the same filters as
    the CPU workers), NVENC encodes."""
    tiers = [t for t in _HLS_TIERS if t[0] in out_dirs]
    prefix = _sdr_8bit_filter(stream)
    filter_str = f"[0:v]{prefix}split={len(tiers)}" + "".join(f"[v{i}]" for i in range(1, len(tiers) + 1)) + ";"
    for i, (_name, w, h, *_rates) in enumerate(tiers, start=1):
        filter_str += (f"[v{i}]scale=w={w}:h={h}:force_original_aspect_ratio=decrease,"
                       f"scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p[v{i}out];")
    cmd = ["ffmpeg", "-y", "-i", input_path, "-filter_complex", filter_str.rstrip(";")]
    for m, (_name, _w, _h, bitrate, maxrate, bufsize) in enumerate(tiers):
        cmd += ["-map", f"[v{m + 1}out]"] + _nvenc_tier_args(m, bitrate, maxrate, bufsize, gop)
    return cmd + _hls_output_args(tmp_path, out_dirs, has_audio, tiers)


def _clear_hls_dirs(tmp_path, out_dirs):
    """Removes a failed attempt's segments and playlists so the next attempt starts clean."""
    for out_dir in out_dirs:
        for f in (tmp_path / out_dir).glob("*"):
            f.unlink()
    (tmp_path / "master.m3u8").unlink(missing_ok=True)


def _log_gpu_fallback(payload: dict, reason: str, gpu_seconds: float):
    """Issue #129: one modal_cost_logs row per long video the L4 worker hands to the 16-core worker."""
    try:
        from supabase import create_client
        supabase = create_client(os.environ.get("NEXT_PUBLIC_SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))
        supabase.table("modal_cost_logs").insert({
            "photo_id": payload.get("photo_id") or payload.get("id"),
            "event_id": payload.get("event_id"),
            "function_name": "process_video_gpu_fallback",
            "worker_type": f"L4 -> 16-core: {reason}"[:250],
            "media_type": "video",
            "cpu_cores": 4.0,
            "memory_gb": 8.0,
            "gpu_type": "l4",
            "execution_time_seconds": gpu_seconds,
            "estimated_cost_inr": gpu_seconds * (4.0 * 0.00131 + 8.0 * 0.000222 + 0.0222),
            "faces_detected": 0,
        }).execute()
    except Exception as err:
        print(f"[VideoGPU] Could not log the handoff (non-fatal): {err}")


# ---------------------------------------------------------------------------
# 8-bit SDR output for every video (issue #118)
# ---------------------------------------------------------------------------
# libx264 keeps the source's pixel format, so a 10-bit source (iPhone HDR video, many cameras) became H.264
# High 10 and a 4:2:2 source High 4:2:2, which most phones can't decode. With the "sdr_8bit" key of the video
# switch on (modal_engine/video_gpu_switch.py sdr-8bit on), the CPU command converts them to 8-bit 4:2:0 before
# the tier split and tone-maps HDR (PQ / HLG) to normal colours. Sources that are already 8-bit 4:2:0 SDR get
# exactly the old command. Off (default) = the old command for every video.

_HDR_TRANSFERS = ("smpte2084", "arib-std-b67")


# ---------------------------------------------------------------------------
# Video probe that survives phone rotation flags (issue #119)
# ---------------------------------------------------------------------------
# The old probes read `ffprobe -show_entries stream=height -of csv`, which prints "1080," for a video with a
# rotation flag (most portrait phone videos). int() then failed and the shared fallback set has_audio=True and
# height 1080, so a rotated video WITHOUT audio failed ("Unable to map stream at a:0") and a small rotated video
# got an enlarged 1080p stream. With the "probe_v2" key of the video switch on (video_gpu_switch.py probe-v2 on),
# one JSON probe is used instead. Off (default) = the old probes.

def _read_probe_v2_switch() -> bool:
    try:
        return bool(modal.Dict.from_name(VIDEO_GPU_SWITCH, create_if_missing=True).get("probe_v2", False))
    except Exception as err:
        print(f"[TranscodeVideo] Could not read the probe switch, using the old probes: {err}")
        return False


def _video_basics_from_probe(probe: dict):
    """(has_audio, display height) from `ffprobe -show_entries stream=codec_type,width,height:stream_side_data=rotation
    -of json`. The height is the one the viewer sees: a video stored sideways with a 90-degree flag shows its stored
    width as height, the same as a video recorded upright. None when there is no video stream."""
    streams = probe.get("streams") or []
    has_audio = any(s.get("codec_type") == "audio" for s in streams)
    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    if not video or not video.get("height"):
        return has_audio, None
    rotation = next((float(d["rotation"]) for d in video.get("side_data_list", []) if "rotation" in d), 0)
    sideways = round(rotation) % 180 == 90
    return has_audio, int(video["width"] if sideways else video["height"])


def _read_sdr_8bit_switch() -> bool:
    try:
        return bool(modal.Dict.from_name(VIDEO_GPU_SWITCH, create_if_missing=True).get("sdr_8bit", False))
    except Exception as err:
        print(f"[TranscodeVideo] Could not read the 8-bit switch, keeping the source format: {err}")
        return False


def _sdr_8bit_filter(stream: dict) -> str:
    """Filters to put before the tier split so every tier is 8-bit 4:2:0 SDR ("" when the source already is).
    Tested 2026-10-24: mobius keeps normal-brightness colours (SSIM 0.99 vs the SDR original; hable 0.96, visibly
    darker) and still rolls off highlights. Tone mapping runs in float, so a source bigger than 1080p is first
    shrunk to the largest tier (15.7 s -> 3.4 s on a 15 s 4K clip); smaller sources are never enlarged."""
    if stream.get("color_transfer") in _HDR_TRANSFERS:
        shrink = ""
        if (stream.get("width") or 0) > 1920 or (stream.get("height") or 0) > 1080:
            shrink = "scale=w=1920:h=1080:force_original_aspect_ratio=decrease,"
        return (f"{shrink}zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=mobius:desat=0,"
                "zscale=t=bt709:m=bt709:r=tv,format=yuv420p,")
    if stream.get("pix_fmt") not in ("yuv420p", "yuvj420p"):
        return "format=yuv420p,"
    return ""


# ---------------------------------------------------------------------------
# Poster in normal colours and at most 1080p (issue #145)
# ---------------------------------------------------------------------------
# The poster was one frame of the original as it is, on every worker: an HDR video (iPhone HDR) gave a pale poster
# and a 4K video a 4K JPEG (2.6 MB for a portrait iPhone video). With the "poster_sdr" key of the video switch on
# (video_gpu_switch.py poster-sdr on), HDR is tone-mapped the same way as the streams and a source bigger than 1080p
# is shrunk. Off (default) = the old command.

def _read_poster_sdr_switch() -> bool:
    try:
        return bool(modal.Dict.from_name(VIDEO_GPU_SWITCH, create_if_missing=True).get("poster_sdr", False))
    except Exception as err:
        print(f"[TranscodeVideo] Could not read the poster switch, using the plain frame: {err}")
        return False


def _poster_filter(stream: dict) -> str:
    """-vf for the poster ("" = the frame as it is)."""
    if stream.get("color_transfer") in _HDR_TRANSFERS:
        return _sdr_8bit_filter(stream).rstrip(",")
    if (stream.get("width") or 0) > 1920 or (stream.get("height") or 0) > 1080:
        return "scale=w=1920:h=1080:force_original_aspect_ratio=decrease"
    return ""


# ---------------------------------------------------------------------------
# New video pipeline, step 1 (todos #15 and #16)
# ---------------------------------------------------------------------------
# Two keys of the video switch, each "off" (the default: as before), "test" (only galleries listed in the
# "hls_test_events" key) or "on" (every video). modal_engine/video_gpu_switch.py shows and sets them.
#   gop_6s        keyframe interval = 6 s of the video's own frames instead of 48 frames, on every worker.
#                 Keyframes are still forced at every 6 s mark, so the segments and their names don't change; the
#                 48-frame interval only added 2-4 extra keyframes inside every segment, which cost quality.
#                 Measured 2026-10-27 over full length on real footage: VMAF +0.1 to +1.5 on 1080p, +4 to +9 on
#                 iPhone HDR, no tier lower than before, every segment starts on a keyframe, tiers aligned.
#   upload_early  segments go up to B2 while ffmpeg is still encoding the rest. The variant playlists and
#                 master.m3u8 still go up only after the whole run passed its checks, master last, so a video
#                 never plays half-made. Measured: 10-20% less time per video.
_HLS_STEP1_KEYS = ("gop_6s", "upload_early")


def _read_hls_step1_switch(event_id):
    """Returns (gop_6s, upload_early) for this gallery. If the switch can't be read: (False, False), as before."""
    try:
        switch = modal.Dict.from_name(VIDEO_GPU_SWITCH, create_if_missing=True)
        in_test = bool(event_id) and event_id in (switch.get("hls_test_events", []) or [])
        values = [switch.get(key, "off") for key in _HLS_STEP1_KEYS]
        return tuple(v == "on" or (v == "test" and in_test) for v in values)
    except Exception as err:
        print(f"[TranscodeVideo] Could not read the step-1 switch, keeping the old settings: {err}")
        return False, False


def _gop_from_rates(*rates) -> str:
    """Frames in 6 s from the first readable ffprobe rate ("30000/1001", "60/1"), else "48" (the old value)."""
    for rate in rates:
        try:
            num, _, den = str(rate or "").partition("/")
            fps = float(num) / float(den or 1)
        except (ValueError, ZeroDivisionError):
            continue
        if 1 <= fps <= 240:
            return str(int(round(6 * fps)))
    return "48"


def _gop_frames(input_path) -> str:
    import json
    import subprocess

    try:
        probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                "stream=avg_frame_rate,r_frame_rate", "-of", "json", input_path],
                               capture_output=True, text=True)
        stream = (json.loads(probe.stdout or "{}").get("streams") or [{}])[0]
        return _gop_from_rates(stream.get("avg_frame_rate"), stream.get("r_frame_rate"))
    except Exception as err:
        print(f"[TranscodeVideo] Could not read the frame rate, keeping 48-frame keyframes: {err}")
        return "48"


def _finished_segments(out_dir):
    """Segments of one stream folder that ffmpeg has finished: every one except the highest-numbered, because ffmpeg
    only creates segment N+1 after it closed segment N (a VOD playlist is written only at the very end, so it can't
    tell). Sorted by number: seg_1000.ts comes after seg_999.ts."""
    import re

    numbered = []
    for path in out_dir.glob("seg_*.ts"):
        match = re.fullmatch(r"seg_(\d+)\.ts", path.name)
        if match:
            numbered.append((int(match.group(1)), path))
    numbered.sort()
    return [path for _n, path in numbered[:-1]]


class _EarlySegmentUploader:
    """While one ffmpeg run writes the streams, uploads every segment it has finished (upload_early). finish()
    returns the B2 keys that went up; a failed upload is simply left for the normal upload after ffmpeg."""

    def __init__(self, upload, tmp_path, out_dirs, hls_prefix, threads=8, every_s=2.0):
        import concurrent.futures
        import threading

        self.upload, self.tmp_path, self.out_dirs, self.hls_prefix = upload, tmp_path, out_dirs, hls_prefix
        self.every_s = every_s
        self.futures = {}
        self.executor = concurrent.futures.ThreadPoolExecutor(threads)
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._loop, daemon=True)

    def _scan(self):
        for out_dir in self.out_dirs:
            for path in _finished_segments(self.tmp_path / out_dir):
                key = f"{self.hls_prefix}/{out_dir}/{path.name}"
                if key not in self.futures:
                    self.futures[key] = self.executor.submit(self.upload, (path, key, "video/MP2T"))

    def _loop(self):
        while not self._stop.wait(self.every_s):
            try:
                self._scan()
            except Exception as err:  # never stop ffmpeg over this; the normal upload catches up
                print(f"[TranscodeVideo] Early upload scan failed: {err}")

    def start(self):
        self._thread.start()
        return self

    def finish(self) -> set:
        self._stop.set()
        self._thread.join()
        uploaded = set()
        for key, future in self.futures.items():
            try:
                future.result()
                uploaded.add(key)
            except Exception as err:
                print(f"[TranscodeVideo] Early upload of {key} failed, it goes up after ffmpeg: {err}")
        self.executor.shutdown()
        return uploaded


def _remove_hls_versions(b2_client, bucket_name, hls_prefix, keys, keep_latest_of=()):
    """Deletes every stored version of `keys` under hls_prefix, except the newest version of keys in keep_latest_of
    (a later attempt overwrote them). Plain deletes only hide a file in B2 and it stays billed. Never raises."""
    keys, keep = set(keys), set(keep_latest_of)
    if not keys:
        return 0
    try:
        doomed = []
        for page in b2_client.get_paginator("list_object_versions").paginate(Bucket=bucket_name, Prefix=f"{hls_prefix}/"):
            for v in page.get("Versions", []) + page.get("DeleteMarkers", []):
                if v["Key"] in keys and not (v["Key"] in keep and v.get("IsLatest")):
                    doomed.append({"Key": v["Key"], "VersionId": v["VersionId"]})
        for i in range(0, len(doomed), 1000):
            b2_client.delete_objects(Bucket=bucket_name, Delete={"Objects": doomed[i:i + 1000], "Quiet": True})
        return len(doomed)
    except Exception as err:
        print(f"[TranscodeVideo] Could not remove {len(keys)} left-over segments: {err}")
        return 0


def _transcode_video_core(request: dict, hardware="cpu", cpu_cores=4.0, memory_gb=None, function_name=None):
    import boto3
    import json
    import tempfile
    import pathlib
    import subprocess
    import time
    import concurrent.futures
    import fastapi
    from supabase import create_client, Client

    start_time = time.time()
    storage_key = request.get("storage_key") or request.get("object_key")
    photo_id = request.get("photo_id") or request.get("id")

    if not photo_id and storage_key:
        photo_id = storage_key.replace("/", "_")

    if not storage_key or not photo_id:
        raise fastapi.HTTPException(status_code=400, detail="Missing required storage_key or photo_id")

    supabase: Client = create_client(
        os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    )
    from botocore.config import Config
    endpoint = os.environ.get('B2_ENDPOINT')
    region = endpoint.split(".")[1] if endpoint and "." in endpoint else "us-east-005"

    b2_client = boto3.client(
        's3',
        endpoint_url=f"https://{endpoint}",
        aws_access_key_id=os.environ.get('B2_KEY_ID'),
        aws_secret_access_key=os.environ.get('B2_APPLICATION_KEY'),
        region_name=region,
        config=Config(signature_version='s3v4', max_pool_connections=30)
    )
    bucket_name = os.environ.get('B2_BUCKET_NAME')
    media_domain = (os.environ.get("MEDIA_DOMAIN") or "media.evebash.com").replace("https://", "").strip("/")

    hls_prefix = f"hls/{storage_key}"
    hls_master_url = f"https://{media_domain}/{hls_prefix}/master.m3u8"
    poster_url = f"https://{media_domain}/{hls_prefix}/poster.jpg"
    raw_url = f"https://{media_domain}/{storage_key}"

    print(f"[TranscodeVideo-{hardware.upper()}] Processing video {storage_key}")

    gop_6s, upload_early = _read_hls_step1_switch(request.get("event_id"))
    upload_early = upload_early and hardware in ("cpu", "gpu_full", "gpu_all")
    gop_6s = gop_6s and hardware in ("cpu", "gpu_full", "gpu_all")
    early = {"last": set(), "failed": set()}  # segments the last ffmpeg run / failed runs uploaded while encoding

    def upload_file_worker(args):
        file_path, s3_key, content_type = args
        b2_client.upload_file(
            str(file_path), bucket_name, s3_key,
            ExtraArgs={"ContentType": content_type, "CacheControl": "public, max-age=31536000, immutable"}
        )

    def run_ffmpeg(ffmpeg_cmd, out_dirs, tmp_path):
        """subprocess.run, plus (upload_early) the finished segments going up meanwhile."""
        if not upload_early:
            return subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
        early["failed"] |= early["last"]  # a run before this one didn't produce the final streams
        # A retry (e.g. the CPU workers' plain 8-bit retry) must not have the failed run's playlists read as its own
        _clear_hls_dirs(tmp_path, out_dirs)
        uploader = _EarlySegmentUploader(upload_file_worker, tmp_path, out_dirs, hls_prefix).start()
        try:
            return subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
        finally:
            early["last"] = uploader.finish()

    def remove_early_uploads_unless_live():
        """After a failed or handed-over run: delete what it uploaded early, unless the video is already playable
        (a re-run of a processed video only overwrote its segments)."""
        uploaded = early["last"] | early["failed"]
        if not uploaded:
            return
        try:
            row = supabase.table("photos").select("status").eq("id", photo_id).maybe_single().execute()
            if ((getattr(row, "data", None) if row is not None else None) or {}).get("status") == "processed":
                return
        except Exception as err:
            print(f"[TranscodeVideo-{hardware.upper()}] Keeping early uploads (status unknown): {err}")
            return
        removed = _remove_hls_versions(b2_client, bucket_name, hls_prefix, uploaded)
        print(f"[TranscodeVideo-{hardware.upper()}] Removed {removed} early-uploaded segment versions of a run that did not finish")

    try:
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = pathlib.Path(tmp_dir)
            raw_video_path = tmp_path / "input.mp4"
            poster_path = tmp_path / "poster.jpg"

            # 1. Download raw video from B2 to local NVMe SSD
            print(f"[TranscodeVideo-{hardware.upper()}] Downloading {storage_key} to local SSD...")
            b2_client.download_file(bucket_name, storage_key, str(raw_video_path))
            raw_size_mb = raw_video_path.stat().st_size // (1024 * 1024)
            print(f"[TranscodeVideo-{hardware.upper()}] Downloaded {raw_size_mb} MB in {time.time() - start_time:.1f}s")

            if raw_video_path.stat().st_size == 0:
                raise RuntimeError("Downloaded video file is 0 bytes.")

            input_path = str(raw_video_path)

            # 2. Check for audio stream and video height via local file
            has_audio = False
            src_height = 1080  # default
            try:
                probe_audio = subprocess.run([
                    "ffprobe", "-v", "error", "-select_streams", "a",
                    "-show_entries", "stream=index", "-of", "csv=p=0",
                    input_path
                ], capture_output=True, text=True)
                if probe_audio.stdout.strip():
                    has_audio = True

                probe_vid = subprocess.run([
                    "ffprobe", "-v", "error", "-select_streams", "v:0",
                    "-show_entries", "stream=height", "-of", "csv=p=0",
                    input_path
                ], capture_output=True, text=True)
                if probe_vid.stdout.strip():
                    src_height = int(probe_vid.stdout.strip())
            except Exception:
                has_audio = True
                src_height = 1080

            if _read_probe_v2_switch():
                try:
                    probe = subprocess.run([
                        "ffprobe", "-v", "error",
                        "-show_entries", "stream=codec_type,width,height:stream_side_data=rotation", "-of", "json",
                        input_path
                    ], capture_output=True, text=True)
                    probed_audio, probed_height = _video_basics_from_probe(json.loads(probe.stdout or "{}"))
                    if probed_height:
                        has_audio, src_height = probed_audio, probed_height
                    print(f"[TranscodeVideo-{hardware.upper()}] Probe: audio={has_audio}, height={src_height}")
                except Exception as err:
                    print(f"[TranscodeVideo-{hardware.upper()}] JSON probe failed, keeping the old values: {err}")

            video_duration_seconds = None
            try:
                probe_dur = subprocess.run([
                    "ffprobe", "-v", "error", "-show_entries", "format=duration",
                    "-of", "csv=p=0", input_path
                ], capture_output=True, text=True)
                if probe_dur.stdout.strip():
                    video_duration_seconds = float(probe_dur.stdout.strip())
            except Exception:
                pass
            if not video_duration_seconds and request.get("duration"):
                try:
                    video_duration_seconds = float(request.get("duration"))
                except Exception:
                    pass

            gop = _gop_frames(input_path) if gop_6s else "48"
            if gop_6s:
                print(f"[TranscodeVideo-{hardware.upper()}] Keyframe interval {gop} frames (6 s), upload while encoding: {upload_early}")

            # The GPU can't take every video: check before writing anything, so a video handed to the 16-core
            # worker doesn't get its poster written twice (issue #134: the older copy survived the delete)
            if hardware == "gpu_full":
                probe = subprocess.run([
                    "ffprobe", "-v", "error", "-select_streams", "v:0",
                    "-show_entries", "stream=codec_name,pix_fmt:stream_side_data=rotation", "-of", "json",
                    input_path
                ], capture_output=True, text=True)
                stream = (json.loads(probe.stdout or "{}").get("streams") or [{}])[0]
                problem = _gpu_decode_problem(stream)
                if problem:
                    raise _UseCpuWorker(problem)
            gpu_path = None  # which step made the streams on the all-formats GPU worker (issue #141)
            if hardware == "gpu_all":
                probe = subprocess.run([
                    "ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                    "stream=codec_name,pix_fmt,color_transfer,color_primaries,width,height:stream_side_data=rotation",
                    "-of", "json", input_path
                ], capture_output=True, text=True)
                stream = (json.loads(probe.stdout or "{}").get("streams") or [{}])[0]

            # 3. Extract poster.jpg from local file at 1.0s
            poster_cmd = ["ffmpeg", "-y", "-i", input_path, "-ss", "00:00:01", "-vframes", "1", "-q:v", "2", str(poster_path)]
            poster_vf = ""
            if _read_poster_sdr_switch():  # normal colours, at most 1080p (issue #145)
                probe = subprocess.run([
                    "ffprobe", "-v", "error", "-select_streams", "v:0",
                    "-show_entries", "stream=color_transfer,width,height", "-of", "json", input_path
                ], capture_output=True, text=True)
                poster_vf = _poster_filter((json.loads(probe.stdout or "{}").get("streams") or [{}])[0])
            if poster_vf:
                proc = subprocess.run(poster_cmd[:-1] + ["-vf", poster_vf, str(poster_path)], capture_output=True, text=True)
                if proc.returncode != 0 or not poster_path.exists() or poster_path.stat().st_size == 0:
                    # e.g. HDR without colour tags, which zscale can't convert: keep the old poster
                    print(f"[TranscodeVideo-{hardware.upper()}] Poster conversion failed, using the plain frame: {proc.stderr[-300:]}")
                    poster_vf = ""
            if not poster_vf:
                subprocess.run(poster_cmd, capture_output=True, text=True)

            if poster_path.exists() and poster_path.stat().st_size > 0:
                b2_client.upload_file(
                    str(poster_path),
                    bucket_name,
                    f"{hls_prefix}/poster.jpg",
                    ExtraArgs={
                        "ContentType": "image/jpeg",
                        "CacheControl": "public, max-age=604800, stale-while-revalidate=86400"
                    }
                )

            # 4. Single-Pass Multi-Output FFmpeg Generation
            # Dynamic tiers based on source height (Don't upscale)
            out_dirs = []
            if src_height >= 1080: out_dirs.append("1080p")
            if src_height >= 720:  out_dirs.append("720p")
            out_dirs.append("480p") # Always generate at least 480p
            
            if has_audio:
                out_dirs.append("audio")
                
            for out_dir in out_dirs:
                (tmp_path / out_dir).mkdir(parents=True, exist_ok=True)

            print(f"[TranscodeVideo-{hardware.upper()}] Starting single-pass multi-output FFmpeg...")

            if hardware == "gpu_full":
                proc = run_ffmpeg(_full_gpu_ffmpeg_cmd(input_path, tmp_path, out_dirs, has_audio, gop), out_dirs, tmp_path)
                if proc.returncode != 0:
                    raise _UseCpuWorker(f"GPU ffmpeg failed: {(proc.stderr or '')[-500:]}")
                problem = _hls_length_problem(tmp_path, out_dirs, video_duration_seconds)
                if problem:
                    raise _UseCpuWorker(f"GPU output incomplete: {problem}")

            if hardware == "gpu_all":
                failures = []
                attempts = [("GPU decode" if _gpu_all_plan(stream)["gpu_decode"] else "CPU decode", _gpu_all_ffmpeg_cmd, stream),
                            ("mixed (CPU filters)", _mixed_gpu_ffmpeg_cmd, stream)]
                if _gpu_all_plan(stream)["hdr"]:
                    # As on the CPU workers: HDR the CPU tone map can't read (e.g. no primaries tag) still gets an 8-bit stream
                    attempts.append(("mixed (plain 8-bit)", _mixed_gpu_ffmpeg_cmd, {**stream, "color_transfer": None}))
                for path_name, build, attempt_stream in attempts:
                    proc = run_ffmpeg(build(input_path, tmp_path, out_dirs, has_audio, attempt_stream, gop), out_dirs, tmp_path)
                    problem = (f"ffmpeg failed: {(proc.stderr or '')[-300:]}" if proc.returncode != 0
                               else _hls_length_problem(tmp_path, out_dirs, video_duration_seconds))
                    if not problem:
                        gpu_path = path_name
                        break
                    failures.append(f"{path_name}: {problem}")
                    print(f"[TranscodeVideo-GPU_ALL] {path_name} did not work: {problem}")
                    _clear_hls_dirs(tmp_path, out_dirs)
                if not gpu_path:
                    raise _UseCpuWorker(" | ".join(failures))
                print(f"[TranscodeVideo-GPU_ALL] Streams made by the {gpu_path} path")

            # 8-bit SDR output (issue #118): only with the switch on and a source that isn't 8-bit 4:2:0 SDR
            sdr_prefix = ""
            if hardware not in ("gpu_full", "gpu_all") and _read_sdr_8bit_switch():
                probe = subprocess.run([
                    "ffprobe", "-v", "error", "-select_streams", "v:0",
                    "-show_entries", "stream=pix_fmt,color_transfer,width,height", "-of", "json", input_path
                ], capture_output=True, text=True)
                sdr_prefix = _sdr_8bit_filter((json.loads(probe.stdout or "{}").get("streams") or [{}])[0])
                if sdr_prefix:
                    print(f"[TranscodeVideo-{hardware.upper()}] Converting to 8-bit SDR: {sdr_prefix.rstrip(',')}")

            cmd = ["ffmpeg", "-y", "-i", input_path]

            # Build filter complex dynamically
            split_count = len([d for d in out_dirs if d != "audio"])
            filter_str = f"[0:v]{sdr_prefix}split={split_count}" + "".join(f"[v{i+1}]" for i in range(split_count)) + ";"
                
            idx = 1
            if "1080p" in out_dirs:
                filter_str += f"[v{idx}]scale=w=1920:h=1080:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[v{idx}out];"
                idx += 1
                
            if "720p" in out_dirs:
                filter_str += f"[v{idx}]scale=w=1280:h=720:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[v{idx}out];"
                idx += 1
                
            if "480p" in out_dirs:
                filter_str += f"[v{idx}]scale=w=854:h=480:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[v{idx}out];"

            cmd += ["-filter_complex", filter_str.rstrip(";")]

            vcodec = "h264_nvenc" if hardware == "gpu" else "libx264"
            vpreset = "p4" if hardware == "gpu" else "veryfast"
            
            idx = 1
            map_idx = 0
            var_stream_parts = []
            
            # Codec settings injected into each map
            def add_video_map(out_name, bitrate, maxrate, bufsize):
                nonlocal cmd, idx, map_idx, var_stream_parts
                cmd += ["-map", f"[v{idx}out]", f"-c:v:{map_idx}", vcodec, "-preset", vpreset]
                if hardware == "gpu":
                    cmd += ["-cq", "28", "-force_key_frames", "expr:gte(t,n_forced*6)"]
                else:
                    cmd += ["-g", gop, "-keyint_min", gop, "-sc_threshold", "0", "-force_key_frames", "expr:gte(t,n_forced*6)"]
                cmd += [f"-b:v:{map_idx}", bitrate, f"-maxrate:{map_idx}", maxrate, f"-bufsize:{map_idx}", bufsize]
                if has_audio:
                    var_stream_parts.append(f"v:{map_idx},agroup:audio,name:{out_name}")
                else:
                    var_stream_parts.append(f"v:{map_idx},name:{out_name}")
                idx += 1
                map_idx += 1

            if "1080p" in out_dirs: add_video_map("1080p", "4000k", "4500k", "8000k")
            if "720p" in out_dirs: add_video_map("720p", "2500k", "3000k", "5000k")
            if "480p" in out_dirs: add_video_map("480p", "1000k", "1200k", "2000k")

            # Audio
            if has_audio:
                cmd += ["-map", "0:a?", "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2"]
                var_stream_parts.insert(0, "a:0,agroup:audio,default:yes,name:audio")

            var_stream = " ".join(var_stream_parts)

            # Global HLS Settings
            cmd += [
                "-f", "hls", "-hls_time", "6", "-hls_playlist_type", "vod",
                "-hls_flags", "independent_segments",
                "-hls_segment_filename", str(tmp_path / "%v/seg_%03d.ts"),
                "-master_pl_name", "master.m3u8",
                "-var_stream_map", var_stream,
                str(tmp_path / "%v/playlist.m3u8")
            ]

            if hardware not in ("gpu_full", "gpu_all"):  # the GPU run above already made the streams
                proc = run_ffmpeg(cmd, out_dirs, tmp_path)
                if proc.returncode != 0 and "tonemap" in sdr_prefix:
                    # zscale can't convert colours it can't identify (e.g. HDR without primaries tags):
                    # still give an 8-bit stream that plays, just without the tone map
                    print(f"[TranscodeVideo-{hardware.upper()}] HDR conversion failed, retrying as plain 8-bit: {proc.stderr[-300:]}")
                    fc = cmd.index("-filter_complex") + 1
                    cmd[fc] = cmd[fc].replace(sdr_prefix, "format=yuv420p,", 1)
                    proc = run_ffmpeg(cmd, out_dirs, tmp_path)

            # GPU Fallback to CPU if hardware acceleration fails
            if proc.returncode != 0 and hardware == "gpu":
                print(f"[TranscodeVideo-GPU] Hardware pipeline failed. Error: {proc.stderr[-500:]}")
                print(f"[TranscodeVideo-GPU] Falling back to CPU software pipeline...")
                
                # Rebuild cmd for CPU
                cmd = ["ffmpeg", "-y", "-i", input_path]
                
                filter_str = f"[0:v]split={split_count}" + "".join(f"[v{i+1}]" for i in range(split_count)) + ";"
                    
                idx = 1
                if "1080p" in out_dirs:
                    filter_str += f"[v{idx}]scale=w=1920:h=1080:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[v{idx}out];"
                    idx += 1
                if "720p" in out_dirs:
                    filter_str += f"[v{idx}]scale=w=1280:h=720:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[v{idx}out];"
                    idx += 1
                if "480p" in out_dirs:
                    filter_str += f"[v{idx}]scale=w=854:h=480:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[v{idx}out];"
                    
                cmd += ["-filter_complex", filter_str.rstrip(";")]
                
                idx = 1
                map_idx = 0
                def add_video_map_fallback(bitrate, maxrate, bufsize):
                    nonlocal cmd, idx, map_idx
                    cmd += ["-map", f"[v{idx}out]", f"-c:v:{map_idx}", "libx264", "-preset", "veryfast"]
                    cmd += ["-g", "48", "-keyint_min", "48", "-sc_threshold", "0", "-force_key_frames", "expr:gte(t,n_forced*6)"]
                    cmd += [f"-b:v:{map_idx}", bitrate, f"-maxrate:{map_idx}", maxrate, f"-bufsize:{map_idx}", bufsize]
                    idx += 1; map_idx += 1

                if "1080p" in out_dirs: add_video_map_fallback("4000k", "4500k", "8000k")
                if "720p" in out_dirs: add_video_map_fallback("2500k", "3000k", "5000k")
                if "480p" in out_dirs: add_video_map_fallback("1000k", "1200k", "2000k")

                if has_audio:
                    cmd += ["-map", "0:a?", "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2"]
                    
                cmd += [
                    "-f", "hls", "-hls_time", "6", "-hls_playlist_type", "vod",
                    "-hls_flags", "independent_segments",
                    "-hls_segment_filename", str(tmp_path / "%v/seg_%03d.ts"),
                    "-master_pl_name", "master.m3u8",
                    "-var_stream_map", var_stream,
                    str(tmp_path / "%v/playlist.m3u8")
                ]
                proc = subprocess.run(cmd, capture_output=True, text=True)

            if proc.returncode != 0:
                err = proc.stderr[-1000:] if proc.stderr else f"Exit code {proc.returncode}"
                raise RuntimeError(f"FFmpeg failed: {err}")

            # 5. Atomic Parallel Upload Fleet
            print(f"[TranscodeVideo-{hardware.upper()}] Transcode complete. Starting strict-order atomic B2 uploads...")

            # Phase 1: Upload all .ts chunks
            chunk_tasks = []
            for out_dir in out_dirs:
                res_path = tmp_path / out_dir
                for seg_path in res_path.glob("seg_*.ts"):
                    chunk_tasks.append((seg_path, f"{hls_prefix}/{out_dir}/{seg_path.name}", "video/MP2T"))
            final_segment_keys = {task[1] for task in chunk_tasks}
            if early["last"]:
                chunk_tasks = [task for task in chunk_tasks if task[1] not in early["last"]]
                print(f"[TranscodeVideo-{hardware.upper()}] -> {len(early['last'])} chunks already went up while encoding")

            print(f"[TranscodeVideo-{hardware.upper()}] -> Uploading {len(chunk_tasks)} video chunks...")
            with concurrent.futures.ThreadPoolExecutor(max_workers=30) as executor:
                list(executor.map(upload_file_worker, chunk_tasks))

            # Phase 2: Upload all Variant Playlists
            playlist_tasks = []
            for out_dir in out_dirs:
                pl_file = (tmp_path / out_dir) / "playlist.m3u8"
                if pl_file.exists():
                    playlist_tasks.append((pl_file, f"{hls_prefix}/{out_dir}/playlist.m3u8", "application/x-mpegURL"))
                    
            print(f"[TranscodeVideo-{hardware.upper()}] -> Uploading {len(playlist_tasks)} variant playlists...")
            with concurrent.futures.ThreadPoolExecutor(max_workers=30) as executor:
                list(executor.map(upload_file_worker, playlist_tasks))
                
            # Phase 3: Upload Master Playlist Last (Atomic swap)
            master_file = tmp_path / "master.m3u8"
            if not master_file.exists():
                raise RuntimeError("FFmpeg did not generate master.m3u8")
                
            print(f"[TranscodeVideo-{hardware.upper()}] -> Uploading master playlist (Atomic swap)...")
            b2_client.upload_file(
                str(master_file), bucket_name, f"{hls_prefix}/master.m3u8",
                ExtraArgs={"ContentType": "application/x-mpegURL", "CacheControl": "public, max-age=3600"}
            )

        if early["failed"]:
            # An earlier attempt of this run uploaded segments before it failed: drop the ones the final streams
            # don't use, and the old versions of the ones the final attempt overwrote
            removed = _remove_hls_versions(b2_client, bucket_name, hls_prefix, early["failed"],
                                           keep_latest_of=early["failed"] & final_segment_keys)
            print(f"[TranscodeVideo-{hardware.upper()}] Removed {removed} segment versions left by a failed attempt")

        # 6. Streaming copy size, from what is now in B2. It used to be summed from the temporary folder after
        # that folder had been deleted, so every video was saved with overhead_size 0 and its streaming copy
        # (often more than half the original's size) never counted toward the host's storage.
        total_hls_bytes = 0
        for page in b2_client.get_paginator("list_objects_v2").paginate(Bucket=bucket_name, Prefix=f"{hls_prefix}/"):
            total_hls_bytes += sum(obj["Size"] for obj in page.get("Contents", []))
        print(f"[TranscodeVideo-{hardware.upper()}] Calculated exact HLS streaming overhead: {total_hls_bytes} bytes (~{total_hls_bytes / (1024 * 1024):.2f} MB)")

        update_data = {
            "url": hls_master_url,
            "overhead_size": total_hls_bytes,
            "resource_type": "video",
            "media_type": "video",
            "status": "processed",
            "processing_error": None,
        }
        if video_duration_seconds:
            update_data["duration"] = round(video_duration_seconds, 2)
        # A retry must preserve a frame explicitly chosen by the video owner.
        # Atomic null check also protects a concurrent custom-thumbnail save.
        supabase.table("photos").update({"thumbnail_url": poster_url}).eq("id", photo_id).is_("thumbnail_url", "null").execute()
        saved = supabase.table("photos").update(update_data).eq("id", photo_id).execute()
        if not saved.data:
            # The video was deleted (or its upload cancelled) while it was being converted: the delete already
            # removed hls/<storage_key>/, but this run uploaded the streaming copy after that. Remove it again
            # so it isn't left in B2 with nothing pointing at it.
            removed = 0
            # Every version, not just the latest: a plain delete only hides a file in B2 and it stays billed
            for page in b2_client.get_paginator("list_object_versions").paginate(Bucket=bucket_name, Prefix=f"{hls_prefix}/"):
                keys = [{"Key": v["Key"], "VersionId": v["VersionId"]} for v in page.get("Versions", []) + page.get("DeleteMarkers", [])]
                if keys:
                    b2_client.delete_objects(Bucket=bucket_name, Delete={"Objects": keys, "Quiet": True})
                    removed += len(keys)
            print(f"[TranscodeVideo-{hardware.upper()}] Video {photo_id} was deleted during processing; removed {removed} streaming files.")
            return {"status": "cancelled", "photo_id": photo_id}
        _notify_video_processed(photo_id)

        # 7. Log infrastructure cost
        duration = time.time() - start_time
        memory_gb = memory_gb or (8.0 if hardware == "gpu" else 4.0)
        function_name = function_name or f"process_video_{hardware}"
        gpu_type = "l4" if hardware in ("gpu", "gpu_full", "gpu_all") else "None"
        gpu_cost_rate = 0.0222 if hardware in ("gpu", "gpu_full", "gpu_all") else 0.0
        estimated_cost_inr = duration * ((cpu_cores * 0.00131) + (memory_gb * 0.000222) + gpu_cost_rate)
        event_id = request.get("event_id")
        user_id = request.get("user_id")

        # Resolve user_id / event_id if missing or anonymous from request
        if (not user_id or user_id == "anonymous" or not event_id) and photo_id:
            try:
                p_res = supabase.table("photos").select("user_id, event_id").eq("id", photo_id).maybe_single().execute()
                if p_res and p_res.data:
                    p_user = p_res.data.get("user_id")
                    if not user_id and p_user and p_user != "anonymous":
                        user_id = p_user
                    if not event_id:
                        event_id = p_res.data.get("event_id")
            except Exception:
                pass

        # Gallery video transcode compute is always billed to the event owner (host/creator)
        if event_id:
            try:
                e_res = supabase.table("events").select("created_by").eq("id", event_id).maybe_single().execute()
                if e_res and e_res.data and e_res.data.get("created_by"):
                    user_id = e_res.data.get("created_by")
            except Exception:
                pass

        video_size = raw_video_path.stat().st_size if raw_video_path.exists() else None
        if hardware in ("gpu", "gpu_full", "gpu_all"):
            worker_desc = "Modal GPU Worker (NVIDIA L4 • 4 vCPU • 8GB RAM)"
            if gpu_path:
                worker_desc += f" • {gpu_path}"
        elif cpu_cores == 4.0:
            worker_desc = "Modal CPU Worker (4 vCPU • 4GB RAM)"
        else:
            worker_desc = f"Modal CPU Worker ({cpu_cores:g} cores • {memory_gb:g}GB RAM)"

        try:
            video_log_payload = {
                "photo_id":                photo_id,
                "event_id":                event_id,
                "function_name":           function_name,
                "worker_type":             worker_desc,
                "media_type":              "video",
                "media_size":              video_size,
                "video_duration_seconds":  video_duration_seconds,
                "cpu_cores":               cpu_cores,
                "memory_gb":               memory_gb,
                "gpu_type":                gpu_type,
                "execution_time_seconds":  duration,
                "estimated_cost_inr":      estimated_cost_inr,
                "faces_detected":          0
            }
            if user_id:
                video_log_payload["user_id"] = user_id

            try:
                supabase.table("modal_cost_logs").insert(video_log_payload).execute()
                print(f"[TranscodeVideo-{hardware.upper()}] Cost logged (full metadata): {duration:.2f}s, ₹{estimated_cost_inr:.5f}")
            except Exception as meta_err:
                print(f"[TranscodeVideo-{hardware.upper()}] Full metadata log failed ({meta_err}), attempting core schema fallback...")
                core_payload = {
                    "photo_id":                photo_id,
                    "event_id":                event_id,
                    "function_name":           function_name,
                    "cpu_cores":               cpu_cores,
                    "memory_gb":               memory_gb,
                    "gpu_type":                gpu_type,
                    "execution_time_seconds":  duration,
                    "estimated_cost_inr":      estimated_cost_inr,
                    "faces_detected":          0
                }
                if user_id:
                    core_payload["user_id"] = user_id
                supabase.table("modal_cost_logs").insert(core_payload).execute()
                print(f"[TranscodeVideo-{hardware.upper()}] Cost logged (core fallback): {duration:.2f}s, ₹{estimated_cost_inr:.5f}")
        except Exception as log_err:
            print(f"[TranscodeVideo-{hardware.upper()}] Cost log completely failed: {log_err}")

        print(f"[TranscodeVideo-{hardware.upper()}] completed in {duration:.1f}s")
        return {"status": "success", "hls_master_url": hls_master_url}

    except _UseCpuWorker:
        remove_early_uploads_unless_live()  # the 16-core worker makes and uploads every segment again
        raise  # not a failure: transcode_video_long_gpu hands the video to the 16-core worker
    except Exception as e:
        remove_early_uploads_unless_live()
        error_details = str(e)
        try:
            supabase.table("photos").update({"status": "failed", "processing_error": error_details[:1000]}).eq("id", photo_id).execute()
        except Exception:
            pass
        raise fastapi.HTTPException(status_code=500, detail=f"Transcoding failed: {error_details}")

_video_secrets = [modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]

# Long videos (> 10 min) run on 16 CPU cores instead of an L4: 1.6x faster and ~38% cheaper in the
# Oct 2026 benchmark (33-min 1080p60 video).
_long_video_resources = {
    "cpu": 16.0,
    "memory": 8192,
}

def _transcode_long(request: dict):
    return _transcode_video_core(request, hardware="cpu", cpu_cores=16.0, memory_gb=8.0, function_name="process_video_cpu_long")

def _transcode_short(request: dict):
    return _transcode_video_core(request, hardware="cpu")

# Issue #157 (burst of uploads): with the "queue_aware" key of the video switch on, Modal records on the photo row
# when a video's job was queued (transcode_queued_at: accepted from QStash, or handed from the GPU to the 16-core
# worker) and, while a worker runs it, a heartbeat every minute (transcode_heartbeat_at). The backend watchdog
# (VIDEO_WATCHDOG_QUEUE_AWARE=true) then leaves waiting and running videos alone instead of re-sending every video
# still processing 15 min after upload. A worker also skips a video whose row already points at this file's
# finished stream, so a re-sent copy that starts after the first run finished doesn't transcode it again.
# Off (the default): none of this runs. Needs supabase/migrations/20261027000000_video_transcode_heartbeat.sql;
# without it the writes fail, are logged once and ignored.
_TRANSCODE_HEARTBEAT_S = 60


def _read_queue_aware_switch() -> bool:
    try:
        return bool(modal.Dict.from_name(VIDEO_GPU_SWITCH, create_if_missing=True).get("queue_aware", False))
    except Exception as err:
        print(f"[TranscodeVideo] Could not read the queue-aware switch, keeping the old behaviour: {err}")
        return False


def _video_db():
    from supabase import create_client

    return create_client(os.environ.get("NEXT_PUBLIC_SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))


def _utc_now_iso() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()


def _mark_video_queued(photo_id):
    """Best effort: if it fails, the watchdog treats the video as it always has."""
    if not photo_id:
        return
    try:
        _video_db().table("photos").update({"transcode_queued_at": _utc_now_iso()}).eq("id", photo_id).eq("status", "processing").execute()
    except Exception as err:
        print(f"[TranscodeVideo] Could not record the queued time of {photo_id}: {err}")


def _video_already_done(photo_id, storage_key) -> bool:
    """True when the row is processed and already points at this file's stream. Any error: False (transcode)."""
    try:
        res = _video_db().table("photos").select("status, url").eq("id", photo_id).maybe_single().execute()
    except Exception as err:
        print(f"[TranscodeVideo] Could not check whether {photo_id} is already done: {err}")
        return False
    row = (getattr(res, "data", None) if res is not None else None) or {}
    return row.get("status") == "processed" and str(row.get("url") or "").endswith(f"/hls/{storage_key}/master.m3u8")


class _TranscodeHeartbeat:
    """Writes transcode_heartbeat_at now and every _TRANSCODE_HEARTBEAT_S seconds until the block ends."""

    def __init__(self, photo_id):
        self.photo_id = photo_id
        self._warned = False

    def _beat(self):
        try:
            self._db.table("photos").update({"transcode_heartbeat_at": _utc_now_iso()}).eq("id", self.photo_id).eq("status", "processing").execute()
        except Exception as err:
            if not self._warned:
                print(f"[TranscodeVideo] Heartbeat for {self.photo_id} failed (logged once): {err}")
                self._warned = True

    def _run(self):
        while not self._stop.wait(_TRANSCODE_HEARTBEAT_S):
            self._beat()

    def __enter__(self):
        import threading

        self._stop = threading.Event()
        try:
            self._db = _video_db()
        except Exception as err:
            print(f"[TranscodeVideo] No heartbeat for {self.photo_id}: {err}")
            self._thread = None
            return self
        self._beat()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        return self

    def __exit__(self, *exc):
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=5)
        return False


def _transcode_once(payload: dict, transcode):
    """
    Skips a second transcode of a video that is already being transcoded, e.g. when the backend
    watchdog re-queues a long video whose first run is still going.
    """
    import contextlib
    import time

    storage_key = payload.get("storage_key") or payload.get("object_key") or ""
    photo_id = payload.get("photo_id") or payload.get("id") or storage_key.replace("/", "_")
    locks = modal.Dict.from_name("video-transcode-locks", create_if_missing=True)
    now = time.time()
    if not locks.put(photo_id, now, skip_if_exists=True):
        if now - locks.get(photo_id, now) < 3600 + 120:
            print(f"[TranscodeVideo] {photo_id} is already being transcoded; skipping this copy")
            return {"status": "skipped", "photo_id": photo_id}
        locks[photo_id] = now  # older than the function timeout: its run died without releasing it
    try:
        queue_aware = _read_queue_aware_switch()
        if queue_aware and _video_already_done(photo_id, storage_key):
            print(f"[TranscodeVideo] {photo_id} is already transcoded (re-sent copy); skipping it")
            return {"status": "skipped", "photo_id": photo_id, "reason": "already processed"}
        with (_TranscodeHeartbeat(photo_id) if queue_aware else contextlib.nullcontext()):
            return transcode(payload)
    finally:
        try:
            locks.pop(photo_id, None)
        except Exception as err:
            print(f"[TranscodeVideo] Could not release lock for {photo_id}: {err}")

# QStash no longer retries a failed transcode (it only waits for the 202), so Modal does: same count
_video_retries = modal.Retries(max_retries=3, initial_delay=10.0, backoff_coefficient=2.0)

@app.function(
    image=transcode_image,
    cpu=4.0,
    memory=4096,
    timeout=3600,
    scaledown_window=10,
    retries=_video_retries,
    max_containers=10,
    secrets=_video_secrets,
)
def transcode_video_short(payload: dict):
    return _transcode_once(payload, _transcode_short)

@app.function(
    image=transcode_image,
    **_long_video_resources,
    timeout=3600,
    scaledown_window=10,
    retries=_video_retries,
    max_containers=5,
    secrets=_video_secrets,
)
def transcode_video_long(payload: dict):
    return _transcode_once(payload, _transcode_long)

def _transcode_long_gpu(request: dict):
    return _transcode_video_core(request, hardware="gpu_full", cpu_cores=4.0, memory_gb=8.0, function_name="process_video_gpu_long")

# Same CPU and memory as the 2026-10-18 benchmark worker
@app.function(
    image=transcode_image,
    gpu="L4",
    cpu=4.0,
    memory=8192,
    timeout=3600,
    scaledown_window=10,
    retries=_video_retries,
    max_containers=5,
    secrets=_video_secrets,
)
def transcode_video_long_gpu(payload: dict):
    import time

    starts = modal.Dict.from_name(VIDEO_GPU_STARTS, create_if_missing=True)
    call_id = modal.current_function_call_id()
    # A retry finds its own "gpu" mark; "cpu" means watch_gpu_start gave up waiting and the 16-core worker has it
    if not starts.put(call_id, "gpu", skip_if_exists=True) and starts.get(call_id) != "gpu":
        print(f"[VideoGPU] {payload.get('photo_id')} already went to the 16-core worker; skipping")
        return {"status": "skipped", "photo_id": payload.get("photo_id")}
    started = time.time()
    try:
        return _transcode_once(payload, _transcode_long_gpu)
    except _UseCpuWorker as err:
        print(f"[VideoGPU] {payload.get('photo_id')} -> 16-core worker: {err}")
        _log_gpu_fallback(payload, str(err), time.time() - started)
        transcode_video_long.spawn(payload)
        if _read_queue_aware_switch():
            _mark_video_queued(payload.get("photo_id") or payload.get("id"))
        return {"status": "sent_to_cpu", "photo_id": payload.get("photo_id"), "reason": str(err)[:300]}

def _transcode_long_gpu_all(request: dict):
    return _transcode_video_core(request, hardware="gpu_all", cpu_cores=4.0, memory_gb=8.0, function_name="process_video_gpu_long")

# Issue #141: the L4 worker for every video format (Jellyfin ffmpeg); same resources as transcode_video_long_gpu
@app.function(
    image=gpu_all_image,
    gpu="L4",
    cpu=4.0,
    memory=8192,
    timeout=3600,
    scaledown_window=10,
    retries=_video_retries,
    max_containers=5,
    secrets=_video_secrets,
)
def transcode_video_long_gpu_all(payload: dict):
    import time

    starts = modal.Dict.from_name(VIDEO_GPU_STARTS, create_if_missing=True)
    call_id = modal.current_function_call_id()
    if not starts.put(call_id, "gpu", skip_if_exists=True) and starts.get(call_id) != "gpu":
        print(f"[VideoGPU] {payload.get('photo_id')} already went to the 16-core worker; skipping")
        return {"status": "skipped", "photo_id": payload.get("photo_id")}
    started = time.time()
    try:
        return _transcode_once(payload, _transcode_long_gpu_all)
    except _UseCpuWorker as err:
        print(f"[VideoGPU] {payload.get('photo_id')} -> 16-core worker (both GPU steps failed): {err}")
        _log_gpu_fallback(payload, str(err), time.time() - started)
        transcode_video_long.spawn(payload)
        if _read_queue_aware_switch():
            _mark_video_queued(payload.get("photo_id") or payload.get("id"))
        return {"status": "sent_to_cpu", "photo_id": payload.get("photo_id"), "reason": str(err)[:300]}

@app.function(image=media_image, timeout=3600, secrets=_video_secrets)
def watch_gpu_start(call_id: str, payload: dict, wait_s: float):
    """Sends the video to the 16-core worker if no L4 has picked it up within wait_s seconds."""
    import time

    starts = modal.Dict.from_name(VIDEO_GPU_STARTS, create_if_missing=True)
    deadline = time.time() + wait_s
    while time.time() < deadline:
        if starts.get(call_id):
            return "gpu"
        time.sleep(5)
    if not starts.put(call_id, "cpu", skip_if_exists=True):
        return "gpu"  # started just now
    print(f"[VideoGPU] No L4 for {payload.get('photo_id')} after {wait_s:g}s; sending it to the 16-core worker")
    _log_gpu_fallback(payload, f"no L4 started within {wait_s:g}s", 0.0)
    # Best effort (a queued call can still start after cancel): if it does, it finds the "cpu" mark and skips
    modal.FunctionCall.from_id(call_id).cancel()
    transcode_video_long.spawn(payload)
    if _read_queue_aware_switch():
        _mark_video_queued(payload.get("photo_id") or payload.get("id"))
    return "cpu"

async def _accept_video_job(request, worker):
    """Checks the QStash signature, starts the transcode in the background and replies 202 at once."""
    import json
    from fastapi.responses import JSONResponse

    body = await request.body()
    verify_qstash_signature(body, request.headers.get("Upstash-Signature", ""), str(request.url))
    try:
        payload = json.loads(body.decode("utf-8")) if body else {}
    except ValueError:
        raise fastapi.HTTPException(status_code=400, detail="Body must be JSON")
    if not isinstance(payload, dict) or not (payload.get("storage_key") or payload.get("object_key")):
        raise fastapi.HTTPException(status_code=400, detail="Missing required storage_key or photo_id")
    if worker is transcode_video_long:
        mode, gpu_events, wait_s, all_formats = await _read_video_gpu_switch()
        if _pick_long_video_worker(payload.get("event_id"), mode, gpu_events) == "gpu":
            gpu_worker = transcode_video_long_gpu_all if all_formats else transcode_video_long_gpu
            call = await gpu_worker.spawn.aio(payload)
            await watch_gpu_start.spawn.aio(call.object_id, payload, wait_s)
            await _mark_queued_if_switch_on(payload)
            return JSONResponse({"accepted": True, "photo_id": payload.get("photo_id") or payload.get("id")}, status_code=202)
    await worker.spawn.aio(payload)
    await _mark_queued_if_switch_on(payload)
    return JSONResponse({"accepted": True, "photo_id": payload.get("photo_id") or payload.get("id")}, status_code=202)


async def _mark_queued_if_switch_on(payload: dict):
    """Issue #157: records that Modal accepted the job (queue_aware switch key only). Never raises."""
    import asyncio

    try:
        switch = modal.Dict.from_name(VIDEO_GPU_SWITCH, create_if_missing=True)
        if not bool(await switch.get.aio("queue_aware", False)):
            return
    except Exception as err:
        print(f"[TranscodeVideo] Could not read the queue-aware switch: {err}")
        return
    await asyncio.to_thread(_mark_video_queued, payload.get("photo_id") or payload.get("id"))

# Same names as before, so the backend's URLs don't change
@app.function(image=media_image, secrets=_video_secrets)
@modal.concurrent(max_inputs=20)
@modal.fastapi_endpoint(method="POST")
async def process_video_cpu(request: fastapi.Request):
    return await _accept_video_job(request, transcode_video_short)

@app.function(image=media_image, secrets=_video_secrets)
@modal.concurrent(max_inputs=20)
@modal.fastapi_endpoint(method="POST")
async def process_video_gpu(request: fastapi.Request):
    return await _accept_video_job(request, transcode_video_long)





