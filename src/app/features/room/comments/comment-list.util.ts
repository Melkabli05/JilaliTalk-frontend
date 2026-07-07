import { UserRole } from '@core/models/user-role';
import { Comment, CommentOrEvent, EventCard } from '../models/room-model';
import { formatClockTime } from '@shared/utils';

export interface CommentGroup {
  key: string;
  userId: number;
  nickname: string;
  headUrl: string | null;
  nationality: string | null;
  role: UserRole;
  vipType: number;
  fgLevel: number;
  fgName: string | null;
  fgIsActive: boolean;
  createdAtMs: number;
  messages: readonly Comment[];
}

const GROUP_WINDOW_MS = 60_000;
const NAME_COLOR_COUNT = 6;

export function nameColorIndex(userId: number): number {
  return userId % NAME_COLOR_COUNT;
}

export const formatTime = formatClockTime;

function formatDateLabel(timestamp: number): string {
  const now = new Date();
  const msg = new Date(timestamp);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(msg.getFullYear(), msg.getMonth(), msg.getDate());
  const diff = Math.floor((today.getTime() - msgDay.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return msg.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

export type ReplyInfo = NonNullable<Comment['msg']['replyInfo']>;

export function findReplyTarget(
  comments: readonly Comment[],
  comment: Comment,
  ri: ReplyInfo,
): Comment | null {
  if (ri.msgId) {
    return comments.find((c) => c._id === ri.msgId) ?? null;
  }
  let best: Comment | null = null;
  for (const c of comments) {
    if (c._id === comment._id) break;
    if (c.userId === ri.fromId && c.msg.text.text === ri.text) best = c;
  }
  return best;
}

function buildGroups(comments: readonly Comment[]): (CommentGroup & { dateLabel?: string })[] {
  const out: (CommentGroup & { dateLabel?: string })[] = [];
  let lastDate: string | null = null;

  for (const c of comments) {
    const dateLabel = formatDateLabel(c.createdAtMs);
    const last = out[out.length - 1];
    const sameGroup =
      last &&
      last.userId === c.userId &&
      c.createdAtMs - last.createdAtMs <= GROUP_WINDOW_MS &&
      dateLabel === lastDate;

    if (!sameGroup) {
      const entry: CommentGroup & { dateLabel?: string } = {
        key: c._id,
        userId: c.userId,
        nickname: c.nickname,
        headUrl: c.headUrl,
        nationality: c.nationality,
        role: c.role,
        vipType: c.vipType,
        fgLevel: c.fgLevel,
        fgName: c.fgName,
        fgIsActive: c.fgIsActive,
        createdAtMs: c.createdAtMs,
        messages: [c],
      };
      if (dateLabel !== lastDate) {
        entry.dateLabel = dateLabel;
        lastDate = dateLabel;
      }
      out.push(entry);
    } else {
      (last!.messages as Comment[]).push(c);
    }
  }
  return out;
}

export type CommentRow = {
  readonly type: 'comments';
  readonly group: CommentGroup & { dateLabel?: string };
  readonly ts: number;
};
export type EventRow = { readonly type: 'event'; readonly card: EventCard; readonly ts: number };
export type Row = CommentRow | EventRow;

export function rowKey(row: Row): string {
  if (row.type === 'comments') return row.group.key;
  return row.card.kind === 'gift' ? `${row.card.id}-${row.card.giftCount}` : row.card.id;
}

export function buildRows(items: readonly CommentOrEvent[]): readonly Row[] {
  const comments = items.filter((i): i is Comment => !('kind' in i));
  const events = items.filter((i): i is EventCard => 'kind' in i);

  const commentRows: readonly CommentRow[] = buildGroups(comments).map((group) => ({
    type: 'comments' as const,
    group,
    ts: group.createdAtMs,
  }));
  const eventRows: readonly EventRow[] = events.map((card) => ({
    type: 'event' as const,
    card,
    ts: card.ts,
  }));

  return [...commentRows, ...eventRows].sort((a, b) => a.ts - b.ts);
}
