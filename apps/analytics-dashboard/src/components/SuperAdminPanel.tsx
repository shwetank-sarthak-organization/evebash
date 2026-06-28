import { useMemo, useState } from 'react';
import {
  RefreshCcw,
  ShieldCheck,
  Trash2,
  Users,
  FolderTree,
  UserCheck,
  UserX,
} from 'lucide-react';
import type { Event, GuestLog, UserProfile } from '../lib/analytics';

type AdminSection = 'users' | 'admins' | 'events' | 'guests';

interface SuperAdminPanelProps {
  users: UserProfile[];
  events: Event[];
  guests: GuestLog[];
  loading: boolean;
  onRefresh: () => void;
  onSyncUsers: () => void;
  onUpdateUserRole: (userId: string, role: string, delegatedBy?: string, roleType?: string) => void;
  onDeleteUser: (userId: string) => void;
  onDeleteEvent: (eventId: string) => void;
  onDeleteGuest: (guestId: string) => void;
}

function formatDate(value?: string) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function getUserName(users: UserProfile[], id?: string) {
  if (!id) return 'Unassigned';
  const user = users.find(item => item.id === id);
  return user?.name || user?.email || id;
}

function RoleSelect({
  user,
  onChange,
}: {
  user: UserProfile;
  onChange: (role: string) => void;
}) {
  return (
    <select
      value={user.role || 'user'}
      onChange={event => onChange(event.target.value)}
      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
    >
      <option value="user">User</option>
      <option value="free">Free</option>
      <option value="starter">10 GB</option>
      <option value="basic">Basic</option>
      <option value="standard">Standard</option>
      <option value="premium">Premium</option>
      <option value="pro">200 GB</option>
      <option value="elite">Elite</option>
      <option value="ultimate">1 TB</option>
      <option value="admin">Admin</option>
    </select>
  );
}

export function SuperAdminPanel({
  users,
  events,
  guests,
  loading,
  onRefresh,
  onSyncUsers,
  onUpdateUserRole,
  onDeleteUser,
  onDeleteEvent,
  onDeleteGuest,
}: SuperAdminPanelProps) {
  const [section, setSection] = useState<AdminSection>('users');

  const mainEvents = useMemo(
    () => events.filter(event => !event.parentId && event.type !== 'sub'),
    [events]
  );

  const subEventsByParent = useMemo(() => {
    const groups = new Map<string, Event[]>();
    events
      .filter(event => event.parentId || event.type === 'sub')
      .forEach(event => {
        const key = event.parentId || 'unassigned';
        const existing = groups.get(key) || [];
        existing.push(event);
        groups.set(key, existing);
      });
    return groups;
  }, [events]);

  const delegatedAdmins = useMemo(
    () => users.filter(user => user.role === 'admin' && user.delegatedBy),
    [users]
  );

  const globalAdmins = useMemo(
    () => users.filter(user => user.role === 'admin' && !user.delegatedBy),
    [users]
  );

  const sortedGuests = useMemo(
    () => [...guests].sort((a, b) => {
      const aTime = a.loginAt ? new Date(a.loginAt).getTime() : 0;
      const bTime = b.loginAt ? new Date(b.loginAt).getTime() : 0;
      return bTime - aTime;
    }),
    [guests]
  );

  const sections = [
    { id: 'users' as const, label: 'Users', icon: Users, count: users.length },
    { id: 'admins' as const, label: 'Admins', icon: UserCheck, count: globalAdmins.length + delegatedAdmins.length },
    { id: 'events' as const, label: 'Events', icon: FolderTree, count: events.length },
    { id: 'guests' as const, label: 'Guests', icon: UserX, count: guests.length },
  ];

  const confirmDeleteUser = (user: UserProfile) => {
    if (confirm(`Delete ${user.name || user.email || 'this user'} permanently?`)) {
      onDeleteUser(user.id);
    }
  };

  const confirmDeleteEvent = (event: Event) => {
    if (confirm(`Delete "${event.title}" and its nested content?`)) {
      onDeleteEvent(event.id);
    }
  };

  const confirmDeleteGuest = (guest: GuestLog) => {
    if (confirm(`Delete guest log for ${guest.name || guest.phone || guest.id}?`)) {
      onDeleteGuest(guest.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2">
            <ShieldCheck className="w-4 h-4" />
            Global Super Admin
          </div>
          <h1 className="text-2xl font-bold text-white">Super Admin Control</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage accounts, delegated admins, events, sub galleries, and guest access from the analytics app.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-800 bg-slate-900 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-60"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={onSyncUsers}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            <Users className="w-4 h-4" />
            Sync Auth Users
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {sections.map(item => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`text-left border rounded-2xl p-4 transition-colors ${
                active
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-[#111827] border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <Icon className="w-5 h-5 mb-3" />
              <p className="text-xs font-semibold uppercase tracking-wider opacity-80">{item.label}</p>
              <p className="text-2xl font-bold mt-1">{item.count}</p>
            </button>
          );
        })}
      </div>

      {section === 'users' && (
        <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h2 className="font-bold text-white">User Accounts</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/60 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 py-3">User</th>
                  <th className="text-left px-5 py-3">Role</th>
                  <th className="text-left px-5 py-3">Created</th>
                  <th className="text-right px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-slate-900/40">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-100">{user.name || 'Anonymous'}</p>
                      <p className="text-xs text-slate-500">{user.email || user.phone || user.id}</p>
                    </td>
                    <td className="px-5 py-4">
                      <RoleSelect user={user} onChange={role => onUpdateUserRole(user.id, role)} />
                    </td>
                    <td className="px-5 py-4 text-slate-400">{formatDate(user.createdAt)}</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => confirmDeleteUser(user)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 text-xs font-semibold"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {section === 'admins' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5">
            <h2 className="font-bold text-white mb-4">Global Admins</h2>
            <div className="space-y-3">
              {globalAdmins.map(user => (
                <div key={user.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-950/50 border border-slate-800 p-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-100 truncate">{user.name || 'Admin'}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                  <RoleSelect user={user} onChange={role => onUpdateUserRole(user.id, role)} />
                </div>
              ))}
              {globalAdmins.length === 0 && <p className="text-sm text-slate-500">No global admins found.</p>}
            </div>
          </div>
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5">
            <h2 className="font-bold text-white mb-4">Delegated Admins</h2>
            <div className="space-y-3">
              {delegatedAdmins.map(user => (
                <div key={user.id} className="rounded-xl bg-slate-950/50 border border-slate-800 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-100 truncate">{user.name || 'Delegated Admin'}</p>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      <p className="text-xs text-slate-400 mt-2">
                        Owner: {getUserName(users, user.delegatedBy)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Scope: {user.roleType || 'primary'}
                      </p>
                    </div>
                    <button
                      onClick={() => onUpdateUserRole(user.id, 'user')}
                      className="px-3 py-2 rounded-lg border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 text-xs font-semibold"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
              {delegatedAdmins.length === 0 && <p className="text-sm text-slate-500">No delegated admins found.</p>}
            </div>
          </div>
        </div>
      )}

      {section === 'events' && (
        <div className="space-y-4">
          {mainEvents.map(event => {
            const subEvents = subEventsByParent.get(event.id) || [];
            const eventGuests = guests.filter(guest =>
              guest.eventId === event.id || guest.parentEventId === event.id
            );
            const eventAdmins = delegatedAdmins.filter(admin =>
              admin.delegatedBy === event.createdById &&
              (admin.roleType !== 'event' || admin.assignedEvents?.includes(event.id))
            );

            return (
              <div key={event.id} className="bg-[#111827] border border-slate-800 rounded-2xl p-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-white">{event.title}</h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Owner: {getUserName(users, event.createdById)} · {formatDate(event.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => confirmDeleteEvent(event)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 text-xs font-semibold"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Event
                  </button>
                </div>
                <div className="mt-4 grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {subEvents.map(subEvent => (
                    <div key={subEvent.id} className="rounded-xl bg-slate-950/50 border border-slate-800 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-200 truncate">{subEvent.title}</p>
                          <p className="text-xs text-slate-500 mt-1">{formatDate(subEvent.createdAt)}</p>
                        </div>
                        <button
                          onClick={() => confirmDeleteEvent(subEvent)}
                          className="p-2 rounded-lg border border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
                          aria-label="Delete sub event"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {subEvents.length === 0 && (
                    <p className="text-sm text-slate-500">No sub galleries under this event.</p>
                  )}
                </div>
                <div className="mt-5 grid lg:grid-cols-2 gap-4">
                  <div className="rounded-xl bg-slate-950/40 border border-slate-800 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Delegated Admins</p>
                    <div className="space-y-2">
                      {eventAdmins.map(admin => (
                        <div key={admin.id} className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-200 truncate">{admin.name || 'Admin'}</p>
                            <p className="text-xs text-slate-500 truncate">{admin.email}</p>
                          </div>
                          <button
                            onClick={() => onUpdateUserRole(admin.id, 'user')}
                            className="px-3 py-1.5 rounded-lg border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 text-xs font-semibold"
                          >
                            Revoke
                          </button>
                        </div>
                      ))}
                      {eventAdmins.length === 0 && (
                        <p className="text-sm text-slate-500">No delegated admins assigned.</p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-950/40 border border-slate-800 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Recent Guests</p>
                    <div className="space-y-2">
                      {eventGuests.slice(0, 5).map(guest => (
                        <div key={guest.id} className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-200 truncate">{guest.name || 'Guest'}</p>
                            <p className="text-xs text-slate-500 truncate">{guest.email || guest.phone || guest.status}</p>
                          </div>
                          <button
                            onClick={() => confirmDeleteGuest(guest)}
                            className="p-2 rounded-lg border border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
                            aria-label="Delete guest"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {eventGuests.length === 0 && (
                        <p className="text-sm text-slate-500">No guest traffic found.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {mainEvents.length === 0 && (
            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-8 text-center text-slate-500">
              No events found.
            </div>
          )}
        </div>
      )}

      {section === 'guests' && (
        <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h2 className="font-bold text-white">Guest Access Logs</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/60 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 py-3">Guest</th>
                  <th className="text-left px-5 py-3">Event</th>
                  <th className="text-left px-5 py-3">Access</th>
                  <th className="text-left px-5 py-3">Login</th>
                  <th className="text-right px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sortedGuests.map(guest => (
                  <tr key={guest.id} className="hover:bg-slate-900/40">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-100">{guest.name || 'Guest User'}</p>
                      <p className="text-xs text-slate-500">{guest.email || guest.phone || guest.id}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-400">{guest.eventTitle || guest.eventId || 'Unknown'}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-slate-900 border border-slate-800 px-2.5 py-1 text-xs text-slate-300">
                        {guest.status || 'pending'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-400">{formatDate(guest.loginAt)}</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => confirmDeleteGuest(guest)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 text-xs font-semibold"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
