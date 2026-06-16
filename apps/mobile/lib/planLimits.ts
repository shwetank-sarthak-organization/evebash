export type PlanDetails = {
  name: string;
  storageBytes: number;
  storageLabel: string;
  eventLimit: number;
  eventLabel: string;
  accent: string;
  accentSoft: string;
};

const GB = 1024 * 1024 * 1024;

export function getPlanDetails(role?: string): PlanDetails {
  switch (role?.toLowerCase()) {
    case 'admin':
      return {
        name: 'Super Admin',
        storageBytes: Infinity,
        storageLabel: 'Unlimited',
        eventLimit: Infinity,
        eventLabel: 'Unlimited',
        accent: '#d4af37',
        accentSoft: 'rgba(212, 175, 55, 0.16)',
      };
    case 'elite':
      return {
        name: 'Elite Plan',
        storageBytes: 500 * GB,
        storageLabel: '500 GB',
        eventLimit: 100,
        eventLabel: '100',
        accent: '#d4af37',
        accentSoft: 'rgba(212, 175, 55, 0.16)',
      };
    case 'premium':
      return {
        name: 'Premium Plan',
        storageBytes: 100 * GB,
        storageLabel: '100 GB',
        eventLimit: 25,
        eventLabel: '25',
        accent: '#818cf8',
        accentSoft: 'rgba(129, 140, 248, 0.16)',
      };
    case 'standard':
      return {
        name: 'Standard Plan',
        storageBytes: 50 * GB,
        storageLabel: '50 GB',
        eventLimit: 10,
        eventLabel: '10',
        accent: '#38bdf8',
        accentSoft: 'rgba(56, 189, 248, 0.16)',
      };
    case 'basic':
      return {
        name: 'Basic Plan',
        storageBytes: 25 * GB,
        storageLabel: '25 GB',
        eventLimit: 5,
        eventLabel: '5',
        accent: '#22c55e',
        accentSoft: 'rgba(34, 197, 94, 0.16)',
      };
    case 'free':
    case 'freemium':
    default:
      return {
        name: 'Free Plan',
        storageBytes: 5 * GB,
        storageLabel: '5 GB',
        eventLimit: 2,
        eventLabel: '2',
        accent: '#94a3b8',
        accentSoft: 'rgba(148, 163, 184, 0.16)',
      };
  }
}

export function getUsagePercent(current: number, limit: number) {
  if (limit === Infinity) return 0;
  if (limit <= 0) return current > 0 ? 100 : 0;
  return Math.min((current / limit) * 100, 100);
}

export function formatStorageSize(bytes: number) {
  if (bytes === 0) return '0 MB';

  const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, unitIndex);
  return `${parseFloat(value.toFixed(2))} ${units[unitIndex]}`;
}
