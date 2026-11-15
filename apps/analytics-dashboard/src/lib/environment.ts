/**
 * Which EveBash data the dashboard works on: Staging or Live (todo #32). Each has its own Supabase project and
 * backend, set in apps/analytics-dashboard/.env:
 *   VITE_STAGING_SUPABASE_URL, VITE_STAGING_SUPABASE_ANON_KEY, VITE_STAGING_API_BASE_URL
 *   VITE_LIVE_SUPABASE_URL,    VITE_LIVE_SUPABASE_ANON_KEY,    VITE_LIVE_API_BASE_URL
 * The older VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_API_BASE_URL count as Staging (the file has pointed
 * at staging since todo #30 step 5h). The choice is remembered in this browser; Staging is the default, and Live is
 * only offered when its three settings are present and differ from Staging's.
 */

export type DashboardEnvironment = 'staging' | 'live';

export interface EnvironmentConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  apiBaseUrl: string;
}

const STORAGE_KEY = 'evebash:dashboard-environment';
const env = (import.meta as any).env as Record<string, string | undefined>;

const clean = (value: string | undefined) => (value || '').trim().replace(/\/+$/, '');

const configs: Record<DashboardEnvironment, EnvironmentConfig> = {
  staging: {
    supabaseUrl: clean(env.VITE_STAGING_SUPABASE_URL || env.VITE_SUPABASE_URL),
    supabaseAnonKey: (env.VITE_STAGING_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '').trim(),
    apiBaseUrl: clean(env.VITE_STAGING_API_BASE_URL || env.VITE_API_BASE_URL || env.VITE_NEXT_PUBLIC_SITE_URL) || 'http://localhost:8080',
  },
  live: {
    supabaseUrl: clean(env.VITE_LIVE_SUPABASE_URL),
    supabaseAnonKey: (env.VITE_LIVE_SUPABASE_ANON_KEY || '').trim(),
    apiBaseUrl: clean(env.VITE_LIVE_API_BASE_URL),
  },
};

/** Live is offered only when fully set up and not accidentally the same project as Staging. */
export const liveAvailable =
  !!configs.live.supabaseUrl &&
  !!configs.live.supabaseAnonKey &&
  !!configs.live.apiBaseUrl &&
  configs.live.supabaseUrl !== configs.staging.supabaseUrl;

function readChoice(): DashboardEnvironment {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'live' && liveAvailable ? 'live' : 'staging';
  } catch {
    return 'staging';
  }
}

export const currentEnvironment: DashboardEnvironment = readChoice();
export const currentConfig: EnvironmentConfig = configs[currentEnvironment];

/** Switches and reloads, so every screen and the login start fresh on the other data. */
export function switchEnvironment(next: DashboardEnvironment) {
  if (next === currentEnvironment || (next === 'live' && !liveAvailable)) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    return;
  }
  window.location.reload();
}
