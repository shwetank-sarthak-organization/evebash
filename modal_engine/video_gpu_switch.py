"""
Shows or sets the long-video GPU switch read by modal_engine/main.py (issue #112). Takes effect on the next
long video (> 10 min), with no deploy. Run from the repo root with the Modal CLI's Python:

  modal_engine/venv/bin/python modal_engine/video_gpu_switch.py show
  modal_engine/venv/bin/python modal_engine/video_gpu_switch.py mode on         # every long video on the L4
  modal_engine/venv/bin/python modal_engine/video_gpu_switch.py mode off        # back to the 16-core worker
  modal_engine/venv/bin/python modal_engine/video_gpu_switch.py add-gallery <gallery id>
  modal_engine/venv/bin/python modal_engine/video_gpu_switch.py remove-gallery <gallery id>
  modal_engine/venv/bin/python modal_engine/video_gpu_switch.py wait 180        # seconds to wait for an L4

add-gallery sends just that gallery's long videos to the GPU while mode is off. A sub-gallery has its own id.
A long video still goes to the 16-core worker when the GPU can't take it (10-bit, rotated phone video...),
when the GPU run fails, or when no L4 picks it up within the wait.
"""
import sys

import modal

SWITCH_NAME = "video-gpu-switch"  # must match VIDEO_GPU_SWITCH in main.py


def main(argv):
    switch = modal.Dict.from_name(SWITCH_NAME, create_if_missing=True)
    command = argv[1] if len(argv) > 1 else "show"
    value = argv[2] if len(argv) > 2 else ""

    if command == "mode" and value in ("on", "off"):
        switch["mode"] = value
    elif command == "add-gallery" and value:
        galleries = switch.get("gpu_events", [])
        if value not in galleries:
            switch["gpu_events"] = galleries + [value]
    elif command == "remove-gallery" and value:
        switch["gpu_events"] = [g for g in switch.get("gpu_events", []) if g != value]
    elif command == "wait" and value.isdigit():
        switch["gpu_wait_s"] = int(value)
    elif command != "show":
        print(__doc__)
        return 1

    print(f"mode: {switch.get('mode', 'off')}")
    print(f"GPU test galleries: {switch.get('gpu_events', []) or 'none'}")
    print(f"wait for an L4: {switch.get('gpu_wait_s', 180)} s")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
