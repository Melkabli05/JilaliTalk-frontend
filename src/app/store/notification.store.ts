import { Service, effect, inject, signal, computed } from '@angular/core';
import { StorageService } from '@core/services/storage.service';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

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

const STORAGE_KEY = 'jtl_notifications';

@Service()
export class NotificationStore {
  private readonly storage = inject(StorageService);

  private readonly _notifications = signal<AppNotification[]>(
    this.storage.get<AppNotification[]>(STORAGE_KEY) ?? [],
  );
  private readonly _isOpen = signal(false);

  readonly notifications = this._notifications.asReadonly();
  readonly isOpen = this._isOpen.asReadonly();
  readonly unreadCount = computed(() => this._notifications().filter(n => !n.read).length);
  readonly hasNotifications = computed(() => this._notifications().length > 0);

  constructor() {
    // effect() is the correct pattern for syncing signal state to external persistence (localStorage).
    // Angular's docs explicitly name this as a valid use case — it auto-runs on every tracked signal change.
    effect(() => {
      this.storage.set(STORAGE_KEY, this._notifications());
    });
  }

  toggle(): void {
    this._isOpen.update(open => !open);
  }

  open(): void {
    this._isOpen.set(true);
  }

  close(): void {
    this._isOpen.set(false);
  }

  add(notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>): void {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    this._notifications.update(list => [
      { ...notification, id, timestamp: Date.now(), read: false },
      ...list,
    ]);
  }

  addUserEvent(params: Omit<AppNotification, 'id' | 'timestamp' | 'read' | 'userId' | 'avatarUrl' | 'nickname'> & {
    userId: number;
    avatarUrl?: string | null;
    nickname?: string | null;
  }): void {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    this._notifications.update(list => [
      { ...params, id, timestamp: Date.now(), read: false },
      ...list,
    ]);
  }

  markRead(id: string): void {
    this._notifications.update(list =>
      list.map(n => n.id === id ? { ...n, read: true } : n),
    );
  }

  markAllRead(): void {
    this._notifications.update(list => list.map(n => ({ ...n, read: true })));
  }

  remove(id: string): void {
    this._notifications.update(list => list.filter(n => n.id !== id));
  }

  clear(): void {
    this._notifications.set([]);
    this.storage.remove(STORAGE_KEY);
  }
}
