import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RoomApi } from '../api/room-api';
import { RoomStore } from '../store/room-store';
import { CommentsStore } from '../comments/comments-store';
import { ToastService } from '@core/services/toast.service';
import { SendEvent } from '../comments/comment-input';
import { UserRole } from '@core/models/user-role';
import { buildSendCommentPayload } from '../utils/send-comment-payload.util';
import { httpErrorMessage } from '@shared/utils/http-error-message.util';

function makeClientNonce(userId: number): string {
  return (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `local-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Voice rooms optimistically insert the comment locally (tagged with a clientNonce so
 * CommentsStore can dedup the server echo — see PR1's comment-dedup fix) before sending;
 * video rooms don't (see sendVideoComment). This is a real, intentional difference between
 * the two room types, not an oversight — kept as two functions rather than one merged
 * "SendCommentCommand" so neither behavior silently changes.
 *
 * POST /comments can genuinely fail (upstream has been observed rejecting a send with
 * `code: 100002` from a non-stage account), so a failure here rolls the optimistic insert
 * back out and surfaces a toast — matching the pattern already used by every other
 * optimistic room command (raiseOrLowerHand, leaveStage) rather than leaving a message
 * sitting in the sender's own list that nobody else ever received.
 */
export function sendVoiceComment(
  event: SendEvent,
  cname: string,
  roomStore: RoomStore,
  commentsStore: CommentsStore,
  api: RoomApi,
  toast: ToastService,
  destroyRef: DestroyRef,
): void {
  const nickname = roomStore.nickname() || 'Anonymous';
  const headUrl = roomStore.headUrl() || null;
  const nationality = roomStore.nationality() || null;
  const role = roomStore.myRole();

  const clientNonce = makeClientNonce(roomStore.userId());
  const localId = `local-${roomStore.userId()}-${Date.now()}`;

  const payload = buildSendCommentPayload(
    {
      cname,
      busiType: roomStore.busiType(),
      nickname: roomStore.nickname(),
      headUrl: roomStore.headUrl(),
      nationality: roomStore.nationality(),
      role: roomStore.myRole(),
    },
    event,
    clientNonce,
  );

  commentsStore.addComment({
    _id: localId,
    clientNonce,
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
    userId: roomStore.userId(),
    nickname,
    headUrl,
    nationality,
    role: role as UserRole,
    vipType: 0,
    msg: {
      text: { text: event.text },
      replyInfo: event.replyInfo
        ? { msgId: event.replyInfo.msgId, fromId: event.replyInfo.fromId, fromNickname: event.replyInfo.nickname, text: event.replyInfo.text, msgType: 'text' }
        : null,
    },
    dayRankLevel: 0,
    giftLevel: 0,
    fgLevel: 0,
    fgName: '',
    fgIsActive: false,
    bubbleId: 0,
    bubbleUrl: null,
    bubbleColor: '',
    hitBad: 0,
    bubbleAnimalType: 0,
    bubbleAnimalUrl: null,
  });

  api.sendComment(payload)
    .pipe(takeUntilDestroyed(destroyRef))
    .subscribe({
      next: (res) => commentsStore.confirmCommentSent(localId, res.createdAtMs),
      error: (err: unknown) => {
        console.warn('[RoomPage] sendComment failed', err);
        commentsStore.removeComment(localId);
        toast.error(httpErrorMessage(err, 'Failed to send message'));
      },
    });
}

export function sendVideoComment(
  event: SendEvent,
  cname: string,
  roomStore: RoomStore,
  api: RoomApi,
  toast: ToastService,
  destroyRef: DestroyRef,
): void {
  const payload = buildSendCommentPayload(
    {
      cname,
      busiType: roomStore.busiType(),
      nickname: roomStore.nickname(),
      headUrl: roomStore.headUrl(),
      nationality: roomStore.nationality(),
      role: roomStore.myRole(),
    },
    event,
  );

  api.sendComment(payload)
    .pipe(takeUntilDestroyed(destroyRef))
    .subscribe({
      error: (err: unknown) => {
        console.warn('[video-room] sendComment failed', err);
        toast.error(httpErrorMessage(err, 'Failed to send message'));
      },
    });
}
