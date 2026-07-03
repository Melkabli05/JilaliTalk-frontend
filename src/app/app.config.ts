import { ApplicationConfig, ErrorHandler, provideZonelessChangeDetection, APP_INITIALIZER, inject, computed, EnvironmentProviders } from '@angular/core';
import { IMAGE_CONFIG } from '@angular/common';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideLucideIcons, provideLucideConfig, LucideMoon, LucideSun } from '@lucide/angular';
import { provideServiceWorker } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { errorInterceptor } from '@core/http/interceptors/error.interceptor';
import { AppErrorHandler } from '@core/error/error-handler';
import { AuthStore } from '@core/auth/auth.store';
import { AuthService } from '@core/auth/auth.service';
import { NOTIFICATION_REPORTER, NotificationReporter } from '@core/tokens/notification-reporter.token';
import { ROOM_INVITE_GATEWAY } from '@core/tokens/room-invite-gateway.token';
import { ACTIVE_CALL_READER } from '@core/tokens/active-call-reader.token';
import { NotificationStore } from '@store/notification.store';
import { ActiveCallStore } from '@store/active-call.store';
import { RoomApi } from '@features/room/data/room-api';

import { environment } from '@env/environment';
import { routes } from './app.routes';
import { API_BASE_URL } from '@core/tokens/api-base-url.token';
import { WS_BASE_URL } from '@core/tokens/ws-base-url.token';

function restoreSession() {
  return () => {
    const auth = inject(AuthStore);
    const authService = inject(AuthService);
    return firstValueFrom(authService.me())
      .then(res => auth.login(res.user))
      .catch(() => undefined);
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([errorInterceptor])),
    provideLucideIcons(LucideMoon, LucideSun),
    provideLucideConfig({ strokeWidth: 1.5 }),
    { provide: ErrorHandler, useClass: AppErrorHandler },
    // Avatars are served from CDN at fixed sizes — the intrinsic image warning is not actionable
    { provide: IMAGE_CONFIG, useValue: { disableImageSizeWarning: true } },
    { provide: APP_INITIALIZER, useFactory: restoreSession, multi: true },
    { provide: API_BASE_URL, useValue: environment.apiUrl },
    { provide: WS_BASE_URL, useValue: environment.wsUrl },

    // Service Worker — only registered in production builds (enabled: environment.production).
    // Dev mode skips SW registration so hot-reload is unaffected.
    environment.production
      ? provideServiceWorker('ngsw-worker.js', { enabled: environment.production, registrationStrategy: 'registerWhenStable:30000' })
      : ([] as EnvironmentProviders[]),
    // Binds the core/-owned NOTIFICATION_REPORTER abstraction to the real store/ implementation —
    // core/ can't import store/ directly (see CLAUDE.md §2), so this is the one place allowed to wire them.
    {
      provide: NOTIFICATION_REPORTER,
      useFactory: () => {
        const store = inject(NotificationStore);
        return {
          notify: (type: 'info' | 'success' | 'warning' | 'error', title: string, message?: string) =>
            store.add(message === undefined ? { type, title } : { type, title, message }),
          notifyUserEvent: (params: Parameters<NotificationReporter['notifyUserEvent']>[0]) =>
            store.addUserEvent(params),
        };
      },
    },
    // Binds the core/-owned ROOM_INVITE_GATEWAY abstraction to the real features/room/
    // RoomApi implementation — core/ can't import features/ directly (see CLAUDE.md §2),
    // so this is the one place allowed to wire them.
    // Stage invites over the IM socket only carry cname, not busiType — every captured
    // /livehub/stage/invite_approval request in websocket_realtime.md shows busi_type: 2
    // (voice room); no video-room example has been observed.
    {
      provide: ROOM_INVITE_GATEWAY,
      useFactory: () => {
        const api = inject(RoomApi);
        const STAGE_INVITE_BUSI_TYPE = 2;
        return {
          approveStageInvite: (cname: string, accepted: boolean) =>
            api.stageInviteApproval(cname, STAGE_INVITE_BUSI_TYPE, 3, accepted ? 1 : 2),
          approveModInvite: (cname: string, userId: number) => api.approveManager(cname, userId),
        };
      },
    },
    {
      provide: ACTIVE_CALL_READER,
      useFactory: () => {
        const store = inject(ActiveCallStore);
        return {
          snapshot: computed(() =>
            store.minimized()
              ? { cname: store.cname()!, busiType: store.busiType(), roomName: store.roomName(), isMicOn: store.isMicOn() }
              : null,
          ),
          updateMicState: (v: boolean) => store.updateMicState(v),
          clear: () => store.clear(),
        };
      },
    },
  ],
};