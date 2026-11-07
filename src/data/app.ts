// The app's single Supabase client, wrapped in the data-access layer. Screens import `roomsApi` only.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as rooms from './rooms';

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

export type { Resident, Room, RoomPreview } from './rooms';
export { RoomError } from './rooms';
