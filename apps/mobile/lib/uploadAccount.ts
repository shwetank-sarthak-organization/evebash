import { supabase } from './supabase';

// Whose files may upload right now (issues #302, #303). The upload list is saved on the phone, not per account, and
// each file remembers who picked it (userId). Only the signed-in person's files upload or are saved; files another
// account picked wait until that account signs in again on this phone. null (signed out) starts nothing.
// Set by AuthContext through setUploadAccount in uploadQueue.ts.
let uploadAccountId: string | null = null;

export const getUploadAccount = () => uploadAccountId;

export function setUploadAccountId(userId: string | null) {
  uploadAccountId = userId;
}

const UPLOAD_PAUSED = 'upload_paused';

/** Thrown when a file's account isn't the one signed in: the file waits in the list, it isn't retried or failed */
export function uploadPausedError(): Error & { code: string; nonRetryable: true } {
  return Object.assign(new Error('Paused until its account signs in again'), { code: UPLOAD_PAUSED, nonRetryable: true as const });
}

export function isUploadPausedError(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { code?: string }).code === UPLOAD_PAUSED;
}

/**
 * The login to send for a file picked by `ownerId`: only while that account is the one signed in, so a file never
 * uploads under someone else's account. Throws uploadPausedError otherwise.
 */
export async function uploadAccessToken(ownerId: string, forceRefresh = false): Promise<string> {
  if (!uploadAccountId || ownerId !== uploadAccountId) throw uploadPausedError();
  let session = forceRefresh ? (await supabase.auth.refreshSession()).data.session : null;
  // getSession() refreshes an expired token itself, so long uploads always send a valid one
  if (!session?.access_token) session = (await supabase.auth.getSession()).data.session;
  if (!session?.access_token || session.user?.id !== ownerId || ownerId !== uploadAccountId) throw uploadPausedError();
  return session.access_token;
}
