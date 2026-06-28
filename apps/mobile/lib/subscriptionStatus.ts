const GRACE_DAYS = 7;

function isPaidRole(role?: string | null) {
  const cleanRole = String(role || 'user').toLowerCase();
  return !['admin', 'user', 'free', 'freemium'].includes(cleanRole);
}

function parseDateOnly(value?: string | null, endOfDay = false) {
  if (!value) return null;
  const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`
    : value;
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatPlanDate(date?: Date | null) {
  if (!date) return '';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function getSubscriptionStatus(params: {
  role?: string | null;
  planStartDate?: string | null;
  planEndDate?: string | null;
  now?: Date;
}) {
  const now = params.now || new Date();
  const endDate = parseDateOnly(params.planEndDate, true);
  const startDate = parseDateOnly(params.planStartDate);
  const paidRole = isPaidRole(params.role);

  if (!paidRole || !endDate) {
    return {
      status: 'active' as const,
      label: 'ACTIVE',
      tone: 'active' as const,
      startDate,
      endDate,
      graceEndsAt: null,
      daysLeft: null,
      message: '',
    };
  }

  if (now.getTime() <= endDate.getTime()) {
    const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / 86400000));
    return {
      status: 'active' as const,
      label: 'ACTIVE',
      tone: 'active' as const,
      startDate,
      endDate,
      graceEndsAt: null,
      daysLeft,
      message: `Your plan is active until ${formatPlanDate(endDate)}.`,
    };
  }

  const graceEndsAt = new Date(endDate);
  graceEndsAt.setDate(graceEndsAt.getDate() + GRACE_DAYS);

  if (now.getTime() <= graceEndsAt.getTime()) {
    const daysLeft = Math.max(0, Math.ceil((graceEndsAt.getTime() - now.getTime()) / 86400000));
    return {
      status: 'grace' as const,
      label: 'GRACE PERIOD',
      tone: 'warning' as const,
      startDate,
      endDate,
      graceEndsAt,
      daysLeft,
      message: `Your plan expired on ${formatPlanDate(endDate)}. You have ${daysLeft} day${daysLeft === 1 ? '' : 's'} left to download extra data before it becomes hidden.`,
    };
  }

  return {
    status: 'expired' as const,
    label: 'EXPIRED',
    tone: 'danger' as const,
    startDate,
    endDate,
    graceEndsAt,
    daysLeft: 0,
    message: `Your plan expired on ${formatPlanDate(endDate)} and the grace period ended on ${formatPlanDate(graceEndsAt)}. Renew your plan to restore full access.`,
  };
}

export function formatSubscriptionDate(value?: string | null) {
  return formatPlanDate(parseDateOnly(value));
}
