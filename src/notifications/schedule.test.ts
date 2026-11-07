// Tests for computeReminders — no I/O, no sleeping, fully deterministic.
// Dates are created with new Date(y, m, d, h) which uses LOCAL time, matching
// the local-time window logic inside computeReminders.
import { describe, expect, it } from 'vitest';
import { REMINDER_CONFIG } from './config';
import { computeReminders } from './schedule';

const cfg = REMINDER_CONFIG;

// Fixed local reference: 7 Nov 2026, 16:00
const ref = new Date(2026, 10, 7, 16, 0, 0); // Nov is month 10

describe('computeReminders', () => {
  it('returns nothing for a done occurrence', () => {
    const due = new Date(2026, 10, 7, 18, 0, 0).toISOString();
    expect(computeReminders(due, 'done', ref, cfg)).toHaveLength(0);
  });

  it('returns nothing for a passed occurrence', () => {
    const due = new Date(2026, 10, 7, 18, 0, 0).toISOString();
    expect(computeReminders(due, 'passed', ref, cfg)).toHaveLength(0);
  });

  it('returns advance + due when due is more than 1 h away', () => {
    const due = new Date(2026, 10, 7, 18, 0, 0); // 18:00 local
    const result = computeReminders(due.toISOString(), 'pending', ref, cfg);
    // now = 16:00, due = 18:00 → advance at 17:00, due at 18:00
    expect(result).toHaveLength(2);
    expect(result[0]!.kind).toBe('advance');
    expect(result[0]!.date.getHours()).toBe(17);
    expect(result[1]!.kind).toBe('due');
    expect(result[1]!.date.getHours()).toBe(18);
  });

  it('returns only due when due is less than 1 h away', () => {
    const now = new Date(2026, 10, 7, 17, 30, 0); // 17:30
    const due = new Date(2026, 10, 7, 18, 0, 0).toISOString();
    const result = computeReminders(due, 'pending', now, cfg);
    expect(result).toHaveLength(1);
    expect(result[0]!.kind).toBe('due');
  });

  it('returns exactly 1 trigger when due is exactly 1 h away (boundary is exclusive)', () => {
    // advance threshold is 1 h; at exactly 1 h it is NOT > ADVANCE_THRESHOLD, so no advance
    const now = new Date(2026, 10, 7, 17, 0, 0); // exactly 1 h before due
    const due = new Date(2026, 10, 7, 18, 0, 0).toISOString();
    const result = computeReminders(due, 'pending', now, cfg);
    expect(result).toHaveLength(1);
    expect(result[0]!.kind).toBe('due');
  });

  it('returns overdue slots for a past due occurrence', () => {
    const now = new Date(2026, 10, 7, 19, 30, 0); // 19:30, due was 18:00
    const due = new Date(2026, 10, 7, 18, 0, 0).toISOString();
    const result = computeReminders(due, 'pending', now, cfg);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((r) => r.kind === 'overdue')).toBe(true);
    // First slot should be 20:00 (next even hour after 19:30 within window)
    expect(result[0]!.date.getHours()).toBe(20);
  });

  it('wraps to next day 08:00 when overdue after 22:00', () => {
    const now = new Date(2026, 10, 7, 22, 30, 0); // 22:30
    const due = new Date(2026, 10, 7, 18, 0, 0).toISOString();
    const result = computeReminders(due, 'pending', now, cfg);
    expect(result[0]!.date.getDate()).toBe(8); // next day
    expect(result[0]!.date.getHours()).toBe(8);
  });

  it('returns OVERDUE_SLOTS triggers for a long-overdue occurrence', () => {
    const now = new Date(2026, 10, 7, 8, 0, 0); // 08:00, due yesterday
    const due = new Date(2026, 10, 6, 18, 0, 0).toISOString();
    const result = computeReminders(due, 'pending', now, cfg);
    expect(result).toHaveLength(cfg.OVERDUE_SLOTS);
    expect(result.every((r) => r.kind === 'overdue')).toBe(true);
  });
});
