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
  | 'OCCURRENCE_NOT_FOUND'
  | 'ALREADY_DONE'
  | 'ALREADY_PASSED'
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

export interface CompletionResult {
  residentId: string;
  displayName: string;
  completedAt: string;
}

/** Returned by pass_occurrence RPC. */
export interface PassResult {
  allPassed: boolean;
  passedBy: string[];
  oldAssigneeId: string | null;
}

/** Returned by the suggest-assignee Edge Function. */
export interface SuggestionResult {
  assigneeId: string;
  reason: string | null;
  source: 'ai' | 'fallback';
}

const SERVER_MESSAGES: Record<string, ChoreErrorCode> = {
  'chore title required': 'CHORE_TITLE_REQUIRED',
  'assignee required': 'ASSIGNEE_REQUIRED',
  'assignee not in room': 'ASSIGNEE_NOT_IN_ROOM',
  'room needs 2 members': 'ROOM_NEEDS_2_MEMBERS',
  'chore not found': 'CHORE_NOT_FOUND',
  'occurrence not found': 'OCCURRENCE_NOT_FOUND',
  'already done': 'ALREADY_DONE',
  'already passed': 'ALREADY_PASSED',
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
    suggestionReason?: string | null;
    suggestionSource?: 'ai' | 'fallback' | 'manual';
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
    p_suggestion_reason: params.suggestionReason ?? null,
    p_suggestion_source: params.suggestionSource ?? 'manual',
  });
  if (error) throw mapChoreError(error);
  return toChore(data as ChoreRow);
}

/** Call the suggest-assignee Edge Function. Returns null on any failure (caller shows no suggestion). */
export async function suggestAssignee(
  client: SupabaseClient,
  roomId: string,
  choreTitle: string,
  excludeIds: string[] = [],
  lastAssigneeId: string | null = null,
): Promise<SuggestionResult | null> {
  const { data, error } = await client.functions.invoke('suggest-assignee', {
    body: { room_id: roomId, chore_title: choreTitle, exclude_ids: excludeIds, last_assignee_id: lastAssigneeId },
  });
  if (error || !data?.assignee_id) return null;
  return {
    assigneeId: data.assignee_id as string,
    reason: (data.reason as string) || null,
    source: (data.source as 'ai' | 'fallback') ?? 'fallback',
  };
}

export async function completeOccurrence(client: SupabaseClient, occurrenceId: string): Promise<CompletionResult> {
  const { data, error } = await client.rpc('complete_occurrence', { p_occurrence_id: occurrenceId });
  if (error) throw mapChoreError(error);
  const r = data as { resident_id: string; display_name: string; completed_at: string };
  return { residentId: r.resident_id, displayName: r.display_name, completedAt: r.completed_at };
}

export async function passOccurrence(client: SupabaseClient, occurrenceId: string): Promise<PassResult> {
  const { data, error } = await client.rpc('pass_occurrence', { p_occurrence_id: occurrenceId });
  if (error) throw mapChoreError(error);
  const r = data as { all_passed: boolean; passed_by: string[]; old_assignee_id: string | null };
  return { allPassed: r.all_passed, passedBy: r.passed_by ?? [], oldAssigneeId: r.old_assignee_id };
}

export async function assignOccurrence(
  client: SupabaseClient,
  occurrenceId: string,
  assigneeId: string | null,
  suggestionReason: string | null,
  suggestionSource: 'ai' | 'fallback' | 'manual',
): Promise<void> {
  const { error } = await client.rpc('assign_occurrence', {
    p_occurrence_id: occurrenceId,
    p_assignee_id: assigneeId ?? null,
    p_suggestion_reason: suggestionReason ?? null,
    p_suggestion_source: suggestionSource,
  });
  if (error) throw mapChoreError(error);
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
