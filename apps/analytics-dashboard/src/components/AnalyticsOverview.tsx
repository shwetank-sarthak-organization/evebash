import React from 'react';
import type { DashboardStats } from '../lib/analytics';
import { Users, Calendar, TrendingUp, Award, CreditCard, Sparkles, Clock, Database } from 'lucide-react';

interface Props {
  stats: DashboardStats;
}

const formatSize = (bytes: number | null | undefined) => {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) return '0 B';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const sizeIndex = Math.min(Math.max(0, i), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, sizeIndex)).toFixed(2)) + ' ' + sizes[sizeIndex];
};

export const AnalyticsOverview: React.FC<Props> = ({ stats }) => {
  // Calculations for custom SVG chart
  const timeline = stats.timeline;
  const maxVal = Math.max(
    ...timeline.map(t => Math.max(t.logins, t.registrations)),
    10 // Fallback minimum value to avoid flatlines
  );

  const chartWidth = 600;
  const chartHeight = 220;
  const paddingX = 40;
  const paddingY = 30;

  const innerWidth = chartWidth - paddingX * 2;
  const innerHeight = chartHeight - paddingY * 2;

  const points = timeline.map((t, idx) => {
    const x = paddingX + (idx / (timeline.length - 1)) * innerWidth;
    const yLogin = chartHeight - paddingY - (t.logins / maxVal) * innerHeight;
    const yReg = chartHeight - paddingY - (t.registrations / maxVal) * innerHeight;
    return { x, yLogin, yReg, ...t };
  });

  const loginLineD = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.yLogin}`).join(' ');
  const loginAreaD = `${loginLineD} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`;

  const regLineD = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.yReg}`).join(' ');
  const regAreaD = `${regLineD} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {/* Card 1: Active Users */}
        <div className="bg-[#111827]/80 backdrop-blur-md border border-slate-800 rounded-2xl p-6 hover:border-sky-500/50 transition-all duration-300 shadow-xl group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-sm font-medium">Daily Active Users</p>
              <h3 className="text-3xl font-bold text-white mt-2 group-hover:text-sky-400 transition-colors">
                {stats.dau}
              </h3>
            </div>
            <div className="p-3 bg-sky-500/10 rounded-xl text-sky-400">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-slate-400">
            <span className="text-emerald-400 font-semibold mr-1.5">Stickiness:</span>
            <span>{stats.stickiness}% DAU/MAU</span>
          </div>
        </div>

        {/* Card 2: MAU */}
        <div className="bg-[#111827]/80 backdrop-blur-md border border-slate-800 rounded-2xl p-6 hover:border-indigo-500/50 transition-all duration-300 shadow-xl group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-sm font-medium">Monthly Active Users</p>
              <h3 className="text-3xl font-bold text-white mt-2 group-hover:text-indigo-400 transition-colors">
                {stats.mau}
              </h3>
            </div>
            <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-slate-400">
            <span className="text-indigo-400 font-semibold mr-1.5">Active base</span>
            <span>last 30 days</span>
          </div>
        </div>

        {/* Card 3: Total Users */}
        <div className="bg-[#111827]/80 backdrop-blur-md border border-slate-800 rounded-2xl p-6 hover:border-emerald-500/50 transition-all duration-300 shadow-xl group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-sm font-medium">Total Registered</p>
              <h3 className="text-3xl font-bold text-white mt-2 group-hover:text-emerald-400 transition-colors">
                {stats.totalUsers}
              </h3>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
              <Award className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-slate-400">
            <span className="text-emerald-400 font-semibold mr-1.5">Accounts</span>
            <span>created in database</span>
          </div>
        </div>

        {/* Card 4: Total Events & Guests */}
        <div className="bg-[#111827]/80 backdrop-blur-md border border-slate-800 rounded-2xl p-6 hover:border-amber-500/50 transition-all duration-300 shadow-xl group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-sm font-medium">Events & Guests</p>
              <h3 className="text-3xl font-bold text-white mt-2 group-hover:text-amber-400 transition-colors">
                {stats.totalEvents} <span className="text-lg text-slate-500">/</span> {stats.totalGuests}
              </h3>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400">
              <Calendar className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-slate-400">
            <span className="text-amber-400 font-semibold mr-1.5">Galleries</span>
            <span>and visitor sessions</span>
          </div>
        </div>

        {/* Card 5: Total Space Consumed */}
        <div className="bg-[#111827]/80 backdrop-blur-md border border-slate-800 rounded-2xl p-6 hover:border-violet-500/50 transition-all duration-300 shadow-xl group bg-gradient-to-br from-[#111827]/85 to-violet-950/10">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-sm font-medium">Storage Consumed</p>
              <h3 className="text-3xl font-bold text-white mt-2 group-hover:text-violet-400 transition-colors">
                {formatSize(stats.totalStorage)}
              </h3>
            </div>
            <div className="p-3 bg-violet-500/10 rounded-xl text-violet-400">
              <Database className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-slate-400">
            <span className="text-violet-400 font-semibold mr-1.5">Data size:</span>
            <span>across all uploaded media</span>
          </div>
        </div>
      </div>

      {/* Chart View */}
      <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h4 className="text-lg font-bold text-white">7-Day Activity Trend</h4>
              <p className="text-slate-400 text-xs mt-0.5">Daily registered signups vs active session logins</p>
            </div>
            <div className="flex space-x-4 text-xs font-semibold">
              <div className="flex items-center text-sky-400">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 mr-1.5 inline-block"></span>
                Logins
              </div>
              <div className="flex items-center text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1.5 inline-block"></span>
                Registrations
              </div>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full min-w-[500px] h-auto">
              <defs>
                <linearGradient id="loginGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((val, idx) => {
                const y = paddingY + val * innerHeight;
                const gridLabel = Math.round(maxVal * (1 - val));
                return (
                  <g key={idx}>
                    <line
                      x1={paddingX}
                      y1={y}
                      x2={chartWidth - paddingX}
                      y2={y}
                      stroke="#1e293b"
                      strokeDasharray="4,4"
                      strokeWidth="1"
                    />
                    <text
                      x={paddingX - 10}
                      y={y + 4}
                      fill="#64748b"
                      fontSize="10"
                      textAnchor="end"
                      fontWeight="500"
                    >
                      {gridLabel}
                    </text>
                  </g>
                );
              })}

              {/* Chart Areas */}
              <path d={loginAreaD} fill="url(#loginGrad)" />
              <path d={regAreaD} fill="url(#regGrad)" />

              {/* Chart Paths */}
              <path d={loginLineD} fill="none" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round" />
              <path d={regLineD} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeDasharray="1" />

              {/* Points & Tooltips */}
              {points.map((p, idx) => (
                <g key={idx} className="group/dot cursor-pointer">
                  {/* Hover guideline */}
                  <line
                    x1={p.x}
                    y1={paddingY}
                    x2={p.x}
                    y2={chartHeight - paddingY}
                    stroke="#334155"
                    strokeWidth="1.5"
                    className="opacity-0 group-hover/dot:opacity-40 transition-opacity"
                  />
                  {/* Logins Dot */}
                  <circle
                    cx={p.x}
                    cy={p.yLogin}
                    r="4"
                    fill="#0b0f19"
                    stroke="#0ea5e9"
                    strokeWidth="2.5"
                  />
                  {/* Registrations Dot */}
                  <circle
                    cx={p.x}
                    cy={p.yReg}
                    r="4"
                    fill="#0b0f19"
                    stroke="#10b981"
                    strokeWidth="2.5"
                  />
                  {/* Axis Label */}
                  <text
                    x={p.x}
                    y={chartHeight - 8}
                    fill="#64748b"
                    fontSize="10"
                    textAnchor="middle"
                    fontWeight="500"
                  >
                    {p.date}
                  </text>

                  {/* Floating tooltip simulation on hover */}
                  <g className="opacity-0 group-hover/dot:opacity-100 transition-opacity duration-200 pointer-events-none">
                    <rect
                      x={p.x - 60}
                      y={Math.min(p.yLogin, p.yReg) - 52}
                      width="120"
                      height="40"
                      rx="6"
                      fill="#0f172a"
                      stroke="#334155"
                      strokeWidth="1"
                    />
                    <text x={p.x} y={Math.min(p.yLogin, p.yReg) - 38} fill="#f1f5f9" fontSize="9" textAnchor="middle" fontWeight="bold">
                      {p.date}
                    </text>
                    <text x={p.x} y={Math.min(p.yLogin, p.yReg) - 26} fill="#94a3b8" fontSize="8" textAnchor="middle">
                      Logins: {p.logins} | Signups: {p.registrations}
                    </text>
                  </g>
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* Subscription & Plan Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Card 1: Package Tiers */}
          <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2.5 mb-4">
                <CreditCard className="w-5 h-5 text-indigo-400" />
                <h4 className="text-lg font-bold text-white">Package Distribution</h4>
              </div>
              <p className="text-slate-400 text-xs mb-6">User counts and ratios across account packages</p>

              <div className="space-y-4">
                {stats.planBreakdown.map((plan, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center">
                        <span className="font-semibold text-slate-200">{plan.name}</span>
                        <span className="text-xs text-slate-500 ml-2">({plan.count})</span>
                      </div>
                      <span className="font-bold text-slate-400">{plan.percentage}%</span>
                    </div>
                    <div className="w-full bg-slate-800/80 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${plan.color} rounded-full transition-all duration-1000`}
                        style={{ width: `${plan.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mt-8 pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center text-amber-400">
                <Sparkles className="w-3.5 h-3.5 mr-1" /> Premium conversion rate:
              </span>
              <span className="font-bold text-slate-200">
                {(
                  (stats.planBreakdown
                    .filter(p => p.name !== 'Free Plan')
                    .reduce((sum, p) => sum + p.count, 0) /
                    (stats.totalUsers || 1)) *
                  100
                ).toFixed(1)}
                %
              </span>
            </div>
          </div>

          {/* Card 2: Billing Cycle Durations */}
          <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2.5 mb-4">
                <Clock className="w-5 h-5 text-sky-400" />
                <h4 className="text-lg font-bold text-white">Billing Cycles</h4>
              </div>
              <p className="text-slate-400 text-xs mb-6">Proportion of users on monthly vs yearly cycles</p>

              <div className="space-y-4">
                {stats.durationBreakdown.map((dur, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center">
                        <span className="font-semibold text-slate-200">{dur.name}</span>
                        <span className="text-xs text-slate-500 ml-2">({dur.count})</span>
                      </div>
                      <span className="font-bold text-slate-400">{dur.percentage}%</span>
                    </div>
                    <div className="w-full bg-slate-800/80 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${dur.color} rounded-full transition-all duration-1000`}
                        style={{ width: `${dur.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Stable cycle mapping</span>
              <span>Based on User IDs</span>
            </div>
          </div>

          {/* Card 3: Storage Tiers */}
          <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2.5 mb-4">
                <Database className="w-5 h-5 text-emerald-400" />
                <h4 className="text-lg font-bold text-white">Storage Plans</h4>
              </div>
              <p className="text-slate-400 text-xs mb-6">Distribution of storage quotas amongst users</p>

              <div className="space-y-4">
                {stats.storageBreakdown.map((storage, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center">
                        <span className="font-semibold text-slate-200">{storage.name}</span>
                        <span className="text-xs text-slate-500 ml-2">({storage.count})</span>
                      </div>
                      <span className="font-bold text-slate-400">{storage.percentage}%</span>
                    </div>
                    <div className="w-full bg-slate-800/80 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${storage.color} rounded-full transition-all duration-1000`}
                        style={{ width: `${storage.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Mapped from account roles</span>
              <span>10 GB to 1 TB tiers</span>
            </div>
          </div>
        </div>

      {/* Tables Row: Recent Signups and Logins */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Recent Signups */}
        <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <h4 className="text-lg font-bold text-white mb-4 flex items-center">
            <Users className="w-5 h-5 mr-2 text-emerald-400" />
            Recent Signups
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-400">
              <thead className="text-xs text-slate-500 uppercase border-b border-slate-800">
                <tr>
                  <th scope="col" className="py-3 px-2">User</th>
                  <th scope="col" className="py-3 px-2">Plan</th>
                  <th scope="col" className="py-3 px-2">Date Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {stats.recentSignups.map((user, idx) => {
                  const initials = user.name
                    .split(' ')
                    .map(n => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();
                  const formattedDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown';

                  return (
                    <tr key={user.id || idx} className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-3.5 px-2 flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-300">
                          {initials || 'U'}
                        </div>
                        <div>
                          <p className="font-semibold text-white leading-tight">{user.name}</p>
                          <p className="text-xs text-slate-500 leading-tight mt-0.5">{user.email}</p>
                        </div>
                      </td>
                      <td className="py-3.5 px-2">
                        <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                          user.role === 'ultimate' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                          user.role === 'elite' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          user.role === 'pro' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                          user.role === 'premium' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                          user.role === 'standard' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                          user.role === 'basic' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          user.role === 'starter' ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' :
                          'bg-slate-500/10 text-slate-400 border-slate-500/20'
                        }`}>
                          {user.role ? user.role.toUpperCase() : 'FREE'}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-slate-500 text-xs">{formattedDate}</td>
                    </tr>
                  );
                })}
                {stats.recentSignups.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-slate-500">
                      No signups registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Recent Active Logins */}
        <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <h4 className="text-lg font-bold text-white mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-indigo-400" />
            Recent Activity Log
          </h4>
          <div className="space-y-4">
            {stats.recentLogins.map((login, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 hover:bg-slate-900 border border-slate-800/40 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${login.type === 'User' ? 'bg-indigo-400' : 'bg-emerald-400'}`} />
                  <div>
                    <p className="text-sm font-semibold text-white leading-tight">{login.name}</p>
                    <p className="text-xs text-slate-500 leading-tight mt-0.5">{login.emailOrPhone}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                    login.type === 'User'
                      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}>
                    {login.type}
                  </span>
                  <p className="text-[10px] text-slate-500 mt-1">{login.time}</p>
                </div>
              </div>
            ))}
            {stats.recentLogins.length === 0 && (
              <p className="py-6 text-center text-slate-500 text-sm">
                No active login logs reported.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
