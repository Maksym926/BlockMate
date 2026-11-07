import { useEffect, useState } from 'react';
import { roomsApi, type Resident } from '../data/app';

/** Live resident list for a room. `error` is set while the realtime channel is down and cleared on recovery. */
export function useResidents(roomId: string) {
  const [residents, setResidents] = useState<Resident[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(
    () =>
      roomsApi.subscribeResidents(
        roomId,
        (next) => {
          setResidents(next);
          setError(null);
        },
        () => setError('Live updates are paused. Reconnecting…'),
      ),
    [roomId],
  );
  return { residents: residents ?? [], loaded: residents !== null, error };
}
