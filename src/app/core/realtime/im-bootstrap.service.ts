import { Injectable, effect, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '@core/auth/auth.store';
import { ToastService } from '@core/services/toast.service';
import { UserInfoService } from '@core/services/user-info.service';
import { NOTIFICATION_REPORTER } from '@core/tokens/notification-reporter.token';
import { ROOM_INVITE_GATEWAY } from '@core/tokens/room-invite-gateway.token';
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

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.imSocket.connect();
      } else {
        this.imSocket.disconnect();
      }
    });

    effect(() => {
      const event = this.imSocket.lastEvent();
      if (event) this.handle(event);
    });
  }

  /** stage_invite/mod_invite/mod_accepted/mod_removed/mod_unmuted are pushed by
   *  HelloTalk on the LiveHub (room) socket too, but this IM socket is the source
   *  of truth for them — handle-realtime-event.util.ts (BFF path) no longer
   *  handles these five at all. */
  private handle(event: ImEvent): void {
    switch (event.type) {
      case 'profile_visit': {
        const uid = Number(event.visitorUserId);
        if (!Number.isFinite(uid)) break;
        // Prefetch profile so UserInfoModal is populated by the time the user clicks the notification
        void this.userInfo.fetchUserInfo(uid);
        const displayName = event.nickname?.trim() || event.visitorUserId;
        this.notifications.notifyUserEvent({
          type: 'info',
          title: 'Profile visit',
          message: `${displayName} visited your profile`,
          userId: uid,
          avatarUrl: event.headUrl ?? null,
          nickname: event.nickname ?? null,
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
      case 'follow':
        this.notifications.notify('info', 'New follower', event.status === 2 ? `${event.nickname} followed you back` : `${event.nickname} followed you`);
        break;
      case 'voice_room_shared':
        this.notifications.notify('info', 'Voice room shared', `${event.fromNickname} sent you a voice room`);
        break;
      case 'live_room_shared':
        this.notifications.notify('info', 'Live room shared', `${event.fromNickname} sent you a live room`);
        break;
      case 'text_message':
        this.notifications.notify('info', 'New message', event.text);
        break;
      case 'image_message':
        this.notifications.notify('info', 'New message', 'Sent you a photo');
        break;
      case 'gift_message':
        this.notifications.notify('info', 'Gift received', `${event.fromNickname} sent you a gift`);
        break;
      case 'introduction_message':
        this.notifications.notify('info', 'Introduction', `${event.fromNickname} sent you an introduction`);
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
}
