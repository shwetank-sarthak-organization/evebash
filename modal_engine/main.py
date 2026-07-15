import modal
import os
import io

app = modal.App("wedding-media-engine")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1-mesa-glx", "libglib2.0-0")
    .pip_install(
        "fastapi[standard]",
        "boto3",
        "Pillow",
        "facenet-pytorch",   # Provides MTCNN (detection) + InceptionResnetV1 (recognition)
        "supabase",
        "requests",
        "numpy",
        "torch",
        "torchvision",
    )
    # Models are downloaded at runtime and cached by Modal's container snapshot.
    # VGGFace2 pretrained weights (~100MB) download once on first cold start.
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
    from PIL import Image, ImageOps
    from supabase import create_client, Client
    import numpy as np
    import torch
    from facenet_pytorch import MTCNN, InceptionResnetV1

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
            img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            width, height = img.size
            print(f"[{photo_id}] Preview loaded: {width}×{height}px")
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

        # ── 3. Face Detection — MTCNN ────────────────────────────────────────
        # MTCNN is a 3-stage cascade detector trained specifically for faces.
        # min_face_size=20 detects faces as small as 20px — critical for group
        # shots where background guests appear tiny.
        # keep_all=True returns every face, not just the largest.
        mtcnn = MTCNN(
            image_size=160,         # FaceNet input size
            margin=20,              # Context margin around each face
            min_face_size=20,       # Detect very small faces (20px) vs old YuNet ~50px
            thresholds=[0.6, 0.7, 0.7],  # P-Net, R-Net, O-Net detection thresholds
            factor=0.709,           # Scale factor for image pyramid
            keep_all=True,          # Return ALL detected faces
            device='cpu'
        )

        # Returns tensor (N, 3, 160, 160) or None if no faces detected
        face_tensors, probs = mtcnn(img, return_prob=True)

        if face_tensors is None:
            print(f"[{photo_id}] MTCNN found 0 faces.")
            face_tensors = []
        else:
            if face_tensors.dim() == 3:
                face_tensors = face_tensors.unsqueeze(0)  # Single face → batch dim
            print(f"[{photo_id}] MTCNN found {len(face_tensors)} face(s). Probs: {[f'{p:.3f}' for p in probs]}")

        # ── 4. Face Encoding — FaceNet (InceptionResnetV1, VGGFace2) ────────
        # InceptionResnetV1 pretrained on VGGFace2 (3.3M images, MIT license).
        # Outputs 512-dim L2-normalized embeddings.
        # No num_jitters needed — network is deterministic and fast.
        face_encodings = []
        if len(face_tensors) > 0:
            facenet = InceptionResnetV1(pretrained='vggface2').eval()
            with torch.no_grad():
                embeddings = facenet(face_tensors)                          # (N, 512)
                embeddings = torch.nn.functional.normalize(embeddings, p=2, dim=1)  # L2 norm
            face_encodings = [emb.numpy() for emb in embeddings]
            print(f"[{photo_id}] {len(face_encodings)} face encoding(s) computed (512-dim each).")

        # ── 5. Save face embeddings to Supabase ─────────────────────────────
        if face_encodings:
            face_records = []
            for encoding in face_encodings:
                face_records.append({
                    "event_id":  event_id,
                    "image_id":  photo_id,
                    "image_url": original_url,
                    "width":     width,
                    "height":    height,
                    "descriptor": encoding.tolist()   # 512 floats
                })
            supabase.table("faces").insert(face_records).execute()
            print(f"[{photo_id}] Saved {len(face_records)} face record(s) to Supabase.")

        # ── 6. Mark face_indexed status ──────────────────────────────────────
        # Only mark True when at least one face was stored.
        # Photos with 0 detections stay face_indexed=False and are retried next batch.
        if face_encodings:
            supabase.table("photos").update({"face_indexed": True}).eq("id", photo_id).execute()
            print(f"[{photo_id}] Marked face_indexed=True ({len(face_encodings)} face(s)).")
        else:
            print(f"[{photo_id}] 0 faces — leaving face_indexed=False for retry.")

        # ── 7. Log infrastructure cost ───────────────────────────────────────
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
    Uses FaceNet cosine similarity — threshold calibrated to 0.70.

    NOTE: After your first real test upload, check Modal logs for
    '[Match Distance Debug]' lines to see actual cosine distances,
    then adjust THRESHOLD below to the natural gap between matches
    and non-matches for your specific event photos.
    """
    import base64
    from PIL import Image, ImageOps
    import numpy as np
    import torch
    from facenet_pytorch import MTCNN, InceptionResnetV1
    from supabase import create_client, Client

    selfie_base64 = request.get("selfie_base64", "")
    event_ids     = request.get("event_ids", [])

    if not selfie_base64 or not event_ids:
        return {"error": "Missing selfie_base64 or event_ids", "matches": []}

    try:
        # ── 1. Decode and load selfie ────────────────────────────────────────
        selfie_bytes = base64.b64decode(selfie_base64)
        selfie_img   = Image.open(io.BytesIO(selfie_bytes)).convert("RGB")
        selfie_img   = ImageOps.exif_transpose(selfie_img)  # Fix mobile portrait rotation
        print(f"[Selfie] Loaded selfie: {selfie_img.size}")

        # ── 2. Detect face in selfie with MTCNN ─────────────────────────────
        # For selfies we keep_all=False (take the largest face = the user).
        # Higher thresholds than indexing since selfies are close-up, well-lit.
        mtcnn_selfie = MTCNN(
            image_size=160,
            margin=20,
            min_face_size=60,           # Selfies are close-up, face is large
            thresholds=[0.7, 0.8, 0.9], # Higher confidence for selfie
            keep_all=False,             # Only the largest (closest) face
            device='cpu'
        )

        face_tensor = mtcnn_selfie(selfie_img)  # Returns (3, 160, 160) or None

        if face_tensor is None:
            print("[Selfie] No face detected in selfie.")
            return {"error": "No face detected in selfie", "matches": []}

        face_tensor = face_tensor.unsqueeze(0)  # Add batch dim → (1, 3, 160, 160)
        print("[Selfie] Face detected. Computing FaceNet embedding...")

        # ── 3. Encode selfie face ────────────────────────────────────────────
        facenet = InceptionResnetV1(pretrained='vggface2').eval()
        with torch.no_grad():
            selfie_embedding = facenet(face_tensor)                               # (1, 512)
            selfie_embedding = torch.nn.functional.normalize(selfie_embedding, p=2, dim=1)
        selfie_vec = selfie_embedding[0].numpy()  # (512,)
        print(f"[Selfie] Embedding computed. Norm: {np.linalg.norm(selfie_vec):.4f}")

        # ── 4. Fetch all indexed face descriptors for these events ───────────
        supabase: Client = create_client(
            os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        )
        response = supabase.table("faces").select("*").in_("event_id", event_ids).execute()
        db_faces = response.data or []
        print(f"[Selfie] Fetched {len(db_faces)} indexed face records to compare.")

        # ── 5. Cosine similarity matching ────────────────────────────────────
        # FaceNet embeddings are L2-normalized so:
        #   cosine_similarity = dot(a, b) / (|a| * |b|) = dot(a, b)  (since |a|=|b|=1)
        #
        # Cosine similarity ranges: 1.0 = identical, 0.0 = unrelated, -1.0 = opposite.
        # Same person in wedding photos: typically 0.65–0.90
        # Different people:              typically 0.10–0.55
        #
        # THRESHOLD = 0.70 is a safe starting point.
        # After your first real test, check Modal logs and adjust this number.
        # To reduce false positives → raise threshold (e.g. 0.75)
        # To reduce missed faces   → lower threshold  (e.g. 0.65)
        THRESHOLD = 0.70

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

                # Skip old 128-dim dlib vectors — incompatible with 512-dim FaceNet
                if len(db_vec) != 512:
                    print(f"[Match] Skipping face {face.get('id')} — wrong dim ({len(db_vec)}, expected 512)")
                    continue

                # Cosine similarity (dot product of L2-normalized vectors)
                cosine_sim = float(np.dot(selfie_vec, db_vec))

                print(f"[Match Debug] image_id={face.get('image_id')} cosine_sim={cosine_sim:.4f} (threshold={THRESHOLD})")

                if cosine_sim >= THRESHOLD:
                    image_id = face.get("image_id")
                    # Keep the highest-similarity match per photo
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

        # Remove internal 'sim' field from output
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
