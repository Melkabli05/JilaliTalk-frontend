import { InjectionToken } from '@angular/core';

/** Mirrors store/notification.store.ts's NotificationType — duplicated rather than imported,
 *  same reasoning as ERROR_REPORTER: core/ may not import store/ (see CLAUDE.md §2), so this
 *  abstraction owns its own small type instead of reaching upward for one. */
export type ReportedNotificationType = 'info' | 'success' | 'warning' | 'error';

export interface NotificationReporter {
  notify(type: ReportedNotificationType, title: string, message?: string): void;
}

export const NOTIFICATION_REPORTER = new InjectionToken<NotificationReporter>('NOTIFICATION_REPORTER', {
  factory: () => ({
    notify: () => {}, // no-op until app.config.ts binds the real NotificationStore
  }),
});
