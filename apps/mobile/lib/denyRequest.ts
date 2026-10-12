import { denyGuestRequest } from './database';
import { appAlert, showToast } from './feedback';

/** Asks the host to confirm, then denies the request (the person is told and can ask again later). */
export function confirmDenyRequest(log: { id: string; name?: string | null }, onDenied: () => void) {
  const name = log.name || 'this guest';
  appAlert(`Deny ${name}'s request?`, "They'll be notified, and they can ask again later.", [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Deny',
      style: 'destructive',
      onPress: () => {
        void denyGuestRequest(log.id).then((result) => {
          if (!result.success) {
            appAlert('Could not deny the request', result.error || 'Please try again.');
            return;
          }
          showToast('Request denied.');
          onDenied();
        });
      },
    },
  ]);
}
