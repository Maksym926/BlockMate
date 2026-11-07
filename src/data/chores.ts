// Data-access layer for chores and occurrences (UC-02). UI calls this module only.
import type { SupabaseClient } from '@supabase/supabase-js';

export type RepeatInterval = 'daily' | 'weekly' | 'custom' | null;
export type ChoreScope = 'person' | 'room';
export type OccurrenceStatus = 'pending' | 'done' | 'passed';

export type ChoreErrorCode =
  | 'CHORE_TITLE_REQUIRED'
  | 'ASSIGNEE_REQUIRED'
  | 'ASSIGNEE_NOT_IN_ROOM'
  | 'ROOM_NEEDS_2_MEMBERS'
  | 'CHORE_NOT_FOUND'
  | 'NOT_AUTHENTICATED'
  | 'UNKNOWN';

export class ChoreError extends Error {
  constructor(
    readonly code: ChoreErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ChoreError';
  }
}

export interface Chore {
  id: string;
  roomId: string;
  title: string;
  repeatInterval: RepeatInterval;
  repeatDays: number | null;
  scope: ChoreScope;
  createdBy: string;
  createdAt: string;
}

export interface Occurrence {
  id: string;
  choreId: string;
  roomId: string;
  assigneeId: string | null;
  dueAt: string;
  status: OccurrenceStatus;
  suggestionReason: string | null;
  suggestionSource: 'ai' | 'fallback' | 'manual' | null;
  passedBy: string[];
}

export interface ChoreWithOccurrence {
  chore: Chore;
  occurrence: Occurrence;
}

const SERVER_MESSAGES: Record<string, ChoreErrorCode> = {
  'chore title required': 'CHORE_TITLE_REQUIRED',
  'assignee required': 'ASSIGNEE_REQUIRED',
  'assignee not in room': 'ASSIGNEE_NOT_IN_ROOM',
  'room needs 2 members': 'ROOM_NEEDS_2_MEMBERS',
  'chore not found': 'CHORE_NOT_FOUND',
  'not authenticated': 'NOT_AUTHENTICATED',
};

export function mapChoreError(error: { message: string }): ChoreError {
  return new ChoreError(SERVER_MESSAGES[error.message] ?? 'UNKNOWN', error.message);
}

interface ChoreRow {
  id: string;
  room_id: string;
  title: string;
  repeat_interval: string | null;
  repeat_days: number | null;
  scope: string;
  created_by: string;
  created_at: string;
}

interface OccurrenceRow {
  id: string;
  chore_id: string;
  room_id: string;
  assignee_id: string | null;
  due_at: string;
  status: string;
  suggestion_reason: string | null;
  suggestion_source: string | null;
  passed_by: string[];
}

const toChore = (r: ChoreRow): Chore => ({
  id: r.id,
  roomId: r.room_id,
  title: r.title,
  repeatInterval: (r.repeat_interval as RepeatInterval) ?? null,
  repeatDays: r.repeat_days,
  scope: r.scope as ChoreScope,
  createdBy: r.created_by,
  createdAt: r.created_at,
});

const toOccurrence = (r: OccurrenceRow): Occurrence => ({
  id: r.id,
  choreId: r.chore_id,
  roomId: r.room_id,
  assigneeId: r.assignee_id,
  dueAt: r.due_at,
  status: r.status as OccurrenceStatus,
  suggestionReason: r.suggestion_reason,
  suggestionSource: r.suggestion_source as Occurrence['suggestionSource'],
  passedBy: r.passed_by ?? [],
});

export async function createChore(
  client: SupabaseClient,
  params: {
    roomId: string;
    title: string;
    repeatInterval: RepeatInterval;
    repeatDays: number | null;
    scope: ChoreScope;
    assigneeId: string | null;
    dueAt: Date;
  },
): Promise<Chore> {
  const { data, error } = await client.rpc('create_chore', {
    p_room_id: params.roomId,
    p_title: params.title,
    p_repeat_interval: params.repeatInterval ?? null,
    p_repeat_days: params.repeatDays ?? null,
    p_scope: params.scope,
    p_assignee_id: params.assigneeId ?? null,
    p_due_at: params.dueAt.toISOString(),
  });
  if (error) throw mapChoreError(error);
  return toChore(data as ChoreRow);
}

export async function deleteChore(client: SupabaseClient, choreId: string): Promise<void> {
  const { error } = await client.rpc('delete_chore', { p_chore_id: choreId });
  if (error) throw mapChoreError(error);
}

async function listOccurrences(client: SupabaseClient, roomId: string): Promise<ChoreWithOccurrence[]> {
  const { data, error } = await client
    .from('occurrences')
    .select('*, chores!inner(*)')
    .eq('room_id', roomId)
    .order('due_at');
  if (error) throw mapChoreError(error);
  return (data as (OccurrenceRow & { chores: ChoreRow })[]).map((row) => ({
    chore: toChore(row.chores),
    occurrence: toOccurrence(row),
  }));
}

/** Live occurrence list for a room. Calls onChange with the full list on every change. Returns unsubscribe. */
export function subscribeOccurrences(
  client: SupabaseClient,
  roomId: string,
  onChange: (items: ChoreWithOccurrence[]) => void,
  onError: (error: ChoreError) => void = () => {},
): () => void {
  const refresh = () => {
    listOccurrences(client, roomId).then(onChange, (e: unknown) =>
      onError(e instanceof ChoreError ? e : new ChoreError('UNKNOWN', String(e))),
    );
  };
  const channel = client
    .channel(`chores:${roomId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'occurrences', filter: `room_id=eq.${roomId}` }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chores', filter: `room_id=eq.${roomId}` }, refresh)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') refresh();
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onError(new ChoreError('UNKNOWN', `realtime channel ${status}`));
      }
    });
  return () => {
    void client.removeChannel(channel);
  };
}
