import type { ChatMessage } from '../models/chat-message.model';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function dayLabel(messages: readonly ChatMessage[], index: number, now: number = Date.now()): string {
  const msg = messages[index];
  if (!msg) return '';
  const ts = msg.ts;
  const start = startOfDay(ts);
  if (index > 0) {
    const prev = messages[index - 1];
    if (prev) {
      const prevStart = startOfDay(prev.ts);
      if (prevStart === start) return '';
    }
  }
  const todayStart = startOfDay(now);
  const diff = Math.floor((todayStart - start) / ONE_DAY_MS);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return formatDay(start);
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatDay(dayStart: number): string {
  const d = new Date(dayStart);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}