import { useEffect } from 'react';
import type { ChoreWithOccurrence, Resident } from '../data/app';
import { scheduleReminders } from '../notifications/remind';

/**
 * Reschedules local reminders whenever the occurrence list changes (D-008).
 * Reminders are cancelled and rebuilt on every update so completions and passes
 * are reflected immediately.
 */
export function useReminders(items: ChoreWithOccurrence[], residents: Resident[]): void {
  const myResident = residents.find((r) => r.isYou);
  const myResidentId = myResident?.id;

  useEffect(() => {
    if (!myResidentId) return;
    void scheduleReminders(items, myResidentId);
  }, [items, myResidentId]);
}
