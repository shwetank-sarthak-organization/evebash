import { useEffect, useRef, useState } from 'react';
import type { Event } from '../lib/analytics';
import { runAdminAction, type GalleryMedia } from '../lib/adminApi';

const buttonClass = 'rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-40';
const isVideo = (media: GalleryMedia) => media.media_type === 'video' || media.resource_type === 'video';

export function GalleryViewer({ initialGallery, events, onClose }: {
  initialGallery: Event;
  events: Event[];
  onClose: () => void;
}) {
  const [gallery, setGallery] = useState(initialGallery);
  const [media, setMedia] = useState<GalleryMedia[]>([]);
  const [page, setPage] = useState(0);
  const [mediaType, setMediaType] = useState<'images' | 'videos'>('images');
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const parent = events.find(event => event.id === gallery.parentId);
  const children = events.filter(event => event.parentId === gallery.id);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setMedia([]);
    setHasMore(false);
    setSelected(null);
    async function load() {
      try {
        const result = await runAdminAction('viewGallery', { eventId: gallery.id, offset: page * 48, mediaType });
        if (!active) return;
        if (!result.success) throw new Error(result.error || 'Unable to load gallery');
        setMedia(result.media || []);
        setHasMore(!!result.hasMore);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load gallery');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [gallery.id, page, mediaType, retry]);

  useEffect(() => {
    if (selected !== null) dialog.current?.showModal();
    else dialog.current?.close();
  }, [selected]);

  const navigate = (event: Event) => { setGallery(event); setPage(0); setSelected(null); };
  const current = selected === null ? null : media[selected];

  return <section className="space-y-6">
    <button type="button" onClick={onClose} className={buttonClass}>← Back to User Accounts</button>
    <div>
      <h2 className="text-2xl font-bold text-white">{gallery.title || 'Untitled Gallery'}</h2>
      <p className="mt-1 text-sm text-slate-400">Photos and videos in this gallery’s home section</p>
    </div>
    {parent && <button type="button" onClick={() => navigate(parent)} className={buttonClass}>← {parent.title}</button>}
    {children.length > 0 && <nav aria-label="Sub-galleries" className="flex flex-wrap gap-2">
      {children.map(child => <button key={child.id} type="button" onClick={() => navigate(child)} className={buttonClass}>{child.title || 'Untitled Sub-gallery'}</button>)}
    </nav>}
    <div role="group" aria-label="Media type" className="flex gap-2">
      {(['images', 'videos'] as const).map(type => <button
        key={type}
        type="button"
        aria-pressed={mediaType === type}
        onClick={() => { setMediaType(type); setPage(0); setSelected(null); }}
        className={`${buttonClass} ${mediaType === type ? 'border-violet-400 bg-violet-600 text-white' : ''}`}
      >{type === 'images' ? 'Images' : 'Videos'}</button>)}
    </div>
    {loading && <p role="status" className="text-slate-400">Loading gallery…</p>}
    {error && <div role="alert" className="space-y-3 text-rose-300"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className={buttonClass}>Retry</button></div>}
    {!loading && !error && media.length === 0 && <p className="text-slate-400">No {mediaType} in this section. Select a sub-gallery above if available.</p>}
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
      {media.map((item, index) => <button key={item.id} type="button" onClick={() => setSelected(index)} aria-label={`Open ${isVideo(item) ? 'video' : 'photo'} ${page * 48 + index + 1}`} className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-left text-slate-300">
        {isVideo(item) ? <div className="relative flex aspect-square items-center justify-center bg-black">
          {item.thumbnail_url && <img src={item.thumbnail_url} alt="" loading="lazy" className="absolute h-full w-full object-cover" />}
          <span className="relative rounded bg-black/70 px-3 py-2">▶ Video</span>
        </div> : <img src={item.thumbnail_url || item.preview_url || item.url} alt={`Photo ${page * 48 + index + 1}`} loading="lazy" className="aspect-square w-full object-cover" onError={event => { if (event.currentTarget.getAttribute('src') !== item.url) event.currentTarget.src = item.url; }} />}
        <span className="block px-3 py-2 text-xs">{isVideo(item) ? 'Video' : 'Photo'} {page * 48 + index + 1}</span>
      </button>)}
    </div>
    <div className="flex items-center gap-3">
      <button type="button" disabled={loading || page === 0} onClick={() => setPage(value => value - 1)} className={buttonClass}>Previous page</button>
      <span className="text-sm text-slate-400">Page {page + 1}</span>
      <button type="button" disabled={loading || !hasMore} onClick={() => setPage(value => value + 1)} className={buttonClass}>Next page</button>
    </div>
    <dialog ref={dialog} onCancel={() => setSelected(null)} onClose={() => setSelected(null)} aria-label="Gallery media viewer" className="fixed inset-0 m-auto max-h-[95vh] w-[min(1100px,95vw)] max-w-none rounded-xl border border-slate-600 bg-slate-950 p-4 text-white backdrop:bg-black/80">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setSelected(null)} className={buttonClass}>Close</button>
        <div className="flex gap-2">
          <button type="button" disabled={selected === null || selected === 0} onClick={() => setSelected(value => value === null ? null : value - 1)} className={buttonClass}>Previous</button>
          <button type="button" disabled={selected === null || selected >= media.length - 1} onClick={() => setSelected(value => value === null ? null : value + 1)} className={buttonClass}>Next</button>
        </div>
      </div>
      {current && (isVideo(current)
        ? <video key={current.id} src={current.url} poster={current.thumbnail_url || undefined} controls playsInline className="max-h-[75vh] w-full" />
        : <img key={current.id} src={current.url} alt="Selected gallery photo" className="max-h-[75vh] w-full object-contain" />)}
    </dialog>
  </section>;
}
