#!/usr/bin/env python3
"""
Applies CORS rules from b2_cors.json to the configured Backblaze B2 bucket
using the Backblaze B2 Native REST API.
"""
import os
import json
import base64
import urllib.request
import urllib.error
from pathlib import Path

def load_env(env_path: Path):
    env_vars = {}
    if not env_path.exists():
        return env_vars
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, v = line.split("=", 1)
            # Remove optional surrounding quotes
            v = v.strip().strip("'\"")
            env_vars[k.strip()] = v
    return env_vars

def main():
    root_dir = Path(__file__).resolve().parent.parent
    env = load_env(root_dir / ".env")
    
    key_id = env.get("B2_KEY_ID") or os.environ.get("B2_KEY_ID")
    app_key = env.get("B2_APPLICATION_KEY") or os.environ.get("B2_APPLICATION_KEY")
    bucket_id = env.get("B2_BUCKET_ID") or os.environ.get("B2_BUCKET_ID")
    bucket_name = env.get("B2_BUCKET_NAME") or os.environ.get("B2_BUCKET_NAME")
    
    if not key_id or not app_key:
        print("Error: B2_KEY_ID or B2_APPLICATION_KEY not found in environment or .env file.")
        return 1

    cors_path = root_dir / "b2_cors.json"
    if not cors_path.exists():
        print(f"Error: CORS config file not found at {cors_path}")
        return 1
        
    cors_rules = json.loads(cors_path.read_text(encoding="utf-8"))
    print(f"Loaded {len(cors_rules)} CORS rule(s) from b2_cors.json")

    # Step 1: Authorize account
    print("Authorizing with Backblaze B2 API...")
    auth_header = base64.b64encode(f"{key_id}:{app_key}".encode("utf-8")).decode("utf-8")
    auth_req = urllib.request.Request(
        "https://api.backblazeb2.com/b2api/v3/b2_authorize_account",
        headers={"Authorization": f"Basic {auth_header}"}
    )
    
    try:
        with urllib.request.urlopen(auth_req) as resp:
            auth_data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"HTTP Error during authorization ({e.code}): {e.read().decode('utf-8')}")
        return 1
    except Exception as e:
        print(f"Network / connection error during authorization: {e}")
        return 1

    api_url = auth_data.get("apiUrl") or auth_data.get("apiInfo", {}).get("storageApi", {}).get("apiUrl")
    auth_token = auth_data.get("authorizationToken") or auth_data.get("apiInfo", {}).get("storageApi", {}).get("authorizationToken")
    account_id = auth_data.get("accountId")
    print(f"Successfully authorized account: {account_id}, API URL: {api_url}")

    # If bucket_id wasn't in env, list buckets to resolve it from bucket_name
    if not bucket_id:
        print(f"B2_BUCKET_ID not set, resolving bucketId for '{bucket_name}'...")
        list_req = urllib.request.Request(
            f"{api_url}/b2api/v3/b2_list_buckets",
            data=json.dumps({"accountId": account_id}).encode("utf-8"),
            headers={"Authorization": auth_token, "Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(list_req) as resp:
                list_data = json.loads(resp.read().decode("utf-8"))
                for b in list_data.get("buckets", []):
                    if b.get("bucketName") == bucket_name:
                        bucket_id = b.get("bucketId")
                        break
        except Exception as e:
            print(f"Failed to list buckets: {e}")

    if not bucket_id:
        print(f"Error: Could not resolve bucket ID for bucket name '{bucket_name}'")
        return 1

    print(f"Applying CORS rules to Bucket ID: {bucket_id} ({bucket_name})...")
    update_req = urllib.request.Request(
        f"{api_url}/b2api/v3/b2_update_bucket",
        data=json.dumps({
            "accountId": account_id,
            "bucketId": bucket_id,
            "corsRules": cors_rules
        }).encode("utf-8"),
        headers={"Authorization": auth_token, "Content-Type": "application/json"}
    )

    try:
        with urllib.request.urlopen(update_req) as resp:
            update_data = json.loads(resp.read().decode("utf-8"))
            print(f"✅ Success! Updated CORS rules on bucket {update_data.get('bucketName')}:")
            print(json.dumps(update_data.get("corsRules", []), indent=2))
            return 0
    except urllib.error.HTTPError as e:
        print(f"HTTP Error during b2_update_bucket ({e.code}): {e.read().decode('utf-8')}")
        return 1
    except Exception as e:
        print(f"Error during b2_update_bucket: {e}")
        return 1

if __name__ == "__main__":
    exit(main() or 0)
