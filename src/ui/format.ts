import type { RepeatInterval } from '../data/app';
import { avatarColors } from './theme';

export const initial = (name: string): string => name.trim().charAt(0).toUpperCase() || '?';

/** Avatar colour by join order, so each flatmate keeps a stable colour. */
export const avatarColor = (index: number): string => avatarColors[index % avatarColors.length]!;

/** Subtitle under a resident's name in the member list. `now` is injected so it is testable. */
export function joinedLabel(joinedAt: string, now: Date, isCreator: boolean): string {
  if (isCreator) return 'Created the room';
  const minutes = Math.floor((now.getTime() - new Date(joinedAt).getTime()) / 60_000);
  if (minutes < 2) return 'Joined just now';
  if (minutes < 60) return `Joined ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Joined ${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `Joined ${days} ${days === 1 ? 'day' : 'days'} ago`;
}

/** "Maya is already in" / "Maya, Alex are already in"; empty when nobody is listed. */
export function alreadyInLabel(names: string[]): string {
  if (names.length === 0) return '';
  return names.length === 1 ? `${names[0]} is already in` : `${names.join(', ')} are already in`;
}

/** Display label for a chore's repeat interval (D-021). */
export function repeatLabel(interval: RepeatInterval, days: number | null): string {
  if (!interval) return 'Once';
  if (interval === 'daily') return 'Daily';
  if (interval === 'weekly') return 'Weekly';
  if (interval === 'custom' && days === 30) return 'Monthly';
  if (interval === 'custom' && days != null) return `Every ${days} days`;
  return 'Repeating';
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

/** Human-readable due label for an occurrence. Never mutates `now`. */
export function dueLabel(dueAt: string, now: Date): string {
  const due = new Date(dueAt);
  const today = startOfDay(now);
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const dayAfter = new Date(tomorrow.getTime() + 86_400_000);
  const nextWeek = new Date(today.getTime() + 7 * 86_400_000);

  if (due < today) {
    const days = Math.ceil((today.getTime() - due.getTime()) / 86_400_000);
    return `${days} ${days === 1 ? 'day' : 'days'} late`;
  }
  if (due < tomorrow) return 'Due today';
  if (due < dayAfter) return 'Due tomorrow';
  if (due < nextWeek) return `Due ${due.toLocaleDateString('en-GB', { weekday: 'long' })}`;
  return `Due ${due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

/** Which section of the chore list an occurrence belongs to. */
export function occurrenceGroup(
  dueAt: string,
  status: string,
  now: Date,
): 'overdue' | 'today' | 'week' | 'later' | 'done' {
  if (status === 'done') return 'done';
  const due = new Date(dueAt);
  const today = startOfDay(now);
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const nextWeek = new Date(today.getTime() + 7 * 86_400_000);
  if (due < today) return 'overdue';
  if (due < tomorrow) return 'today';
  if (due < nextWeek) return 'week';
  return 'later';
}

/** Human-readable completion time, e.g. "today, 18:42" / "yesterday" / "2 Nov". */
export function completionTime(completedAt: string, now: Date): string {
  const d = new Date(completedAt);
  const today = startOfDay(now);
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d >= today) {
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    return `today, ${hh}:${mm}`;
  }
  if (d >= yesterday) return 'yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Next occurrence due date: shifts the previous due_at by the repeat interval (schedule-based, D-007). */
export function nextDueAt(dueAt: string, interval: RepeatInterval, repeatDays: number | null): Date {
  const due = new Date(dueAt);
  if (interval === 'daily') return new Date(due.getTime() + 86_400_000);
  if (interval === 'weekly') return new Date(due.getTime() + 7 * 86_400_000);
  if (interval === 'custom' && repeatDays) return new Date(due.getTime() + repeatDays * 86_400_000);
  return due;
}

/** Default due time: today at 18:00 local; tomorrow if already past 18:00 today (D-021). */
export function defaultDueAt(): Date {
  const d = new Date();
  d.setHours(18, 0, 0, 0);
  if (d <= new Date()) d.setDate(d.getDate() + 1);
  return d;
}
