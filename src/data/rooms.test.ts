import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  RoomError,
  createRoom,
  findMyRoom,
  joinRoom,
  listResidents,
  mapRoomError,
  previewRoom,
  subscribeResidents,
  type Resident,
} from './rooms';

describe('mapRoomError', () => {
  it('maps server error messages to resident-facing codes', () => {
    expect(mapRoomError({ message: 'display name required' }).code).toBe('NAME_REQUIRED');
    expect(mapRoomError({ message: 'room name required' }).code).toBe('ROOM_NAME_REQUIRED');
    expect(mapRoomError({ message: 'display name taken' }).code).toBe('NAME_TAKEN');
    expect(mapRoomError({ message: 'room not found' }).code).toBe('ROOM_NOT_FOUND');
    expect(mapRoomError({ message: 'not authenticated' }).code).toBe('NOT_AUTHENTICATED');
  });
  it('falls back to UNKNOWN and keeps it a RoomError', () => {
    const err = mapRoomError({ message: 'boom' });
    expect(err).toBeInstanceOf(RoomError);
    expect(err.code).toBe('UNKNOWN');
  });
});

// ---- Integration: two independent clients ("phone A" and "phone B") against the Supabase project ----
// Uses EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY from .env.local (see .env.example) via vitest.config.ts.
// Each run creates anonymous users and rooms in that project.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

async function phone(): Promise<SupabaseClient> {
  const client = createClient(url!, anonKey!, { auth: { persistSession: false } });
  const { error } = await client.auth.signInAnonymously();
  if (error) throw error;
  return client;
}

async function rejection(p: Promise<unknown>): Promise<RoomError> {
  try {
    await p;
  } catch (e) {
    return e as RoomError;
  }
  throw new Error('expected rejection');
}

const names = (residents: Resident[]) => residents.map((r) => r.displayName).sort();

describe.skipIf(!url || !anonKey)('UC-01 rooms (two phones, Supabase project)', () => {
  it('acceptance: create on A, join by code on B, both list both names', async () => {
    const a = await phone();
    const b = await phone();

    const room = await createRoom(a, 'Flat 12B', 'Maya');
    expect(room.joinCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);

    // Typed lower-case with a stray space, as a resident might (D-023: case-insensitive).
    const typed = ` ${room.joinCode.slice(0, 3).toLowerCase()} ${room.joinCode.slice(3).toLowerCase()}`;
    const joined = await joinRoom(b, typed, 'Alex');
    expect(joined.id).toBe(room.id);

    expect(names(await listResidents(a, room.id))).toEqual(['Alex', 'Maya']);
    expect(names(await listResidents(b, room.id))).toEqual(['Alex', 'Maya']);

    // Each phone knows which entry is its own.
    const onB = await listResidents(b, room.id);
    expect(onB.filter((r) => r.isYou).map((r) => r.displayName)).toEqual(['Alex']);
  });

  it('story 10: A sees B join live, within 10 seconds', async () => {
    const a = await phone();
    const b = await phone();
    const room = await createRoom(a, 'Flat Live', 'Maya');

    let latest: Resident[] = [];
    const seenBoth = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('B not visible on A within 10s')), 10_000);
      subscribeResidents(a, room.id, (residents) => {
        latest = residents;
        if (residents.length === 2) {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    await joinRoom(b, room.joinCode, 'Alex');
    await seenBoth;
    expect(names(latest)).toEqual(['Alex', 'Maya']);
  }, 15_000);

  it('4c: joining again as an existing resident opens the room without a duplicate', async () => {
    const a = await phone();
    const b = await phone();
    const room = await createRoom(a, 'Flat 1', 'Maya');
    await joinRoom(b, room.joinCode, 'Alex');
    const again = await joinRoom(b, room.joinCode, 'Alex');
    expect(again.id).toBe(room.id);
    expect(await listResidents(a, room.id)).toHaveLength(2);
  });

  it('4c: two simultaneous joins from the same phone give one resident, not a name error', async () => {
    const a = await phone();
    const b = await phone();
    const room = await createRoom(a, 'Flat Race', 'Maya');
    const results = await Promise.all([
      joinRoom(b, room.joinCode, 'Alex'),
      joinRoom(b, room.joinCode, 'Alex'),
    ]);
    expect(results.map((r) => r.id)).toEqual([room.id, room.id]);
    expect(names(await listResidents(a, room.id))).toEqual(['Alex', 'Maya']);
  });

  it('1a: empty display name is rejected on create and on join', async () => {
    const a = await phone();
    const b = await phone();
    expect((await rejection(createRoom(a, 'Flat', '   '))).code).toBe('NAME_REQUIRED');
    const room = await createRoom(a, 'Flat', 'Maya');
    expect((await rejection(joinRoom(b, room.joinCode, ''))).code).toBe('NAME_REQUIRED');
  });

  it('D-013: a taken name (case-insensitive) asks for another name, and a retry works', async () => {
    const a = await phone();
    const b = await phone();
    const room = await createRoom(a, 'Flat', 'Maya');
    expect((await rejection(joinRoom(b, room.joinCode, ' maya '))).code).toBe('NAME_TAKEN');
    await joinRoom(b, room.joinCode, 'Alex');
    expect(names(await listResidents(a, room.id))).toEqual(['Alex', 'Maya']);
  });

  it('4b: unknown code gives ROOM_NOT_FOUND', async () => {
    const b = await phone();
    expect((await rejection(joinRoom(b, 'ZZZZZZ', 'Alex'))).code).toBe('ROOM_NOT_FOUND');
    expect((await rejection(previewRoom(b, 'ZZZZZZ'))).code).toBe('ROOM_NOT_FOUND');
  });

  it('D-024: preview shows room name and residents before the joiner picks a name', async () => {
    const a = await phone();
    const b = await phone();
    const room = await createRoom(a, 'Flat 12B', 'Maya');
    const preview = await previewRoom(b, room.joinCode);
    expect(preview).toEqual({ roomName: 'Flat 12B', residentNames: ['Maya'] });
    // Peeking does not join.
    expect(await listResidents(a, room.id)).toHaveLength(1);
  });

  it('4c: a returning phone finds its room again; a fresh phone finds none', async () => {
    const a = await phone();
    const fresh = await phone();
    expect(await findMyRoom(fresh)).toBeNull();
    const room = await createRoom(a, 'Flat Again', 'Maya');
    expect(await findMyRoom(a)).toEqual(room);
  });

  it('RLS: residents of one room cannot see another room, and outsiders see nothing', async () => {
    const maya = await phone();
    const sam = await phone();
    const outsider = await phone();
    const roomA = await createRoom(maya, 'Room A', 'Maya');
    const roomB = await createRoom(sam, 'Room B', 'Sam');

    expect(names(await listResidents(maya, roomA.id))).toEqual(['Maya']);
    expect(await listResidents(maya, roomB.id)).toEqual([]);
    expect(await listResidents(sam, roomA.id)).toEqual([]);
    expect(await listResidents(outsider, roomA.id)).toEqual([]);
  });
});
