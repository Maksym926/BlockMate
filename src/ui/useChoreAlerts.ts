/**
 * Detects two alert conditions (D-016, D-019):
 *  1. Completion: another resident finishes a chore (Realtime-driven via items diff).
 *  2. Overdue: a pending chore's dueAt passes (60-second poll).
 *
 * Calls onAlert(message) for in-app toasts.
 * When the app is backgrounded, also schedules an immediate local notification.
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { ChoreWithOccurrence, Resident } from '../data/app';

interface PrevState {
  status: string;
  assigneeId: string | null;
  choreTitle: string;
}

export function useChoreAlerts(
  items: ChoreWithOccurrence[],
  residents: Resident[],
  myResidentId: string | undefined,
  onAlert: (message: string) => void,
): void {
  const prevMap = useRef<Map<string, PrevState>>(new Map());
  const overdueAlerted = useRef<Set<string>>(new Set());

  // ── Completion detection (Realtime-driven) ───────────────────────────────
  useEffect(() => {
    const prev = prevMap.current;

    for (const { chore, occurrence } of items) {
      const p = prev.get(occurrence.id);
      if (p && p.status === 'pending' && occurrence.status === 'done') {
        // Transition: pending → done
        const completedByMe = p.assigneeId === myResidentId;
        if (!completedByMe) {
          let completerName = 'A flatmate';
          if (p.assigneeId) {
            const r = residents.find((res) => res.id === p.assigneeId);
            if (r) completerName = r.displayName;
          }
          const message = `${completerName} completed ${chore.title}`;
          onAlert(message);
          if (AppState.currentState !== 'active') {
            void sendImmediate(chore.title, `${completerName} just completed this.`);
          }
        }
      }
    }

    // Rebuild snapshot
    prevMap.current = new Map(
      items.map(({ chore, occurrence }) => [
        occurrence.id,
        { status: occurrence.status, assigneeId: occurrence.assigneeId, choreTitle: chore.title },
      ]),
    );
  }, [items, myResidentId, residents, onAlert]);

  // ── Overdue detection (60-second interval) ───────────────────────────────
  useEffect(() => {
    const checkOverdue = () => {
      const now = new Date();

      for (const { chore, occurrence } of items) {
        if (
          occurrence.status === 'pending' &&
          new Date(occurrence.dueAt) < now &&
          !overdueAlerted.current.has(occurrence.id)
        ) {
          overdueAlerted.current.add(occurrence.id);
          const message = `${chore.title} is overdue`;
          onAlert(message);
          if (AppState.currentState !== 'active') {
            void sendImmediate(chore.title, 'This chore is overdue.');
          }
        }
      }

      // Drop IDs for occurrences that are no longer pending (completed / deleted)
      const pendingIds = new Set(
        items.filter((i) => i.occurrence.status === 'pending').map((i) => i.occurrence.id),
      );
      for (const id of overdueAlerted.current) {
        if (!pendingIds.has(id)) overdueAlerted.current.delete(id);
      }
    };

    checkOverdue();
    const timer = setInterval(checkOverdue, 60_000);
    return () => clearInterval(timer);
  }, [items, onAlert]);
}

/** Schedules an immediate local notification (fire-and-forget, silent on error). */
async function sendImmediate(title: string, body: string): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    await Notifications.scheduleNotificationAsync({
      identifier: `alert-${Date.now()}`,
      content: { title, body, sound: true },
      trigger: null,
    });
  } catch {}
}
