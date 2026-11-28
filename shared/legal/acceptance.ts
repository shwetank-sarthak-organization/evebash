// Keep this version aligned with the database migration when terms/privacy change
// (2026-11-27.1: supabase/migrations/20261127120000_policy_acceptance_18_plus.sql, the 18+ confirmation, #25).
export const POLICY_VERSION = '2026-11-27.1';
export const POLICY_ACCEPTANCE_TEXT = 'I confirm I am 18 or older, agree to the Terms & Conditions and acknowledge the Privacy Policy.';
export const POLICY_PENDING_KEY = 'evebash.policy-acceptance-intent';
export function acceptanceIdentity(email: string) { return email.trim().toLowerCase(); }
export function matchesAcceptanceIntent(value: string | null, email: string) {
  try {
    const intent = JSON.parse(value || 'null');
    return intent?.version === POLICY_VERSION && intent?.email === acceptanceIdentity(email);
  } catch { return false; }
}
export function acceptanceIntent(email: string) {
  return JSON.stringify({ version: POLICY_VERSION, email: acceptanceIdentity(email) });
}
