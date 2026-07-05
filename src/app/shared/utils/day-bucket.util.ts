export type DayBucket = 'today' | 'yesterday' | 'this-week' | 'earlier';

export const DAY_BUCKET_LABELS: Record<DayBucket, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  'this-week': 'This week',
  earlier: 'Earlier',
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Buckets a timestamp into a day-group relative to `now`, using local calendar days
 *  (not rolling 24h windows) so "Yesterday" means the previous calendar day, not
 *  "24-48 hours ago". */
export function bucketForTimestamp(ts: number, now: number): DayBucket {
  const daysAgo = Math.round((startOfDay(now) - startOfDay(ts)) / DAY_MS);
  if (daysAgo <= 0) return 'today';
  if (daysAgo === 1) return 'yesterday';
  if (daysAgo <= 7) return 'this-week';
  return 'earlier';
}
