// Live updates for access requests (todo #40), used by the website's and the app's Host > Requests.
// Listens to new and changed rows in public.guests. Realtime only sends rows the signed-in person may read (their own
// requests, and the guests of events they manage), and never deletions. A burst of changes calls onChange once,
// delayMs after the last one; the screen then reloads its list as it does today. Screens keep their "reload when
// you come back" fallback, since a phone's connection drops in the background.

// The parts of the supabase-js client used here, so shared/ needs no Supabase import. `on` is loosely typed because
// supabase-js declares it with many overloads, which a narrow type can't match.
type ChannelLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on: (...args: any[]) => any;
  subscribe: () => unknown;
};
type ClientLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  channel: (name: string) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  removeChannel: (channel: any) => unknown;
};

/** Starts listening; returns the function that stops it */
export function watchAccessRequests(
  client: ClientLike,
  userId: string,
  onChange: () => void,
  delayMs = 1000,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const changed = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      onChange();
    }, delayMs);
  };

  // A new name each time: reusing a channel name after removing it can fail (see #335)
  const channel: ChannelLike = client
    .channel(`access-requests-${userId}-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'guests' }, changed)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'guests' }, changed);
  channel.subscribe();

  return () => {
    if (timer) clearTimeout(timer);
    void client.removeChannel(channel);
  };
}
