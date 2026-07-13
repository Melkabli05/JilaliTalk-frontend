import type { ReplyTarget } from './comment-input';
import type { Comment } from '../models/room-model';

export function resolveReplyTo(comment: Comment | null): ReplyTarget | null {
  return comment
    ? {
        msgId: comment._id,
        fromId: comment.userId,
        nickname: comment.nickname,
        text: comment.msg.text.text,
      }
    : null;
}

export function formatTypingText(names: readonly string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return `${names[0]} is writing...`;
  if (names.length === 2) return `${names[0]} & ${names[1]} are writing...`;
  return 'Several people are writing...';
}
