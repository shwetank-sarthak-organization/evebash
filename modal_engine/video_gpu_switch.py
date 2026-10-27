"""
Shows or sets the long-video GPU switch read by modal_engine/main.py (issue #112). Takes effect on the next
long video (> 10 min), with no deploy. Run from the repo root with the Modal CLI's Python:

  modal_engine/venv/bin/python modal_engine/video_gpu_switch.py show
  modal_engine/venv/bin/python modal_engine/video_gpu_switch.py mode on         # every long video on the L4
  modal_engine/venv/bin/python modal_engine/video_gpu_switch.py mode off        # back to the 16-core worker
  modal_engine/venv/bin/python modal_engine/video_gpu_switch.py add-gallery <gallery id>
  modal_engine/venv/bin/python modal_engine/video_gpu_switch.py remove-gallery <gallery id>
  modal_engine/venv/bin/python modal_engine/video_gpu_switch.py wait 180        # seconds to wait for an L4
  modal_engine/venv/bin/python modal_engine/video_gpu_switch.py sdr-8bit on     # 10-bit/HDR/4:2:2 -> 8-bit SDR (#118)
  modal_engine/venv/bin/python modal_engine/video_gpu_switch.py sdr-8bit off    # keep the source format, as before
  modal_engine/venv/bin/python modal_engine/video_gpu_switch.py probe-v2 on     # rotation-safe video probe (#119)
  modal_engine/venv/bin/python modal_engine/video_gpu_switch.py probe-v2 off    # old probes, as before
  modal_engine/venv/bin/python modal_engine/video_gpu_switch.py all-formats on   # GPU takes every format (#141)
  modal_engine/venv/bin/python modal_engine/video_gpu_switch.py all-formats off  # GPU hands some to the 16-core
  modal_engine/venv/bin/python modal_engine/video_gpu_switch.py poster-sdr on    # HDR posters in normal colours (#145)
  modal_engine/venv/bin/python modal_engine/video_gpu_switch.py poster-sdr off   # poster = the plain frame, as before
  modal_engine/venv/bin/python modal_engine/video_gpu_switch.py queue-aware on   # queued time + heartbeat on the row (#157)
  modal_engine/venv/bin/python modal_engine/video_gpu_switch.py queue-aware off  # no markers, no skip, as before

add-gallery sends just that gallery's long videos to the GPU while mode is off. A sub-gallery has its own id.
A long video still goes to the 16-core worker when the GPU can't take it (10-bit, rotated phone video...),
when the GPU run fails, or when no L4 picks it up within the wait.
sdr-8bit (issue #118, every video length, CPU workers): converts 10-bit, HDR and 4:2:2 sources to 8-bit 4:2:0
SDR so every phone can play them. Videos that are already 8-bit 4:2:0 SDR are not affected either way.
probe-v2 (issue #119, every video): reads audio and height from one JSON probe, so portrait phone videos without
audio no longer fail and small portrait videos don't get an enlarged 1080p stream.
all-formats (issue #141, long videos that go to the GPU): the GPU worker keeps 10-bit, HDR, rotated and other
formats itself instead of handing them to the 16-core worker; only a failed GPU run or no free L4 still does.
poster-sdr (issue #145, every video, every worker): the poster of an HDR video is tone-mapped like the streams
(not pale), and a poster bigger than 1080p is shrunk. SDR videos up to 1080p get the same poster either way.
queue-aware (issue #157, every video, every worker): writes transcode_queued_at when Modal accepts or hands over a
video and transcode_heartbeat_at every minute while a worker runs it, and skips a re-sent copy of a video that is
already processed. Needs supabase/migrations/20261027000000_video_transcode_heartbeat.sql. Turn it on before the
backend's VIDEO_WATCHDOG_QUEUE_AWARE=true, which reads these columns.
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
    elif command == "sdr-8bit" and value in ("on", "off"):
        switch["sdr_8bit"] = value == "on"
    elif command == "probe-v2" and value in ("on", "off"):
        switch["probe_v2"] = value == "on"
    elif command == "all-formats" and value in ("on", "off"):
        switch["gpu_all_formats"] = value == "on"
    elif command == "poster-sdr" and value in ("on", "off"):
        switch["poster_sdr"] = value == "on"
    elif command == "queue-aware" and value in ("on", "off"):
        switch["queue_aware"] = value == "on"
    elif command != "show":
        print(__doc__)
        return 1

    print(f"mode: {switch.get('mode', 'off')}")
    print(f"GPU test galleries: {switch.get('gpu_events', []) or 'none'}")
    print(f"wait for an L4: {switch.get('gpu_wait_s', 180)} s")
    print(f"8-bit SDR output (#118): {'on' if switch.get('sdr_8bit', False) else 'off'}")
    print(f"rotation-safe probe (#119): {'on' if switch.get('probe_v2', False) else 'off'}")
    print(f"GPU takes every format (#141): {'on' if switch.get('gpu_all_formats', False) else 'off'}")
    print(f"HDR posters in normal colours (#145): {'on' if switch.get('poster_sdr', False) else 'off'}")
    print(f"queued time, heartbeat and done-skip (#157): {'on' if switch.get('queue_aware', False) else 'off'}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
