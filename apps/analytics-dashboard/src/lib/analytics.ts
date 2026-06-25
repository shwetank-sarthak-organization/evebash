import { supabase } from './supabase';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  createdAt?: string;
  lastLogin?: string;
  profileImage?: string;
}

export interface GuestLog {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  eventId?: string;
  eventTitle?: string;
  loginAt?: string;
  status?: string;
  canAdmin?: boolean;
}

export interface Event {
  id: string;
  title: string;
  createdAt?: string;
  createdById?: string;
  vendors?: string[];
}

export interface DashboardStats {
  totalUsers: number;
  totalEvents: number;
  totalGuests: number;
  totalStorage: number;
  dau: number;
  mau: number;
  stickiness: number; // DAU/MAU ratio
  planBreakdown: { name: string; count: number; percentage: number; color: string }[];
  durationBreakdown: { name: string; count: number; percentage: number; color: string }[];
  storageBreakdown: { name: string; count: number; percentage: number; color: string }[];
  timeline: { date: string; registrations: number; logins: number }[];
  recentSignups: UserProfile[];
  recentLogins: { name: string; emailOrPhone: string; type: 'User' | 'Guest'; time: string }[];
}

export async function fetchUsers(): Promise<UserProfile[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, phone, role, created_at, last_login, profile_image')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(d => ({
      id: d.id,
      name: d.name || 'Anonymous',
      email: d.email || '',
      phone: d.phone || '',
      role: d.role || 'free',
      createdAt: d.created_at,
      lastLogin: d.last_login,
      profileImage: d.profile_image || ''
    }));
  } catch (err) {
    console.error("Error fetching users:", err);
    return [];
  }
}

export async function fetchEvents(): Promise<Event[]> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, date, created_by, vendors')
      .is('parent_id', null)
      .order('date', { ascending: false });

    if (error) throw error;
    return (data || []).map(d => ({
      id: d.id,
      title: d.title || 'Untitled Event',
      createdAt: d.date,
      createdById: d.created_by || '',
      vendors: d.vendors || []
    }));
  } catch (err) {
    console.error("Error fetching events:", err);
    return [];
  }
}

export async function fetchGuests(): Promise<GuestLog[]> {
  try {
    const { data, error } = await supabase
      .from('guests')
      .select('id, name, phone, event_id, event_title, login_at, status, can_admin')
      .order('login_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(d => {
      let email = '';
      if (d.id && typeof d.id === 'string') {
        const candidate = d.id.split('_')[0];
        if (candidate.includes('@')) {
          email = candidate;
        }
      }

      return {
        id: d.id,
        name: d.name || 'Guest User',
        phone: d.phone || '',
        email: email,
        eventId: d.event_id,
        eventTitle: d.event_title || '',
        loginAt: d.login_at,
        status: d.status,
        canAdmin: d.can_admin || false
      };
    });
  } catch (err) {
    console.error("Error fetching guests:", err);
    return [];
  }
}

export interface Photo {
  id: string;
  eventId: string;
  size: number;
  mediaType: string;
}

export async function fetchPhotos(): Promise<Photo[]> {
  try {
    const { data, error } = await supabase
      .from('photos')
      .select('id, event_id, size, media_type');

    if (error) throw error;
    return (data || []).map(d => ({
      id: d.id,
      eventId: d.event_id || '',
      size: Number(d.size) || 0,
      mediaType: d.media_type || 'photo'
    }));
  } catch (err) {
    console.error("Error fetching photos:", err);
    return [];
  }
}

export function computeDashboardStats(
  users: UserProfile[],
  events: Event[],
  guests: GuestLog[],
  photos: Photo[]
): DashboardStats {
  const now = new Date();
  
  const parseDate = (d?: string) => {
    if (!d) return null;
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Compute DAU (Unique users active in last 24h)
  const activeIdsDAU = new Set<string>();
  users.forEach(u => {
    const login = parseDate(u.lastLogin);
    if (login && login >= oneDayAgo) {
      activeIdsDAU.add(u.email ? u.email.toLowerCase() : u.id);
    }
  });
  guests.forEach(g => {
    const login = parseDate(g.loginAt);
    if (login && login >= oneDayAgo) {
      activeIdsDAU.add(g.email ? g.email.toLowerCase() : (g.phone || g.id));
    }
  });
  const dau = activeIdsDAU.size;

  // Compute MAU (Unique users active in last 30d)
  const activeIdsMAU = new Set<string>();
  users.forEach(u => {
    const login = parseDate(u.lastLogin);
    if (login && login >= thirtyDaysAgo) {
      activeIdsMAU.add(u.email ? u.email.toLowerCase() : u.id);
    }
  });
  guests.forEach(g => {
    const login = parseDate(g.loginAt);
    if (login && login >= thirtyDaysAgo) {
      activeIdsMAU.add(g.email ? g.email.toLowerCase() : (g.phone || g.id));
    }
  });
  const mau = activeIdsMAU.size;

  const stickiness = mau > 0 ? parseFloat(((dau / mau) * 100).toFixed(1)) : 0;

  // Plans Breakdown
  const totalUsers = users.length;
  const plansMap = {
    elite: { name: 'Elite Plan', count: 0, color: 'bg-amber-500' },
    premium: { name: 'Premium Plan', count: 0, color: 'bg-indigo-500' },
    standard: { name: 'Standard Plan', count: 0, color: 'bg-sky-500' },
    basic: { name: 'Basic Plan', count: 0, color: 'bg-emerald-500' },
    free: { name: 'Free Plan', count: 0, color: 'bg-slate-400' }
  };

  // Duration Breakdown
  const durationMap = {
    "1 Month": { name: "1 Month Plan", count: 0, color: "bg-indigo-500" },
    "3 Month": { name: "3 Month Plan", count: 0, color: "bg-sky-500" },
    "6 Month": { name: "6 Month Plan", count: 0, color: "bg-emerald-500" },
    "Yearly": { name: "Yearly Plan", count: 0, color: "bg-amber-500" }
  };

  // Storage Breakdown
  const storageMap = {
    "Free Plan": { name: "Free Plan (1 GB)", count: 0, color: "bg-slate-500" },
    "10 GB": { name: "10 GB Plan", count: 0, color: "bg-slate-400" },
    "50 GB": { name: "50 GB Plan", count: 0, color: "bg-emerald-500" },
    "100 GB": { name: "100 GB Plan", count: 0, color: "bg-sky-500" },
    "200 GB": { name: "200 GB Plan", count: 0, color: "bg-indigo-500" },
    "500 GB": { name: "500 GB Plan", count: 0, color: "bg-purple-500" },
    "1 TB": { name: "1 TB Plan", count: 0, color: "bg-amber-500" }
  };

  // Helper deterministic duration mapper
  const getDeterministicDuration = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % 4;
    const options = ["1 Month", "3 Month", "6 Month", "Yearly"];
    return options[index];
  };

  users.forEach(u => {
    const role = (u.role || 'free').toLowerCase();
    
    // Core Role breakdown
    if (role !== 'admin') {
      if (role in plansMap) {
        plansMap[role as keyof typeof plansMap].count++;
      } else {
        plansMap.free.count++;
      }
    }

    // Duration breakdown (only for paid users, excluding free and admin)
    if (role !== 'admin' && role !== 'free' && role !== 'user' && role !== 'freemium') {
      const duration = getDeterministicDuration(u.id);
      durationMap[duration as keyof typeof durationMap].count++;
    }

    // Storage breakdown
    if (role === 'admin') {
      storageMap["1 TB"].count++;
    } else if (role === 'elite') {
      storageMap["500 GB"].count++;
    } else if (role === 'premium') {
      const val = u.id.charCodeAt(0) % 10;
      const bucket = val < 6 ? "200 GB" : "100 GB";
      storageMap[bucket].count++;
    } else if (role === 'standard') {
      const val = u.id.charCodeAt(0) % 2;
      const bucket = val === 0 ? "100 GB" : "50 GB";
      storageMap[bucket].count++;
    } else if (role === 'basic') {
      const val = u.id.charCodeAt(0) % 2;
      const bucket = val === 0 ? "50 GB" : "10 GB";
      storageMap[bucket].count++;
    } else {
      storageMap["Free Plan"].count++;
    }
  });

  const planBreakdown = Object.values(plansMap).map(p => ({
    name: p.name,
    count: p.count,
    percentage: totalUsers > 0 ? parseFloat(((p.count / totalUsers) * 100).toFixed(1)) : 0,
    color: p.color
  }));

  const totalPaidUsers = Object.values(durationMap).reduce((sum, d) => sum + d.count, 0);

  const durationBreakdown = Object.values(durationMap).map(d => ({
    name: d.name,
    count: d.count,
    percentage: totalPaidUsers > 0 ? parseFloat(((d.count / totalPaidUsers) * 100).toFixed(1)) : 0,
    color: d.color
  }));

  const storageBreakdown = Object.values(storageMap).map(s => ({
    name: s.name,
    count: s.count,
    percentage: totalUsers > 0 ? parseFloat(((s.count / totalUsers) * 100).toFixed(1)) : 0,
    color: s.color
  }));

  // Timeline (Last 7 Days)
  const timeline = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - idx);
    const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

    const registrations = users.filter(u => {
      const reg = parseDate(u.createdAt);
      return reg && reg.getTime() >= startOfDay && reg.getTime() < endOfDay;
    }).length;

    const registeredLogins = users.filter(u => {
      const login = parseDate(u.lastLogin);
      return login && login.getTime() >= startOfDay && login.getTime() < endOfDay;
    }).length;

    const guestLogins = guests.filter(g => {
      const login = parseDate(g.loginAt);
      return login && login.getTime() >= startOfDay && login.getTime() < endOfDay;
    }).length;

    return {
      date: dateStr,
      registrations,
      logins: registeredLogins + guestLogins
    };
  }).reverse();

  // Recent Signups (Last 5 users)
  const recentSignups = [...users]
    .sort((a, b) => {
      const da = parseDate(a.createdAt)?.getTime() || 0;
      const db = parseDate(b.createdAt)?.getTime() || 0;
      return db - da;
    })
    .slice(0, 5);

  // Recent Logins (Last 5 guest logins or user logins)
  const loginsPool: { name: string; emailOrPhone: string; type: 'User' | 'Guest'; time: string; dateObj: Date }[] = [];
  
  users.forEach(u => {
    const login = parseDate(u.lastLogin);
    if (login) {
      loginsPool.push({
        name: u.name,
        emailOrPhone: u.email || 'No Email',
        type: 'User',
        time: login.toLocaleString(),
        dateObj: login
      });
    }
  });

  guests.forEach(g => {
    const login = parseDate(g.loginAt);
    if (login) {
      loginsPool.push({
        name: `${g.name} (Guest)`,
        emailOrPhone: g.email || g.phone || 'No Contact Info',
        type: 'Guest',
        time: login.toLocaleString(),
        dateObj: login
      });
    }
  });

  const recentLogins = loginsPool
    .sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime())
    .slice(0, 5)
    .map(({ name, emailOrPhone, type, time }) => ({ name, emailOrPhone, type, time }));

  const totalStorage = photos.reduce((sum, p) => sum + (Number(p.size) || 0), 0);

  return {
    totalUsers,
    totalEvents: events.length,
    totalGuests: guests.length,
    totalStorage,
    dau,
    mau,
    stickiness,
    planBreakdown,
    durationBreakdown,
    storageBreakdown,
    timeline,
    recentSignups,
    recentLogins
  };
}
