import { InjectionToken } from '@angular/core';

/** Mirrors store/notification.store.ts's NotificationType — duplicated rather than imported,
 *  same reasoning as ERROR_REPORTER: core/ may not import store/ (see CLAUDE.md §2), so this
 *  abstraction owns its own small type instead of reaching upward for one. */
export type ReportedNotificationType = 'info' | 'success' | 'warning' | 'error';

export interface NotificationReporter {
  notify(type: ReportedNotificationType, title: string, message?: string): void;
  /** User-linked notification — carries userId and optional avatar so the notification
   *  panel can render a profile avatar and route clicks to a user-info modal. Returns the
   *  new notification's id so a caller that queued a deferred identity lookup can patch it
   *  in place via {@link updateUserEvent} once that lookup resolves. */
  notifyUserEvent(params: {
    type: ReportedNotificationType;
    title: string;
    message?: string;
    userId: number;
    avatarUrl?: string | null;
    nickname?: string | null;
    action?: { type: 'navigate_to_conversation'; userId: number } | { type: 'open_user_profile'; userId: number };
  }): string;
  /** Patches a previously-added user-linked notification — used to backfill nickname/avatar/
   *  message once a deferred lookup resolves after the notification already displayed with
   *  incomplete data. No-ops if the notification no longer exists. */
  updateUserEvent(id: string, patch: { nickname?: string | null; avatarUrl?: string | null; message?: string }): void;
}

export const NOTIFICATION_REPORTER = new InjectionToken<NotificationReporter>('NOTIFICATION_REPORTER', {
  factory: () => ({
    notify: () => {},
    notifyUserEvent: () => '',
    updateUserEvent: () => {},
  }),
});
