import { useEffect, useState } from 'react';
import { choresApi, type ChoreWithOccurrence } from '../data/app';

/** Live occurrence list for a room. `error` is set while the realtime channel is down. */
export function useChores(roomId: string) {
  const [items, setItems] = useState<ChoreWithOccurrence[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(
    () =>
      choresApi.subscribeOccurrences(
        roomId,
        (next) => {
          setItems(next);
          setError(null);
        },
        () => setError('Live updates paused. Reconnecting…'),
      ),
    [roomId],
  );
  return { items: items ?? [], loaded: items !== null, error };
}
