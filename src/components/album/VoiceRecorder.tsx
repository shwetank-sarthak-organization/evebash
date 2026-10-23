"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2 } from "lucide-react";
import { ALBUM_MAX_VOICE_SECONDS } from "@/lib/albumApi";
import { startWavRecording } from "@/lib/wavRecorder";
import { albumButton, formatSeconds } from "./albumUi";

export type VoiceRecording = { blob: Blob; seconds: number; url: string };

// AAC in MP4 plays everywhere, including the iPhone app, so it's used when the browser can record it (Safari,
// recent Chrome and Edge). Other browsers (Firefox) record WAV instead: WebM/Opus doesn't play on iPhones (#107).
const AAC_TYPES = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4"];

function pickAacType() {
    if (typeof MediaRecorder === "undefined") return null;
    return AAC_TYPES.find((type) => MediaRecorder.isTypeSupported?.(type)) ?? null;
}

/** Records with MediaRecorder (AAC) or as WAV; finish() gives the file, or null when cancelled. */
type Capture = { finish: () => Promise<Blob | null>; cancel: () => void };

async function startCapture(stream: MediaStream): Promise<Capture> {
    const aac = pickAacType();
    if (aac) {
        const recorder = new MediaRecorder(stream, { mimeType: aac, audioBitsPerSecond: 64_000 });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
        recorder.start(1000);
        const release = () => stream.getTracks().forEach((track) => track.stop());
        return {
            finish: () => new Promise((resolve) => {
                recorder.onstop = () => {
                    release();
                    resolve(new Blob(chunks, { type: (recorder.mimeType || aac).split(";")[0] }));
                };
                recorder.stop();
            }),
            cancel: () => { if (recorder.state !== "inactive") recorder.stop(); release(); },
        };
    }
    const wav = await startWavRecording(stream);
    return { finish: () => wav.stop(), cancel: wav.cancel };
}

export function VoiceRecorder({ value, onChange, disabled }: {
    value: VoiceRecording | null;
    onChange: (recording: VoiceRecording | null) => void;
    disabled?: boolean;
}) {
    const [recording, setRecording] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [error, setError] = useState("");
    const captureRef = useRef<Capture | null>(null);
    const timerRef = useRef<number | null>(null);
    const startedRef = useRef(0);

    useEffect(() => () => {
        if (timerRef.current) window.clearInterval(timerRef.current);
        captureRef.current?.cancel();
    }, []);

    const stop = async () => {
        const capture = captureRef.current;
        if (!capture) return;
        captureRef.current = null;
        if (timerRef.current) window.clearInterval(timerRef.current);
        setRecording(false);
        const seconds = Math.min((Date.now() - startedRef.current) / 1000, ALBUM_MAX_VOICE_SECONDS);
        const blob = await capture.finish().catch(() => null);
        if (!blob || !blob.size || seconds < 0.5) return;
        onChange({ blob, seconds, url: URL.createObjectURL(blob) });
    };

    const start = async () => {
        setError("");
        if (!navigator.mediaDevices?.getUserMedia || (!pickAacType() && typeof AudioContext === "undefined")) {
            setError("This browser can't record audio. Type your comment instead.");
            return;
        }
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
            setError("Allow microphone access in your browser to record a voice note.");
            return;
        }
        try {
            captureRef.current = await startCapture(stream);
        } catch {
            stream.getTracks().forEach((track) => track.stop());
            setError("Recording couldn't start. Type your comment instead.");
            return;
        }
        startedRef.current = Date.now();
        setElapsed(0);
        setRecording(true);
        timerRef.current = window.setInterval(() => {
            const seconds = (Date.now() - startedRef.current) / 1000;
            setElapsed(seconds);
            if (seconds >= ALBUM_MAX_VOICE_SECONDS) void stop();
        }, 250);
    };

    if (value) {
        return (
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 p-2">
                <audio src={value.url} controls preload="metadata" className="h-9 min-w-0 flex-1" />
                <button
                    type="button"
                    onClick={() => { URL.revokeObjectURL(value.url); onChange(null); }}
                    className={albumButton.ghost}
                    aria-label="Delete voice note"
                    title="Delete voice note"
                    disabled={disabled}
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        );
    }

    return (
        <div>
            {recording ? (
                <button type="button" onClick={() => void stop()} className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-rose-400/50 bg-rose-500/15 px-4 py-3 text-sm font-black text-rose-100">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-400" aria-hidden />
                    Recording {formatSeconds(elapsed)} / {formatSeconds(ALBUM_MAX_VOICE_SECONDS)}
                    <Square className="h-4 w-4 fill-current" aria-hidden />
                    <span className="sr-only">Stop recording</span>
                </button>
            ) : (
                <button type="button" onClick={start} disabled={disabled} className={`${albumButton.secondary} w-full normal-case tracking-normal`}>
                    <Mic className="h-4 w-4 text-[#CA9C68]" aria-hidden />
                    Record a voice note
                </button>
            )}
            {error && <p className="mt-2 text-xs font-bold text-rose-300">{error}</p>}
        </div>
    );
}
