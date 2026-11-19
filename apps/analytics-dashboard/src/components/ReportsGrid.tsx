import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Ban, CheckCircle2, Clock, ExternalLink, Flag, RefreshCw, Trash2, XCircle } from 'lucide-react';
import { runAdminAction, type ContentReport, type ContentReportStatus } from '../lib/adminApi';

const REASON_LABELS: Record<string, string> = {
  sexual: 'Nudity or sexual content',
  child_safety: 'Child safety concern',
  harassment: 'Harassment or bullying',
  hate: 'Hate speech or symbols',
  violence: 'Violence or dangerous acts',
  spam: 'Spam, scam or fake',
  privacy: 'Private info / no consent',
  other: 'Something else',
};

const TYPE_LABELS: Record<ContentReport['target_type'], string> = {
  media: 'Photo / video',
  comment: 'Comment',
  chat_message: 'Chat message',
  business: 'Business profile',
  user: 'User',
};

const statusFilters: Array<'open' | 'actioned' | 'dismissed' | 'all'> = ['open', 'actioned', 'dismissed', 'all'];

function siteUrl() {
  const env = (import.meta as any).env;
  return (env.VITE_SITE_URL || 'https://www.evebash.com').replace(/\/$/, '');
}

// Where the reported item can be seen on the website (chat messages have no web page)
function itemLink(report: ContentReport) {
  const base = siteUrl();
  if ((report.target_type === 'media' || report.target_type === 'comment') && report.event_id) {
    return `${base}/events/${encodeURIComponent(report.event_id)}`;
  }
  if (report.target_type === 'business') return `${base}/eb-network/${encodeURIComponent(report.target_id)}`;
  if (report.target_type === 'user') return `${base}/profile/${encodeURIComponent(report.target_id)}`;
  return '';
}

function formatDate(value?: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function hoursOpen(createdAt: string) {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 3_600_000);
}

function statusClass(status: ContentReportStatus) {
  if (status === 'open') return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
  if (status === 'actioned') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
  return 'bg-slate-500/10 text-slate-300 border-slate-500/20';
}

export const ReportsGrid: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]>('open');
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await runAdminAction('listContentReports', { status: statusFilter }).catch((err: Error) => ({ success: false, error: err.message }));
    if (!result.success) setError(result.error || 'Could not load reports.');
    else setReports((result as { reports?: ContentReport[] }).reports || []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);

  // Reports about the same item are counted together so repeat reports stand out
  const reportCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const report of reports) {
      if (report.status !== 'open') continue;
      const key = `${report.target_type}:${report.target_id}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [reports]);

  const openCount = reports.filter((report) => report.status === 'open').length;
  const overdueCount = reports.filter((report) => report.status === 'open' && hoursOpen(report.created_at) >= 24).length;

  const act = async (report: ContentReport, action: 'dismiss' | 'actioned' | 'reopen' | 'remove' | 'suspend' | 'unsuspend') => {
    let adminNote = '';
    if (action === 'remove') {
      if (!confirm(`Permanently delete this ${TYPE_LABELS[report.target_type].toLowerCase()}? This can't be undone.`)) return;
    } else if (action === 'suspend') {
      if (!confirm(`Suspend ${report.reported_user_name || report.reported_user_email || 'this account'}? They won't be able to log in until you lift it.`)) return;
    } else if (action === 'dismiss' || action === 'actioned') {
      const note = prompt('Note for the record (optional):', '');
      if (note === null) return;
      adminNote = note;
    }
    setBusyId(report.id);
    const result = action === 'remove'
      ? await runAdminAction('removeReportedContent', { reportId: report.id, confirm: 'REMOVE_REPORTED_CONTENT' })
      : action === 'suspend' || action === 'unsuspend'
        ? await runAdminAction('setReportedUserSuspended', { reportId: report.id, suspended: action === 'suspend', confirm: 'SUSPEND_USER' })
        : await runAdminAction('reviewContentReport', {
          reportId: report.id,
          status: action === 'dismiss' ? 'dismissed' : action === 'actioned' ? 'actioned' : 'open',
          adminNote,
        });
    setBusyId('');
    if (!result.success) {
      alert(result.error || 'Action failed.');
      return;
    }
    await load();
  };

  const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-colors disabled:opacity-50';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-400">Open</p>
          <p className="mt-2 text-3xl font-black text-white">{statusFilter === 'open' || statusFilter === 'all' ? openCount : '—'}</p>
        </div>
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-rose-400">Open over 24 h</p>
          <p className="mt-2 text-3xl font-black text-white">{statusFilter === 'open' || statusFilter === 'all' ? overdueCount : '—'}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Shown</p>
          <p className="mt-2 text-3xl font-black text-white">{reports.length}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-black text-white">Reports</h3>
            <p className="text-sm text-slate-500 mt-1">
              Content and users reported from the website and app. We promise users a review within 24 hours.
            </p>
          </div>
          <div className="flex gap-3">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm font-semibold text-slate-200 outline-none focus:border-indigo-500"
            >
              {statusFilters.map((status) => <option key={status} value={status}>{status.toUpperCase()}</option>)}
            </select>
            <button type="button" onClick={() => void load()} className={`${buttonClass} border-slate-800 bg-slate-950 text-slate-200`}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div className="p-10 text-center text-rose-300 flex items-center justify-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</div>
        ) : loading && reports.length === 0 ? (
          <div className="p-10 text-center text-slate-500">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="p-10 text-center text-slate-500">No reports here.</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {reports.map((report) => {
              const link = itemLink(report);
              const repeats = reportCounts.get(`${report.target_type}:${report.target_id}`) || 0;
              const overdue = report.status === 'open' && hoursOpen(report.created_at) >= 24;
              const removable = report.target_type === 'media' || report.target_type === 'comment' || report.target_type === 'chat_message';
              const busy = busyId === report.id;
              return (
                <article key={report.id} className="p-5 hover:bg-slate-800/20 transition-colors">
                  <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 text-base font-black text-white">
                          <Flag className="w-4 h-4 text-rose-400" /> {REASON_LABELS[report.reason] || report.reason}
                        </span>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${statusClass(report.status)}`}>{report.status}</span>
                        <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-300">
                          {TYPE_LABELS[report.target_type]}
                        </span>
                        {repeats > 1 && (
                          <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-rose-300">
                            {repeats} open reports
                          </span>
                        )}
                        {report.reason === 'child_safety' && (
                          <span className="rounded-full border border-rose-500/40 bg-rose-500/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-rose-200">Urgent</span>
                        )}
                      </div>

                      <div className="flex gap-4">
                        {report.media && (
                          <a href={report.media.url || undefined} target="_blank" rel="noreferrer" className="shrink-0">
                            {report.media.is_video ? (
                              <video src={report.media.url || undefined} poster={report.media.thumbnail_url || undefined} className="h-28 w-28 rounded-xl object-cover bg-slate-950" muted />
                            ) : (
                              <img src={report.media.thumbnail_url || report.media.url || undefined} alt="Reported media" className="h-28 w-28 rounded-xl object-cover bg-slate-950" />
                            )}
                          </a>
                        )}
                        {report.target_type === 'media' && !report.media && (
                          <div className="h-28 w-28 shrink-0 rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-center text-center text-xs text-slate-500 p-2">Media deleted</div>
                        )}
                        <div className="min-w-0 space-y-2 text-sm text-slate-300">
                          {report.target_snapshot && (
                            <p className="whitespace-pre-wrap rounded-2xl border border-slate-800 bg-slate-950/60 p-3 leading-6">{report.target_snapshot}</p>
                          )}
                          {report.event_title && <p><span className="text-slate-500">Gallery:</span> {report.event_title}</p>}
                          <p>
                            <span className="text-slate-500">Reported account:</span>{' '}
                            {report.reported_user_id
                              ? `${report.reported_user_name || 'No name'} ${report.reported_user_email ? `(${report.reported_user_email})` : ''}`
                              : 'Unknown'}
                            {report.reported_user_suspended && <span className="ml-2 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-black uppercase text-rose-300">Suspended</span>}
                          </p>
                          <p>
                            <span className="text-slate-500">Reported by:</span>{' '}
                            {report.reporter_id ? `${report.reporter_name || 'No name'} ${report.reporter_email ? `(${report.reporter_email})` : ''}` : 'Deleted account'}
                            {report.platform && <span className="text-slate-500"> on {report.platform}</span>}
                          </p>
                          {report.note && <p><span className="text-slate-500">Their note:</span> {report.note}</p>}
                          {report.admin_note && <p><span className="text-slate-500">Admin note:</span> {report.admin_note}</p>}
                          <p className="text-xs text-slate-600 break-all">{report.target_type} id {report.target_id}</p>
                        </div>
                      </div>
                    </div>

                    <div className="xl:w-60 shrink-0 space-y-2">
                      <div className={`flex items-center gap-2 text-xs font-semibold ${overdue ? 'text-rose-300' : 'text-slate-500'}`}>
                        <Clock className="w-4 h-4" />
                        {formatDate(report.created_at)}{overdue && ' · over 24 h'}
                      </div>
                      {report.reviewed_at && <p className="text-xs text-slate-500">Reviewed {formatDate(report.reviewed_at)}</p>}
                      {link && (
                        <a href={link} target="_blank" rel="noreferrer" className={`${buttonClass} w-full border-slate-700 bg-slate-950 text-sky-300 hover:text-sky-200`}>
                          <ExternalLink className="w-4 h-4" /> Open on website
                        </a>
                      )}
                      {report.status === 'open' ? (
                        <>
                          {removable && (
                            <button type="button" disabled={busy} onClick={() => void act(report, 'remove')} className={`${buttonClass} w-full border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20`}>
                              <Trash2 className="w-4 h-4" /> Remove content
                            </button>
                          )}
                          <button type="button" disabled={busy} onClick={() => void act(report, 'actioned')} className={`${buttonClass} w-full border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20`}>
                            <CheckCircle2 className="w-4 h-4" /> Mark actioned
                          </button>
                          <button type="button" disabled={busy} onClick={() => void act(report, 'dismiss')} className={`${buttonClass} w-full border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800`}>
                            <XCircle className="w-4 h-4" /> Dismiss
                          </button>
                        </>
                      ) : (
                        <button type="button" disabled={busy} onClick={() => void act(report, 'reopen')} className={`${buttonClass} w-full border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800`}>
                          <RefreshCw className="w-4 h-4" /> Reopen
                        </button>
                      )}
                      {report.reported_user_id && (
                        report.reported_user_suspended ? (
                          <button type="button" disabled={busy} onClick={() => void act(report, 'unsuspend')} className={`${buttonClass} w-full border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800`}>
                            <Ban className="w-4 h-4" /> Lift suspension
                          </button>
                        ) : (
                          <button type="button" disabled={busy} onClick={() => void act(report, 'suspend')} className={`${buttonClass} w-full border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20`}>
                            <Ban className="w-4 h-4" /> Suspend account
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
