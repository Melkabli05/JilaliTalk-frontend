import type { DmConversation } from '../models/dm.model';

export function preview(conv: DmConversation): string {
  const last = conv.messages.at(-1);
  if (!last) return '';
  switch (last.type) {
    case 'text':          return last.text ?? '';
    case 'image':         return 'Photo';
    case 'gift':          return `Gift ×${last.count ?? 1}`;
    case 'introduction':  return 'Introduction';
    case 'voice_room_shared':
      return last.voiceCount != null ? `Voice room · ${last.voiceCount} listening` : 'Voice room shared';
    case 'live_room_shared': return 'Live link shared';
    default:                   return '';
  }
}

export function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatDay(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}
