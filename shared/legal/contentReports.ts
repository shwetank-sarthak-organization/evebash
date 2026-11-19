// Reasons and types for in-app reports. Keep aligned with supabase/migrations/20261023000000_content_reports.sql.
export type ReportTargetType = 'media' | 'comment' | 'chat_message' | 'business' | 'user';
export type ReportReason = 'sexual' | 'child_safety' | 'harassment' | 'hate' | 'violence' | 'spam' | 'privacy' | 'other';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'sexual', label: 'Nudity or sexual content' },
  { value: 'child_safety', label: 'Child safety concern' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate', label: 'Hate speech or symbols' },
  { value: 'violence', label: 'Violence or dangerous acts' },
  { value: 'spam', label: 'Spam, scam or fake' },
  { value: 'privacy', label: 'Shares private information or posted without consent' },
  { value: 'other', label: 'Something else' },
];

export const REPORT_TARGET_LABELS: Record<ReportTargetType, string> = {
  media: 'photo or video',
  comment: 'comment',
  chat_message: 'message',
  business: 'business profile',
  user: 'user',
};

export const REPORT_NOTE_MAX = 1000;
export const REPORT_THANKS = "Thanks, we'll review this within 24 hours.";
export const REPORT_DUPLICATE = "You've already reported this. We'll review it within 24 hours.";

// Turns file_content_report errors into text for the reporter
export function reportErrorMessage(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return '';
  // PostgREST's "function not found": the migration isn't applied yet
  if (error.code === 'PGRST202') return 'Reporting is not available yet. Please email support@evebash.com.';
  return error.message || 'Could not send the report. Please try again.';
}
