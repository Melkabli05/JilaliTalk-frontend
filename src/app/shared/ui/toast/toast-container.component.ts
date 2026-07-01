import { Component, ChangeDetectionStrategy, inject, ViewEncapsulation } from '@angular/core';
import { ToastService, Toast, ToastAction } from '@core/services/toast.service';
import { LucideX, LucideCheckCircle, LucideAlertCircle, LucideInfo } from '@lucide/angular';

@Component({
  selector: 'app-toast-container',

  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [LucideX, LucideCheckCircle, LucideAlertCircle, LucideInfo],
  template: `
    <div class="toast-container" role="region" aria-label="Notifications">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="toast"
          [class]="'toast-' + toast.type"
          [class.toast-leaving]="toast.leaving"
          role="alert"
          [attr.aria-live]="toast.type === 'error' ? 'assertive' : 'polite'"
          [attr.aria-atomic]="true"
        >
          <div class="toast-icon-badge" aria-hidden="true">
            @switch (toast.type) {
              @case ('success') {
                <svg lucideCheckCircle [size]="20"></svg>
              }
              @case ('error') {
                <svg lucideAlertCircle [size]="20"></svg>
              }
              @case ('warning') {
                <svg lucideAlertCircle [size]="20"></svg>
              }
              @default {
                <svg lucideInfo [size]="20"></svg>
              }
            }
          </div>
          <div class="toast-body">
            <span class="toast-message">{{ toast.message }}</span>
            @if (toast.actions?.length) {
              <div class="toast-actions">
                @for (action of toast.actions; track action.label) {
                  <button
                    type="button"
                    class="toast-action"
                    [class.toast-action-primary]="action.variant === 'primary'"
                    (click)="onAction(toast, action)"
                  >
                    {{ action.label }}
                  </button>
                }
              </div>
            }
          </div>
          <button
            class="toast-close"
            (click)="toastService.dismiss(toast.id)"
            aria-label="Dismiss notification"
          >
            <svg aria-hidden="true" lucideX [size]="14"></svg>
          </button>
          @if (toast.duration) {
            <div class="toast-progress" [style.animation-duration.ms]="toast.duration"></div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      /* 56px = app-header height; --space-3 = 12px breathing room */
      top: calc(56px + var(--space-3));
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: calc(100% - 32px);
      max-width: 360px;
    }

    /* On desktop the fixed sidebar (var(--sidebar-width) = 84px) offsets the
       content area, so centering in the viewport puts toasts over the sidebar.
       Shift left anchor right by half the sidebar width to centre in the content area. */
    @media (min-width: 1024px) {
      .toast-container {
        left: calc(50% + var(--sidebar-width) / 2);
      }
    }

    .toast {
      position: relative;
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 18px 16px 22px;
      border-radius: var(--radius-xl);
      background-color: var(--color-card);
      box-shadow: var(--shadow-xl);
      border: 1px solid var(--color-border);
      overflow: hidden;
      animation: toast-enter 280ms cubic-bezier(0.16, 1, 0.3, 1);
    }

    .toast::before {
      content: '';
      position: absolute;
      inset: 0 auto 0 0;
      width: 4px;
      background: var(--toast-accent);
    }

    /* Exit animation must finish in TOAST_EXIT_MS (toast.service.ts) before removal. */
    .toast-leaving {
      animation: toast-exit 200ms ease-in forwards;
      pointer-events: none;
    }

    @keyframes toast-enter {
      from {
        opacity: 0;
        transform: translateY(-12px) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    @keyframes toast-exit {
      from {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      to {
        opacity: 0;
        transform: translateY(-8px) scale(0.96);
      }
    }

    .toast-success {
      --toast-accent: var(--color-accent-500);
    }

    .toast-error {
      --toast-accent: var(--color-warm-500);
    }

    .toast-warning {
      --toast-accent: var(--color-warning);
    }

    .toast-info {
      --toast-accent: var(--color-primary-500);
    }

    .toast-icon-badge {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: var(--radius-full);
      background: color-mix(in srgb, var(--toast-accent) 15%, transparent);
      color: var(--toast-accent);
    }

    .toast-body {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .toast-message {
      font-size: var(--text-sm);
      font-weight: 500;
      color: var(--color-text);
    }

    .toast-actions {
      display: flex;
      gap: 8px;
    }

    .toast-action {
      padding: 6px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border);
      background: transparent;
      color: var(--color-text);
      font-size: var(--text-xs);
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }

    .toast-action:hover {
      background-color: var(--color-neutral-100);
    }

    .dark .toast-action:hover {
      background-color: var(--color-neutral-700);
    }

    .toast-action-primary {
      border-color: transparent;
      background: var(--toast-accent);
      color: var(--color-on-color);
    }

    .toast-action-primary:hover {
      filter: brightness(0.92);
    }

    .toast-close {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: var(--radius-sm);
      border: none;
      background: transparent;
      color: var(--color-text-muted);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .toast-close:hover {
      background-color: var(--color-neutral-100);
      color: var(--color-text);
    }

    .dark .toast-close:hover {
      background-color: var(--color-neutral-700);
    }

    .toast-close:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }

    .toast-progress {
      position: absolute;
      left: 4px;
      right: 0;
      bottom: 0;
      height: 3px;
      background: var(--toast-accent);
      opacity: 0.6;
      transform-origin: left;
      animation-name: toast-progress;
      animation-timing-function: linear;
      animation-fill-mode: forwards;
    }

    @keyframes toast-progress {
      from {
        transform: scaleX(1);
      }
      to {
        transform: scaleX(0);
      }
    }
  `]
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);

  onAction(toast: Toast, action: ToastAction): void {
    action.run();
    this.toastService.dismiss(toast.id);
  }
}
