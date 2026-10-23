"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2 } from "lucide-react";
import { ALBUM_MAX_VOICE_SECONDS } from "@/lib/albumApi";
import { albumButton, formatSeconds } from "./albumUi";

export type VoiceRecording = { blob: Blob; seconds: number; url: string };

// AAC in MP4 plays everywhere, including the iPhone app, so it's preferred when the browser can record it
// (Safari, recent Chrome and Edge). Firefox records Opus.
const RECORDING_TYPES = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];

function pickRecordingType() {
    if (typeof MediaRecorder === "undefined") return null;
    return RECORDING_TYPES.find((type) => MediaRecorder.isTypeSupported?.(type)) ?? "";
}

export function VoiceRecorder({ value, onChange, disabled }: {
    value: VoiceRecording | null;
    onChange: (recording: VoiceRecording | null) => void;
    disabled?: boolean;
}) {
    const [recording, setRecording] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [error, setError] = useState("");
    const recorderRef = useRef<MediaRecorder | null>(null);
    const timerRef = useRef<number | null>(null);
    const startedRef = useRef(0);

    useEffect(() => () => {
        if (timerRef.current) window.clearInterval(timerRef.current);
        recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    }, []);

    const stop = () => {
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    };

    const start = async () => {
        setError("");
        const type = pickRecordingType();
        if (type === null || !navigator.mediaDevices?.getUserMedia) {
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
        const recorder = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 64_000 } : undefined);
        const chunks: Blob[] = [];
        recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
        recorder.onstop = () => {
            stream.getTracks().forEach((track) => track.stop());
            if (timerRef.current) window.clearInterval(timerRef.current);
            setRecording(false);
            const seconds = Math.min((Date.now() - startedRef.current) / 1000, ALBUM_MAX_VOICE_SECONDS);
            const blob = new Blob(chunks, { type: (recorder.mimeType || type || "audio/webm").split(";")[0] });
            if (seconds < 0.5 || !blob.size) return;
            onChange({ blob, seconds, url: URL.createObjectURL(blob) });
        };
        recorderRef.current = recorder;
        startedRef.current = Date.now();
        setElapsed(0);
        recorder.start(1000);
        setRecording(true);
        timerRef.current = window.setInterval(() => {
            const seconds = (Date.now() - startedRef.current) / 1000;
            setElapsed(seconds);
            if (seconds >= ALBUM_MAX_VOICE_SECONDS) stop();
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
                <button type="button" onClick={stop} className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-rose-400/50 bg-rose-500/15 px-4 py-3 text-sm font-black text-rose-100">
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
