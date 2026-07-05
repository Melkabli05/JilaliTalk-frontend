import type { DayBucket } from '@shared/utils/day-bucket.util';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export type NotificationFilter = 'all' | 'unread' | NotificationType;

export interface AppNotification {
  readonly id: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly message?: string;
  readonly timestamp: number;
  readonly read: boolean;
  /** Set for user-linked notifications (e.g. profile visits) to enable avatar rendering
   *  and click-to-user-profile in the notification panel. */
  readonly userId?: number;
  readonly avatarUrl?: string | null;
  readonly nickname?: string | null;
}

export interface NotificationGroup {
  readonly bucket: DayBucket;
  readonly label: string;
  readonly items: readonly AppNotification[];
}

export interface UndoEntry {
  readonly notification: AppNotification;
  readonly expiresAt: number;
}
