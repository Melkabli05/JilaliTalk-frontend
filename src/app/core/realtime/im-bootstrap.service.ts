import { Injectable, effect, inject } from '@angular/core';
import { AuthStore } from '@core/auth/auth.store';
import { ToastService } from '@core/services/toast.service';
import { NOTIFICATION_REPORTER } from '@core/tokens/notification-reporter.token';
import { ImSocketService } from './im-socket.service';
import type { ImEvent } from './im-events';

@Injectable({ providedIn: 'root' })
export class ImBootstrapService {
  private readonly auth = inject(AuthStore);
  private readonly imSocket = inject(ImSocketService);
  private readonly toast = inject(ToastService);
  private readonly notifications = inject(NOTIFICATION_REPORTER);

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

  private handle(event: ImEvent): void {
    switch (event.type) {
      case 'profile_visit':
        this.toast.info(`${event.visitorUserId} visited your profile`);
        this.notifications.notify('info', 'Profile visit', `${event.visitorUserId} visited your profile`);
        break;
      case 'voice_room_shared':
        this.toast.info(`${event.fromNickname} sent you a voice room`);
        this.notifications.notify('info', 'Voice room shared', `${event.fromNickname} sent you a voice room`);
        break;
      case 'live_room_shared':
        this.toast.info(`${event.fromNickname} sent you a live room`);
        this.notifications.notify('info', 'Live room shared', `${event.fromNickname} sent you a live room`);
        break;
      case 'text_message':
        this.notifications.notify('info', 'New message', event.text);
        break;
      case 'image_message':
        this.notifications.notify('info', 'New message', 'Sent you a photo');
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
