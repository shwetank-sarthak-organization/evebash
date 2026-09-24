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


@app.function(
    image=image,
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

    results = list(process_single_photo.map(photos))

    duration = time.time() - start_time
    cpu_cores = 0.125
    memory_gb = 1.0
    estimated_cost_inr = duration * ((cpu_cores * 0.00131) + (memory_gb * 0.000222))
    try:
        from supabase import create_client
        supabase = create_client(
            os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        )
        supabase.table("modal_cost_logs").insert({
            "function_name":           "process_media_batch",
            "cpu_cores":               cpu_cores,
            "memory_gb":               memory_gb,
            "execution_time_seconds":  duration,
            "estimated_cost_inr":      estimated_cost_inr,
            "faces_detected":          0
        }).execute()
        print(f"[Batch] Cost logged: {duration:.2f}s, ₹{estimated_cost_inr:.5f}")
    except Exception as log_err:
        print(f"[Batch] Cost log failed: {log_err}")

    return {"status": "success", "processed": len(results), "results": results}


@app.function(
    image=image,
    cpu=1.0,
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
def process_single_photo(photo_data: dict):
    import time
    import io
    import os
    import boto3
    import numpy as np
    import cv2
    from PIL import Image, ImageOps
    from supabase import create_client, Client

    start_time = time.time()

    # ── 1. Init Supabase and B2 ──────────────────────────────────────────
    supabase: Client = create_client(
        os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    )

    b2_client = boto3.client(
        's3',
        endpoint_url=f"https://{os.environ.get('B2_ENDPOINT')}",
        aws_access_key_id=os.environ.get('B2_KEY_ID'),
        aws_secret_access_key=os.environ.get('B2_APPLICATION_KEY')
    )
    bucket_name = os.environ.get('B2_BUCKET_NAME')

    photo_id   = photo_data.get("id")
    object_key = photo_data.get("storage_key") or photo_data.get("object_key")
    event_id   = photo_data.get("event_id")
    original_url = photo_data.get("url", "")

    if not object_key:
        return {"error": "no object key", "id": photo_id}

    try:
        # ── 2. Download original photo from B2 (Single Download) ────────────
        print(f"[{photo_id}] Downloading original photo from B2: {object_key}")
        try:
            response = b2_client.get_object(Bucket=bucket_name, Key=object_key)
            image_bytes = response['Body'].read()
        except Exception as dl_err:
            print(f"[{photo_id}] Failed to download original photo ({dl_err}). Marking failed.")
            try:
                supabase.table("photos").update({"status": "failed"}).eq("id", photo_id).execute()
            except Exception:
                pass
            return {"status": "error", "photo_id": photo_id, "error": f"Download failed: {dl_err}"}

        # ── 3. Image Decoding & EXIF Orientation ───────────────────────────
        try:
            pil_img = Image.open(io.BytesIO(image_bytes))
            try:
                pil_img = ImageOps.exif_transpose(pil_img)
            except Exception:
                pass
            if pil_img.mode != "RGB":
                pil_img = pil_img.convert("RGB")
            orig_w, orig_h = pil_img.size
            print(f"[{photo_id}] Original image loaded: {orig_w}×{orig_h}px")
        except Exception as decode_err:
            print(f"[{photo_id}] PIL failed to decode image: {decode_err}")
            return {"status": "error", "photo_id": photo_id, "error": str(decode_err)}

        # ── 4. Resizing & Thumbnail WebP Generation ────────────────────────
        # Generate 1080p Preview WebP
        preview_img = pil_img.copy()
        preview_img.thumbnail((1920, 1920), Image.Resampling.LANCZOS)
        preview_buf = io.BytesIO()
        preview_img.save(preview_buf, format="WEBP", quality=75)
        preview_bytes = preview_buf.getvalue()

        # Generate 480p Thumbnail WebP
        thumb_img = pil_img.copy()
        thumb_img.thumbnail((480, 480), Image.Resampling.LANCZOS)
        thumb_buf = io.BytesIO()
        thumb_img.save(thumb_buf, format="WEBP", quality=75)
        thumb_bytes = thumb_buf.getvalue()

        # Upload WebP variants directly to Backblaze B2
        preview_key = f"{object_key}-preview.webp"
        thumb_key   = f"{object_key}-thumbnail.webp"

        b2_client.put_object(Bucket=bucket_name, Key=preview_key, Body=preview_bytes, ContentType="image/webp")
        b2_client.put_object(Bucket=bucket_name, Key=thumb_key, Body=thumb_bytes, ContentType="image/webp")
        print(f"[{photo_id}] Uploaded WebP variants to B2: {preview_key}, {thumb_key}")

        # Construct public media URLs
        media_domain = (
            os.environ.get("MEDIA_DOMAIN")
            or os.environ.get("CLOUDFLARE_DOMAIN")
            or os.environ.get("NEXT_PUBLIC_MEDIA_DOMAIN")
            or "media.evebash.com"
        ).strip().replace("https://", "").replace("http://", "").rstrip("/")

        preview_url = f"https://{media_domain}/{preview_key}"
        thumbnail_url = f"https://{media_domain}/{thumb_key}"

        # ── 5. Face Detection & AuraFace Vector Extraction ─────────────────
        img_rgb = np.array(pil_img)
        img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
        h, w, _ = img_bgr.shape

        face_analysis = get_indexing_model()
        faces = face_analysis.get(img_bgr)
        print(f"[{photo_id}] AuraFace detector found {len(faces)} face(s).")

        face_encodings = []
        for face in faces:
            embedding = face.normed_embedding
            if embedding is not None:
                face_encodings.append(embedding)

        # ── 6. Save face records to Supabase ──────────────────────────────
        if face_encodings:
            face_records = []
            for encoding in face_encodings:
                face_records.append({
                    "event_id":  event_id,
                    "image_id":  photo_id,
                    "image_url": preview_url or original_url,
                    "width":     w,
                    "height":    h,
                    "descriptor": encoding.tolist()
                })
            supabase.table("faces").insert(face_records).execute()
            print(f"[{photo_id}] Saved {len(face_records)} face record(s) to Supabase.")

        # ── 7. Update photo row in Supabase ────────────────────────────────
        update_data = {
            "thumbnail_url": thumbnail_url,
            "preview_url": preview_url,
            "width": orig_w,
            "height": orig_h,
            "face_indexed": True,
            "status": "processed"
        }
        try:
            supabase.table("photos").update(update_data).eq("id", photo_id).execute()
        except Exception:
            update_data.pop("status", None)
            supabase.table("photos").update(update_data).eq("id", photo_id).execute()

        print(f"[{photo_id}] Updated photos table: face_indexed=True, thumbnails saved.")

        # ── 8. Log infrastructure cost ───────────────────────────────────
        duration = time.time() - start_time
        cpu_cores = 1.0
        memory_gb = 1.0
        estimated_cost_inr = duration * ((cpu_cores * 0.00131) + (memory_gb * 0.000222))
        try:
            supabase.table("modal_cost_logs").insert({
                "photo_id":                photo_id,
                "event_id":                event_id,
                "function_name":           "process_single_photo",
                "cpu_cores":               cpu_cores,
                "memory_gb":               memory_gb,
                "execution_time_seconds":  duration,
                "estimated_cost_inr":      estimated_cost_inr,
                "faces_detected":          len(face_encodings)
            }).execute()
            print(f"[{photo_id}] Cost logged: {duration:.2f}s, ₹{estimated_cost_inr:.5f}")
        except Exception as log_err:
            print(f"[{photo_id}] Cost log failed: {log_err}")

        return {"status": "success", "photo_id": photo_id, "faces": len(face_encodings)}

    except Exception as e:
        print(f"[{photo_id}] Error in process_single_photo: {e}")
        return {"status": "error", "photo_id": photo_id, "error": str(e)}


@app.function(
    image=image,
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
@modal.fastapi_endpoint(method="POST")
def find_matching_photos(request: dict):
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
            # Log cost even if no face detected
            duration = time.time() - start_time
            cpu_cores = 0.125
            memory_gb = 1.0
            estimated_cost_inr = duration * ((cpu_cores * 0.00131) + (memory_gb * 0.000222))
            try:
                supabase: Client = create_client(
                    os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
                    os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
                )
                supabase.table("modal_cost_logs").insert({
                    "function_name":           "find_matching_photos",
                    "cpu_cores":               cpu_cores,
                    "memory_gb":               memory_gb,
                    "execution_time_seconds":  duration,
                    "estimated_cost_inr":      estimated_cost_inr,
                    "faces_detected":          0
                }).execute()
            except Exception as log_err:
                print(f"[Selfie] Cost log failed: {log_err}")
            return {"error": "No face detected in selfie", "matches": []}

        # Sort by box area descending to pick the closest/largest face
        sorted_faces = sorted(selfie_faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]), reverse=True)
        selfie_vec = sorted_faces[0].normed_embedding
        if selfie_vec is None:
            print("[Selfie] Failed to generate face vector.")
            # Log cost even if failure
            duration = time.time() - start_time
            cpu_cores = 0.125
            memory_gb = 1.0
            estimated_cost_inr = duration * ((cpu_cores * 0.00131) + (memory_gb * 0.000222))
            try:
                supabase: Client = create_client(
                    os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
                    os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
                )
                supabase.table("modal_cost_logs").insert({
                    "function_name":           "find_matching_photos",
                    "cpu_cores":               cpu_cores,
                    "memory_gb":               memory_gb,
                    "execution_time_seconds":  duration,
                    "estimated_cost_inr":      estimated_cost_inr,
                    "faces_detected":          0
                }).execute()
            except Exception as log_err:
                print(f"[Selfie] Cost log failed: {log_err}")
            return {"error": "Failed to generate face vector", "matches": []}
            
        print("[Selfie] Embedding successfully generated.")

        # ── 3. Fetch all indexed face descriptors for these events ───────
        supabase: Client = create_client(
            os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        )
        response = supabase.table("faces").select("*").in_("event_id", event_ids).execute()
        db_faces = response.data or []
        print(f"[Selfie] Fetched {len(db_faces)} indexed face records to compare.")

        # ── 4. Cosine similarity matching ────────────────────────────────
        # Threshold set to 0.40 (maximum recall for side profiles, group shots).
        THRESHOLD = 0.40
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

                print(f"[Match Debug] image_id={face.get('image_id')} cosine_sim={cosine_sim:.4f} (threshold={THRESHOLD})")

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

        print(f"[Selfie] Returning {len(matches)} match(es).")
        
        # Log infrastructure cost
        duration = time.time() - start_time
        cpu_cores = 0.125
        memory_gb = 1.0
        estimated_cost_inr = duration * ((cpu_cores * 0.00131) + (memory_gb * 0.000222))
        try:
            supabase.table("modal_cost_logs").insert({
                "function_name":           "find_matching_photos",
                "cpu_cores":               cpu_cores,
                "memory_gb":               memory_gb,
                "execution_time_seconds":  duration,
                "estimated_cost_inr":      estimated_cost_inr,
                "faces_detected":          len(selfie_faces)
            }).execute()
            print(f"[Selfie] Cost logged: {duration:.2f}s, ₹{estimated_cost_inr:.5f}")
        except Exception as log_err:
            print(f"[Selfie] Cost log failed: {log_err}")

        return {
            "success": True,
            "matches": matches,
            "debug": {
                "indexedFacesCount": len(db_faces),
                "selfieDetected":    True,
                "matchesCount":      len(matches)
            }
        }

    except Exception as e:
        print(f"[find_matching_photos] Error: {e}")
        # Log cost even on exception
        duration = time.time() - start_time
        cpu_cores = 0.125
        memory_gb = 1.0
        estimated_cost_inr = duration * ((cpu_cores * 0.00131) + (memory_gb * 0.000222))
        try:
            supabase: Client = create_client(
                os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
                os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            )
            supabase.table("modal_cost_logs").insert({
                "function_name":           "find_matching_photos",
                "cpu_cores":               cpu_cores,
                "memory_gb":               memory_gb,
                "execution_time_seconds":  duration,
                "estimated_cost_inr":      estimated_cost_inr,
                "faces_detected":          0
            }).execute()
        except Exception as log_err:
            print(f"[Selfie] Cost log failed: {log_err}")
        return {"error": str(e), "matches": []}


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

def _transcode_video_core(request: dict, hardware="cpu"):
    import boto3
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
        config=Config(signature_version='s3v4')
    )
    bucket_name = os.environ.get('B2_BUCKET_NAME')
    media_domain = (os.environ.get("MEDIA_DOMAIN") or "media.evebash.com").replace("https://", "").strip("/")

    hls_prefix = f"hls/{storage_key}"
    hls_master_url = f"https://{media_domain}/{hls_prefix}/master.m3u8"
    poster_url = f"https://{media_domain}/{hls_prefix}/poster.jpg"
    raw_url = f"https://{media_domain}/{storage_key}"

    print(f"[TranscodeVideo-{hardware.upper()}] Processing video {storage_key}")

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

            # 2. Check for audio stream via local file
            has_audio = False
            try:
                probe_audio = subprocess.run([
                    "ffprobe", "-v", "error", "-select_streams", "a",
                    "-show_entries", "stream=index", "-of", "csv=p=0",
                    input_path
                ], capture_output=True, text=True)
                if probe_audio.stdout.strip():
                    has_audio = True
            except Exception:
                has_audio = True

            # 3. Extract poster.jpg from local file at 1.0s
            subprocess.run([
                "ffmpeg", "-y", "-i", input_path,
                "-ss", "00:00:01", "-vframes", "1", "-q:v", "2", str(poster_path)
            ], capture_output=True, text=True)

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
            out_dirs = ["1080p", "720p", "480p"]
            if has_audio:
                out_dirs.append("audio")
                
            for out_dir in out_dirs:
                (tmp_path / out_dir).mkdir(parents=True, exist_ok=True)

            print(f"[TranscodeVideo-{hardware.upper()}] Starting single-pass multi-output FFmpeg...")
            
            cmd = [
                "ffmpeg", "-y", "-i", input_path,
                "-filter_complex", 
                "[0:v]split=3[v1][v2][v3];"
                "[v1]scale=w=1920:h=1080:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[v1out];"
                "[v2]scale=w=1280:h=720:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[v2out];"
                "[v3]scale=w=854:h=480:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[v3out]"
            ]

            vcodec = "h264_nvenc" if hardware == "gpu" else "libx264"
            vpreset = "p4" if hardware == "gpu" else "veryfast"
            
            # 1080p
            cmd += ["-map", "[v1out]", "-c:v:0", vcodec, "-preset", vpreset]
            if hardware == "gpu":
                cmd += ["-cq", "28"]
            else:
                cmd += ["-g", "48", "-keyint_min", "48", "-sc_threshold", "0"]
            cmd += ["-b:v:0", "4000k", "-maxrate:0", "4500k", "-bufsize:0", "8000k"]
                
            # 720p
            cmd += ["-map", "[v2out]", "-c:v:1", vcodec, "-preset", vpreset]
            if hardware == "gpu":
                cmd += ["-cq", "28"]
            else:
                cmd += ["-g", "48", "-keyint_min", "48", "-sc_threshold", "0"]
            cmd += ["-b:v:1", "2500k", "-maxrate:1", "3000k", "-bufsize:1", "5000k"]

            # 480p
            cmd += ["-map", "[v3out]", "-c:v:2", vcodec, "-preset", vpreset]
            if hardware == "gpu":
                cmd += ["-cq", "28"]
            else:
                cmd += ["-g", "48", "-keyint_min", "48", "-sc_threshold", "0"]
            cmd += ["-b:v:2", "1000k", "-maxrate:2", "1200k", "-bufsize:2", "2000k"]

            # Audio
            if has_audio:
                cmd += ["-map", "0:a?", "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2"]
                var_stream = "a:0,agroup:audio,default:yes,name:audio v:0,agroup:audio,name:1080p v:1,agroup:audio,name:720p v:2,agroup:audio,name:480p"
            else:
                var_stream = "v:0,name:1080p v:1,name:720p v:2,name:480p"

            # Global HLS Settings
            cmd += [
                "-f", "hls", "-hls_time", "6", "-hls_playlist_type", "vod",
                "-hls_flags", "independent_segments",
                "-hls_segment_filename", str(tmp_path / "%v/seg_%03d.ts"),
                "-master_pl_name", "master.m3u8",
                "-var_stream_map", var_stream,
                str(tmp_path / "%v/playlist.m3u8")
            ]

            proc = subprocess.run(cmd, capture_output=True, text=True)
            
            # NVENC Fallback
            if proc.returncode != 0 and hardware == "gpu" and "nvenc" in proc.stderr.lower():
                print(f"[TranscodeVideo-GPU] NVENC failed, falling back to libx264. Error: {proc.stderr[-500:]}")
                cmd_fallback = []
                skip_next = False
                for arg in cmd:
                    if skip_next:
                        skip_next = False
                        continue
                    if arg == "h264_nvenc":
                        cmd_fallback.append("libx264")
                    elif arg == "p4":
                        cmd_fallback.append("veryfast")
                    elif arg == "-cq":
                        skip_next = True
                    else:
                        cmd_fallback.append(arg)
                proc = subprocess.run(cmd_fallback, capture_output=True, text=True)

            if proc.returncode != 0:
                err = proc.stderr[-1000:] if proc.stderr else f"Exit code {proc.returncode}"
                raise RuntimeError(f"FFmpeg failed: {err}")

            # 5. Parallel Upload Fleet
            print(f"[TranscodeVideo-{hardware.upper()}] Transcode complete. Starting parallel B2 uploads...")
            def upload_file_worker(file_path, s3_key, content_type):
                b2_client.upload_file(
                    str(file_path), bucket_name, s3_key,
                    ExtraArgs={"ContentType": content_type, "CacheControl": "public, max-age=31536000, immutable"}
                )

            upload_tasks = []
            
            # Add Master Playlist
            master_file = tmp_path / "master.m3u8"
            if not master_file.exists():
                raise RuntimeError("FFmpeg did not generate master.m3u8")
            upload_tasks.append((master_file, f"{hls_prefix}/master.m3u8", "application/x-mpegURL"))
                
            # Add Variant Playlists and Segments
            for out_dir in out_dirs:
                res_path = tmp_path / out_dir
                pl_file = res_path / "playlist.m3u8"
                if pl_file.exists():
                    upload_tasks.append((pl_file, f"{hls_prefix}/{out_dir}/playlist.m3u8", "application/x-mpegURL"))
                for seg_path in res_path.glob("seg_*.ts"):
                    upload_tasks.append((seg_path, f"{hls_prefix}/{out_dir}/{seg_path.name}", "video/MP2T"))

            with concurrent.futures.ThreadPoolExecutor(max_workers=30) as executor:
                list(executor.map(lambda args: upload_file_worker(*args), upload_tasks))

        # 6. Update Supabase record
        update_data = {
            "url": hls_master_url,
            "thumbnail_url": poster_url,
            "resource_type": "video",
            "media_type": "video",
            "status": "processed",
            "processing_error": None,
        }
        supabase.table("photos").update(update_data).eq("id", photo_id).execute()

        duration = time.time() - start_time
        print(f"[TranscodeVideo-{hardware.upper()}] completed in {duration:.1f}s")
        return {"status": "success", "hls_master_url": hls_master_url}

    except Exception as e:
        error_details = str(e)
        try:
            supabase.table("photos").update({"status": "failed", "processing_error": error_details[:1000]}).eq("id", photo_id).execute()
        except Exception:
            pass
        raise fastapi.HTTPException(status_code=500, detail=f"Transcoding failed: {error_details}")

@app.function(
    image=transcode_image,
    cpu=4.0,
    memory=4096,
    timeout=3600,
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
@modal.fastapi_endpoint(method="POST")
def process_video_cpu(request: dict):
    return _transcode_video_core(request, hardware="cpu")

@app.function(
    image=transcode_image,
    gpu="l4",
    cpu=4.0,
    memory=8192,
    timeout=3600,
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
@modal.fastapi_endpoint(method="POST")
def process_video_gpu(request: dict):
    return _transcode_video_core(request, hardware="gpu")





