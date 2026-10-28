# RunPod serverless video worker (todo #18). Built and published by .github/workflows/runpod-video-worker.yml to
# ghcr.io/shwetank-sarthak-organization/evebash-video-worker (private). Build context: the repository root.
# One image for every RunPod video endpoint: the GPU endpoints run hardware "gpu" (NVENC), the CPU endpoint "cpu".
FROM python:3.11-slim

# The same pinned Jellyfin ffmpeg as Modal's all-formats GPU worker (gpu_all_image in modal_engine/main.py):
# NVENC/NVDEC, scale_cuda, tonemap_cuda, transpose_cuda, plus libx264 and zscale for the CPU command.
ARG JELLYFIN_FFMPEG_URL=https://github.com/jellyfin/jellyfin-ffmpeg/releases/download/v7.1.4-3/jellyfin-ffmpeg_7.1.4-3_portable_linux64-gpl.tar.xz
ARG JELLYFIN_FFMPEG_SHA256=cab9ff40a47e4232d231e4eb7e4e85fabfeec56c6905266bc94291fc0881f83f
RUN apt-get update \
    && apt-get install -y --no-install-recommends wget xz-utils ca-certificates \
    && wget -q -O /tmp/jellyfin-ffmpeg.tar.xz "$JELLYFIN_FFMPEG_URL" \
    && echo "$JELLYFIN_FFMPEG_SHA256  /tmp/jellyfin-ffmpeg.tar.xz" | sha256sum -c - \
    && mkdir -p /opt/jellyfin-ffmpeg \
    && tar -xJf /tmp/jellyfin-ffmpeg.tar.xz -C /opt/jellyfin-ffmpeg \
    && rm /tmp/jellyfin-ffmpeg.tar.xz \
    && ln -s /opt/jellyfin-ffmpeg/ffmpeg /usr/local/bin/ffmpeg \
    && ln -s /opt/jellyfin-ffmpeg/ffprobe /usr/local/bin/ffprobe \
    && apt-get purge -y wget xz-utils && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

# Without "video" the NVIDIA runtime doesn't mount the encoder/decoder libraries and NVENC fails
ENV NVIDIA_DRIVER_CAPABILITIES=all \
    NVIDIA_VISIBLE_DEVICES=all \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY runpod_worker/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
COPY modal_engine/main.py /app/main.py
COPY runpod_worker/handler.py /app/handler.py

CMD ["python", "-u", "/app/handler.py"]
