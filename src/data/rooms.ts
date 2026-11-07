// Data-access layer for rooms (UC-01). UI code calls this module and never touches Supabase directly.
// Join codes are normalised server-side (case-insensitive, spaces and dashes ignored), so the client sends them as typed.
import type { SupabaseClient } from '@supabase/supabase-js';

export type RoomErrorCode =
  | 'NAME_REQUIRED'
  | 'ROOM_NAME_REQUIRED'
  | 'NAME_TAKEN'
  | 'ROOM_NOT_FOUND'
  | 'NOT_AUTHENTICATED'
  | 'UNKNOWN';

export class RoomError extends Error {
  constructor(
    readonly code: RoomErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RoomError';
  }
}

export interface Room {
  id: string;
  name: string;
  joinCode: string;
}

export interface Resident {
  id: string;
  displayName: string;
  joinedAt: string;
  /** True for the signed-in user's own entry, so the UI can show "(you)". */
  isYou: boolean;
}

export interface RoomPreview {
  roomName: string;
  residentNames: string[];
}

// Messages raised by the SQL functions in supabase/migrations.
const SERVER_MESSAGES: Record<string, RoomErrorCode> = {
  'display name required': 'NAME_REQUIRED',
  'room name required': 'ROOM_NAME_REQUIRED',
  'display name taken': 'NAME_TAKEN',
  'room not found': 'ROOM_NOT_FOUND',
  'not authenticated': 'NOT_AUTHENTICATED',
};

export function mapRoomError(error: { message: string }): RoomError {
  return new RoomError(SERVER_MESSAGES[error.message] ?? 'UNKNOWN', error.message);
}

interface RoomRow {
  id: string;
  name: string;
  join_code: string;
}

const toRoom = (row: RoomRow): Room => ({ id: row.id, name: row.name, joinCode: row.join_code });

export async function createRoom(
  client: SupabaseClient,
  roomName: string,
  displayName: string,
): Promise<Room> {
  const { data, error } = await client.rpc('create_room', {
    p_room_name: roomName,
    p_display_name: displayName,
  });
  if (error) throw mapRoomError(error);
  return toRoom(data as RoomRow);
}

/**
 * The room this device's anonymous user already belongs to, or null. Lets the app reopen straight into the room
 * (UC-01 4c) with no extra local state. One room per device for the MVP.
 */
export async function findMyRoom(client: SupabaseClient): Promise<Room | null> {
  const { data: sessionData } = await client.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return null;
  const { data, error } = await client
    .from('residents')
    .select('rooms(id, name, join_code)')
    .eq('user_id', userId)
    .order('joined_at')
    .limit(1);
  if (error) throw mapRoomError(error);
  const row = (data as unknown as { rooms: RoomRow | null }[])[0];
  return row?.rooms ? toRoom(row.rooms) : null;
}

/** Room name and who is already in, for the join screen before a display name is chosen (D-024). */
export async function previewRoom(client: SupabaseClient, code: string): Promise<RoomPreview> {
  const { data, error } = await client.rpc('preview_room', { p_code: code });
  if (error) throw mapRoomError(error);
  const row = (data as { room_name: string; resident_names: string[] }[])[0];
  if (!row) throw new RoomError('ROOM_NOT_FOUND', 'room not found');
  return { roomName: row.room_name, residentNames: row.resident_names };
}

/** Joins the room, or re-opens it if the caller is already a resident (UC-01 4c). */
export async function joinRoom(
  client: SupabaseClient,
  code: string,
  displayName: string,
): Promise<Room> {
  const { data, error } = await client.rpc('join_room', {
    p_code: code,
    p_display_name: displayName,
  });
  if (error) throw mapRoomError(error);
  return toRoom(data as RoomRow);
}

interface ResidentRow {
  id: string;
  user_id: string;
  display_name: string;
  joined_at: string;
}

/** Residents of a room the caller belongs to, in join order. Non-residents see nothing (RLS). */
export async function listResidents(client: SupabaseClient, roomId: string): Promise<Resident[]> {
  const { data: sessionData } = await client.auth.getSession();
  const myUserId = sessionData.session?.user.id;
  const { data, error } = await client
    .from('residents')
    .select('id, user_id, display_name, joined_at')
    .eq('room_id', roomId)
    .order('joined_at');
  if (error) throw mapRoomError(error);
  return (data as ResidentRow[]).map((row) => ({
    id: row.id,
    displayName: row.display_name,
    joinedAt: row.joined_at,
    isYou: row.user_id === myUserId,
  }));
}

/**
 * Live resident list (UC-01 story 10). Calls onChange with the full list once subscribed (and again after
 * every reconnect, so a dropped channel cannot leave the list stale) and after every change. Returns unsubscribe.
 */
export function subscribeResidents(
  client: SupabaseClient,
  roomId: string,
  onChange: (residents: Resident[]) => void,
  onError: (error: RoomError) => void = () => {},
): () => void {
  const refresh = () => {
    listResidents(client, roomId).then(onChange, (e: unknown) =>
      onError(e instanceof RoomError ? e : new RoomError('UNKNOWN', String(e))),
    );
  };
  const channel = client
    .channel(`residents:${roomId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'residents', filter: `room_id=eq.${roomId}` },
      refresh,
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') refresh();
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onError(new RoomError('UNKNOWN', `realtime channel ${status}`));
      }
    });
  return () => {
    void client.removeChannel(channel);
  };
}
