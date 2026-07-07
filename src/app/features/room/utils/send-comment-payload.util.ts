import type { SendCommentPayload } from '../models/room-model';
import type { SendEvent } from '../comments/comment-input';

interface CommentAuthorContext {
  readonly cname: string | null;
  readonly busiType: number;
  readonly nickname: string | null;
  readonly headUrl: string | null;
  readonly nationality: string | null;
  readonly role: number;
}

/** Builds the API payload for sendComment from the caller's identity context
 *  + the input event. Lifted out of the two room pages, which had identical copies. */
export function buildSendCommentPayload(
  ctx: CommentAuthorContext,
  event: SendEvent,
  clientNonce?: string,
): SendCommentPayload {
  return {
    cname: ctx.cname ?? '',
    busiType: ctx.busiType,
    nickname: ctx.nickname || 'Anonymous',
    headUrl: ctx.headUrl || null,
    nationality: ctx.nationality || null,
    role: ctx.role,
    text: event.text,
    ...(clientNonce ? { clientNonce } : {}),
    replyInfo: event.replyInfo
      ? {
          msgId: event.replyInfo.msgId,
          fromId: event.replyInfo.fromId,
          fromNickname: event.replyInfo.nickname,
          text: event.replyInfo.text,
          msgType: 'text',
        }
      : null,
  };
}