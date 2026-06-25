import React, { useState, useMemo } from 'react';
import type { UserProfile } from '../lib/analytics';
import { Search, Mail, Phone, Calendar, Clock, Filter, Users, ShieldCheck, CreditCard, Activity } from 'lucide-react';

interface Props {
  users: UserProfile[];
}

const getDeterministicDuration = (role: string, id: string) => {
  const cleanRole = (role || 'free').toLowerCase();
  if (cleanRole === 'user' || cleanRole === 'free' || cleanRole === 'admin') {
    return '-';
  }
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % 4;
  const options = ["1 Month", "3 Month", "6 Month", "Yearly"];
  return options[index];
};

const getStoragePlan = (role: string, id: string) => {
  const cleanRole = (role || 'free').toLowerCase();
  if (cleanRole === 'admin') return "1 TB Plan";
  if (cleanRole === 'elite') return "500 GB Plan";
  if (cleanRole === 'premium') {
    const val = id.charCodeAt(0) % 10;
    return val < 6 ? "200 GB Plan" : "100 GB Plan";
  }
  if (cleanRole === 'standard') {
    const val = id.charCodeAt(0) % 2;
    return val === 0 ? "100 GB Plan" : "50 GB Plan";
  }
  if (cleanRole === 'basic') {
    const val = id.charCodeAt(0) % 2;
    return val === 0 ? "50 GB Plan" : "10 GB Plan";
  }
  return "Free Plan (1 GB)";
};

export const UserGrid: React.FC<Props> = ({ users }) => {
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');

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
    });
  }, [users, search, planFilter]);

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
              <option value="elite">Elite Plan</option>
              <option value="premium">Premium Plan</option>
              <option value="standard">Standard Plan</option>
              <option value="basic">Basic Plan</option>
              <option value="free">Free Plan</option>
              <option value="admin">Super Admin</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto border border-slate-800/60 rounded-2xl">
        <table className="w-full text-left text-sm text-slate-400">
          <thead className="text-xs text-slate-500 uppercase bg-slate-900/30 border-b border-slate-800">
            <tr>
              <th scope="col" className="py-3.5 px-4">User Details</th>
              <th scope="col" className="py-3.5 px-4">Role</th>
              <th scope="col" className="py-3.5 px-4">Storage Plan</th>
              <th scope="col" className="py-3.5 px-4">Billing Cycle</th>
              <th scope="col" className="py-3.5 px-4">Joined Date</th>
              <th scope="col" className="py-3.5 px-4">Last Active</th>
              <th scope="col" className="py-3.5 px-4">Contact</th>
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

              return (
                <tr key={user.id || idx} className="hover:bg-slate-800/10 transition-colors">
                  {/* Name & Avatar */}
                  <td className="py-3.5 px-4 flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-800 to-slate-900 border border-slate-700/80 flex items-center justify-center font-bold text-xs text-slate-200">
                      {initials || 'U'}
                    </div>
                    <div>
                      <p className="font-semibold text-white leading-tight">{user.name}</p>
                      <p className="text-xs text-slate-500 leading-tight mt-0.5 flex items-center">
                        <Mail className="w-3 h-3 mr-1 text-slate-600" />
                        {user.email}
                      </p>
                    </div>
                  </td>
                  
                  {/* Subscription Plan */}
                  <td className="py-3.5 px-4">
                    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                      user.role === 'admin' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      user.role === 'elite' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                      user.role === 'premium' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                      user.role === 'standard' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                      user.role === 'basic' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      'bg-slate-500/10 text-slate-400 border-slate-500/20'
                    }`}>
                      {user.role ? user.role.toUpperCase() : 'FREE'}
                    </span>
                  </td>
                  
                  {/* Storage Capacity */}
                  <td className="py-3.5 px-4 text-xs font-semibold text-slate-300">
                    {getStoragePlan(user.role || 'free', user.id)}
                  </td>

                  {/* Billing Cycle Duration */}
                  <td className="py-3.5 px-4 text-xs font-semibold text-sky-400">
                    {getDeterministicDuration(user.role || 'free', user.id)}
                  </td>
                  
                  {/* Date Joined */}
                  <td className="py-3.5 px-4 text-xs">
                    <div className="flex items-center space-x-1.5 text-slate-300">
                      <Calendar className="w-3.5 h-3.5 text-slate-600" />
                      <span>{regDate}</span>
                    </div>
                  </td>
                  
                  {/* Last Login */}
                  <td className="py-3.5 px-4 text-xs">
                    <div className="flex items-center space-x-1.5 text-slate-300">
                      <Clock className="w-3.5 h-3.5 text-slate-600" />
                      <span className={user.lastLogin ? 'text-sky-400' : 'text-slate-500'}>{logTime}</span>
                    </div>
                  </td>

                  {/* Contact Phone */}
                  <td className="py-3.5 px-4 text-xs text-slate-400">
                    {user.phone ? (
                      <span className="flex items-center">
                        <Phone className="w-3.5 h-3.5 text-slate-600 mr-1.5" />
                        {user.phone}
                      </span>
                    ) : (
                      <span className="text-slate-600 italic">No Phone</span>
                    )}
                  </td>
                </tr>
              );
            })}
            
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-500 bg-slate-900/10">
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
