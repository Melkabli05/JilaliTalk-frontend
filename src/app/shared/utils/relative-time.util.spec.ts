import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { relativeTime } from './relative-time.util';

describe('relativeTime', () => {
  const NOW = new Date('2026-07-04T12:00:00.000Z').getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "now" for under a minute ago', () => {
    expect(relativeTime(NOW - 30_000)).toBe('now');
  });

  it('returns minutes for under an hour ago', () => {
    expect(relativeTime(NOW - 5 * 60_000)).toBe('5m');
  });

  it('returns hours for under a day ago', () => {
    expect(relativeTime(NOW - 3 * 60 * 60_000)).toBe('3h');
  });

  it('returns "Yesterday" for 24-48 hours ago', () => {
    expect(relativeTime(NOW - 30 * 60 * 60_000)).toBe('Yesterday');
  });

  it('returns month/day for older-than-48h same-year timestamps', () => {
    const ts = new Date('2026-06-12T12:00:00.000Z').getTime();
    expect(relativeTime(ts)).toBe('Jun 12');
  });

  it('returns month/day/2-digit-year for timestamps from a previous year', () => {
    const ts = new Date('2024-06-12T12:00:00.000Z').getTime();
    expect(relativeTime(ts)).toBe('Jun 12, 24');
  });
});
