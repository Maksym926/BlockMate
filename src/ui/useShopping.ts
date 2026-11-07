import { useEffect, useState } from 'react';
import { shoppingApi, type ShoppingItem } from '../data/app';

/** Live shopping-item list split into active and bought sections. */
export function useShopping(roomId: string) {
  const [items, setItems] = useState<ShoppingItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      shoppingApi.subscribeItems(
        roomId,
        (next) => {
          setItems(next);
          setError(null);
        },
        () => setError('Live updates paused. Reconnecting…'),
      ),
    [roomId],
  );

  const all = items ?? [];
  return {
    active: all.filter((i) => i.status === 'active'),
    bought: all.filter((i) => i.status === 'bought'),
    loaded: items !== null,
    error,
  };
}
