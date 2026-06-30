import { Injectable, signal, computed, effect } from '@angular/core';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface AppNotification {
  readonly id: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly message?: string;
  readonly timestamp: number;
  readonly read: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationStore {
  private readonly _notifications = signal<AppNotification[]>([]);
  private readonly _isOpen = signal(false);

  readonly notifications = this._notifications.asReadonly();

  readonly isOpen = this._isOpen.asReadonly();

  readonly unreadCount = computed(() => this._notifications().filter(n => !n.read).length);

  readonly hasNotifications = computed(() => this._notifications().length > 0);

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
    ].slice(0, 50));
  }

  markRead(id: string): void {
    this._notifications.update(list =>
      list.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }

  markAllRead(): void {
    this._notifications.set(
      this._notifications().map(n => ({ ...n, read: true }))
    );
  }

  remove(id: string): void {
    this._notifications.update(list => list.filter(n => n.id !== id));
  }

  clear(): void {
    this._notifications.set([]);
  }
}
