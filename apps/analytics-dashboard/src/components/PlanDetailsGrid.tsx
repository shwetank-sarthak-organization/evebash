import React, { useState, useMemo } from 'react';
import type { UserProfile } from '../lib/analytics';
import { Search, Filter, Clock } from 'lucide-react';

interface Props {
  users: UserProfile[];
}

interface SubscriptionUnitStats {
  storageKey: string;
  storageName: string;
  durationKey: string;
  durationName: string;
  current: number;
  total: number;
  thisWeek: number;
  thisMonth: number;
  last6Months: number;
  lastYear: number;
}

const getSubscriptionDuration = (user: UserProfile) => {
  const role = user.role || 'free';
  const cleanRole = (role || 'free').toLowerCase();
  if (cleanRole === 'user' || cleanRole === 'free' || cleanRole === 'admin') {
    return '-';
  }

  const normalized = String(user.subscriptionDuration || '').toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'quarterly' || normalized === '3_month' || normalized === '3_months') return '3 Month';
  if (normalized === 'half_yearly' || normalized === '6_month' || normalized === '6_months') return '6 Month';
  if (normalized === 'yearly' || normalized === 'annual') return 'Yearly';
  return '1 Month';
};

const getStoragePlan = (role: string) => {
  const cleanRole = (role || 'free').toLowerCase();
  if (cleanRole === 'admin') return "1 TB";
  if (cleanRole === 'ultimate') return "1 TB";
  if (cleanRole === 'elite') return "500 GB";
  if (cleanRole === 'pro') return "200 GB";
  if (cleanRole === 'premium') return "100 GB";
  if (cleanRole === 'standard') return "50 GB";
  if (cleanRole === 'basic') return "25 GB";
  if (cleanRole === 'starter') return "10 GB";
  return "Free Plan";
};

export const PlanDetailsGrid: React.FC<Props> = ({ users }) => {
  const [search, setSearch] = useState('');
  const [storageFilter, setStorageFilter] = useState('all');
  const [durationFilter, setDurationFilter] = useState('all');

  const storageTiers = ["Free Plan", "10 GB", "25 GB", "50 GB", "100 GB", "200 GB", "500 GB", "1 TB"];
  const durationTiers = ["1 Month", "3 Month", "6 Month", "Yearly"];

  const unitsData = useMemo(() => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const parseDate = (d?: string) => {
      if (!d) return null;
      const parsed = new Date(d);
      return isNaN(parsed.getTime()) ? null : parsed;
    };

    const matrix: SubscriptionUnitStats[] = [];

    // 1. Add the single Free Plan unit (no duration associated with it)
    const freeUsers = users.filter(user => {
      const uStorage = getStoragePlan(user.role || 'free');
      return uStorage === "Free Plan";
    });

    let freeThisWeek = 0;
    let freeThisMonth = 0;
    let freeLast6Months = 0;
    let freeLastYear = 0;

    freeUsers.forEach(u => {
      const created = parseDate(u.createdAt);
      if (created) {
        if (created >= oneWeekAgo) freeThisWeek++;
        if (created >= oneMonthAgo) freeThisMonth++;
        if (created >= sixMonthsAgo) freeLast6Months++;
        if (created >= oneYearAgo) freeLastYear++;
      }
    });

    matrix.push({
      storageKey: "Free Plan",
      storageName: "Free Plan (1 GB)",
      durationKey: "-",
      durationName: "-",
      current: freeUsers.length,
      total: freeUsers.length,
      thisWeek: freeThisWeek,
      thisMonth: freeThisMonth,
      last6Months: freeLast6Months,
      lastYear: freeLastYear
    });

    // 2. Add the paid plans (6 storage tiers * 4 durations = 24 units)
    const paidStorageTiers = ["10 GB", "25 GB", "50 GB", "100 GB", "200 GB", "500 GB", "1 TB"];
    
    paidStorageTiers.forEach(st => {
      durationTiers.forEach(dt => {
        const unitUsers = users.filter(user => {
          const uStorage = getStoragePlan(user.role || 'free');
          const uDuration = getSubscriptionDuration(user);
          return uStorage === st && uDuration === dt;
        });

        let thisWeek = 0;
        let thisMonth = 0;
        let last6Months = 0;
        let lastYear = 0;

        unitUsers.forEach(u => {
          const created = parseDate(u.createdAt);
          if (created) {
            if (created >= oneWeekAgo) thisWeek++;
            if (created >= oneMonthAgo) thisMonth++;
            if (created >= sixMonthsAgo) last6Months++;
            if (created >= oneYearAgo) lastYear++;
          }
        });

        matrix.push({
          storageKey: st,
          storageName: `${st} Plan`,
          durationKey: dt,
          durationName: `${dt} Billing`,
          current: unitUsers.length,
          total: unitUsers.length,
          thisWeek,
          thisMonth,
          last6Months,
          lastYear
        });
      });
    });

    return matrix;
  }, [users]);

  const filteredUnits = useMemo(() => {
    return unitsData.filter(unit => {
      const matchesSearch = 
        unit.storageName.toLowerCase().includes(search.toLowerCase()) ||
        unit.durationName.toLowerCase().includes(search.toLowerCase());

      const matchesStorage = 
        storageFilter === 'all' || 
        unit.storageKey.toLowerCase() === storageFilter.toLowerCase();

      const matchesDuration = 
        durationFilter === 'all' || 
        unit.durationKey.toLowerCase() === durationFilter.toLowerCase();

      return matchesSearch && matchesStorage && matchesDuration;
    });
  }, [unitsData, search, storageFilter, durationFilter]);

  // Sort units so active subscriptions bubble to the top
  const sortedUnits = useMemo(() => {
    return [...filteredUnits].sort((a, b) => b.current - a.current);
  }, [filteredUnits]);

  // Compute aggregated sums for filtered results
  const aggregateStats = useMemo(() => {
    return filteredUnits.reduce((acc, unit) => {
      acc.current += unit.current;
      acc.total += unit.total;
      acc.thisWeek += unit.thisWeek;
      acc.thisMonth += unit.thisMonth;
      acc.last6Months += unit.last6Months;
      acc.lastYear += unit.lastYear;
      return acc;
    }, { current: 0, total: 0, thisWeek: 0, thisMonth: 0, last6Months: 0, lastYear: 0 });
  }, [filteredUnits]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header and Filter Controls */}
      <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-bold text-white">Subscription Units Breakdown</h3>
            <p className="text-slate-400 text-xs mt-1">
              Analyzing user counts and intervals across unique plan dimensions ({filteredUnits.length} units listed)
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search plan sizes or billing..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500/50 w-full sm:w-60 placeholder-slate-600 transition-colors"
              />
            </div>

            {/* Storage Filter */}
            <div className="relative flex items-center">
              <Filter className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
              <select
                value={storageFilter}
                onChange={e => setStorageFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer placeholder-slate-600 transition-colors"
              >
                <option value="all">All Storage Tiers</option>
                {storageTiers.map((tier, idx) => (
                  <option key={idx} value={tier}>{tier}</option>
                ))}
              </select>
            </div>

            {/* Duration Filter */}
            <div className="relative flex items-center">
              <Clock className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
              <select
                value={durationFilter}
                onChange={e => setDurationFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer placeholder-slate-600 transition-colors"
              >
                <option value="all">All Durations</option>
                {durationTiers.map((dur, idx) => (
                  <option key={idx} value={dur}>{dur}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Aggregated view for filtered plans */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mt-6 pt-6 border-t border-slate-800/60 text-center">
          <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800/30">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Current Subs</p>
            <p className="text-xl font-black text-white mt-1">{aggregateStats.current}</p>
          </div>
          <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800/30">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Total Subs</p>
            <p className="text-xl font-black text-white mt-1">{aggregateStats.total}</p>
          </div>
          <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800/30">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">This Week</p>
            <p className="text-xl font-black text-emerald-400 mt-1">+{aggregateStats.thisWeek}</p>
          </div>
          <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800/30">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">This Month</p>
            <p className="text-xl font-black text-sky-400 mt-1">+{aggregateStats.thisMonth}</p>
          </div>
          <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800/30">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Last 6 Months</p>
            <p className="text-xl font-black text-indigo-400 mt-1">+{aggregateStats.last6Months}</p>
          </div>
          <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800/30">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Last Year</p>
            <p className="text-xl font-black text-purple-400 mt-1">+{aggregateStats.lastYear}</p>
          </div>
        </div>
      </div>

      {/* Single Comprehensive Table of Subscription Units */}
      <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="overflow-x-auto border border-slate-800/60 rounded-2xl">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="text-xs text-slate-500 uppercase bg-slate-900/30 border-b border-slate-800">
              <tr>
                <th scope="col" className="py-3.5 px-4">Storage Plan</th>
                <th scope="col" className="py-3.5 px-4">Billing Cycle</th>
                <th scope="col" className="py-3.5 px-4">Current Active</th>
                <th scope="col" className="py-3.5 px-4">Total Subs</th>
                <th scope="col" className="py-3.5 px-4">This Week</th>
                <th scope="col" className="py-3.5 px-4">This Month</th>
                <th scope="col" className="py-3.5 px-4">Last 6 Months</th>
                <th scope="col" className="py-3.5 px-4">Last Year</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {sortedUnits.map((unit, idx) => {
                const isActive = unit.current > 0;
                return (
                  <tr
                    key={idx}
                    className={`hover:bg-slate-800/10 transition-colors ${
                      isActive ? 'text-slate-200' : 'opacity-40 text-slate-500'
                    }`}
                  >
                    {/* Storage Plan */}
                    <td className="py-3.5 px-4 font-semibold flex items-center space-x-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-indigo-400' : 'bg-slate-700'}`} />
                      <span className={isActive ? 'text-white' : ''}>{unit.storageName}</span>
                    </td>

                    {/* Billing Cycle */}
                    <td className="py-3.5 px-4 font-semibold">
                      {unit.durationKey}
                    </td>

                    {/* Current Active */}
                    <td className={`py-3.5 px-4 font-bold ${isActive ? 'text-white' : ''}`}>
                      {unit.current}
                    </td>

                    {/* Total Subs */}
                    <td className={`py-3.5 px-4 ${isActive ? 'text-slate-300' : ''}`}>
                      {unit.total}
                    </td>

                    {/* This Week */}
                    <td className={`py-3.5 px-4 font-semibold ${isActive && unit.thisWeek > 0 ? 'text-emerald-400' : ''}`}>
                      +{unit.thisWeek}
                    </td>

                    {/* This Month */}
                    <td className={`py-3.5 px-4 font-semibold ${isActive && unit.thisMonth > 0 ? 'text-sky-400' : ''}`}>
                      +{unit.thisMonth}
                    </td>

                    {/* Last 6 Months */}
                    <td className={`py-3.5 px-4 ${isActive ? 'text-slate-300' : ''}`}>
                      +{unit.last6Months}
                    </td>

                    {/* Last Year */}
                    <td className={`py-3.5 px-4 ${isActive ? 'text-slate-300' : ''}`}>
                      +{unit.lastYear}
                    </td>
                  </tr>
                );
              })}

              {sortedUnits.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 bg-slate-900/10">
                    <p className="text-base font-semibold">No subscription units found</p>
                    <p className="text-xs text-slate-650 mt-1">Try resetting the storage capacity or billing cycle dropdowns.</p>
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
