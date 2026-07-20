import { Injectable, effect, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '@core/auth/auth.store';
import { ToastService } from '@core/services/toast.service';
import { UserInfoService } from '@core/services/user-info.service';
import { NOTIFICATION_REPORTER } from '@core/tokens/notification-reporter.token';
import { ROOM_INVITE_GATEWAY } from '@core/tokens/room-invite-gateway.token';
import { EnrichBatchQueue } from '@shared/utils';
import { HtImConnectionService } from './ht-im-connection.service';
import type { ImConnectionController, ImEventSource } from './im-connection-roles';
import type { ImEvent } from './im-events';

@Injectable({ providedIn: 'root' })
export class ImBootstrapService {
  private readonly auth = inject(AuthStore);
  private readonly imSocket: ImConnectionController & ImEventSource = inject(HtImConnectionService);
  private readonly gateway = inject(ROOM_INVITE_GATEWAY);
  private readonly toast = inject(ToastService);
  private readonly notifications = inject(NOTIFICATION_REPORTER);
  private readonly userInfo = inject(UserInfoService);
  /** Prefetches profiles for every user-linked notification (profile_visit/follow/
   *  text_message/image_message/gift_message/introduction_message/voice_room_shared/
   *  live_room_shared) so UserInfoModal is warm by the time the user clicks — batched
   *  instead of one call per event, since a burst of queued notifications can flush at
   *  once (e.g. app foregrounded). */
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
        this.notifyUserLinked({
          type: 'info',
          title: 'Profile visit',
          message: (name) => `${name} visited your profile`,
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
        this.notifyUserLinked({
          type: 'info',
          title: 'New follower',
          message: (name) => (event.status === 2 ? `${name} followed you back` : `${name} followed you`),
          uid: event.userId,
          nickname: event.nickname || null,
          avatarUrl: event.headUrl ?? null,
        });
        break;
      }
      case 'voice_room_shared':
        this.notifyUserLinked({
          type: 'info',
          title: 'Voice room shared',
          message: (name) => `${name} sent you a voice room`,
          uid: event.fromUserId,
          nickname: event.fromNickname || null,
          avatarUrl: event.headUrl,
        });
        break;
      case 'live_room_shared':
        this.notifyUserLinked({
          type: 'info',
          title: 'Live room shared',
          message: (name) => `${name} sent you a live room`,
          uid: event.fromUserId,
          nickname: event.fromNickname || null,
          avatarUrl: event.headUrl,
        });
        break;
      case 'text_message':
        this.notifyUserLinked({
          type: 'info',
          title: 'New message',
          message: () => event.text,
          uid: event.fromUserId,
          nickname: event.fromNickname || null,
          avatarUrl: event.fromHeadUrl ?? null,
          action: { type: 'navigate_to_conversation', userId: Number(event.fromUserId) },
        });
        break;
      case 'image_message':
        this.notifyUserLinked({
          type: 'info',
          title: 'New message',
          message: () => 'Sent you a photo',
          uid: event.fromUserId,
          nickname: event.fromNickname || null,
          avatarUrl: event.fromHeadUrl ?? null,
          action: { type: 'navigate_to_conversation', userId: Number(event.fromUserId) },
        });
        break;
      case 'gift_message': {
        this.notifyUserLinked({
          type: 'info',
          title: 'Gift received',
          message: (name) => `${name} sent you a gift`,
          uid: event.fromUserId,
          nickname: event.fromNickname || null,
          avatarUrl: event.fromHeadUrl ?? null,
        });
        break;
      }
      case 'introduction_message': {
        this.notifyUserLinked({
          type: 'info',
          title: 'Introduction',
          message: (name) => `${name} sent you an introduction`,
          uid: event.fromUserId,
          nickname: event.fromNickname || null,
          avatarUrl: event.fromHeadUrl ?? null,
        });
        break;
      }
      case 'group_message':
        this.notifications.notify('info', `${event.roomName}`, `${event.senderName}: ${event.text}`);
        break;
      case 'typing_indicator':
      case 'read_receipt':
        break;
      case 'account_status':
        if (event.status === 'banned') {
          this.toast.error('Your HelloTalk account has been banned.');
          this.notifications.notify('error', 'Account banned', 'Your HelloTalk account has been banned. Messaging is unavailable.');
        } else {
          this.toast.warning('Logged in elsewhere — this session was disconnected.');
          this.notifications.notify('warning', 'Session disconnected', 'Your HelloTalk account was logged in elsewhere, disconnecting this session.');
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
   *  resolvable identity). Shared by every event that names a specific user — profile_visit,
   *  follow, text_message, image_message, gift_message, introduction_message,
   *  voice_room_shared, live_room_shared — to deduplicate the parse/queue/fallback dance that
   *  would otherwise be duplicated in each switch case.
   *
   *  When the event itself didn't carry a nickname or avatar (some upstream pushes omit them),
   *  the notification is still shown immediately with the "Someone" fallback rather than making
   *  the user wait — but a direct `fetchUserInfo` lookup is kicked off alongside the existing
   *  batched enrich-queue prefetch, and the notification is patched in place via
   *  `updateUserEvent` once that resolves, so it doesn't stay stuck showing "Someone" forever
   *  the way a plain, un-patched snapshot would. */
  private notifyUserLinked(params: {
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: (displayName: string) => string;
    uid: string;
    nickname: string | null;
    avatarUrl: string | null;
    action?: { type: 'navigate_to_conversation'; userId: number } | { type: 'open_user_profile'; userId: number };
  }): void {
    const uid = Number(params.uid);
    const displayName = params.nickname?.trim() || 'Someone';
    if (!Number.isFinite(uid) || uid <= 0) {
      this.notifications.notify(params.type, params.title, params.message(displayName));
      return;
    }

    this.enrichQueue.queue(uid);
    const id = this.notifications.notifyUserEvent({
      type: params.type,
      title: params.title,
      message: params.message(displayName),
      userId: uid,
      avatarUrl: params.avatarUrl,
      nickname: params.nickname,
      ...(params.action !== undefined ? { action: params.action } : {}),
    });

    if (params.nickname?.trim() && params.avatarUrl) return;
    void this.userInfo.fetchUserInfo(uid).then((info) => {
      if (!info?.nickname) return;
      this.notifications.updateUserEvent(id, {
        nickname: params.nickname ?? info.nickname,
        avatarUrl: params.avatarUrl ?? info.details?.base?.headUrl ?? null,
        message: params.message(info.nickname),
      });
    });
  }
}
