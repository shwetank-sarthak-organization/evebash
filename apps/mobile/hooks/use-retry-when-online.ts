import { useEffect, useRef } from 'react';
import { waitForConnection } from '@/lib/uploadQueue';

/**
 * While `failed` is true (a screen showing "Couldn't load ..."), waits until the backend answers again and then calls
 * `retry` once, so the error clears by itself when the connection comes back (#215). Try again still works meanwhile.
 */
export function useRetryWhenOnline(failed: boolean, retry: () => void) {
  const retryRef = useRef(retry);
  retryRef.current = retry;

  useEffect(() => {
    if (!failed) return;
    let cancelled = false;
    void waitForConnection().then(() => {
      if (!cancelled) retryRef.current();
    });
    return () => { cancelled = true; };
  }, [failed]);
}
