import React, { useState, useMemo } from 'react';
import type { Event, Photo, UserProfile } from '../lib/analytics';
import { Search, Mail, Phone, Calendar, Clock, Filter, Users, ShieldCheck, CreditCard, Activity, ChevronDown } from 'lucide-react';

interface Props {
  users: UserProfile[];
  events?: Event[];
  photos?: Photo[];
  onPlanChange?: (userId: string, role: string) => Promise<void> | void;
  onDurationChange?: (userId: string, duration: string) => Promise<void> | void;
  onPlanDatesChange?: (userId: string, startDate: string, endDate: string) => Promise<void> | void;
}

const planOptions = [
  { role: 'free', label: 'Free Plan', storage: '1 GB' },
  { role: 'starter', label: 'Starter Plan', storage: '10 GB' },
  { role: 'basic', label: 'Basic Plan', storage: '25 GB' },
  { role: 'standard', label: 'Standard Plan', storage: '50 GB' },
  { role: 'premium', label: 'Premium Plan', storage: '100 GB' },
  { role: 'pro', label: 'Pro Plan', storage: '200 GB' },
  { role: 'elite', label: 'Elite Plan', storage: '500 GB' },
  { role: 'ultimate', label: 'Ultimate Plan', storage: '1 TB' },
];

const durationOptions = [
  { value: 'monthly', label: '1 Month' },
  { value: 'quarterly', label: '3 Month' },
  { value: 'half_yearly', label: '6 Month' },
  { value: 'yearly', label: 'Yearly' },
];

const isPaidPlan = (role?: string) => {
  const cleanRole = (role || 'free').toLowerCase();
  return cleanRole !== 'admin' && cleanRole !== 'free' && cleanRole !== 'user' && cleanRole !== 'freemium';
};

const normalizeDurationValue = (value?: string) => {
  const normalized = String(value || '').toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === '1_month') return 'monthly';
  if (normalized === '3_month' || normalized === '3_months') return 'quarterly';
  if (normalized === '6_month' || normalized === '6_months') return 'half_yearly';
  if (normalized === 'annual') return 'yearly';
  return durationOptions.some(option => option.value === normalized) ? normalized : 'monthly';
};

const getStoragePlan = (role: string) => {
  const cleanRole = (role || 'free').toLowerCase();
  if (cleanRole === 'admin') return "Unlimited";
  return planOptions.find(plan => plan.role === cleanRole)?.storage || "1 GB";
};

const getPlanOptionLabel = (plan: typeof planOptions[number]) => `${plan.label} · ${plan.storage}`;

const bytesToGb = (bytes: number) => bytes / (1024 ** 3);

const formatGb = (bytes: number) => {
  const gb = bytesToGb(bytes);
  if (gb === 0) return '0.00';
  if (gb < 0.01) return '<0.01';
  return gb.toFixed(2);
};

const formatDateInputValue = (value?: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return parsed.toISOString().slice(0, 10);
};

const formatDisplayDate = (value?: string) => {
  if (!value) return 'No date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

const addDurationToDate = (startDate: string, duration: string) => {
  const parsed = new Date(`${startDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return '';

  const monthsByDuration: Record<string, number> = {
    monthly: 1,
    quarterly: 3,
    half_yearly: 6,
    yearly: 12,
  };

  parsed.setUTCMonth(parsed.getUTCMonth() + (monthsByDuration[duration] || 1));
  return parsed.toISOString().slice(0, 10);
};

const openDatePicker = (event: React.MouseEvent<HTMLInputElement>) => {
  const input = event.currentTarget as HTMLInputElement & { showPicker?: () => void };
  input.focus();
  try {
    input.showPicker?.();
  } catch {
    // Some browsers only allow the native picker from their built-in date control.
  }
};

export const UserGrid: React.FC<Props> = ({ users, events = [], photos = [], onPlanChange, onDurationChange, onPlanDatesChange }) => {
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [savingDurationUserId, setSavingDurationUserId] = useState<string | null>(null);
  const [savingDatesUserId, setSavingDatesUserId] = useState<string | null>(null);
  const [expandedEventsUserId, setExpandedEventsUserId] = useState<string | null>(null);

  const handlePlanChange = async (userId: string, role: string) => {
    if (!onPlanChange) return;
    setSavingUserId(userId);
    try {
      await onPlanChange(userId, role);
    } finally {
      setSavingUserId(null);
    }
  };

  const handleDurationChange = async (userId: string, duration: string) => {
    if (!onDurationChange) return;
    setSavingDurationUserId(userId);
    try {
      await onDurationChange(userId, duration);
    } finally {
      setSavingDurationUserId(null);
    }
  };

  const handlePlanDateChange = async (
    userId: string,
    currentStartDate: string,
    currentEndDate: string,
    field: 'start' | 'end',
    value: string,
    duration?: string
  ) => {
    if (!onPlanDatesChange) return;
    const nextStartDate = field === 'start' ? value : currentStartDate;
    const nextEndDate = field === 'start'
      ? addDurationToDate(value, normalizeDurationValue(duration)) || currentEndDate
      : value;
    setSavingDatesUserId(userId);
    try {
      await onPlanDatesChange(userId, nextStartDate, nextEndDate);
    } finally {
      setSavingDatesUserId(null);
    }
  };

  const stats = useMemo(() => {
    const total = users.length;
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const active24h = users.filter(u => {
      if (!u.lastLogin) return false;
      const lastLoginDate = new Date(u.lastLogin);
      return !isNaN(lastLoginDate.getTime()) && lastLoginDate >= oneDayAgo;
    }).length;

    const paid = users.filter(u => {
      const cleanRole = (u.role || 'free').toLowerCase();
      return cleanRole !== 'admin' && cleanRole !== 'free' && cleanRole !== 'user' && cleanRole !== 'freemium';
    }).length;

    const admins = users.filter(u => (u.role || '').toLowerCase() === 'admin').length;

    return { total, active24h, paid, admins };
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = 
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase()) ||
        (user.phone && user.phone.includes(search));
      
      const matchesPlan = 
        planFilter === 'all' || 
        (user.role || 'free').toLowerCase() === planFilter.toLowerCase();

      return matchesSearch && matchesPlan;
    }).sort((a, b) => {
      const aLabel = (a.name || a.email || '').trim().toLowerCase();
      const bLabel = (b.name || b.email || '').trim().toLowerCase();
      return aLabel.localeCompare(bLabel);
    });
  }, [users, search, planFilter]);

  const userUsageMetrics = useMemo(() => {
    const metrics = new Map<string, { eventCount: number; imageBytes: number; videoBytes: number; events: Event[] }>();
    const userKeyByIdentifier = new Map<string, string>();

    users.forEach(user => {
      metrics.set(user.id, { eventCount: 0, imageBytes: 0, videoBytes: 0, events: [] });
      if (user.id) userKeyByIdentifier.set(user.id.toLowerCase(), user.id);
      if (user.email) userKeyByIdentifier.set(user.email.toLowerCase(), user.id);
    });

    const eventOwnerById = new Map<string, string>();

    events.forEach(event => {
      const ownerId = (event.createdBy || event.createdById || '').toLowerCase();
      const userId = userKeyByIdentifier.get(ownerId);

      if (event.id && ownerId) {
        eventOwnerById.set(event.id, ownerId);
      }

      if (!userId) return;
      const current = metrics.get(userId);
      if (current) {
        current.eventCount += 1;
        current.events.push(event);
      }
    });

    photos.forEach(photo => {
      const explicitUploader = (photo.userId || '').toLowerCase();
      const eventOwner = (eventOwnerById.get(photo.eventId) || '').toLowerCase();
      const userId = userKeyByIdentifier.get(explicitUploader) || userKeyByIdentifier.get(eventOwner);
      if (!userId) return;

      const current = metrics.get(userId);
      if (!current) return;

      const size = Number(photo.size) || 0;
      const mediaType = String(photo.mediaType || '').toLowerCase();
      const resourceType = String(photo.resourceType || '').toLowerCase();
      const isVideo = mediaType === 'video' || resourceType === 'video';

      if (isVideo) {
        current.videoBytes += size;
      } else {
        current.imageBytes += size;
      }
    });

    metrics.forEach(metric => {
      metric.events.sort((a, b) => {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate;
      });
    });

    return metrics;
  }, [users, events, photos]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Quick Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Total Registered */}
        <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 hover:border-emerald-500/50 transition-all duration-300 shadow-lg group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Accounts</p>
              <h3 className="text-2xl font-black text-white mt-1 group-hover:text-emerald-400 transition-colors">
                {stats.total}
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Registered in database</p>
        </div>

        {/* Card 2: Active Users */}
        <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 hover:border-sky-500/50 transition-all duration-300 shadow-lg group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Active Users</p>
              <h3 className="text-2xl font-black text-white mt-1 group-hover:text-sky-400 transition-colors">
                {stats.active24h}
              </h3>
            </div>
            <div className="p-2.5 bg-sky-500/10 rounded-xl text-sky-400">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Active within last 24h</p>
        </div>

        {/* Card 3: Premium Subscriptions */}
        <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 hover:border-indigo-500/50 transition-all duration-300 shadow-lg group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Premium Subs</p>
              <h3 className="text-2xl font-black text-white mt-1 group-hover:text-indigo-400 transition-colors">
                {stats.paid}
              </h3>
            </div>
            <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Paid tiers (10GB - 500GB)</p>
        </div>

        {/* Card 4: Super Admins */}
        <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 hover:border-amber-500/50 transition-all duration-300 shadow-lg group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Super Admins</p>
              <h3 className="text-2xl font-black text-white mt-1 group-hover:text-amber-400 transition-colors">
                {stats.admins}
              </h3>
            </div>
            <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Administrative privileges</p>
        </div>
      </div>

      {/* Main Table Box */}
      <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
      {/* Table Header and Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h4 className="text-lg font-bold text-white">Registered Accounts</h4>
          <p className="text-slate-400 text-xs mt-0.5">
            Showing {filteredUsers.length} of {users.length} users
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500/50 w-full sm:w-64 placeholder-slate-600 transition-colors"
            />
          </div>

          {/* Filter dropdown */}
          <div className="relative flex items-center">
            <Filter className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
            <select
              value={planFilter}
              onChange={e => setPlanFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer placeholder-slate-600 transition-colors"
            >
              <option value="all">All Plans</option>
              {planOptions.slice().reverse().map(plan => (
                <option key={plan.role} value={plan.role}>
                  {getPlanOptionLabel(plan)}
                </option>
              ))}
              <option value="admin">Super Admin</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto border border-slate-800/60 rounded-2xl">
        <table className="w-full min-w-[1900px] text-left text-sm text-slate-400">
          <thead className="text-xs text-slate-500 uppercase bg-slate-900/30 border-b border-slate-800">
            <tr>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">User Details</th>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">Role</th>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">Storage Plan</th>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">Events Created</th>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">Images GB</th>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">Videos GB</th>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">Total GB</th>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">Duration</th>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">Plan Start Date</th>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">Plan End Date</th>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">Joined Date</th>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">Last Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {filteredUsers.map((user, idx) => {
              const initials = user.name
                .split(' ')
                .map(n => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();
              
              const regDate = user.createdAt 
                ? new Date(user.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) 
                : 'N/A';
              const logTime = user.lastLogin 
                ? new Date(user.lastLogin).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                : 'Never';
              const paidPlan = isPaidPlan(user.role);
              const planStartDate = formatDateInputValue(user.planStartDate);
              const planEndDate = formatDateInputValue(user.planEndDate);
              const usage = userUsageMetrics.get(user.id) || { eventCount: 0, imageBytes: 0, videoBytes: 0, events: [] };
              const totalBytes = usage.imageBytes + usage.videoBytes;
              const isEventsExpanded = expandedEventsUserId === user.id;

              return (
                <React.Fragment key={user.id || idx}>
                  <tr className="hover:bg-slate-800/10 transition-colors">
                    {/* Name & Avatar */}
                    <td className="py-3.5 px-4 flex min-w-72 items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-800 to-slate-900 border border-slate-700/80 flex items-center justify-center font-bold text-xs text-slate-200">
                        {initials || 'U'}
                      </div>
                      <div>
                        <p className="font-semibold text-white leading-tight">{user.name}</p>
                        <p className="text-xs text-slate-500 leading-tight mt-0.5 flex items-center">
                          <Mail className="w-3 h-3 mr-1 text-slate-600" />
                          {user.email}
                        </p>
                        <p className="text-xs text-slate-500 leading-tight mt-1 flex items-center">
                          <Phone className="w-3 h-3 mr-1 text-slate-600" />
                          {user.phone || <span className="italic text-slate-600">No phone</span>}
                        </p>
                      </div>
                    </td>

                    {/* Subscription Plan */}
                    <td className="py-3.5 px-4 min-w-28">
                      <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                        user.role === 'admin' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        user.role === 'ultimate' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                        user.role === 'elite' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
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

                    {/* Storage Plan */}
                    <td className="py-3.5 px-4 min-w-44">
                      {user.role === 'admin' ? (
                        <span className="inline-flex rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300">
                          Super Admin · {getStoragePlan(user.role)}
                        </span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <select
                            value={(user.role || 'free') === 'user' ? 'free' : (user.role || 'free')}
                            disabled={!onPlanChange || savingUserId === user.id}
                            onChange={event => handlePlanChange(user.id, event.target.value)}
                            className="min-w-36 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 outline-none transition-colors focus:border-indigo-500 disabled:cursor-wait disabled:opacity-60"
                          >
                            {planOptions.map(plan => (
                              <option key={plan.role} value={plan.role}>
                                {getPlanOptionLabel(plan)}
                              </option>
                            ))}
                          </select>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                            {savingUserId === user.id ? 'Saving...' : `${getStoragePlan(user.role || 'free')} allotted`}
                          </span>
                        </div>
                      )}
                    </td>

                  {/* Events Created */}
                    <td className="py-3.5 px-4 min-w-36 whitespace-nowrap text-xs font-semibold text-slate-300">
                      <div className="flex items-center gap-2">
                        <span>{usage.eventCount}</span>
                        {usage.eventCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setExpandedEventsUserId(isEventsExpanded ? null : user.id)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-slate-300 transition-colors hover:border-indigo-500/60 hover:text-white"
                            aria-label={isEventsExpanded ? 'Hide created events' : 'Show created events'}
                          >
                            <ChevronDown className={`h-4 w-4 transition-transform ${isEventsExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        )}
                      </div>
                    </td>

                  {/* Image Storage */}
                    <td className="py-3.5 px-4 min-w-32 whitespace-nowrap text-xs font-semibold text-emerald-300">
                    {formatGb(usage.imageBytes)} GB
                  </td>

                  {/* Video Storage */}
                    <td className="py-3.5 px-4 min-w-32 whitespace-nowrap text-xs font-semibold text-violet-300">
                    {formatGb(usage.videoBytes)} GB
                  </td>

                  {/* Total Storage */}
                    <td className="py-3.5 px-4 min-w-32 whitespace-nowrap text-xs font-bold text-white">
                    {formatGb(totalBytes)} GB
                  </td>

                  {/* Duration */}
                  <td className="py-3.5 px-4 min-w-40">
                    {paidPlan ? (
                      <div className="flex flex-col gap-1">
                        <select
                          value={normalizeDurationValue(user.subscriptionDuration)}
                          disabled={!onDurationChange || savingDurationUserId === user.id}
                          onChange={event => handleDurationChange(user.id, event.target.value)}
                          className="min-w-32 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 outline-none transition-colors focus:border-sky-500 disabled:cursor-wait disabled:opacity-60"
                        >
                          {durationOptions.map(duration => (
                            <option key={duration.value} value={duration.value}>
                              {duration.label}
                            </option>
                          ))}
                        </select>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          {savingDurationUserId === user.id ? 'Saving...' : 'Billing duration'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-slate-600">-</span>
                    )}
                  </td>

                  {/* Plan Start Date */}
                  <td className="py-3.5 px-4 min-w-44">
                    {paidPlan ? (
                      <div className="flex flex-col gap-1">
                        <input
                          type="date"
                          value={planStartDate}
                          disabled={!onPlanDatesChange || savingDatesUserId === user.id}
                          onClick={openDatePicker}
                          onChange={event => handlePlanDateChange(user.id, planStartDate, planEndDate, 'start', event.target.value, user.subscriptionDuration)}
                          className="min-w-36 cursor-pointer rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 outline-none transition-colors focus:border-emerald-500 disabled:cursor-wait disabled:opacity-60"
                        />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          {savingDatesUserId === user.id ? 'Saving...' : 'Start date'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-slate-600">-</span>
                    )}
                  </td>

                  {/* Plan End Date */}
                  <td className="py-3.5 px-4 min-w-44">
                    {paidPlan ? (
                      <div className="flex flex-col gap-1">
                        <input
                          type="date"
                          value={planEndDate}
                          disabled={!onPlanDatesChange || savingDatesUserId === user.id}
                          onClick={openDatePicker}
                          onChange={event => handlePlanDateChange(user.id, planStartDate, planEndDate, 'end', event.target.value)}
                          className="min-w-36 cursor-pointer rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 outline-none transition-colors focus:border-rose-500 disabled:cursor-wait disabled:opacity-60"
                        />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          {savingDatesUserId === user.id ? 'Saving...' : 'End date'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-slate-600">-</span>
                    )}
                  </td>
                  
                  {/* Date Joined */}
                  <td className="py-3.5 px-4 min-w-40 text-xs whitespace-nowrap">
                    <div className="flex items-center space-x-1.5 text-slate-300 whitespace-nowrap">
                      <Calendar className="w-3.5 h-3.5 text-slate-600" />
                      <span>{regDate}</span>
                    </div>
                  </td>
                  
                  {/* Last Login */}
                  <td className="py-3.5 px-4 min-w-48 text-xs whitespace-nowrap">
                    <div className="flex items-center space-x-1.5 text-slate-300 whitespace-nowrap">
                      <Clock className="w-3.5 h-3.5 text-slate-600" />
                      <span className={user.lastLogin ? 'text-sky-400' : 'text-slate-500'}>{logTime}</span>
                    </div>
                  </td>

                  </tr>
                  {isEventsExpanded && (
                    <tr className="bg-slate-950/70">
                      <td colSpan={12} className="px-4 py-4">
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                              Events created by {user.name || user.email}
                            </p>
                            <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                              {usage.eventCount} total
                            </span>
                          </div>
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {usage.events.map(event => (
                              <div
                                key={event.id}
                                className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-white">
                                      {event.title || 'Untitled Event'}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      {formatDisplayDate(event.createdAt)}
                                    </p>
                                  </div>
                                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                    event.type === 'sub'
                                      ? 'border-sky-500/20 bg-sky-500/10 text-sky-300'
                                      : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                                  }`}>
                                    {event.type === 'sub' ? 'Sub' : 'Main'}
                                  </span>
                                </div>
                                <p className="mt-2 truncate text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                                  ID: {event.id}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={12} className="py-12 text-center text-slate-500 bg-slate-900/10">
                  <p className="text-base font-semibold">No accounts found</p>
                  <p className="text-xs text-slate-600 mt-1">Try adjusting your filters or search query.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  );
};
