"use client";

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getApiUrl } from '@/lib/apiBase';
import type Hls from 'hls.js';

type Props = {
  video: { id: string; url: string; thumbnailUrl?: string | null };
  onClose: () => void;
  onSaved: (id: string, thumbnailUrl: string) => void;
};
const timeLabel = (time: number) => `${Math.floor(time / 60)}:${(time % 60).toFixed(1).padStart(4, '0')}`;

export function VideoThumbnailPicker({ video, onClose, onSaved }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const player = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [frame, setFrame] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const focused = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => focused?.focus();
  }, []);
  useEffect(() => {
    const element = player.current!;
    let hls: Hls | undefined;
    let active = true;
    const fail = () => { if (active) setError('Unable to load this video. Please try again after processing finishes.'); };
    void (async () => {
      if (video.url.includes('.m3u8') && !element.canPlayType('application/vnd.apple.mpegurl')) {
        const { default: HlsPlayer } = await import('hls.js');
        if (!active) return;
        if (!HlsPlayer.isSupported()) return fail();
        hls = new HlsPlayer({ maxBufferLength: 10 });
        hls.on(HlsPlayer.Events.ERROR, (_event, data) => { if (data.fatal) fail(); });
        hls.loadSource(video.url);
        hls.attachMedia(element);
      } else { element.src = video.url; }
    })().catch(fail);
    return () => { active = false; hls?.destroy(); element.pause(); element.removeAttribute('src'); element.load(); };
  }, [video.url]);

  const capture = () => {
    const element = player.current;
    if (!element || element.seeking || element.readyState < 2 || !element.videoWidth) return;
    try {
      const scale = Math.min(1, 1280 / Math.max(element.videoWidth, element.videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(element.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(element.videoHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable');
      context.drawImage(element, 0, 0, canvas.width, canvas.height);
      setFrame(canvas.toDataURL('image/jpeg', 0.85));
      setTime(element.currentTime);
      setError('');
    } catch {
      setFrame('');
      setError('This video could not be captured. Please check that the media domain allows cross-origin video access.');
    }
  };
  const seek = (value: number) => {
    if (!player.current || saving) return;
    const next = Math.max(0, Math.min(value, Math.max(0, duration - 0.05)));
    setTime(next);
    setFrame('');
    if (Math.abs(player.current.currentTime - next) < 0.001) capture();
    else player.current.currentTime = next;
  };
  const save = async () => {
    if (!frame || saving) return;
    setSaving(true); setError('');
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error('Please sign in again to save the thumbnail');
      const response = await fetch(getApiUrl('/api/media/video-thumbnail'), {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ photoId: video.id, previousThumbnailUrl: video.thumbnailUrl || null, image: frame }),
      });
      const result = await response.json();
      if (!response.ok || !result.thumbnailUrl) throw new Error(result.error || 'Unable to save thumbnail');
      onSaved(video.id, result.thumbnailUrl);
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save thumbnail'); }
    finally { setSaving(false); }
  };

  return <dialog ref={dialog} aria-labelledby="thumbnail-title" onCancel={e => { e.preventDefault(); if (!saving) onClose(); }} className="m-auto w-[calc(100%-2rem)] max-w-2xl max-h-[90dvh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 text-white shadow-2xl backdrop:bg-black/70">
    <h2 id="thumbnail-title" className="text-xl font-bold">Change thumbnail</h2>
    <p className="mt-2 text-sm text-slate-300">Move the timeline to choose a frame. The preview below is the image that will be saved.</p>
    <video ref={player} crossOrigin="anonymous" muted playsInline preload="auto" className="mt-4 max-h-[32vh] w-full bg-black object-contain" onError={() => setError('Unable to load video')} onLoadedMetadata={() => {
      const length = player.current?.duration || 0;
      if (!Number.isFinite(length) || length <= 0) { setError('The video duration is unavailable'); return; }
      setDuration(length);
    }} onLoadedData={capture} onSeeking={() => setFrame('')} onSeeked={capture} />
    <label className="mt-4 block text-sm" htmlFor="thumbnail-timeline">Frame position: {timeLabel(time)} / {timeLabel(duration)}</label>
    <input id="thumbnail-timeline" type="range" min={0} max={Math.max(0, duration - 0.05)} step={0.01} value={time} disabled={!duration || saving} onChange={e => seek(Number(e.target.value))} className="my-3 w-full accent-amber-300" />
    <div className="flex gap-3"><button type="button" disabled={!duration || saving} onClick={() => seek(time - 0.1)} className="rounded border border-slate-600 px-3 py-2 disabled:opacity-40">−0.1s</button><button type="button" disabled={!duration || saving} onClick={() => seek(time + 0.1)} className="rounded border border-slate-600 px-3 py-2 disabled:opacity-40">+0.1s</button></div>
    {frame ? <img src={frame} alt="Selected thumbnail preview" className="mx-auto mt-4 max-h-40 object-contain" /> : <p role="status" className="mt-4 text-sm text-slate-300">Loading frame…</p>}
    {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
    <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-600 px-4 py-3 disabled:opacity-40">Cancel</button><button type="button" onClick={save} disabled={!frame || saving} className="rounded-lg bg-[#CA9C68] px-4 py-3 font-bold text-slate-950 disabled:opacity-40">{saving ? 'Saving…' : 'Save thumbnail'}</button></div>
  </dialog>;
}

export function VideoThumbnailActions({ ready, onClose, onChoose, onDelete }: { ready: boolean; onClose: () => void; onChoose: () => void; onDelete: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const focused = document.activeElement as HTMLElement | null; ref.current?.showModal(); return () => focused?.focus(); }, []);
  return <dialog ref={ref} onCancel={e => { e.preventDefault(); onClose(); }} aria-label="Video actions" className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 text-white backdrop:bg-black/60">
    <h2 className="mb-4 text-xl font-bold">Video actions</h2>
    <button type="button" disabled={!ready} onClick={onChoose} className="w-full rounded-lg bg-[#CA9C68] p-3 font-bold text-slate-950 disabled:opacity-40">Change thumbnail</button>
    {!ready && <p className="mt-2 text-sm text-slate-300">Available after video processing finishes.</p>}
    <button type="button" onClick={onDelete} className="mt-3 w-full rounded-lg border border-red-400/40 p-3 text-red-300">Delete video</button>
    <button type="button" onClick={onClose} className="mt-3 w-full rounded-lg border border-slate-600 p-3">Cancel</button>
  </dialog>;
}
