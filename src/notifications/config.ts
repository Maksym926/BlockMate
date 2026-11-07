/** Reminder timing constants (D-020). Change here to tune all reminder behaviour. */
export const REMINDER_CONFIG = {
  /** Schedule an extra "1 hour before" reminder if due is at least this many ms away. */
  ADVANCE_THRESHOLD_MS: 60 * 60 * 1000, // 1 hour

  /** Interval between overdue reminders. */
  OVERDUE_INTERVAL_MS: 2 * 60 * 60 * 1000, // 2 hours

  /** Earliest local hour at which overdue reminders fire. */
  OVERDUE_WINDOW_START_HOUR: 8,

  /** Latest local hour at which overdue reminders fire (inclusive). */
  OVERDUE_WINDOW_END_HOUR: 22,

  /** How many future overdue slots to schedule at once. */
  OVERDUE_SLOTS: 8,
} as const;
