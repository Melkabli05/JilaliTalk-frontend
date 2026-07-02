import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Dialog } from '@angular/cdk/dialog';
import { LucideBell, LucideCheck, LucideTrash2, LucideX } from '@lucide/angular';
import { NotificationStore, AppNotification } from '@store/notification.store';
import { UserInfoService } from '@core/services/user-info.service';
import { UserInfoModalComponent, UserInfoModalData } from '@shared/ui/user-info-modal';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';

@Component({
  selector: 'app-notification-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, LucideBell, LucideCheck, LucideTrash2, LucideX, AvatarComponent],
  template: `
    @if (store.isOpen()) {
      <div
        class="notification-overlay"
        [class.open]="store.isOpen()"
        (click)="onOverlayClick()"
        role="presentation"
      ></div>
      <div
        class="notification-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        aria-describedby="notification-list"
      >
        <header class="panel-header">
          <div class="header-title">
            <svg aria-hidden="true" lucideBell [size]="16" class="header-icon"></svg>
            <span class="header-text">Notifications</span>
            @if (store.unreadCount() > 0) {
              <span class="unread-badge" aria-label="{{ store.unreadCount() }} unread">
                {{ store.unreadCount() }}
              </span>
            }
          </div>
          <div class="header-actions">
            @if (store.unreadCount() > 0) {
              <button
                type="button"
                class="action-btn"
                (click)="store.markAllRead()"
                aria-label="Mark all notifications as read"
              >
                <svg aria-hidden="true" lucideCheck [size]="14" class="action-icon"></svg>
                <span class="action-text">Mark all read</span>
              </button>
            }
            @if (store.hasNotifications()) {
              <button
                type="button"
                class="action-btn danger"
                (click)="store.clear()"
                aria-label="Clear all notifications"
              >
                <svg aria-hidden="true" lucideTrash2 [size]="14" class="action-icon"></svg>
                <span class="action-text">Clear all</span>
              </button>
            }
          </div>
        </header>

        <main
          id="notification-list"
          class="panel-content"
          role="list"
          aria-label="Notification list"
          aria-live="polite"
          aria-atomic="false"
        >
          @if (store.notifications().length === 0) {
            <div class="empty-state" role="status">
              <svg aria-hidden="true" lucideBell [size]="32" class="empty-icon"></svg>
              <p class="empty-title">No notifications yet</p>
              <p class="empty-description">We'll notify you when something happens</p>
            </div>
          } @else {
            @for (notification of store.notifications(); track notification.id) {
              <article
                class="notification-item"
                [class.unread]="!notification.read"
                [attr.data-type]="notification.type"
                role="listitem"
                tabindex="0"
                (click)="onNotificationClick(notification)"
                (keydown.enter)="onNotificationClick(notification)"
                (keydown.space)="onNotificationClick(notification); $event.preventDefault()"
              >
                @if (notification.userId) {
                  <app-avatar
                    [src]="notification.avatarUrl ?? ''"
                    [alt]="notification.nickname ?? 'User'"
                    [initials]="notification.nickname ? notification.nickname.slice(0, 2) : null"
                    size="sm"
                    shape="circle"
                    class="notification-avatar"
                    [clickable]="true"
                    (avatarClick)="openUserModal(notification.userId!, notification.nickname ?? undefined, notification.avatarUrl ?? undefined)"
                  />
                } @else {
                  <div class="notification-indicator" [attr.data-type]="notification.type" aria-hidden="true"></div>
                }
                <div class="notification-content">
                  <p class="notification-title">{{ notification.title }}</p>
                  @if (notification.message) {
                    <p class="notification-message">{{ notification.message }}</p>
                  }
                  <time class="notification-time" [dateTime]="notification.timestamp">
                    {{ notification.timestamp | date:'short' }}
                  </time>
                </div>
                <button
                  type="button"
                  class="remove-btn"
                  (click)="$event.stopPropagation(); store.remove(notification.id)"
                  [attr.aria-label]="'Remove notification: ' + notification.title"
                >
                  <svg aria-hidden="true" lucideX [size]="12" class="remove-icon"></svg>
                </button>
              </article>
            }
          }
        </main>
      </div>
    }
  `,
  styles: [`
    .notification-overlay {
      position: fixed;
      inset: 0;
      z-index: 39;
      background: transparent;
    }

    .notification-panel {
      position: fixed;
      top: 60px;
      right: var(--space-4);
      z-index: 40;
      width: 380px;
      max-height: 520px;
      background: var(--color-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-elevation-3);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: slideIn 0.2s ease-out;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Header */
    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid var(--color-border);
      gap: var(--space-2);
    }

    .header-title {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .header-icon {
      color: var(--color-text-secondary);
    }

    .header-text {
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-text);
    }

    .unread-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      border-radius: var(--radius-full);
      background: var(--color-warm-500);
      color: var(--color-on-color);
      font-size: 11px;
      font-weight: var(--font-bold);
      line-height: 1;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }

    .action-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 10px;
      border-radius: var(--radius-md);
      font-size: var(--text-xs);
      font-weight: var(--font-medium);
      color: var(--color-text-secondary);
      background: transparent;
      border: none;
      cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease;
    }

    .action-btn:hover {
      background: var(--color-neutral-100);
      color: var(--color-text);
    }

    .action-btn:focus-visible {
      outline: var(--focus-ring);
      outline-offset: 2px;
    }

    .action-btn.danger:hover {
      background: color-mix(in srgb, var(--color-warm-500) 10%, transparent);
      color: var(--color-warm-600);
    }

    :host-context(.dark) .action-btn:hover {
      background: var(--color-neutral-700);
    }

    :host-context(.dark) .action-btn.danger:hover {
      background: color-mix(in srgb, var(--color-warm-500) 15%, transparent);
      color: var(--color-warm-400);
    }

    .action-icon {
      flex-shrink: 0;
    }

    /* Content */
    .panel-content {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: var(--space-2);
    }

    .panel-content::-webkit-scrollbar {
      width: 6px;
    }

    .panel-content::-webkit-scrollbar-track {
      background: transparent;
    }

    .panel-content::-webkit-scrollbar-thumb {
      background: var(--color-neutral-300);
      border-radius: 3px;
    }

    :host-context(.dark) .panel-content::-webkit-scrollbar-thumb {
      background: var(--color-neutral-600);
    }

    /* Empty State */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-10) var(--space-4);
      text-align: center;
    }

    .empty-icon {
      color: var(--color-text-tertiary);
      opacity: 0.5;
      margin-bottom: var(--space-3);
    }

    .empty-title {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text-secondary);
      margin: 0 0 var(--space-1);
    }

    .empty-description {
      font-size: var(--text-xs);
      color: var(--color-text-tertiary);
      margin: 0;
    }

    /* Notification Item */
    .notification-item {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      padding: var(--space-3);
      border-radius: var(--radius-lg);
      cursor: pointer;
      transition: background-color 0.15s ease;
      position: relative;
    }

    .notification-item:hover {
      background: var(--color-neutral-50);
    }

    .notification-item:focus-visible {
      outline: var(--focus-ring);
      outline-offset: -2px;
    }

    .notification-item.unread {
      background: color-mix(in srgb, var(--color-primary-500) 6%, transparent);
    }

    .notification-item.unread:hover {
      background: color-mix(in srgb, var(--color-primary-500) 10%, transparent);
    }

    :host-context(.dark) .notification-item:hover {
      background: var(--color-neutral-800);
    }

    :host-context(.dark) .notification-item.unread {
      background: color-mix(in srgb, var(--color-primary-500) 12%, transparent);
    }

    :host-context(.dark) .notification-item.unread:hover {
      background: color-mix(in srgb, var(--color-primary-500) 18%, transparent);
    }

    /* Type Indicators */
    .notification-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
      margin-top: 6px;
    }

    .notification-indicator[data-type="info"] { background: var(--color-primary-500); }
    .notification-indicator[data-type="success"] { background: var(--color-accent-500); }
    .notification-indicator[data-type="warning"] { background: var(--color-gold-500); }
    .notification-indicator[data-type="error"] { background: var(--color-warm-500); }

    /* Notification Content */
    .notification-content {
      flex: 1;
      min-width: 0;
    }

    .notification-title {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text);
      margin: 0;
      line-height: 1.4;
    }

    .notification-item.unread .notification-title {
      font-weight: var(--font-semibold);
    }

    .notification-message {
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      margin: 2px 0 0;
      line-height: 1.5;
    }

    .notification-time {
      display: block;
      font-size: 11px;
      color: var(--color-text-tertiary);
      margin-top: 4px;
    }

    /* Notification Avatar */
    .notification-avatar {
      flex-shrink: 0;
      align-self: flex-start;
      margin-top: 2px;
    }

    /* Remove Button */
    .remove-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: var(--radius-md);
      background: transparent;
      border: none;
      cursor: pointer;
      color: var(--color-text-tertiary);
      opacity: 0;
      transition: opacity 0.15s ease, background-color 0.15s ease, color 0.15s ease;
      flex-shrink: 0;
    }

    .notification-item:hover .remove-btn {
      opacity: 1;
    }

    .remove-btn:hover {
      background: var(--color-neutral-200);
      color: var(--color-text-secondary);
    }

    :host-context(.dark) .remove-btn:hover {
      background: var(--color-neutral-600);
    }
  `]
})
export class NotificationPanelComponent {
  readonly store = inject(NotificationStore);
  private readonly dialog = inject(Dialog);
  private readonly userInfo = inject(UserInfoService);

  onOverlayClick(): void {
    this.store.close();
  }

  onNotificationClick(notification: AppNotification): void {
    this.store.markRead(notification.id);
  }

  openUserModal(userId: number, nickname?: string, headUrl?: string): void {
    // Prefetch enriched profile in the background
    void this.userInfo.fetchUserInfo(userId);
    this.dialog.open<UserInfoModalComponent, UserInfoModalData>(UserInfoModalComponent, {
      data: { userId, nickname: nickname ?? null, headUrl: headUrl ?? null },
      backdropClass: 'app-modal-backdrop',
      ariaLabelledBy: 'user-info-title',
    });
  }
}
