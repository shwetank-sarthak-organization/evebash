// Keep this version aligned with the database migration when terms/privacy change.
export const POLICY_VERSION = '2026-10-04.1';
export const POLICY_ACCEPTANCE_TEXT = 'I agree to the Terms & Conditions and acknowledge the Privacy Policy.';
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
