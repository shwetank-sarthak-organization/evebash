import { createEventTransfersClient } from '../../../shared/eventTransfers/client';
import { supabase } from './supabase';

export { formatTransferExpiry } from '../../../shared/eventTransfers/client';
export type { EventTransferStatus, IncomingTransfer } from '../../../shared/eventTransfers/client';

export const eventTransfers = createEventTransfersClient({
  apiUrl: (path) => `${process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '') ?? ''}${path}`,
  getToken: async () => (await supabase.auth.getSession()).data.session?.access_token,
});
