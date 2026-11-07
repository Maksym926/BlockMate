// Pure schedule computation — no side effects, fully testable with injected `now`.
import { REMINDER_CONFIG } from './config';

export type ReminderKind = 'advance' | 'due' | 'overdue';

export interface ReminderTrigger {
  date: Date;
  kind: ReminderKind;
}

type Config = typeof REMINDER_CONFIG;

/**
 * Returns the list of local notification trigger times for one occurrence.
 * Accepts `now` as an argument so tests can inject any clock without sleeping.
 *
 * Rules (D-020):
 *  - done/passed → no reminders
 *  - pending, not yet due, > ADVANCE_THRESHOLD away → [advance, due]
 *  - pending, not yet due, ≤ ADVANCE_THRESHOLD away → [due]
 *  - pending, overdue → next OVERDUE_SLOTS 2-hour slots within 08:00–22:00 local time
 */
export function computeReminders(
  dueAt: string,
  status: string,
  now: Date,
  config: Config = REMINDER_CONFIG,
): ReminderTrigger[] {
  if (status !== 'pending') return [];

  const due = new Date(dueAt);

  if (due > now) {
    const triggers: ReminderTrigger[] = [];
    const advance = new Date(due.getTime() - config.ADVANCE_THRESHOLD_MS);
    if (advance > now) triggers.push({ date: advance, kind: 'advance' });
    triggers.push({ date: due, kind: 'due' });
    return triggers;
  }

  // Overdue: collect next N 2-hour slots within [START, END] local
  return computeOverdueSlots(now, config).map((date) => ({ date, kind: 'overdue' }));
}

function computeOverdueSlots(now: Date, config: Config): Date[] {
  const slots: Date[] = [];
  // Walk day by day, collecting even-hour marks within the window
  const cursor = new Date(now);
  cursor.setMinutes(0, 0, 0);

  while (slots.length < config.OVERDUE_SLOTS) {
    for (
      let h = config.OVERDUE_WINDOW_START_HOUR;
      h <= config.OVERDUE_WINDOW_END_HOUR;
      h += 2
    ) {
      const slot = new Date(cursor);
      slot.setHours(h, 0, 0, 0);
      if (slot > now) {
        slots.push(slot);
        if (slots.length >= config.OVERDUE_SLOTS) break;
      }
    }
    // Advance to next day
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }

  return slots;
}
