// Data-access layer for the shared shopping list (UC-03).
import type { SupabaseClient } from '@supabase/supabase-js';

export type ShoppingStatus = 'active' | 'bought';

export class ShoppingError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ShoppingError';
  }
}

export interface ShoppingItem {
  id: string;
  roomId: string;
  name: string;
  quantity: number;
  addedBy: string;
  status: ShoppingStatus;
  boughtBy: string | null;
  boughtAt: string | null;
  createdAt: string;
}

function mapRow(row: Record<string, unknown>): ShoppingItem {
  return {
    id: row.id as string,
    roomId: row.room_id as string,
    name: row.name as string,
    quantity: row.quantity as number,
    addedBy: row.added_by as string,
    status: row.status as ShoppingStatus,
    boughtBy: (row.bought_by as string | null) ?? null,
    boughtAt: (row.bought_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function addItem(
  client: SupabaseClient,
  roomId: string,
  name: string,
  quantity = 1,
): Promise<ShoppingItem> {
  const { data, error } = await client.rpc('add_shopping_item', {
    p_room_id: roomId,
    p_name: name,
    p_quantity: quantity,
  });
  if (error) throw new ShoppingError('UNKNOWN', error.message);
  return mapRow(data as Record<string, unknown>);
}

export async function tickItem(client: SupabaseClient, itemId: string): Promise<void> {
  const { error } = await client.rpc('tick_shopping_item', { p_item_id: itemId });
  if (error) throw new ShoppingError('UNKNOWN', error.message);
}

export async function untickItem(client: SupabaseClient, itemId: string): Promise<void> {
  const { error } = await client.rpc('untick_shopping_item', { p_item_id: itemId });
  if (error) throw new ShoppingError('UNKNOWN', error.message);
}

export async function deleteItem(client: SupabaseClient, itemId: string): Promise<void> {
  const { error } = await client.rpc('delete_shopping_item', { p_item_id: itemId });
  if (error) throw new ShoppingError('UNKNOWN', error.message);
}

export async function increaseQuantity(
  client: SupabaseClient,
  itemId: string,
  addQty: number,
): Promise<ShoppingItem> {
  const { data, error } = await client.rpc('increase_item_quantity', {
    p_item_id: itemId,
    p_add_quantity: addQty,
  });
  if (error) throw new ShoppingError('UNKNOWN', error.message);
  return mapRow(data as Record<string, unknown>);
}

async function fetchItems(client: SupabaseClient, roomId: string): Promise<ShoppingItem[]> {
  const { data, error } = await client
    .from('shopping_items')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true });
  if (error) throw new ShoppingError('UNKNOWN', error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapRow);
}

export function subscribeItems(
  client: SupabaseClient,
  roomId: string,
  onChange: (items: ShoppingItem[]) => void,
  onError?: (error: ShoppingError) => void,
): () => void {
  const reload = async () => {
    try {
      onChange(await fetchItems(client, roomId));
    } catch (err) {
      onError?.(
        err instanceof ShoppingError ? err : new ShoppingError('UNKNOWN', String(err)),
      );
    }
  };

  void reload();

  const channel = client
    .channel(`shopping:${roomId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'shopping_items', filter: `room_id=eq.${roomId}` },
      () => void reload(),
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        onError?.(new ShoppingError('REALTIME_ERROR', 'Live updates paused. Reconnecting…'));
      }
    });

  return () => { void client.removeChannel(channel); };
}
