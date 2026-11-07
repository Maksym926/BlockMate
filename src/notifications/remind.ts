// Schedules / cancels local notifications for a set of occurrences.
// Wraps expo-notifications; the pure schedule logic lives in schedule.ts.
import * as Notifications from 'expo-notifications';
import type { ChoreWithOccurrence } from '../data/app';
import { REMINDER_CONFIG } from './config';
import { computeReminders } from './schedule';

/** Prefix used on all notification identifiers managed by this module. */
const ID_PREFIX = 'remind-';

/** Notification content for each trigger kind. */
function notificationBody(kind: 'advance' | 'due' | 'overdue', title: string): string {
  if (kind === 'advance') return `Due in about 1 hour.`;
  if (kind === 'due') return `Due right now.`;
  return `Still waiting on this one.`;
}

/**
 * Cancels all existing reminder notifications then schedules fresh ones.
 * Called by useReminders whenever the occurrence list changes.
 *
 * @param items  Current live occurrences for the room.
 * @param myResidentId  The signed-in user's resident ID.
 */
export async function scheduleReminders(
  items: ChoreWithOccurrence[],
  myResidentId: string,
): Promise<void> {
  // Request permission — no-op if already granted; silently skip on denial.
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  // Cancel all previously scheduled reminders from this module.
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    existing
      .filter((n) => n.identifier.startsWith(ID_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );

  const now = new Date();

  for (const { chore, occurrence } of items) {
    // Person-scope: only the assignee; room-scope: every device (D-008/D-009).
    const shouldRemind =
      occurrence.status === 'pending' &&
      (chore.scope === 'room' || occurrence.assigneeId === myResidentId);

    if (!shouldRemind) continue;

    const triggers = computeReminders(occurrence.dueAt, occurrence.status, now, REMINDER_CONFIG);

    for (let i = 0; i < triggers.length; i++) {
      const { date, kind } = triggers[i]!;
      if (date <= now) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: `${ID_PREFIX}${occurrence.id}-${i}`,
        content: {
          title: chore.title,
          body: notificationBody(kind, chore.title),
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
        },
      });
    }
  }
}
