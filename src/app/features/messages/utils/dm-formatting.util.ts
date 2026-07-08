import type { DmConversation, DmMessage } from '../models/dm.model';

const GROUP_GAP_MS = 5 * 60 * 1000;

export function isGroupStart(messages: readonly DmMessage[], i: number): boolean {
  const cur = messages[i];
  const prev = messages[i - 1];
  if (!prev || !cur) return true;
  return cur.ts - prev.ts > GROUP_GAP_MS;
}

export function isGroupEnd(messages: readonly DmMessage[], i: number): boolean {
  const cur = messages[i];
  const next = messages[i + 1];
  if (!next || !cur) return true;
  return next.ts - cur.ts > GROUP_GAP_MS;
}

export function dateLabel(messages: readonly DmMessage[], i: number): string | null {
  const msg = messages[i];
  if (!msg) return null;
  const prev = messages[i - 1];
  const d = new Date(msg.ts);
  if (prev && new Date(prev.ts).toDateString() === d.toDateString()) return null;
  return dayLabel(d);
}

function dayLabel(d: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function preview(conv: DmConversation): string {
  const last = conv.messages.at(-1);
  if (!last) return '';
  switch (last.type) {
    case 'text':
      return last.text ?? '';
    case 'image':
      return 'Photo';
    case 'gift':
      return `Gift ×${last.count ?? 1}`;
    case 'introduction':
      return 'Introduction';
    case 'voice_room_shared':
      return last.voiceCount != null
        ? `Voice room · ${last.voiceCount} listening`
        : 'Voice room shared';
    case 'live_room_shared':
      return 'Live link shared';
    default:
      return '';
  }
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
