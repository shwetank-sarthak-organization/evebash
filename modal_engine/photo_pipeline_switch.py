"""
Shows or sets the photo pipeline switch read by modal_engine/main.py (issue #77). Takes effect on the next
upload, with no deploy. Run from the repo root with the Modal CLI's Python:

  modal_engine/venv/bin/python modal_engine/photo_pipeline_switch.py show
  modal_engine/venv/bin/python modal_engine/photo_pipeline_switch.py mode v2        # every photo on v2
  modal_engine/venv/bin/python modal_engine/photo_pipeline_switch.py mode v1        # back to today's workers
  modal_engine/venv/bin/python modal_engine/photo_pipeline_switch.py add-gallery <gallery id>
  modal_engine/venv/bin/python modal_engine/photo_pipeline_switch.py remove-gallery <gallery id>

add-gallery sends just that gallery's new photos to v2 while mode is v1. A sub-gallery has its own id.
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
    elif command != "show":
        print(__doc__)
        return 1

    print(f"mode: {switch.get('mode', 'v1')}")
    print(f"v2 test galleries: {switch.get('v2_events', []) or 'none'}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
