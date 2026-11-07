/**
 * AsyncStorage-backed queue for shopping mutations made while offline (D-015).
 * Ops are replayed in order on reconnect; last-write-wins since the server
 * processes them sequentially.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ShoppingOp =
  | { kind: 'add'; roomId: string; name: string; quantity: number; tempId: string }
  | { kind: 'tick'; itemId: string }
  | { kind: 'untick'; itemId: string }
  | { kind: 'delete'; itemId: string }
  | { kind: 'increaseQty'; itemId: string; addQty: number };

const key = (roomId: string) => `@blockmate/shopping_queue/${roomId}`;

export async function enqueue(roomId: string, op: ShoppingOp): Promise<void> {
  const raw = await AsyncStorage.getItem(key(roomId));
  const ops: ShoppingOp[] = raw ? (JSON.parse(raw) as ShoppingOp[]) : [];
  ops.push(op);
  await AsyncStorage.setItem(key(roomId), JSON.stringify(ops));
}

/** Remove and return all queued ops (atomic dequeue). */
export async function dequeueAll(roomId: string): Promise<ShoppingOp[]> {
  const raw = await AsyncStorage.getItem(key(roomId));
  if (!raw) return [];
  await AsyncStorage.removeItem(key(roomId));
  return JSON.parse(raw) as ShoppingOp[];
}

export async function peekCount(roomId: string): Promise<number> {
  const raw = await AsyncStorage.getItem(key(roomId));
  if (!raw) return 0;
  return (JSON.parse(raw) as ShoppingOp[]).length;
}
