#!/usr/bin/env python3
"""
Creates and manages the RunPod serverless endpoints of the video worker (todo #18). Reads RUNPOD_API_KEY from the
repo-root .env. Run from the repo root:

  python3 scripts/runpod_video_endpoints.py show                 endpoints, image and registry credential
  python3 scripts/runpod_video_endpoints.py create [tag]         template + 3 endpoints (idempotent; tag default "staging")
  python3 scripts/runpod_video_endpoints.py image <tag>          point the template at another image tag (e.g. a commit)
  python3 scripts/runpod_video_endpoints.py delete               remove the 3 endpoints and the template

Endpoints (0 workers when idle, so they cost nothing until a video arrives; max 3 workers each, 9 of the account's 10):
  evebash-video-ada        RTX 4000 Ada (24 GB pool minus the other cards, as in the 2026-10-27 benchmark)
  evebash-video-blackwell  RTX PRO 6000 Blackwell 24 GB slice
  evebash-video-cpu32      32 vCPU (cpu5c-32-64)
The image is private on ghcr.io and pulled with the credential "ghcr-evebash" (RunPod: Account > Container Registry
Auth). After `create`, put the printed ids in Railway as RUNPOD_ENDPOINT_ADA / _BLACKWELL / _CPU32.
"""
import json
import os
import pathlib
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
KEY = os.environ.get("RUNPOD_API_KEY") or next(
    (l.split("=", 1)[1].strip().strip('"').strip("'") for l in open(ROOT / ".env") if l.startswith("RUNPOD_API_KEY=")), ""
) if (ROOT / ".env").exists() or os.environ.get("RUNPOD_API_KEY") else ""
HEADERS = {"Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "User-Agent": "curl/8.7.1"}
IMAGE = "ghcr.io/shwetank-sarthak-organization/evebash-video-worker"
CREDENTIAL = "ghcr-evebash"
TEMPLATE = "evebash-video-worker"
ENDPOINTS = {
    "evebash-video-ada": {"gpuIds": "AMPERE_16,-NVIDIA RTX A4000,-NVIDIA RTX A4500,-NVIDIA RTX 2000 Ada Generation"},
    "evebash-video-blackwell": {"gpuIds": "AMPERE_24,-NVIDIA L4,-NVIDIA RTX A5000,-NVIDIA GeForce RTX 3090"},
    "evebash-video-cpu32": {"instanceIds": ["cpu5c-32-64"]},
}
RAILWAY_NAMES = {"evebash-video-ada": "RUNPOD_ENDPOINT_ADA", "evebash-video-blackwell": "RUNPOD_ENDPOINT_BLACKWELL", "evebash-video-cpu32": "RUNPOD_ENDPOINT_CPU32"}


def gql(query, variables=None):
    request = urllib.request.Request("https://api.runpod.io/graphql", method="POST", headers=HEADERS,
                                     data=json.dumps({"query": query, "variables": variables or {}}).encode())
    data = json.load(urllib.request.urlopen(request, timeout=60))
    if data.get("errors"):
        raise SystemExit(f"RunPod: {data['errors']}")
    return data["data"]


def myself():
    return gql("""{ myself {
        containerRegistryCreds { id name }
        podTemplates { id name imageName containerRegistryAuthId isServerless }
        endpoints { id name templateId gpuIds instanceIds workersMin workersMax idleTimeout }
    } }""")["myself"]


def show():
    me = myself()
    cred = next((c for c in me["containerRegistryCreds"] or [] if c["name"] == CREDENTIAL), None)
    print(f"registry credential {CREDENTIAL}: {'found' if cred else 'MISSING'}")
    for t in me["podTemplates"] or []:
        if t["name"] == TEMPLATE:
            print(f"template {t['name']} ({t['id']}): {t['imageName']}, credential set: {bool(t['containerRegistryAuthId'])}")
    for e in me["endpoints"] or []:
        if e["name"] in ENDPOINTS:
            print(f"{RAILWAY_NAMES[e['name']]}={e['id']}   # {e['name']}, workers {e['workersMin']}-{e['workersMax']}")
    others = [e["name"] for e in me["endpoints"] or [] if e["name"] not in ENDPOINTS]
    if others:
        print(f"other endpoints on the account (they share the 10-worker limit): {', '.join(others)}")


def save_template(me, tag):
    cred = next((c for c in me["containerRegistryCreds"] or [] if c["name"] == CREDENTIAL), None)
    if not cred:
        raise SystemExit(f"RunPod has no registry credential named {CREDENTIAL}")
    existing = next((t for t in me["podTemplates"] or [] if t["name"] == TEMPLATE), None)
    template = {
        "name": TEMPLATE, "imageName": f"{IMAGE}:{tag}", "containerRegistryAuthId": cred["id"], "isServerless": True,
        "containerDiskInGb": 60, "volumeInGb": 0, "volumeMountPath": "/workspace", "dockerArgs": "", "ports": "", "readme": "",
        "env": [{"key": "NVIDIA_DRIVER_CAPABILITIES", "value": "all"}],
    }
    if existing:
        template["id"] = existing["id"]
    return gql("mutation($i: SaveTemplateInput) { saveTemplate(input: $i) { id name imageName } }", {"i": template})["saveTemplate"]


def create(tag="staging"):
    me = myself()
    template = save_template(me, tag)
    print(f"template {template['name']} ({template['id']}): {template['imageName']}")
    existing = {e["name"]: e for e in me["endpoints"] or []}
    for name, hardware in ENDPOINTS.items():
        endpoint = {"name": name, "templateId": template["id"], "workersMin": 0, "workersMax": 3, "idleTimeout": 5,
                    "scalerType": "QUEUE_DELAY", "scalerValue": 1, **hardware}
        if name in existing:
            endpoint["id"] = existing[name]["id"]
        saved = gql("mutation($i: EndpointInput!) { saveEndpoint(input: $i) { id name } }", {"i": endpoint})["saveEndpoint"]
        print(f"{RAILWAY_NAMES[name]}={saved['id']}   # {name}")


def set_image(tag):
    template = save_template(myself(), tag)
    print(f"template now runs {template['imageName']} (new workers pick it up)")


def delete():
    me = myself()
    for e in me["endpoints"] or []:
        if e["name"] in ENDPOINTS:
            gql("mutation($i: EndpointInput!) { saveEndpoint(input: $i) { id } }",
                {"i": {"id": e["id"], "name": e["name"], "templateId": e["templateId"], "workersMin": 0, "workersMax": 0, **ENDPOINTS[e["name"]]}})
            gql("mutation($id: String!) { deleteEndpoint(id: $id) }", {"id": e["id"]})
            print(f"deleted endpoint {e['name']}")
    for t in me["podTemplates"] or []:
        if t["name"] == TEMPLATE:
            gql("mutation($n: String!) { deleteTemplate(templateName: $n) }", {"n": TEMPLATE})
            print(f"deleted template {TEMPLATE}")


if __name__ == "__main__":
    if not KEY:
        raise SystemExit("RUNPOD_API_KEY is not in .env")
    command = sys.argv[1] if len(sys.argv) > 1 else "show"
    if command == "show":
        show()
    elif command == "create":
        create(sys.argv[2] if len(sys.argv) > 2 else "staging")
    elif command == "image" and len(sys.argv) > 2:
        set_image(sys.argv[2])
    elif command == "delete":
        delete()
    else:
        print(__doc__)
