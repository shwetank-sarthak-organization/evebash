"""
Shows or sets the photo pipeline switch read by modal_engine/main.py (issue #77). Takes effect on the next
upload, with no deploy. Run from the repo root with the Modal CLI's Python:

  modal_engine/venv/bin/python modal_engine/photo_pipeline_switch.py show
  modal_engine/venv/bin/python modal_engine/photo_pipeline_switch.py mode v2        # every photo on v2
  modal_engine/venv/bin/python modal_engine/photo_pipeline_switch.py mode v1        # back to today's workers
  modal_engine/venv/bin/python modal_engine/photo_pipeline_switch.py add-gallery <gallery id>
  modal_engine/venv/bin/python modal_engine/photo_pipeline_switch.py remove-gallery <gallery id>
  modal_engine/venv/bin/python modal_engine/photo_pipeline_switch.py face-filter 0.5 24   # v2 skips unclear faces
  modal_engine/venv/bin/python modal_engine/photo_pipeline_switch.py face-filter off      # v2 saves every face
  modal_engine/venv/bin/python modal_engine/photo_pipeline_switch.py grid add <gallery id>  # grid image for one gallery
  modal_engine/venv/bin/python modal_engine/photo_pipeline_switch.py grid all              # grid image for every photo
  modal_engine/venv/bin/python modal_engine/photo_pipeline_switch.py grid off              # no grid image (default)

add-gallery sends just that gallery's new photos to v2 while mode is v1. A sub-gallery has its own id.
face-filter <min score> <min px> (issue #101): v2 doesn't save faces with a detection score below <min score>
or a box smaller than <min px> on the 1600 px preview. Applies to new photos within a minute.
grid (issue #121): v2 also saves a 1000 px "<file>-grid.webp" for the website grid. Applies within a minute.
"""
import sys

import modal

SWITCH_NAME = "photo-pipeline-switch"  # must match PHOTO_PIPELINE_SWITCH in main.py


def main(argv):
    switch = modal.Dict.from_name(SWITCH_NAME, create_if_missing=True)
    command = argv[1] if len(argv) > 1 else "show"
    value = argv[2] if len(argv) > 2 else ""

    if command == "mode" and value in ("v1", "v2"):
        switch["mode"] = value
    elif command == "add-gallery" and value:
        galleries = switch.get("v2_events", [])
        if value not in galleries:
            switch["v2_events"] = galleries + [value]
    elif command == "remove-gallery" and value:
        switch["v2_events"] = [g for g in switch.get("v2_events", []) if g != value]
    elif command == "face-filter" and value == "off":
        switch.pop("face_filter", None)
    elif command == "face-filter" and len(argv) > 3:
        switch["face_filter"] = {"min_score": float(argv[2]), "min_px": float(argv[3])}
    elif command == "grid" and value == "off":
        switch.pop("grid", None)
    elif command == "grid" and value == "all":
        switch["grid"] = "all"
    elif command == "grid" and value == "add" and len(argv) > 3:
        galleries = switch.get("grid") if isinstance(switch.get("grid"), list) else []
        if argv[3] not in galleries:
            switch["grid"] = galleries + [argv[3]]
    elif command != "show":
        print(__doc__)
        return 1

    print(f"mode: {switch.get('mode', 'v1')}")
    print(f"v2 test galleries: {switch.get('v2_events', []) or 'none'}")
    print(f"face filter: {switch.get('face_filter') or 'off (every face saved)'}")
    print(f"grid image: {switch.get('grid') or 'off'}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
