import modal
import os
import io
import json

app = modal.App("wedding-media-engine")

# Load environment variables from the .env file in the parent directory
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("cmake", "g++", "libgl1-mesa-glx", "libglib2.0-0")
    .pip_install(
        "fastapi[standard]",
        "boto3",
        "Pillow",
        "face_recognition",
        "supabase",
        "requests",
        "numpy"
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
            # Fallback: Download original and generate thumbnails
            print(f"[{photo_id}] Preview WebP not found or download failed ({str(e)}). Downloading original: {object_key}")
            response = b2_client.get_object(Bucket=bucket_name, Key=object_key)
            image_bytes = response['Body'].read()
            
            img = Image.open(io.BytesIO(image_bytes))
            # Fix orientation (EXIF)
            try:
                img = ImageOps.exif_transpose(img)
            except Exception:
                pass
            img = img.convert("RGB")
            width, height = img.size
            
            # Generate Preview (1000px)
            preview_img = img.copy()
            preview_img.thumbnail((1000, 1000))
            preview_bytes = io.BytesIO()
            preview_img.save(preview_bytes, format="WEBP", quality=80)
            preview_bytes.seek(0)
            
            # Generate Thumbnail (400px)
            thumb_img = img.copy()
            thumb_img.thumbnail((400, 400))
            thumb_bytes = io.BytesIO()
            thumb_img.save(thumb_bytes, format="WEBP", quality=80)
            thumb_bytes.seek(0)
            
            # Upload Thumbnails back to B2
            print(f"[{photo_id}] Uploading resized thumbnails to B2...")
            b2_client.put_object(Bucket=bucket_name, Key=preview_key, Body=preview_bytes, ContentType="image/webp")
            b2_client.put_object(Bucket=bucket_name, Key=thumb_key, Body=thumb_bytes, ContentType="image/webp")
            
            # Update Supabase with thumbnail URLs
            media_domain = os.environ.get("MEDIA_DOMAIN", "media.evebash.com")
            print(f"[{photo_id}] Saving thumbnail URL to database...")
            supabase.table("photos").update({
                "thumbnail_url": f"https://{media_domain}/{thumb_key}",
            }).eq("id", photo_id).execute()
            
            ai_img = preview_img
            
        # 4. Face Detection (Shrink to 600px first to save 64% of AI processing time!)
        ai_img = ai_img.copy()
        ai_img.thumbnail((600, 600))
        fr_image = np.array(ai_img)
        
        face_locations = face_recognition.face_locations(fr_image)
        face_encodings = face_recognition.face_encodings(fr_image, face_locations)
        
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
            
        return {"status": "success", "photo_id": photo_id, "faces": len(face_encodings)}
        
    except Exception as e:
        print(f"Error processing {photo_id}: {str(e)}")
        return {"status": "error", "photo_id": photo_id, "error": str(e)}
