'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { modalStyles } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { POLICY_VERSION, POLICY_PENDING_KEY, matchesAcceptanceIntent } from '../../shared/legal/acceptance';

export function PolicyAcceptanceGate({ userId, onSignOut, children }: { userId?: string; onSignOut: () => void; children: React.ReactNode }) {
  const pathname = usePathname();
  const [acceptedUser, setAcceptedUser] = useState('');
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const legalPage = ['/privacy-policy', '/terms-and-conditions', '/cancellation-refund-policy', '/digital-service-delivery-policy', '/delete-account', '/reset-password', '/forgot-password'].includes(pathname);
  // Only open once the check says "not accepted" (ready) or fails; opening while it runs flashed the popup on every page load
  const blocked = Boolean(userId && acceptedUser !== userId && !legalPage && (ready || error));
  useEffect(() => {
    if (!blocked) return;
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, [blocked]);
  useEffect(() => {
    let active = true;
    setAcceptedUser(''); setChecked(false); setReady(false); setError('');
    if (!userId) return;
    void (async () => {
      const { data, error } = await supabase.rpc('get_policy_acceptance');
      if (error) throw error;
      if (data?.version !== POLICY_VERSION || typeof data?.accepted !== 'boolean') throw new Error('Please refresh to load the latest policies.');
      if (!active) return;
      if (data.accepted) { setAcceptedUser(userId); return; }
      const { data: sessionData } = await supabase.auth.getSession();
      const email = sessionData.session?.user.email;
      let intent: string | null = null;
      try { intent = sessionStorage.getItem(POLICY_PENDING_KEY); } catch { /* Explicit confirmation remains available. */ }
      if (email && sessionData.session?.user.id === userId && matchesAcceptanceIntent(intent, email)) {
        const { error: saveError } = await supabase.rpc('accept_current_policies', { p_version: POLICY_VERSION, p_platform: 'web', p_accepted: true });
        if (saveError) throw saveError;
        try { sessionStorage.removeItem(POLICY_PENDING_KEY); } catch { /* Best effort. */ }
        if (active) setAcceptedUser(userId);
      } else if (active) setReady(true);
    })().catch(() => { if (active) setError('We could not check your policy acceptance. Please retry.'); });
    return () => { active = false; };
  }, [userId, retry]);
  const accept = async () => {
    if (!checked || busy || !ready || !userId) return;
    setBusy(true); setError('');
    try {
      const { error } = await supabase.rpc('accept_current_policies', { p_version: POLICY_VERSION, p_platform: 'web', p_accepted: true });
      if (error) throw error;
      setAcceptedUser(userId);
    } catch { setError('Your acceptance could not be saved. Please try again.'); }
    finally { setBusy(false); }
  };
  if (!blocked) return children;
  return <dialog ref={dialog} onCancel={e => e.preventDefault()} aria-labelledby="policy-title" className={cn(modalStyles.dialog, 'max-w-lg')}>
    <h2 id="policy-title" className={modalStyles.title}>Before you continue</h2>
    <p className={cn(modalStyles.body, 'my-4')}>Please review EveBash’s terms and privacy information. This does not grant optional permissions for Find You or marketing.</p>
    {ready ? <label className="flex items-start gap-3"><input type="checkbox" checked={checked} disabled={busy} onChange={e => setChecked(e.target.checked)} className="mt-1 h-5 w-5 accent-[#CA9C68]" /><span className="text-sm text-[var(--site-subtle)]">I agree to the <a className="underline" href="/terms-and-conditions" target="_blank" rel="noopener noreferrer">Terms &amp; Conditions</a> and acknowledge the <a className="underline" href="/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</span></label> : !error && <p role="status">Checking policy acceptance…</p>}
    {error && <p role="alert" className={cn(modalStyles.error, 'mt-4')}>{error}</p>}
    <div className={modalStyles.actions}><button disabled={busy} onClick={onSignOut} className={modalStyles.secondary}>Sign out</button>{!ready && error ? <button onClick={() => setRetry(n => n + 1)} className={modalStyles.secondary}>Retry</button> : <button disabled={!ready || !checked || busy} onClick={() => void accept()} className={modalStyles.primary}>{busy ? 'Saving…' : 'Accept and continue'}</button>}</div>
  </dialog>;
}
