import { describe, expect, it } from 'vitest';
import { alreadyInLabel, avatarColor, initial, joinedLabel } from './format';

describe('initial', () => {
  it('is the first letter, upper-cased', () => {
    expect(initial('maya')).toBe('M');
    expect(initial('  alex ')).toBe('A');
  });
  it('is a question mark for an empty name rather than crashing', () => {
    expect(initial('')).toBe('?');
  });
});

describe('avatarColor', () => {
  it('cycles through the five flatmate colours by join order', () => {
    const colors = [0, 1, 2, 3, 4, 5].map(avatarColor);
    expect(new Set(colors.slice(0, 5)).size).toBe(5);
    expect(colors[5]).toBe(colors[0]);
  });
});

describe('joinedLabel', () => {
  const now = new Date('2026-11-07T14:00:00Z');
  it('says the creator created the room', () => {
    expect(joinedLabel('2026-11-07T13:00:00Z', now, true)).toBe('Created the room');
  });
  it('says just now for a recent join', () => {
    expect(joinedLabel('2026-11-07T13:59:10Z', now, false)).toBe('Joined just now');
  });
  it('says minutes ago, then days ago for older joins', () => {
    expect(joinedLabel('2026-11-07T13:50:00Z', now, false)).toBe('Joined 10 min ago');
    expect(joinedLabel('2026-11-05T09:00:00Z', now, false)).toBe('Joined 2 days ago');
  });
});

describe('alreadyInLabel', () => {
  it('names one or several residents, and never says "undefined"', () => {
    expect(alreadyInLabel(['Maya'])).toBe('Maya is already in');
    expect(alreadyInLabel(['Maya', 'Alex'])).toBe('Maya, Alex are already in');
    expect(alreadyInLabel([])).toBe('');
  });
});
