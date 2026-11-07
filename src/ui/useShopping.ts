/**
 * Live shopping-item list with offline queue support (D-015).
 *
 * Optimistic model:
 *  - pendingAdds   – items added locally, not yet confirmed by Realtime
 *  - pendingStatus – per-id status overrides for tick / untick / delete
 *
 * On mutation failure (assumed offline): op is persisted to AsyncStorage via
 * offlineQueue; optimistic state remains until Realtime confirms or flush runs.
 *
 * On channel reconnect: flush() replays the queue in order (last-write-wins).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { shoppingApi, type ShoppingItem } from '../data/app';
import * as offlineQueue from '../data/offlineQueue';

type StatusOverride = 'active' | 'bought' | 'deleted';

/** Stable temp-ID generator. */
const makeTempId = () =>
  `temp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

export function useShopping(roomId: string, myResidentId: string | undefined) {
  const [serverItems, setServerItems] = useState<ShoppingItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingAdds, setPendingAdds] = useState<ShoppingItem[]>([]);
  const [pendingStatus, setPendingStatus] = useState<Record<string, StatusOverride>>({});
  const [pendingCount, setPendingCount] = useState(0);

  const flushing = useRef(false);

  // ── Queue flush ────────────────────────────────────────────────────────────

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      const ops = await offlineQueue.dequeueAll(roomId);
      if (ops.length === 0) return;

      const idMap = new Map<string, string>(); // tempId → real server id

      for (const op of ops) {
        try {
          if (op.kind === 'add') {
            const item = await shoppingApi.addItem(op.roomId, op.name, op.quantity);
            idMap.set(op.tempId, item.id);
            // Remove temp item now that server has the real one
            setPendingAdds((prev) => prev.filter((i) => i.id !== op.tempId));
          } else {
            const realId = idMap.get(op.itemId) ?? op.itemId;
            if (op.kind === 'tick') await shoppingApi.tickItem(realId);
            else if (op.kind === 'untick') await shoppingApi.untickItem(realId);
            else if (op.kind === 'delete') await shoppingApi.deleteItem(realId);
            else if (op.kind === 'increaseQty')
              await shoppingApi.increaseQuantity(realId, op.addQty);
          }
        } catch {
          // LWW: skip failed ops (item already deleted, etc.)
        }
      }

      // Server is now authoritative; clear all optimistic overrides
      setPendingStatus({});
      setPendingCount(0);
    } finally {
      flushing.current = false;
    }
  }, [roomId]);

  // ── Subscription ───────────────────────────────────────────────────────────

  useEffect(() => {
    // Load any ops queued in a previous offline session
    void offlineQueue.peekCount(roomId).then(setPendingCount);

    return shoppingApi.subscribeItems(
      roomId,
      (next) => {
        setServerItems(next);
        setError(null);
        setIsOnline(true);
        // Drop pending-status overrides that the server has now confirmed
        setPendingStatus((prev) => {
          const result: Record<string, StatusOverride> = {};
          for (const [id, override] of Object.entries(prev)) {
            const serverItem = next.find((i) => i.id === id);
            if (!serverItem) continue; // deleted on server – drop override
            if (serverItem.status !== override && override !== 'deleted') {
              result[id] = override; // server hasn't caught up yet – keep
            }
          }
          return result;
        });
        // Drop pending adds whose name + recent time matches a server item
        setPendingAdds((prev) => {
          const serverIds = new Set(next.map((i) => i.id));
          const nowMs = Date.now();
          return prev.filter((tempItem) => {
            if (serverIds.has(tempItem.id)) return false; // already has this id (shouldn't happen)
            const synced = next.some(
              (s) =>
                s.name.toLowerCase() === tempItem.name.toLowerCase() &&
                nowMs - new Date(tempItem.createdAt).getTime() < 15_000,
            );
            return !synced;
          });
        });
      },
      () => {
        setError('Live updates paused. Reconnecting…');
        setIsOnline(false);
      },
      () => {
        setIsOnline(true);
        void flush();
      },
    );
  }, [roomId, flush]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const addItem = useCallback(
    async (name: string, quantity: number): Promise<ShoppingItem> => {
      const tempId = makeTempId();
      const tempItem: ShoppingItem = {
        id: tempId,
        roomId,
        name,
        quantity,
        addedBy: myResidentId ?? '',
        status: 'active',
        boughtBy: null,
        boughtAt: null,
        createdAt: new Date().toISOString(),
      };
      setPendingAdds((prev) => [...prev, tempItem]);
      try {
        const item = await shoppingApi.addItem(roomId, name, quantity);
        // On success: remove temp item immediately (Realtime will show real item)
        setPendingAdds((prev) => prev.filter((i) => i.id !== tempId));
        return item;
      } catch {
        await offlineQueue.enqueue(roomId, { kind: 'add', roomId, name, quantity, tempId });
        setPendingCount((n) => n + 1);
        return tempItem;
      }
    },
    [roomId, myResidentId],
  );

  const tickItem = useCallback(
    async (itemId: string): Promise<void> => {
      setPendingStatus((prev) => ({ ...prev, [itemId]: 'bought' }));
      try {
        await shoppingApi.tickItem(itemId);
        // Keep override until Realtime confirms (clears in subscription callback)
      } catch {
        await offlineQueue.enqueue(roomId, { kind: 'tick', itemId });
        setPendingCount((n) => n + 1);
      }
    },
    [roomId],
  );

  const untickItem = useCallback(
    async (itemId: string): Promise<void> => {
      setPendingStatus((prev) => ({ ...prev, [itemId]: 'active' }));
      try {
        await shoppingApi.untickItem(itemId);
      } catch {
        await offlineQueue.enqueue(roomId, { kind: 'untick', itemId });
        setPendingCount((n) => n + 1);
      }
    },
    [roomId],
  );

  const deleteItem = useCallback(
    async (itemId: string): Promise<void> => {
      setPendingStatus((prev) => ({ ...prev, [itemId]: 'deleted' }));
      try {
        await shoppingApi.deleteItem(itemId);
      } catch {
        await offlineQueue.enqueue(roomId, { kind: 'delete', itemId });
        setPendingCount((n) => n + 1);
      }
    },
    [roomId],
  );

  const increaseQuantity = useCallback(
    async (itemId: string, addQty: number): Promise<ShoppingItem | undefined> => {
      try {
        return await shoppingApi.increaseQuantity(itemId, addQty);
      } catch {
        await offlineQueue.enqueue(roomId, { kind: 'increaseQty', itemId, addQty });
        setPendingCount((n) => n + 1);
        return undefined;
      }
    },
    [roomId],
  );

  // ── Merged display items ───────────────────────────────────────────────────

  const displayItems = useMemo(() => {
    const serverIds = new Set((serverItems ?? []).map((i) => i.id));
    const unsyncedAdds = pendingAdds.filter((i) => !serverIds.has(i.id));
    const base = [...(serverItems ?? []), ...unsyncedAdds];

    return base
      .filter((i) => pendingStatus[i.id] !== 'deleted')
      .map((i) => {
        const override = pendingStatus[i.id];
        if (override === 'active') return { ...i, status: 'active' as const, boughtBy: null, boughtAt: null };
        if (override === 'bought') return { ...i, status: 'bought' as const };
        return i;
      });
  }, [serverItems, pendingAdds, pendingStatus]);

  return {
    active: displayItems.filter((i) => i.status === 'active'),
    bought: displayItems.filter((i) => i.status === 'bought'),
    loaded: serverItems !== null,
    error,
    isOnline,
    pendingCount,
    addItem,
    tickItem,
    untickItem,
    deleteItem,
    increaseQuantity,
  };
}
