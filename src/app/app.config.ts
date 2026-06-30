import { ApplicationConfig, ErrorHandler, provideZonelessChangeDetection, APP_INITIALIZER, inject } from '@angular/core';
import { IMAGE_CONFIG } from '@angular/common';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideLucideIcons, provideLucideConfig, LucideMoon, LucideSun } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { errorInterceptor } from '@core/http/interceptors/error.interceptor';
import { AppErrorHandler } from '@core/error/error-handler';
import { AuthStore } from '@core/auth/auth.store';
import { AuthService } from '@core/auth/auth.service';
import { NOTIFICATION_REPORTER } from '@core/tokens/notification-reporter.token';
import { NotificationStore } from '@store/notification.store';

import { environment } from '@env/environment';
import { routes } from './app.routes';

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
    // Binds the core/-owned NOTIFICATION_REPORTER abstraction to the real store/ implementation —
    // core/ can't import store/ directly (see CLAUDE.md §2), so this is the one place allowed to wire them.
    {
      provide: NOTIFICATION_REPORTER,
      useFactory: () => {
        const store = inject(NotificationStore);
        return {
          notify: (type: 'info' | 'success' | 'warning' | 'error', title: string, message?: string) =>
            store.add(message === undefined ? { type, title } : { type, title, message }),
        };
      },
    },
  ],
};