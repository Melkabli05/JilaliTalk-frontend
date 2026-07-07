import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { NotificationStore } from '@store/notification.store';
import { LucideCheckCircle, LucideAlertCircle, LucideAlertTriangle, LucideInfo } from '@lucide/angular';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';

@Component({
  selector: 'app-notification-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideCheckCircle, LucideAlertCircle, LucideAlertTriangle, LucideInfo, AvatarComponent],
  template: `
    @if (store.pendingToast(); as n) {
      <button
        type="button"
        class="notification-toast"
        [class]="'toast-' + n.type"
        (click)="store.dismissToast()"
        aria-live="polite"
      >
        @if (n.avatarUrl) {
          <app-avatar
            [src]="n.avatarUrl"
            [alt]="n.nickname ?? 'User'"
            [initials]="n.nickname ? n.nickname.slice(0, 2) : null"
            size="sm"
            shape="circle"
            class="toast-avatar"
          />
        } @else {
          <span class="toast-icon" aria-hidden="true">
            @switch (n.type) {
              @case ('success') { <svg lucideCheckCircle [size]="16"></svg> }
              @case ('error') { <svg lucideAlertCircle [size]="16"></svg> }
              @case ('warning') { <svg lucideAlertTriangle [size]="16"></svg> }
              @default { <svg lucideInfo [size]="16"></svg> }
            }
          </span>
        }
        <span class="toast-text">
          <span class="toast-title">{{ n.title }}</span>
          @if (n.message) {
            <span class="toast-message">{{ n.message }}</span>
          }
        </span>
      </button>
    }
  `,
  styles: [`
    .notification-toast {
      position: fixed;
      top: calc(var(--app-header-height) + var(--space-3));
      right: var(--space-4);
      z-index: var(--z-toast);
      display: flex;
      align-items: flex-start;
      gap: var(--space-2);
      max-width: 320px;
      padding: var(--space-3);
      border-radius: var(--radius-lg);
      background: var(--color-card);
      border: 1px solid var(--color-border);
      box-shadow: var(--shadow-xl);
      cursor: pointer;
      text-align: left;
      animation: toast-preview-enter 0.2s ease-out;
    }
    @keyframes toast-preview-enter {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .toast-avatar { flex-shrink: 0; align-self: flex-start; }
    .toast-icon { flex-shrink: 0; margin-top: 1px; }
    .toast-info .toast-icon { color: var(--color-primary-500); }
    .toast-success .toast-icon { color: var(--color-accent-500); }
    .toast-warning .toast-icon { color: var(--color-gold-500); }
    .toast-error .toast-icon { color: var(--color-warm-500); }
    .toast-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .toast-title { font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--color-text); }
    .toast-message { font-size: var(--text-xs); color: var(--color-text-secondary); }
  `],
})
export class NotificationToastComponent {
  protected readonly store = inject(NotificationStore);
}
