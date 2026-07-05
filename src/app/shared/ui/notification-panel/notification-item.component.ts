import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { LucideX } from '@lucide/angular';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { relativeTime } from '@shared/utils/relative-time.util';
import type { AppNotification } from './notification.model';

const SWIPE_THRESHOLD_PX = 72;
const SWIPE_SLOP_PX = 10;

@Component({
  selector: 'app-notification-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideX, AvatarComponent],
  template: `
    <article
      class="notification-item"
      [class.unread]="!notification().read"
      [attr.data-type]="notification().type"
      role="listitem"
      tabindex="0"
      [style.transform]="dragX() ? 'translateX(' + dragX() + 'px)' : null"
      [style.transition]="dragging() ? 'none' : null"
      (touchstart)="onTouchStart($event)"
      (touchmove)="onTouchMove($event)"
      (touchend)="onTouchEnd($event)"
      (click)="onOpen()"
      (keydown.enter)="onOpen()"
      (keydown.space)="onOpen(); $event.preventDefault()"
    >
      @if (notification().userId) {
        <app-avatar
          [src]="notification().avatarUrl ?? ''"
          [alt]="notification().nickname ?? 'User'"
          [initials]="notification().nickname ? notification().nickname!.slice(0, 2) : null"
          size="sm"
          shape="circle"
          class="notification-avatar"
        />
      } @else {
        <div class="notification-indicator" [attr.data-type]="notification().type" aria-hidden="true"></div>
      }
      <div class="notification-content">
        <p class="notification-title">{{ notification().title }}</p>
        @if (notification().message) {
          <p class="notification-message">{{ notification().message }}</p>
        }
        <time class="notification-time" [attr.datetime]="isoTimestamp(notification().timestamp)">
          {{ relativeTime(notification().timestamp) }}
        </time>
      </div>
      <button
        type="button"
        class="remove-btn"
        (click)="onRemoveClick($event)"
        [attr.aria-label]="'Remove notification: ' + notification().title"
      >
        <svg aria-hidden="true" lucideX [size]="12" class="remove-icon"></svg>
      </button>
    </article>
  `,
  styles: [`
    .notification-item {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      padding: var(--space-3);
      border-radius: var(--radius-lg);
      cursor: pointer;
      transition: background-color 0.15s ease;
      position: relative;
      touch-action: pan-y;
    }
    .notification-item:hover { background: var(--color-neutral-50); }
    .notification-item:focus-visible { outline: var(--focus-ring); outline-offset: -2px; }
    .notification-item.unread { background: color-mix(in srgb, var(--color-primary-500) 6%, transparent); }
    .notification-item.unread:hover { background: color-mix(in srgb, var(--color-primary-500) 10%, transparent); }
    :host-context(.dark) .notification-item:hover { background: var(--color-neutral-800); }
    :host-context(.dark) .notification-item.unread { background: color-mix(in srgb, var(--color-primary-500) 12%, transparent); }
    :host-context(.dark) .notification-item.unread:hover { background: color-mix(in srgb, var(--color-primary-500) 18%, transparent); }

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

    .notification-content { flex: 1; min-width: 0; }
    .notification-title { font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--color-text); margin: 0; line-height: 1.4; }
    .notification-item.unread .notification-title { font-weight: var(--font-semibold); }
    .notification-message { font-size: var(--text-xs); color: var(--color-text-secondary); margin: 2px 0 0; line-height: 1.5; }
    .notification-time { display: block; font-size: 11px; color: var(--color-text-tertiary); margin-top: 4px; }
    .notification-avatar { flex-shrink: 0; align-self: flex-start; margin-top: 2px; }

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
    .notification-item:hover .remove-btn { opacity: 1; }
    .remove-btn:hover { background: var(--color-neutral-200); color: var(--color-text-secondary); }
    :host-context(.dark) .remove-btn:hover { background: var(--color-neutral-600); }
  `],
})
export class NotificationItemComponent {
  readonly notification = input.required<AppNotification>();
  readonly remove = output<string>();
  readonly open = output<AppNotification>();

  readonly relativeTime = relativeTime;
  readonly dragX = signal(0);
  readonly dragging = signal(false);

  private touchStartX = 0;
  private touchStartY = 0;
  private didSwipe = false;

  isoTimestamp(ts: number): string {
    return new Date(ts).toISOString();
  }

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.touches[0]!.clientX;
    this.touchStartY = event.touches[0]!.clientY;
    this.didSwipe = false;
    this.dragging.set(true);
  }

  onTouchMove(event: TouchEvent): void {
    if (!this.dragging()) return;
    const deltaX = event.touches[0]!.clientX - this.touchStartX;
    const deltaY = event.touches[0]!.clientY - this.touchStartY;
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;
    if (Math.abs(deltaX) > SWIPE_SLOP_PX) this.didSwipe = true;
    if (deltaX < 0) this.dragX.set(deltaX);
  }

  onTouchEnd(event: TouchEvent): void {
    if (!this.dragging()) return;
    this.dragging.set(false);
    const deltaX = event.changedTouches[0]!.clientX - this.touchStartX;
    if (deltaX < -SWIPE_THRESHOLD_PX) {
      this.remove.emit(this.notification().id);
    } else {
      this.dragX.set(0);
    }
  }

  onOpen(): void {
    if (this.didSwipe) {
      this.didSwipe = false;
      return;
    }
    this.open.emit(this.notification());
  }

  onRemoveClick(event: MouseEvent): void {
    event.stopPropagation();
    this.remove.emit(this.notification().id);
  }
}
