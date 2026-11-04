import { createEventTransfersClient } from "../../shared/eventTransfers/client";
import { getApiUrl } from "@/lib/apiBase";
import { supabase } from "@/lib/supabase";

export { formatTransferExpiry } from "../../shared/eventTransfers/client";
export type { EventTransferStatus, IncomingTransfer } from "../../shared/eventTransfers/client";

export const eventTransfers = createEventTransfersClient({
    apiUrl: getApiUrl,
    getToken: async () => (await supabase.auth.getSession()).data.session?.access_token,
});
