import { InjectionToken } from '@angular/core';

/** Mirrors store/notification.store.ts's NotificationType — duplicated rather than imported,
 *  same reasoning as ERROR_REPORTER: core/ may not import store/ (see CLAUDE.md §2), so this
 *  abstraction owns its own small type instead of reaching upward for one. */
export type ReportedNotificationType = 'info' | 'success' | 'warning' | 'error';

/** Minimal profile shape required to backfill a user-linked notification's display fields
 *  (nickname + avatar). Mirrors UserInfoService's enrichment response, but lives in core/
 *  because the reporter token is core/-owned. */
export interface ReportedUserInfo {
  readonly userId: number;
  readonly nickname: string | null;
  readonly details: {
    readonly base: {
      readonly headUrl: string | null;
    } | null;
  } | null;
}

export interface NotificationReporter {
  notify(type: ReportedNotificationType, title: string, message?: string): void;
  /** User-linked notification — carries userId and optional avatar so the notification
   *  panel can render a profile avatar and route clicks to a user-info modal. */
  notifyUserEvent(params: {
    type: ReportedNotificationType;
    title: string;
    message?: string;
    userId: number;
    avatarUrl?: string | null;
    nickname?: string | null;
  }): void;
  /** Backfill a user-linked notification once enrichment resolves. Patches any stored
   *  notification with a matching `userId` so its nickname/avatar/`message` reflect the
   *  freshly-resolved profile (rather than the placeholder values the realtime push
   *  provided, which can be null/empty for events like profile_visit). No-op for uids
   *  with no stored notification. */
  enrichUserInfo(profile: ReportedUserInfo): void;
}

export const NOTIFICATION_REPORTER = new InjectionToken<NotificationReporter>('NOTIFICATION_REPORTER', {
  factory: () => ({
    notify: () => {},
    notifyUserEvent: () => {},
    enrichUserInfo: () => {},
  }),
});
