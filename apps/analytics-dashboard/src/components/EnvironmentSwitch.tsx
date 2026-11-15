import { currentEnvironment, liveAvailable, switchEnvironment, type DashboardEnvironment } from '../lib/environment';

const LABELS: Record<DashboardEnvironment, string> = { staging: 'Staging', live: 'Live' };

/**
 * Staging / Live switch (todo #32). Live is red everywhere so nobody changes real customers' data by mistake;
 * switching to Live asks first. Shown on the login screen and in the dashboard header.
 */
export function EnvironmentSwitch({ compact = false }: { compact?: boolean }) {
  const isLive = currentEnvironment === 'live';

  const choose = (next: DashboardEnvironment) => {
    if (next === currentEnvironment) return;
    if (next === 'live' && !window.confirm('Switch to LIVE? You will see and change real customers\' data. You may need to log in again.')) {
      return;
    }
    switchEnvironment(next);
  };

  return (
    <div className={`flex items-center ${compact ? 'gap-2' : 'flex-col gap-2'}`}>
      <div
        role="radiogroup"
        aria-label="Data source"
        className={`inline-flex rounded-xl border p-1 ${isLive ? 'border-rose-500/60 bg-rose-500/10' : 'border-sky-500/40 bg-sky-500/10'}`}
      >
        {(['staging', 'live'] as const).map((option) => {
          const active = option === currentEnvironment;
          const disabled = option === 'live' && !liveAvailable;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              title={disabled ? 'Add the VITE_LIVE_ settings to apps/analytics-dashboard/.env to use Live' : undefined}
              onClick={() => choose(option)}
              className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                active
                  ? option === 'live'
                    ? 'bg-rose-600 text-white'
                    : 'bg-sky-600 text-white'
                  : disabled
                    ? 'text-slate-600 cursor-not-allowed'
                    : 'text-slate-300 hover:bg-white/10 cursor-pointer'
              }`}
            >
              {LABELS[option]}
            </button>
          );
        })}
      </div>
      {!compact && (
        <p className={`text-xs font-medium ${isLive ? 'text-rose-300' : 'text-sky-300'}`}>
          {isLive ? 'LIVE: real customers\' data' : 'Staging: test data only'}
        </p>
      )}
    </div>
  );
}

/** Thin red strip across the top while working on Live. */
export function LiveWarningStrip() {
  if (currentEnvironment !== 'live') return null;
  return (
    <div className="bg-rose-600 text-white text-xs font-bold tracking-wide text-center py-1.5 shrink-0">
      LIVE DATA: every change here affects real customers
    </div>
  );
}
