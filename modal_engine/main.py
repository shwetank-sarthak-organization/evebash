import modal
import os
import io

app = modal.App("wedding-media-engine")

# Define the Modal image with system OpenCV dependencies and InsightFace + ONNX Runtime.
# We download the fal/AuraFace-v1 weights (Apache 2.0) during image build so they are
# cached in the container snapshot, eliminating cold-start download times.
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1-mesa-glx", "libglib2.0-0")
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
    photos = request.get("photos", [])
    if not photos:
        return {"status": "no photos provided"}

    results = list(process_single_photo.map(photos))
    return {"status": "success", "processed": len(results), "results": results}


@app.function(
    image=image,
    cpu=1.0,
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
def process_single_photo(photo_data: dict):
    import time
    start_time = time.time()

    import boto3
    from PIL import Image
    from supabase import create_client, Client
    import numpy as np
    import cv2
    from insightface.app import FaceAnalysis

    # ── 1. Init Supabase and B2 ──────────────────────────────────────────────
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
        # ── 2. Download preview WebP from B2 ────────────────────────────────
        preview_key = f"{object_key}-preview.webp"

        try:
            print(f"[{photo_id}] Downloading preview: {preview_key}")
            response = b2_client.get_object(Bucket=bucket_name, Key=preview_key)
            image_bytes = response['Body'].read()
            # OpenCV expects BGR numpy array
            nparr = np.frombuffer(image_bytes, np.uint8)
            img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img_bgr is None:
                raise ValueError("cv2 failed to decode preview WebP image bytes")
            h, w, _ = img_bgr.shape
            print(f"[{photo_id}] Preview loaded: {w}×{h}px")
        except Exception as e:
            print(f"[{photo_id}] Preview not found ({e}). Marking failed.")
            try:
                b2_client.delete_object(Bucket=bucket_name, Key=object_key)
            except Exception:
                pass
            try:
                supabase.table("photos").update({"status": "failed"}).eq("id", photo_id).execute()
            except Exception:
                pass
            return {"status": "error", "photo_id": photo_id, "error": "Preview missing."}

        # ── 3. Face Detection & Alignment & Encoding — AuraFace ─────────────
        # Initialize FaceAnalysis pointing to our downloaded auraface model directory.
        # AuraFace-v1 uses a ResNet100 backbone trained with ArcFace loss.
        # Standard detection size (det_size) is (640, 640) for fast CPU inference.
        # det_thresh=0.4 allows us to capture angled/shadowed faces without false detections.
        face_analysis = FaceAnalysis(
            name="auraface",
            root="/root/.insightface",
            providers=["CPUExecutionProvider"]
        )
        face_analysis.prepare(ctx_id=-1, det_size=(1280, 1280), det_thresh=0.4)
        
        # Get face predictions
        faces = face_analysis.get(img_bgr)
        print(f"[{photo_id}] AuraFace detector found {len(faces)} face(s).")

        face_encodings = []
        for face in faces:
            # face.normed_embedding is the 512-dimension L2-normalized vector
            embedding = face.normed_embedding
            if embedding is not None:
                face_encodings.append(embedding)

        # ── 4. Save face embeddings to Supabase ─────────────────────────────
        if face_encodings:
            face_records = []
            for encoding in face_encodings:
                face_records.append({
                    "event_id":  event_id,
                    "image_id":  photo_id,
                    "image_url": original_url,
                    "width":     w,
                    "height":    h,
                    "descriptor": encoding.tolist()   # 512 floats
                })
            supabase.table("faces").insert(face_records).execute()
            print(f"[{photo_id}] Saved {len(face_records)} face record(s) to Supabase.")

        # ── 5. Mark face_indexed status ──────────────────────────────────────
        if face_encodings:
            supabase.table("photos").update({"face_indexed": True}).eq("id", photo_id).execute()
            print(f"[{photo_id}] Marked face_indexed=True ({len(face_encodings)} face(s)).")
        else:
            print(f"[{photo_id}] 0 faces — leaving face_indexed=False for retry.")

        # ── 6. Log infrastructure cost ───────────────────────────────────────
        duration = time.time() - start_time
        estimated_cost_inr = duration * 0.001532
        try:
            supabase.table("modal_cost_logs").insert({
                "photo_id":                photo_id,
                "event_id":                event_id,
                "execution_time_seconds":  duration,
                "estimated_cost_inr":      estimated_cost_inr,
                "faces_detected":          len(face_encodings)
            }).execute()
            print(f"[{photo_id}] Cost logged: {duration:.2f}s, ₹{estimated_cost_inr:.5f}")
        except Exception as log_err:
            print(f"[{photo_id}] Cost log failed: {log_err}")

        return {"status": "success", "photo_id": photo_id, "faces": len(face_encodings)}

    except Exception as e:
        print(f"[{photo_id}] Error: {e}")
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

    AuraFace/ArcFace cosine similarity ranges:
       - Identical / Same person: 0.50 to 0.85
       - Different people:        -0.10 to 0.40
    
    Starting threshold set to 0.50 for high recall of profile faces.
    """
    import base64
    import numpy as np
    import cv2
    from insightface.app import FaceAnalysis
    from supabase import create_client, Client

    selfie_base64 = request.get("selfie_base64", "")
    event_ids     = request.get("event_ids", [])

    if not selfie_base64 or not event_ids:
        return {"error": "Missing selfie_base64 or event_ids", "matches": []}

    try:
        # ── 1. Decode and load selfie ────────────────────────────────────────
        selfie_bytes = base64.b64decode(selfie_base64)
        nparr = np.frombuffer(selfie_bytes, np.uint8)
        selfie_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if selfie_bgr is None:
            raise ValueError("cv2 failed to decode selfie image bytes")
            
        print(f"[Selfie] Loaded selfie: {selfie_bgr.shape}")

        # ── 2. Detect & Encode selfie face ───────────────────────────────────
        face_analysis = FaceAnalysis(
            name="auraface",
            root="/root/.insightface",
            providers=["CPUExecutionProvider"]
        )
        face_analysis.prepare(ctx_id=-1, det_size=(1280, 1280), det_thresh=0.5)
        
        selfie_faces = face_analysis.get(selfie_bgr)
        if not selfie_faces:
            print("[Selfie] No face detected in selfie.")
            return {"error": "No face detected in selfie", "matches": []}

        # Sort by box area descending to pick the closest/largest face (the guest)
        sorted_faces = sorted(selfie_faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]), reverse=True)
        selfie_vec = sorted_faces[0].normed_embedding
        if selfie_vec is None:
            print("[Selfie] Failed to generate face vector.")
            return {"error": "Failed to generate face vector", "matches": []}
            
        print("[Selfie] Embedding successfully generated.")

        # ── 3. Fetch all indexed face descriptors for these events ───────────
        supabase: Client = create_client(
            os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        )
        response = supabase.table("faces").select("*").in_("event_id", event_ids).execute()
        db_faces = response.data or []
        print(f"[Selfie] Fetched {len(db_faces)} indexed face records to compare.")

        # ── 4. Cosine similarity matching ────────────────────────────────────
        # Threshold set to 0.50 (comprehensive recall for side profiles).
        # Check logs for '[Match Debug]' similarity scores to fine-tune.
        THRESHOLD = 0.50
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
        return {"error": str(e), "matches": []}
