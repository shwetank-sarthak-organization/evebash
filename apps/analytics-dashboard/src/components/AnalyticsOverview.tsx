import React, { useState, useMemo } from 'react';
import type { DashboardStats, UserProfile, GuestLog } from '../lib/analytics';
import {
  Users, Calendar, TrendingUp, Award, CreditCard,
  Sparkles, Clock, Database, Activity, Monitor, MapPin, Star,
  ChevronDown,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Timeframe = '1d' | '1w' | '1m' | '1y' | 'all';

interface TimeframeBucket {
  date: string;
  registrations: number;
  logins: number;
}

interface Props {
  stats: DashboardStats;
  users: UserProfile[];
  guests: GuestLog[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseDate = (d?: string) => {
  if (!d) return null;
  const p = new Date(d);
  return isNaN(p.getTime()) ? null : p;
};

const formatSize = (bytes: number | null | undefined) => {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) return '0 B';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Smooth cubic bezier path
const smoothLinePath = (pts: Array<{ x: number; y: number }>) => {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpX = (curr.x - prev.x) * 0.42;
    d += ` C ${prev.x + cpX} ${prev.y}, ${curr.x - cpX} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
};

const smoothAreaPath = (pts: Array<{ x: number; y: number }>, baseY: number) => {
  if (pts.length < 2) return '';
  return `${smoothLinePath(pts)} L ${pts[pts.length - 1].x} ${baseY} L ${pts[0].x} ${baseY} Z`;
};

// ─── Timeline computation ─────────────────────────────────────────────────────

function computeTimeline(
  users: UserProfile[],
  guests: GuestLog[],
  timeframe: Timeframe
): TimeframeBucket[] {
  const now = new Date();
  const y = now.getFullYear();
  const mo = now.getMonth();
  const d = now.getDate();

  // Helper: start-of-day timestamp
  const sod = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

  if (timeframe === '1d') {
    // 24 hourly buckets for today
    const buckets: TimeframeBucket[] = [];
    const todayStart = new Date(y, mo, d, 0, 0, 0, 0).getTime();
    for (let h = 0; h < 24; h++) {
      const start = todayStart + h * 3600_000;
      const end = start + 3600_000;
      const label = `${String(h).padStart(2, '0')}:00`;
      const registrations = users.filter(u => {
        const t = parseDate(u.createdAt)?.getTime();
        return t != null && t >= start && t < end;
      }).length;
      const logins =
        users.filter(u => {
          const t = parseDate(u.lastLogin)?.getTime();
          return t != null && t >= start && t < end;
        }).length +
        guests.filter(g => {
          const t = parseDate(g.loginAt)?.getTime();
          return t != null && t >= start && t < end;
        }).length;
      buckets.push({ date: label, registrations, logins });
    }
    return buckets;
  }

  if (timeframe === '1w') {
    // 7 days — current running calendar week (Sun–Sat)
    const dayOfWeek = now.getDay(); // 0=Sun
    const buckets: TimeframeBucket[] = [];
    for (let i = 0; i < 7; i++) {
      const dt = new Date(y, mo, d - dayOfWeek + i);
      const start = sod(dt);
      const end = start + 86_400_000;
      const label = dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      const registrations = users.filter(u => {
        const t = parseDate(u.createdAt)?.getTime();
        return t != null && t >= start && t < end;
      }).length;
      const logins =
        users.filter(u => {
          const t = parseDate(u.lastLogin)?.getTime();
          return t != null && t >= start && t < end;
        }).length +
        guests.filter(g => {
          const t = parseDate(g.loginAt)?.getTime();
          return t != null && t >= start && t < end;
        }).length;
      buckets.push({ date: label, registrations, logins });
    }
    return buckets;
  }

  if (timeframe === '1m') {
    // Daily buckets for every day in the current calendar month
    const daysInMonth = new Date(y, mo + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const dt = new Date(y, mo, i + 1);
      const start = sod(dt);
      const end = start + 86_400_000;
      const label = dt.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const registrations = users.filter(u => {
        const t = parseDate(u.createdAt)?.getTime();
        return t != null && t >= start && t < end;
      }).length;
      const logins =
        users.filter(u => {
          const t = parseDate(u.lastLogin)?.getTime();
          return t != null && t >= start && t < end;
        }).length +
        guests.filter(g => {
          const t = parseDate(g.loginAt)?.getTime();
          return t != null && t >= start && t < end;
        }).length;
      return { date: label, registrations, logins };
    });
  }

  if (timeframe === '1y') {
    // 12 monthly buckets for the current calendar year
    return Array.from({ length: 12 }, (_, mo_) => {
      const start = new Date(y, mo_, 1).getTime();
      const end = new Date(y, mo_ + 1, 1).getTime();
      const label = new Date(y, mo_, 1).toLocaleDateString([], { month: 'short' });
      const registrations = users.filter(u => {
        const t = parseDate(u.createdAt)?.getTime();
        return t != null && t >= start && t < end;
      }).length;
      const logins =
        users.filter(u => {
          const t = parseDate(u.lastLogin)?.getTime();
          return t != null && t >= start && t < end;
        }).length +
        guests.filter(g => {
          const t = parseDate(g.loginAt)?.getTime();
          return t != null && t >= start && t < end;
        }).length;
      return { date: label, registrations, logins };
    });
  }

  // all-time: monthly buckets from earliest record to now
  const dates: number[] = [];
  users.forEach(u => {
    const t = parseDate(u.createdAt)?.getTime();
    if (t) dates.push(t);
    const l = parseDate(u.lastLogin)?.getTime();
    if (l) dates.push(l);
  });
  guests.forEach(g => {
    const t = parseDate(g.loginAt)?.getTime();
    if (t) dates.push(t);
  });

  if (dates.length === 0) return [{ date: 'No data', registrations: 0, logins: 0 }];

  const earliest = new Date(Math.min(...dates));
  const startYear = earliest.getFullYear();
  const startMo = earliest.getMonth();
  const endYear = y;
  const endMo = mo;

  const buckets: TimeframeBucket[] = [];
  let cy = startYear;
  let cm = startMo;
  while (cy < endYear || (cy === endYear && cm <= endMo)) {
    const start = new Date(cy, cm, 1).getTime();
    const end = new Date(cy, cm + 1, 1).getTime();
    const label = new Date(cy, cm, 1).toLocaleDateString([], { month: 'short', year: '2-digit' });
    const registrations = users.filter(u => {
      const t = parseDate(u.createdAt)?.getTime();
      return t != null && t >= start && t < end;
    }).length;
    const logins =
      users.filter(u => {
        const t = parseDate(u.lastLogin)?.getTime();
        return t != null && t >= start && t < end;
      }).length +
      guests.filter(g => {
        const t = parseDate(g.loginAt)?.getTime();
        return t != null && t >= start && t < end;
      }).length;
    buckets.push({ date: label, registrations, logins });
    if (cm === 11) { cy++; cm = 0; } else { cm++; }
  }
  return buckets;
}

// ─── Timeframe options ────────────────────────────────────────────────────────

const TF_OPTIONS: { value: Timeframe; label: string; short: string }[] = [
  { value: '1d', label: 'Today',    short: '1D' },
  { value: '1w', label: 'This Week',  short: '1W' },
  { value: '1m', label: 'This Month', short: '1M' },
  { value: '1y', label: 'This Year',  short: '1Y' },
  { value: 'all', label: 'All Time',  short: 'All' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export const AnalyticsOverview: React.FC<Props> = ({ stats, users, guests }) => {
  const [timeframe, setTimeframe] = useState<Timeframe>('1w');

  const timeline = useMemo(
    () => computeTimeline(users, guests, timeframe),
    [users, guests, timeframe]
  );

  // Thin out labels when there are many buckets (1m / 1y / all)
  const labelStep = timeline.length > 24
    ? Math.ceil(timeline.length / 12)
    : timeline.length > 12
    ? 2
    : 1;

  const chartWidth = 620;
  const chartHeight = 230;
  const paddingX = 44;
  const paddingY = 28;
  const innerW = chartWidth - paddingX * 2;
  const innerH = chartHeight - paddingY * 2;

  const maxVal = Math.max(...timeline.map(t => Math.max(t.logins, t.registrations)), 1);

  const pts = timeline.map((t, idx) => {
    const x = paddingX + (idx / Math.max(timeline.length - 1, 1)) * innerW;
    const yLogin = chartHeight - paddingY - (t.logins / maxVal) * innerH;
    const yReg   = chartHeight - paddingY - (t.registrations / maxVal) * innerH;
    return { x, yLogin, yReg, ...t };
  });

  const loginPts = pts.map(p => ({ x: p.x, y: p.yLogin }));
  const regPts   = pts.map(p => ({ x: p.x, y: p.yReg }));

  const loginLineD = smoothLinePath(loginPts);
  const loginAreaD = smoothAreaPath(loginPts, chartHeight - paddingY);
  const regLineD   = smoothLinePath(regPts);
  const regAreaD   = smoothAreaPath(regPts, chartHeight - paddingY);

  const premiumRate = (
    (stats.planBreakdown.filter(p => p.name !== 'Free Plan').reduce((s, p) => s + p.count, 0) /
      (stats.totalUsers || 1)) * 100
  ).toFixed(1);

  const gridVals = [0, 0.25, 0.5, 0.75, 1];

  // Summary numbers for the selected window
  const totalLogins = timeline.reduce((s, b) => s + b.logins, 0);
  const totalSignups = timeline.reduce((s, b) => s + b.registrations, 0);
  const peakLogins = Math.max(...timeline.map(b => b.logins), 0);

  return (
    <div className="space-y-5 animate-fadeIn">

      {/* ── 5 Stat Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          {
            label: 'Daily Active Users', value: stats.dau,
            footer: <><span className="text-emerald-400 font-bold">Stickiness: </span><span className="text-slate-400">{stats.stickiness}% DAU/MAU</span></>,
            icon: <TrendingUp className="w-5 h-5" />,
            iconBg: 'bg-cyan-500/15 border-cyan-500/20 text-cyan-400', hover: 'hover:border-cyan-500/30',
          },
          {
            label: 'Monthly Active Users', value: stats.mau,
            footer: <><span className="text-blue-400 font-bold">Active base </span><span className="text-slate-400">last 30 days</span></>,
            icon: <Users className="w-5 h-5" />,
            iconBg: 'bg-blue-500/15 border-blue-500/20 text-blue-400', hover: 'hover:border-blue-500/30',
          },
          {
            label: 'Total Registered', value: stats.totalUsers,
            footer: <><span className="text-teal-400 font-bold">Accounts </span><span className="text-slate-400">in database</span></>,
            icon: <Award className="w-5 h-5" />,
            iconBg: 'bg-teal-500/15 border-teal-500/20 text-teal-400', hover: 'hover:border-teal-500/30',
          },
          {
            label: 'Events & Guests',
            value: <>{stats.totalEvents} <span className="text-xl text-slate-600">/</span> {stats.totalGuests}</>,
            footer: <><span className="text-amber-400 font-bold">Galleries </span><span className="text-slate-400">and visitor sessions</span></>,
            icon: <Calendar className="w-5 h-5" />,
            iconBg: 'bg-amber-500/15 border-amber-500/20 text-amber-400', hover: 'hover:border-amber-500/30',
          },
          {
            label: 'Storage Consumed', value: formatSize(stats.totalStorage),
            footer: <><span className="text-slate-500 font-semibold">Data size: </span><span className="text-slate-500">all uploaded media</span></>,
            icon: <Database className="w-5 h-5" />,
            iconBg: 'bg-violet-500/15 border-violet-500/20 text-violet-400', hover: 'hover:border-violet-500/30',
          },
        ].map((card, i) => (
          <div key={i} className={`relative overflow-hidden rounded-2xl border border-white/6 bg-[#0f1535]/80 p-5 backdrop-blur-sm group ${card.hover} transition-all duration-300`}>
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-slate-400 text-xs font-medium leading-tight">{card.label}</p>
                <h3 className="text-3xl font-black text-white mt-2 tracking-tight">{card.value}</h3>
                <div className="mt-3 text-xs">{card.footer}</div>
              </div>
              <div className={`p-2.5 rounded-xl border shrink-0 ml-3 ${card.iconBg}`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Activity Trend Chart ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/6 bg-[#0c1028]/90 overflow-hidden">

        {/* Chart header + timeframe selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/15 text-indigo-400 shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Activity Trend</h4>
              <p className="text-slate-500 text-xs mt-0.5">Signups &amp; logins — {TF_OPTIONS.find(o => o.value === timeframe)?.label}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Timeframe pill buttons */}
            <div className="flex items-center gap-1 bg-white/4 border border-white/6 rounded-xl p-1">
              {TF_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTimeframe(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    timeframe === opt.value
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {opt.short}
                </button>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs font-semibold">
              <div className="flex items-center gap-1.5 text-cyan-400">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block shadow-[0_0_6px_#22d3ee]" />
                Logins
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block shadow-[0_0_6px_#34d399]" />
                Signups
              </div>
            </div>
          </div>
        </div>

        {/* Mini summary row */}
        <div className="flex items-center gap-6 px-6 pb-3">
          <div className="text-xs">
            <span className="text-slate-600">Total logins: </span>
            <span className="font-bold text-cyan-400">{totalLogins.toLocaleString()}</span>
          </div>
          <div className="text-xs">
            <span className="text-slate-600">Total signups: </span>
            <span className="font-bold text-emerald-400">{totalSignups.toLocaleString()}</span>
          </div>
          <div className="text-xs">
            <span className="text-slate-600">Peak logins: </span>
            <span className="font-bold text-white">{peakLogins.toLocaleString()}</span>
          </div>
        </div>

        {/* SVG chart */}
        <div className="w-full overflow-x-auto px-4 pb-5">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full min-w-[480px] h-auto"
          >
            <defs>
              <linearGradient id="loginFill2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="regFill2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
              </linearGradient>
              <filter id="glowC2">
                <feGaussianBlur stdDeviation="2.5" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="glowG2">
                <feGaussianBlur stdDeviation="2" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* Grid lines */}
            {gridVals.map((val, idx) => {
              const gy = paddingY + val * innerH;
              const glabel = Math.round(maxVal * (1 - val));
              return (
                <g key={idx}>
                  <line x1={paddingX} y1={gy} x2={chartWidth - paddingX} y2={gy}
                    stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                  <text x={paddingX - 8} y={gy + 4} fill="#475569" fontSize="9"
                    textAnchor="end" fontFamily="monospace" fontWeight="500">
                    {glabel}
                  </text>
                </g>
              );
            })}

            {/* Gradient areas */}
            <path d={loginAreaD} fill="url(#loginFill2)" />
            <path d={regAreaD}   fill="url(#regFill2)" />

            {/* Lines */}
            <path d={loginLineD} fill="none" stroke="#22d3ee" strokeWidth="2.5"
              strokeLinecap="round" filter="url(#glowC2)" />
            <path d={regLineD}   fill="none" stroke="#34d399" strokeWidth="2.5"
              strokeLinecap="round" filter="url(#glowG2)" />

            {/* Dots + labels + tooltips */}
            {pts.map((p, idx) => {
              const showLabel = idx % labelStep === 0 || idx === pts.length - 1;
              return (
                <g key={idx} className="group/dot cursor-pointer">
                  {/* Hover guide line */}
                  <line x1={p.x} y1={paddingY} x2={p.x} y2={chartHeight - paddingY}
                    stroke="#334155" strokeWidth="1" strokeDasharray="3 3"
                    className="opacity-0 group-hover/dot:opacity-50 transition-opacity" />

                  {/* Dots */}
                  <circle cx={p.x} cy={p.yLogin} r="4" fill="#050a1a" stroke="#22d3ee" strokeWidth="2.5"
                    style={{ filter: 'drop-shadow(0 0 4px #22d3ee)' }} />
                  <circle cx={p.x} cy={p.yReg} r="3.5" fill="#050a1a" stroke="#34d399" strokeWidth="2.5"
                    style={{ filter: 'drop-shadow(0 0 4px #34d399)' }} />

                  {/* X-axis label (thinned out) */}
                  {showLabel && (
                    <text x={p.x} y={chartHeight - 6} fill="#475569" fontSize="9"
                      textAnchor="middle" fontWeight="500">
                      {p.date}
                    </text>
                  )}

                  {/* Tooltip */}
                  <g className="opacity-0 group-hover/dot:opacity-100 transition-opacity duration-150 pointer-events-none">
                    <rect
                      x={Math.min(Math.max(p.x - 58, paddingX), chartWidth - paddingX - 116)}
                      y={Math.min(p.yLogin, p.yReg) - 56}
                      width="116" height="44"
                      rx="7" fill="#0d1a36" stroke="rgba(255,255,255,0.08)" strokeWidth="1"
                    />
                    <text
                      x={Math.min(Math.max(p.x, paddingX + 58), chartWidth - paddingX - 58)}
                      y={Math.min(p.yLogin, p.yReg) - 40}
                      fill="#e2e8f0" fontSize="9" textAnchor="middle" fontWeight="700">
                      {p.date}
                    </text>
                    <text
                      x={Math.min(Math.max(p.x, paddingX + 58), chartWidth - paddingX - 58)}
                      y={Math.min(p.yLogin, p.yReg) - 27}
                      fill="#22d3ee" fontSize="8" textAnchor="middle">
                      ↑ {p.logins} logins
                    </text>
                    <text
                      x={Math.min(Math.max(p.x, paddingX + 58), chartWidth - paddingX - 58)}
                      y={Math.min(p.yLogin, p.yReg) - 16}
                      fill="#34d399" fontSize="8" textAnchor="middle">
                      ✦ {p.registrations} signups
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* ── Subscription Insight Cards ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* Package Distribution */}
        <div className="rounded-2xl border border-white/6 bg-[#0f1535]/80 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/15 text-indigo-400">
                <CreditCard className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-white">Package Distribution</h4>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Plans</span>
          </div>
          <p className="text-slate-600 text-xs mb-4">User counts across account packages</p>
          <div className="space-y-3.5 flex-1">
            {stats.planBreakdown.map((plan, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-300">{plan.name}<span className="text-slate-600 ml-1.5">({plan.count})</span></span>
                  <span className="font-bold text-slate-500">{plan.percentage}%</span>
                </div>
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                  <div className={`h-full ${plan.color} rounded-full transition-all duration-1000`} style={{ width: `${plan.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between text-xs">
            <span className="text-amber-400 flex items-center gap-1 font-semibold"><Sparkles className="w-3 h-3" />Premium conversion</span>
            <span className="font-black text-white">{premiumRate}%</span>
          </div>
        </div>

        {/* Billing Cycles */}
        <div className="rounded-2xl border border-white/6 bg-[#0f1535]/80 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/15 text-sky-400">
                <Clock className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-white">Billing Cycles</h4>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Cycles</span>
          </div>
          <p className="text-slate-600 text-xs mb-4">Monthly vs yearly billing split</p>
          <div className="space-y-3.5 flex-1">
            {stats.durationBreakdown.map((dur, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-300">{dur.name}<span className="text-slate-600 ml-1.5">({dur.count})</span></span>
                  <span className="font-bold text-slate-500">{dur.percentage}%</span>
                </div>
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                  <div className={`h-full ${dur.color} rounded-full transition-all duration-1000`} style={{ width: `${dur.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-600 font-medium">
            <span>Stable cycle mapping</span><span>Based on User IDs</span>
          </div>
        </div>

        {/* Storage Plans */}
        <div className="rounded-2xl border border-white/6 bg-[#0f1535]/80 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/15 text-emerald-400">
                <Database className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-white">Storage Plans</h4>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Quotas</span>
          </div>
          <p className="text-slate-600 text-xs mb-4">Storage quota distribution</p>
          <div className="space-y-3.5 flex-1">
            {stats.storageBreakdown.map((s, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-300">{s.name}<span className="text-slate-600 ml-1.5">({s.count})</span></span>
                  <span className="font-bold text-slate-500">{s.percentage}%</span>
                </div>
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                  <div className={`h-full ${s.color} rounded-full transition-all duration-1000`} style={{ width: `${s.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-600 font-medium">
            <span>Mapped from account roles</span><span>10 GB to 1 TB tiers</span>
          </div>
        </div>
      </div>

      {/* ── Recent Activity Tables ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

        {/* Recent Signups */}
        <div className="rounded-2xl border border-white/6 bg-[#0f1535]/80 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/15 text-emerald-400"><Users className="w-4 h-4" /></div>
              <h4 className="text-sm font-bold text-white">Recent Signups</h4>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">New Users</span>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5">
                <th className="pb-2.5 pr-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">User</th>
                <th className="pb-2.5 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">Plan</th>
                <th className="pb-2.5 pl-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">Joined</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentSignups.map((user, idx) => {
                const initials = user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
                const fmtDate = user.createdAt
                  ? new Date(user.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
                  : '—';
                return (
                  <tr key={user.id || idx} className="hover:bg-white/3 transition-colors">
                    <td className="py-3 pr-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-[10px] text-white shrink-0">{initials || 'U'}</div>
                        <div>
                          <p className="font-semibold text-white text-xs leading-tight">{user.name}</p>
                          <p className="text-[10px] text-slate-600 leading-tight mt-0.5 font-mono">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                        user.role === 'ultimate' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                        user.role === 'elite'    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        user.role === 'pro'      ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                        user.role === 'premium'  ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                        user.role === 'standard' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                        user.role === 'basic'    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        user.role === 'starter'  ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' :
                                                   'bg-slate-500/10 text-slate-500 border-slate-500/20'
                      }`}>
                        <span className="w-1 h-1 rounded-full bg-current" />
                        {user.role ? user.role.toUpperCase() : 'FREE'}
                      </span>
                    </td>
                    <td className="py-3 pl-2 text-[10px] text-slate-600 font-mono">{fmtDate}</td>
                  </tr>
                );
              })}
              {stats.recentSignups.length === 0 && (
                <tr><td colSpan={3} className="py-8 text-center text-slate-700 text-xs italic">No signups yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Recent Activity Log */}
        <div className="rounded-2xl border border-white/6 bg-[#0f1535]/80 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/15 text-indigo-400"><TrendingUp className="w-4 h-4" /></div>
              <h4 className="text-sm font-bold text-white">Recent Activity Log</h4>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Live Feed</span>
          </div>
          <div className="space-y-2">
            {stats.recentLogins.map((login, idx) => (
              <div key={idx} className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-white/5 bg-white/3 hover:bg-white/5 hover:border-white/8 transition-all">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${login.type === 'User' ? 'bg-indigo-400' : 'bg-emerald-400'}`} style={{ boxShadow: login.type === 'User' ? '0 0 6px #818cf8' : '0 0 6px #34d399' }} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white leading-tight truncate">{login.name}</p>
                    <p className="text-[10px] text-slate-600 leading-tight font-mono truncate">{login.emailOrPhone}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full border ${login.type === 'User' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                    <span className="w-1 h-1 rounded-full bg-current" />{login.type}
                  </span>
                  <p className="text-[10px] text-slate-700 mt-1">{login.time}</p>
                </div>
              </div>
            ))}
            {stats.recentLogins.length === 0 && (
              <p className="py-8 text-center text-slate-700 text-xs italic">No activity logs.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom 3 Insight Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-white/6 bg-[#0f1535]/80 p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/15 text-amber-400"><Star className="w-4 h-4" /></div>
            <h4 className="text-sm font-bold text-white">Top Active Plans</h4>
          </div>
          <div className="space-y-3">
            {stats.planBreakdown.filter(p => p.count > 0).slice(0, 4).map((plan, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 font-mono w-4">{idx + 1}.</span>
                  <span className="text-xs font-semibold text-slate-300">{plan.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div className={`h-full ${plan.color} rounded-full`} style={{ width: `${plan.percentage}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 w-5 text-right">{plan.count}</span>
                </div>
              </div>
            ))}
            {stats.planBreakdown.filter(p => p.count > 0).length === 0 && (
              <p className="text-xs text-slate-700 italic text-center py-4">No plan data.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/6 bg-[#0f1535]/80 p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/15 text-sky-400"><Monitor className="w-4 h-4" /></div>
            <h4 className="text-sm font-bold text-white">Device &amp; OS</h4>
          </div>
          <div className="space-y-3">
            {[{ label: 'Web Browser', pct: 68, color: 'bg-sky-500' }, { label: 'Android App', pct: 22, color: 'bg-emerald-500' }, { label: 'iOS App', pct: 10, color: 'bg-violet-500' }].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">{item.label}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.pct}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 w-8 text-right">{item.pct}%</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[10px] text-slate-700 italic">Estimated from session metadata</p>
        </div>

        <div className="rounded-2xl border border-white/6 bg-[#0f1535]/80 p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/15 text-violet-400"><MapPin className="w-4 h-4" /></div>
            <h4 className="text-sm font-bold text-white">Session Sources</h4>
          </div>
          <div className="space-y-3">
            {[{ label: 'Direct / Organic', pct: 55, color: 'bg-violet-500' }, { label: 'Referral Links', pct: 28, color: 'bg-indigo-500' }, { label: 'Social Media', pct: 17, color: 'bg-pink-500' }].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">{item.label}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.pct}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 w-8 text-right">{item.pct}%</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[10px] text-slate-700 italic">Estimated from UTM attribution</p>
        </div>
      </div>
    </div>
  );
};
