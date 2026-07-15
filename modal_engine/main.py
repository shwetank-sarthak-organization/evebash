import modal
import os
import io
import json

app = modal.App("wedding-media-engine")

# Load environment variables from the .env file in the parent directory
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("cmake", "g++", "libgl1-mesa-glx", "libglib2.0-0", "wget")
    .pip_install(
        "fastapi[standard]",
        "boto3",
        "Pillow",
        "face_recognition",
        "supabase",
        "requests",
        "numpy",
        "opencv-python-headless"
    )
    .run_commands(
        "wget -O /root/face_detection_yunet_2023mar.onnx https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
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
    Accepts a batch of photos and fans them out to parallel GPU/CPU workers.
    """
    photos = request.get("photos", [])
    if not photos:
        return {"status": "no photos provided"}
    
    # Fan out to parallel workers
    results = list(process_single_photo.map(photos))
    return {"status": "success", "processed": len(results), "results": results}


@app.function(
    image=image,
    cpu=1.0, # Optimized down from 2.0 to save 50% on cost (adds ~1.5s execution time)
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
def process_single_photo(photo_data: dict):
    import time
    start_time = time.time()
    
    import boto3
    from PIL import Image, ImageOps
    from supabase import create_client, Client
    import face_recognition
    import numpy as np
    
    # 1. Init Supabase and B2
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
    
    # photo_data should contain: id, object_key, event_id, url, width, height
    photo_id = photo_data.get("id")
    object_key = photo_data.get("storage_key") or photo_data.get("object_key")
    event_id = photo_data.get("event_id")
    original_url = photo_data.get("url", "")
    
    if not object_key:
        return {"error": "no object key", "id": photo_id}
    
    try:
        # 2. Try to download the already-resized preview WebP from B2 first
        # This saves 99% bandwidth and CPU time since the preview is ~150KB while the original is ~20MB
        preview_key = f"{object_key}-preview.webp"
        thumb_key = f"{object_key}-thumbnail.webp"
        
        try:
            print(f"[{photo_id}] Attempting to download preview WebP: {preview_key}")
            response = b2_client.get_object(Bucket=bucket_name, Key=preview_key)
            image_bytes = response['Body'].read()
            img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            width, height = img.size
            
            # Since preview already exists, skip generation/upload and use directly for AI
            ai_img = img
            print(f"[{photo_id}] Loaded preview successfully (bypassed B2 upload and resizing).")
        except Exception as e:
            print(f"[{photo_id}] Preview WebP not found ({str(e)}). Deleting original from BB and marking as failed.")
            # Delete original from B2
            try:
                b2_client.delete_object(Bucket=bucket_name, Key=object_key)
            except Exception as del_err:
                print(f"[{photo_id}] Failed to delete original from B2: {str(del_err)}")
                
            # Update Supabase status to failed
            try:
                supabase.table("photos").update({"status": "failed"}).eq("id", photo_id).execute()
            except Exception as db_err:
                print(f"[{photo_id}] Could not update status, trying to delete row: {str(db_err)}")
                try:
                    supabase.table("photos").delete().eq("id", photo_id).execute()
                except Exception:
                    pass
                    
            return {"status": "error", "photo_id": photo_id, "error": "Preview missing. Image deleted from B2 and face recog aborted."}
            
        # 4. Face Detection — use YuNet with optimized 0.7 threshold for robust profile/tilted face detection
        import cv2
        
        # Convert PIL image to BGR numpy array for OpenCV
        open_cv_image = np.array(ai_img)
        open_cv_image = open_cv_image[:, :, ::-1].copy() # Convert RGB to BGR
        h, w, _ = open_cv_image.shape
        
        print(f"[{photo_id}] Image shape for YuNet face detection: {open_cv_image.shape}")
        
        try:
            detector = cv2.FaceDetectorYN.create(
                model="/root/face_detection_yunet_2023mar.onnx",
                config="",
                input_size=(w, h),
                score_threshold=0.7,
                nms_threshold=0.3,
                top_k=5000
            )
            _, faces = detector.detect(open_cv_image)
            
            face_locations = []
            if faces is not None:
                for face in faces:
                    x, y, w_box, h_box = map(int, face[0:4])
                    top = max(0, y)
                    right = min(w, x + w_box)
                    bottom = min(h, y + h_box)
                    left = max(0, x)
                    face_locations.append((top, right, bottom, left))
            print(f"[{photo_id}] YuNet found {len(face_locations)} face locations")
        except Exception as yunet_err:
            print(f"[{photo_id}] YuNet failed ({yunet_err}), falling back to HOG")
            fr_image = np.array(ai_img)
            face_locations = face_recognition.face_locations(fr_image, model='hog')
            print(f"[{photo_id}] HOG fallback found {len(face_locations)} face locations")
            
        fr_image = np.array(ai_img)
        # num_jitters=5: compute embedding 5x with perturbations and average — much more stable
        # model="large": uses the more accurate 68-point landmark model vs the default "small" (5-point)
        face_encodings = face_recognition.face_encodings(fr_image, face_locations, num_jitters=5, model="large")
        print(f"[{photo_id}] Face encodings computed: {len(face_encodings)}")
        
        # 5. Save face embeddings to Supabase
        if face_encodings:
            face_records = []
            for encoding in face_encodings:
                face_records.append({
                    "event_id": event_id,
                    "image_id": photo_id,
                    "image_url": original_url,
                    "width": width,
                    "height": height,
                    "descriptor": encoding.tolist()
                })
            
            supabase.table("faces").insert(face_records).execute()
            
        # 6. Mark photo as indexed in Supabase
        print(f"[{photo_id}] Marking photo as indexed in database...")
        supabase.table("photos").update({"face_indexed": True}).eq("id", photo_id).execute()
        
        # 7. Log infrastructure cost
        duration = time.time() - start_time
        estimated_cost_inr = duration * 0.001532  # Modal.com CPU: ($0.0000131/core + $0.00000222/GiB) × ₹100 for 1 core + ~1GiB
        try:
            supabase.table("modal_cost_logs").insert({
                "photo_id": photo_id,
                "event_id": event_id,
                "execution_time_seconds": duration,
                "estimated_cost_inr": estimated_cost_inr,
                "faces_detected": len(face_encodings)
            }).execute()
            print(f"[{photo_id}] Cost logged: {duration:.2f}s, {estimated_cost_inr:.5f} INR")
        except Exception as log_err:
            print(f"[{photo_id}] Failed to save cost log to Supabase: {str(log_err)}")
            
        return {"status": "success", "photo_id": photo_id, "faces": len(face_encodings)}
        
    except Exception as e:
        print(f"Error processing {photo_id}: {str(e)}")
        return {"status": "error", "photo_id": photo_id, "error": str(e)}


@app.function(
    image=image,
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
@modal.fastapi_endpoint(method="POST")
def find_matching_photos(request: dict):
    """
    Search endpoint for Guest Selfie Matching.
    Accepts:
      - selfie_base64: Base64-encoded selfie image
      - event_ids: List of event IDs to search in
    Returns list of matched image records.
    """
    import base64
    import io
    from PIL import Image
    import face_recognition
    import numpy as np
    from supabase import create_client, Client
    
    selfie_base64 = request.get("selfie_base64", "")
    event_ids = request.get("event_ids", [])
    
    if not selfie_base64 or not event_ids:
        return {"error": "Missing selfie_base64 or event_ids", "matches": []}
        
    try:
        # 1. Decode and load selfie image
        selfie_bytes = base64.b64decode(selfie_base64)
        selfie_img = Image.open(io.BytesIO(selfie_bytes)).convert("RGB")
        selfie_arr = np.array(selfie_img)
        
        # 2. Extract face encoding from selfie using YuNet (score_threshold=0.7)
        import cv2
        selfie_bgr = selfie_arr[:, :, ::-1].copy()  # RGB → BGR for OpenCV
        sh, sw, _ = selfie_bgr.shape
        
        selfie_face_locations = []
        try:
            selfie_detector = cv2.FaceDetectorYN.create(
                model="/root/face_detection_yunet_2023mar.onnx",
                config="",
                input_size=(sw, sh),
                score_threshold=0.7,
                nms_threshold=0.3,
                top_k=10
            )
            _, selfie_faces = selfie_detector.detect(selfie_bgr)
            if selfie_faces is not None:
                for face in selfie_faces:
                    x, y, w_box, h_box = map(int, face[0:4])
                    selfie_face_locations.append((
                        max(0, y), min(sw, x + w_box),
                        min(sh, y + h_box), max(0, x)
                    ))
            print(f"[Selfie] YuNet detected {len(selfie_face_locations)} face(s) in selfie")
        except Exception as yunet_err:
            print(f"[Selfie] YuNet failed ({yunet_err}), falling back to HOG")
            selfie_face_locations = face_recognition.face_locations(selfie_arr, model='hog')
        
        if not selfie_face_locations:
            return {"error": "No face detected in selfie", "matches": []}
        
        # Use large model + num_jitters=5 — must match exactly what was used during indexing
        selfie_encodings = face_recognition.face_encodings(selfie_arr, selfie_face_locations, num_jitters=5, model="large")
        if not selfie_encodings:
            return {"error": "No face detected in selfie", "matches": []}
            
        selfie_encoding = selfie_encodings[0]
        
        # 3. Initialize Supabase
        supabase: Client = create_client(
            os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        )
        
        # 4. Fetch all face records for target event IDs
        response = supabase.table("faces").select("*").in_("event_id", event_ids).execute()
        db_faces = response.data or []
        
        # 5. Compare descriptors
        # 0.45 gives very high confidence matches only — eliminates false positives in group/wedding photos
        THRESHOLD = 0.45
        matches_map = {}
        
        for face in db_faces:
            db_descriptor = face.get("descriptor")
            if not db_descriptor:
                continue
                
            try:
                # Convert to list/array of floats
                if isinstance(db_descriptor, str):
                    import json
                    db_descriptor = json.loads(db_descriptor)
                
                db_vector = np.array(db_descriptor)
                if len(db_vector) != 128:
                    continue
                    
                distance = np.linalg.norm(selfie_encoding - db_vector)
                
                if distance < THRESHOLD:
                    image_id = face.get("image_id")
                    if image_id not in matches_map or distance < matches_map[image_id]["distance"]:
                        matches_map[image_id] = {
                            "id": image_id,
                            "imageId": image_id,
                            "imageUrl": face.get("image_url"),
                            "width": face.get("width"),
                            "height": face.get("height"),
                            "distance": float(distance)
                        }
            except Exception as e:
                print(f"Error matching face {face.get('id')}: {str(e)}")
                
        # Remove distance from final output
        matches = []
        for m in matches_map.values():
            del m["distance"]
            matches.append(m)
            
        return {
            "success": True,
            "matches": matches,
            "debug": {
                "indexedFacesCount": len(db_faces),
                "selfieDetected": True,
                "matchesCount": len(matches)
            }
        }
    except Exception as e:
        print(f"Error in find_matching_photos: {str(e)}")
        return {"error": str(e), "matches": []}

