import { Injectable, effect, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '@core/auth/auth.store';
import { ToastService } from '@core/services/toast.service';
import { UserInfoService } from '@core/services/user-info.service';
import { NOTIFICATION_REPORTER } from '@core/tokens/notification-reporter.token';
import { ROOM_INVITE_GATEWAY } from '@core/tokens/room-invite-gateway.token';
import { EnrichBatchQueue } from '@shared/utils';
import { ImSocketService } from './im-socket.service';
import type { ImEvent } from './im-events';

@Injectable({ providedIn: 'root' })
export class ImBootstrapService {
  private readonly auth = inject(AuthStore);
  private readonly imSocket = inject(ImSocketService);
  private readonly gateway = inject(ROOM_INVITE_GATEWAY);
  private readonly toast = inject(ToastService);
  private readonly notifications = inject(NOTIFICATION_REPORTER);
  private readonly userInfo = inject(UserInfoService);
  /** Prefetches profiles for notification events (profile_visit/follow/gift/introduction) so
   *  UserInfoModal is warm by the time the user clicks — batched instead of one call per event,
   *  since a burst of queued notifications can flush at once (e.g. app foregrounded). */
  private readonly enrichQueue = new EnrichBatchQueue((uids) =>
    this.userInfo.enrichBatchAndCache(uids).then(() => undefined),
  );

  /** Read cursor into imSocket.events() — see that signal's doc for why this drains an
   *  append-only log instead of reading a single "lastEvent" value (which could silently
   *  skip an event coalesced away by the effect scheduler). */
  private processedEventCount = 0;

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.imSocket.connect();
      } else {
        this.imSocket.disconnect();
      }
    });

    effect(() => {
      const events = this.imSocket.events();
      if (events.length < this.processedEventCount) {
        // Log was reset (disconnect/reconnect) — start over from the beginning.
        this.processedEventCount = 0;
      }
      for (const event of events.slice(this.processedEventCount)) {
        this.handle(event);
      }
      this.processedEventCount = events.length;
    });
  }

  /** stage_invite/mod_invite/mod_accepted/mod_removed/mod_unmuted are pushed by
   *  HelloTalk on the LiveHub (room) socket too, but this IM socket is the source
   *  of truth for them — handle-realtime-event.util.ts (BFF path) no longer
   *  handles these five at all. */
  private handle(event: ImEvent): void {
    switch (event.type) {
      case 'profile_visit': {
        // BFF enriches nickname/headUrl at the wire level; "Someone" remains a defensive fallback
        // for the rare case the BFF enrichment lookup failed and the raw event still slipped through.
        const displayName = event.nickname?.trim() || 'Someone';
        this.notifyUserLinked({
          type: 'info',
          title: 'Profile visit',
          message: `${displayName} visited your profile`,
          uid: event.visitorUserId,
          nickname: event.nickname ?? null,
          avatarUrl: event.headUrl ?? null,
        });
        break;
      }
      case 'stage_invite': {
        const cname = event.cname;
        this.toast.action('The host invited you to join the stage', [
          {
            label: 'Accept',
            variant: 'primary',
            run: () => {
              void firstValueFrom(this.gateway.approveStageInvite(cname, true)).then(() =>
                this.toast.success('You joined the stage'),
              );
            },
          },
          {
            label: 'Decline',
            run: () => {
              void firstValueFrom(this.gateway.approveStageInvite(cname, false)).then(() =>
                this.toast.info('Invite declined'),
              );
            },
          },
        ]);
        break;
      }
      case 'mod_invite': {
        const cname = event.cname;
        const selfId = this.auth.user()?.userId;
        if (selfId === undefined) break;
        this.toast.action('You have been invited to become a moderator', [
          {
            label: 'Accept',
            variant: 'primary',
            run: () => {
              void firstValueFrom(this.gateway.approveModInvite(cname, selfId)).then(() =>
                this.toast.success('You are now a moderator'),
              );
            },
          },
          { label: 'Decline', run: () => {} },
        ]);
        break;
      }
      case 'mod_accepted':
        this.toast.success('You are now a moderator');
        break;
      case 'mod_removed':
        this.toast.warning('You are no longer a moderator');
        break;
      case 'mod_unmuted':
        this.toast.success('You can speak now');
        break;
      case 'follow': {
        const message = event.status === 2
          ? `${event.nickname} followed you back`
          : `${event.nickname} followed you`;
        this.notifyUserLinked({
          type: 'info',
          title: 'New follower',
          message,
          uid: event.userId,
          nickname: event.nickname,
          avatarUrl: event.headUrl ?? null,
        });
        break;
      }
      case 'voice_room_shared':
        this.notifications.notify('info', 'Voice room shared', `${event.fromNickname} sent you a voice room`);
        break;
      case 'live_room_shared':
        this.notifications.notify('info', 'Live room shared', `${event.fromNickname} sent you a live room`);
        break;
      case 'text_message':
        this.notifyUserLinked({
          type: 'info',
          title: 'New message',
          message: event.text,
          uid: event.fromUserId,
          nickname: event.fromNickname || 'Someone',
          avatarUrl: event.fromHeadUrl ?? null,
          action: { type: 'navigate_to_conversation', userId: Number(event.fromUserId) },
        });
        break;
      case 'image_message':
        this.notifyUserLinked({
          type: 'info',
          title: 'New message',
          message: 'Sent you a photo',
          uid: event.fromUserId,
          nickname: event.fromNickname || 'Someone',
          avatarUrl: event.fromHeadUrl ?? null,
          action: { type: 'navigate_to_conversation', userId: Number(event.fromUserId) },
        });
        break;
      case 'gift_message':
        this.notifyUserLinked({
          type: 'info',
          title: 'Gift received',
          message: `${event.fromNickname} sent you a gift`,
          uid: event.fromUserId,
          nickname: event.fromNickname,
          avatarUrl: event.fromHeadUrl ?? null,
        });
        break;
      case 'introduction_message':
        this.notifyUserLinked({
          type: 'info',
          title: 'Introduction',
          message: `${event.fromNickname} sent you an introduction`,
          uid: event.fromUserId,
          nickname: event.fromNickname,
          avatarUrl: event.fromHeadUrl ?? null,
        });
        break;
      case 'group_message':
        this.notifications.notify('info', `${event.roomName}`, `${event.senderName}: ${event.text}`);
        break;
      case 'typing_indicator':
      case 'read_receipt':
        break;
      case 'account_status':
        if (event.status === 'banned') {
          this.toast.error('Your HelloTalk account has been banned.');
        } else {
          this.toast.warning('Logged in elsewhere — this session was disconnected.');
        }
        break;
      case 'error':
        break;
      case 'connection-state':
        break;
    }
  }

  /** Emits a user-linked notification when `uid` parses as a positive integer, otherwise falls
   *  back to a plain notification (so the user still sees the event happened even without a
   *  resolvable identity). Shared by profile_visit, follow, gift_message, and introduction_message
   *  to deduplicate the parse/queue/fallback dance that was duplicated in each switch case.
   *  Pre-warms the UserInfoService cache via the batched enrich queue so the click-through
   *  UserInfoModal is populated by the time the user opens the notification — the queue already
   *  coalesces a burst of realtime events into one /users/enrich-batch POST. */
  private notifyUserLinked(params: {
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    uid: string;
    nickname: string | null;
    avatarUrl: string | null;
    action?: { type: 'navigate_to_conversation'; userId: number } | { type: 'open_user_profile'; userId: number };
  }): void {
    const uid = Number(params.uid);
    if (Number.isFinite(uid) && uid > 0) {
      this.enrichQueue.queue(uid);
      this.notifications.notifyUserEvent({
        type: params.type,
        title: params.title,
        message: params.message,
        userId: uid,
        avatarUrl: params.avatarUrl,
        nickname: params.nickname,
        action: params.action,
      });
    } else {
      this.notifications.notify(params.type, params.title, params.message);
    }
  }
}
