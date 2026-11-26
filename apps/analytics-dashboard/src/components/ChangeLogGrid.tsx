import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, History, RefreshCw, Search, X } from 'lucide-react';
import { runAdminAction, type EventChange } from '../lib/adminApi';

// Todo #27: who changed what in an event and when. Rows come from a database trigger on events
// (supabase/migrations/20261119230000_event_change_log.sql), read through the backend's listEventChanges.

const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  date: 'Date',
  description: 'Message / description',
  cover_image: 'Cover',
  phone_cover_image: 'Phone cover',
  template_id: 'Theme',
  type: 'Type',
  category: 'Category',
  join_id: 'Join ID',
  is_public: 'Public viewing',
  is_hidden: 'Hidden from guests',
  is_sample_gallery: 'Sample gallery',
  gallery_video_id: 'Gallery video',
  created_by: 'Owner',
  parent_id: 'Main gallery',
  vendors: 'Vendors',
};

const ROLE_LABELS: Record<EventChange['actor_role'], string> = {
  owner: 'Owner',
  guest_admin: 'Event admin',
  platform_admin: 'Platform admin',
  other_user: 'Other user',
  backend: 'Backend',
  database: 'Database',
};

const SOURCE_LABELS: Record<EventChange['source'], string> = {
  website: 'Website',
  app: 'App',
  backend: 'Backend',
  database: 'SQL / migration',
  other: 'Other',
};

function fieldLabel(change: EventChange) {
  if (change.action === 'created') return 'Created';
  if (change.action === 'deleted') return 'Deleted';
  if (!change.field) return 'Changed';
  if (change.field.startsWith('theme_content.')) return `Theme content: ${change.field.slice('theme_content.'.length)}`;
  return FIELD_LABELS[change.field] || change.field;
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function Value({ value }: { value: string | null }) {
  if (value === null || value === '') return <span className="text-slate-600">empty</span>;
  if (/^https?:\/\//.test(value)) {
    return <a href={value} target="_blank" rel="noreferrer" className="text-sky-300 hover:text-sky-200 break-all">{value}</a>;
  }
  // Values are cut to 500 characters when logged
  return <span className="whitespace-pre-wrap break-words">{value}{value.length >= 500 ? '…' : ''}</span>;
}

function roleClass(role: EventChange['actor_role']) {
  if (role === 'owner') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
  if (role === 'guest_admin') return 'bg-sky-500/10 text-sky-300 border-sky-500/20';
  if (role === 'platform_admin') return 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20';
  if (role === 'other_user') return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
  return 'bg-slate-500/10 text-slate-300 border-slate-500/20';
}

interface Props {
  /** Show one gallery's log (main event and its sub-galleries) with the filters hidden. */
  eventId?: string;
  title?: string;
  onClose?: () => void;
}

export const ChangeLogGrid: React.FC<Props> = ({ eventId, title, onClose }) => {
  const [eventDraft, setEventDraft] = useState('');
  const [actorDraft, setActorDraft] = useState('');
  const [filters, setFilters] = useState({ event: eventId || '', actor: '' });
  const [changes, setChanges] = useState<EventChange[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Ignores answers to requests that a newer filter replaced
  const requestId = useRef(0);

  const load = useCallback(async (beforeId?: number) => {
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    const result = await runAdminAction('listEventChanges', { eventId: filters.event, actor: filters.actor, beforeId })
      .catch((err: Error) => ({ success: false, error: err.message, changes: undefined, hasMore: undefined }));
    if (id !== requestId.current) return;
    if (!result.success) {
      setError(result.error || 'Could not load the change log.');
    } else {
      const page = result.changes || [];
      setChanges((current) => (beforeId ? [...current, ...page] : page));
      setHasMore(!!result.hasMore);
    }
    setLoading(false);
  }, [filters]);

  useEffect(() => { void load(); }, [load]);

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    setFilters({ event: eventDraft.trim(), actor: actorDraft.trim() });
  };

  const clearFilters = () => {
    setEventDraft('');
    setActorDraft('');
    setFilters({ event: '', actor: '' });
  };

  const showGallery = (rootId: string) => {
    setEventDraft(rootId);
    setFilters((current) => ({ ...current, event: rootId }));
  };

  const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-colors disabled:opacity-50';
  const inputClass = 'rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500 placeholder:text-slate-600';

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/95 overflow-hidden">
      <div className="p-5 border-b border-slate-800 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div>
          <h3 className="text-lg font-black text-white flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" />
            {eventId ? `Change log: ${title || eventId}` : 'Change log'}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {eventId
              ? 'Every change to this gallery and its sub-galleries, newest first.'
              : 'Who changed what in an event, and when. Newest first; filter by gallery or person.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {!eventId && (
            <form onSubmit={applyFilters} className="flex flex-wrap gap-2">
              <input value={eventDraft} onChange={(event) => setEventDraft(event.target.value)} placeholder="Gallery id or Join ID" className={inputClass} />
              <input value={actorDraft} onChange={(event) => setActorDraft(event.target.value)} placeholder="User id or email" className={inputClass} />
              <button type="submit" className={`${buttonClass} border-indigo-500/40 bg-indigo-600 text-white hover:bg-indigo-500`}>
                <Search className="w-4 h-4" /> Filter
              </button>
              {(filters.event || filters.actor) && (
                <button type="button" onClick={clearFilters} className={`${buttonClass} border-slate-800 bg-slate-950 text-slate-300`}>
                  <X className="w-4 h-4" /> Clear
                </button>
              )}
            </form>
          )}
          <button type="button" onClick={() => void load()} className={`${buttonClass} border-slate-800 bg-slate-950 text-slate-200`}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          {onClose && (
            <button type="button" onClick={onClose} className={`${buttonClass} border-slate-800 bg-slate-950 text-slate-200`}>
              <X className="w-4 h-4" /> Close
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div className="p-10 text-center text-rose-300 flex items-center justify-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</div>
      ) : loading && changes.length === 0 ? (
        <div className="p-10 text-center text-slate-500">Loading changes...</div>
      ) : changes.length === 0 ? (
        <div className="p-10 text-center text-slate-500">No changes logged here yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800">
                <th className="px-4 py-3 whitespace-nowrap">When</th>
                <th className="px-4 py-3">Gallery</th>
                <th className="px-4 py-3">What</th>
                <th className="px-4 py-3">Before</th>
                <th className="px-4 py-3">After</th>
                <th className="px-4 py-3">Who</th>
                <th className="px-4 py-3">From</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {changes.map((change) => {
                const isSub = change.event_id !== change.root_event_id;
                const name = change.current_title ?? change.event_title ?? change.event_id;
                return (
                  <tr key={change.id} className="align-top hover:bg-slate-800/20">
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400">{formatDate(change.created_at)}</td>
                    <td className="px-4 py-3 min-w-[160px] text-slate-200">
                      {eventId ? (
                        <span>{name}</span>
                      ) : (
                        <button type="button" onClick={() => showGallery(change.root_event_id)} className="text-left hover:text-indigo-300" title="Show only this gallery">
                          {isSub ? (change.root_title || change.root_event_id) : name}
                        </button>
                      )}
                      {isSub && <p className="text-xs text-slate-500">{eventId ? 'Sub-gallery' : `Sub-gallery: ${name}`}</p>}
                      {change.current_title === null && <p className="text-[10px] font-black uppercase text-rose-300">Deleted</p>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-semibold text-white">{fieldLabel(change)}</td>
                    <td className="px-4 py-3 max-w-[260px] text-xs text-slate-300">
                      {change.action === 'updated' ? <Value value={change.old_value} /> : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 max-w-[260px] text-xs text-slate-300">
                      {change.action === 'updated' ? <Value value={change.new_value} /> : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 min-w-[180px]">
                      <p className="text-slate-200">{change.actor_name || change.actor_email || (change.actor_id ? 'Unknown user' : '—')}</p>
                      {change.actor_name && change.actor_email && <p className="text-xs text-slate-500 break-all">{change.actor_email}</p>}
                      <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${roleClass(change.actor_role)}`}>
                        {ROLE_LABELS[change.actor_role] || change.actor_role}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-300" title={change.client || undefined}>
                      {SOURCE_LABELS[change.source] || change.source}
                      {change.origin && <p className="text-slate-500">{change.origin}</p>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {hasMore && (
            <div className="p-4 text-center border-t border-slate-800">
              <button type="button" disabled={loading} onClick={() => void load(changes[changes.length - 1]?.id)} className={`${buttonClass} border-slate-700 bg-slate-950 text-slate-200`}>
                {loading ? 'Loading...' : 'Load older changes'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
