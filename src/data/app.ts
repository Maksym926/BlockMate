// The app's single Supabase client, wrapped in the data-access layer. Screens import `roomsApi` / `choresApi` only.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as chores from './chores';
import * as rooms from './rooms';
import * as shopping from './shopping';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  throw new Error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (see .env.example).');
}

const client = createClient(url, anonKey, {
  auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

/** Anonymous sign-in on first launch (D-004); later launches reuse the stored session. */
async function ensureSession(): Promise<void> {
  const { data } = await client.auth.getSession();
  if (data.session) return;
  const { error } = await client.auth.signInAnonymously();
  if (error) throw new rooms.RoomError('NOT_AUTHENTICATED', error.message);
}

export const roomsApi = {
  /** Signs in if needed and returns the room this device already belongs to, if any. */
  async start(): Promise<rooms.Room | null> {
    await ensureSession();
    return rooms.findMyRoom(client);
  },
  create: (roomName: string, displayName: string) => rooms.createRoom(client, roomName, displayName),
  preview: (code: string) => rooms.previewRoom(client, code),
  join: (code: string, displayName: string) => rooms.joinRoom(client, code, displayName),
  subscribeResidents: (
    roomId: string,
    onChange: (residents: rooms.Resident[]) => void,
    onError?: (error: rooms.RoomError) => void,
  ) => rooms.subscribeResidents(client, roomId, onChange, onError),
};

export const choresApi = {
  create: (params: Parameters<typeof chores.createChore>[1]) => chores.createChore(client, params),
  complete: (occurrenceId: string) => chores.completeOccurrence(client, occurrenceId),
  pass: (occurrenceId: string) => chores.passOccurrence(client, occurrenceId),
  createNextOccurrence: (choreId: string, dueAt: Date) => chores.createNextOccurrence(client, choreId, dueAt),
  assign: (
    occurrenceId: string,
    assigneeId: string | null,
    suggestionReason: string | null,
    suggestionSource: 'ai' | 'fallback' | 'manual',
  ) => chores.assignOccurrence(client, occurrenceId, assigneeId, suggestionReason, suggestionSource),
  delete: (choreId: string) => chores.deleteChore(client, choreId),
  suggest: (
    roomId: string,
    choreTitle: string,
    excludeIds?: string[],
    lastAssigneeId?: string | null,
  ) => chores.suggestAssignee(client, roomId, choreTitle, excludeIds, lastAssigneeId),
  subscribeOccurrences: (
    roomId: string,
    onChange: (items: chores.ChoreWithOccurrence[]) => void,
    onError?: (error: chores.ChoreError) => void,
  ) => chores.subscribeOccurrences(client, roomId, onChange, onError),
};

export const shoppingApi = {
  addItem: (roomId: string, name: string, quantity?: number) =>
    shopping.addItem(client, roomId, name, quantity),
  tickItem: (itemId: string) => shopping.tickItem(client, itemId),
  untickItem: (itemId: string) => shopping.untickItem(client, itemId),
  deleteItem: (itemId: string) => shopping.deleteItem(client, itemId),
  increaseQuantity: (itemId: string, addQty: number) =>
    shopping.increaseQuantity(client, itemId, addQty),
  subscribeItems: (
    roomId: string,
    onChange: (items: shopping.ShoppingItem[]) => void,
    onError?: (error: shopping.ShoppingError) => void,
    onReconnect?: () => void,
  ) => shopping.subscribeItems(client, roomId, onChange, onError, onReconnect),
};

export type { Chore, ChoreScope, ChoreWithOccurrence, CompletionResult, Occurrence, PassResult, RepeatInterval, SuggestionResult } from './chores';
// A class used with instanceof in the UI, so it must be a value export, not type-only.
export { ChoreError } from './chores';
export type { Resident, Room, RoomPreview } from './rooms';
export { RoomError } from './rooms';
export type { ShoppingItem } from './shopping';
export { ShoppingError } from './shopping';
