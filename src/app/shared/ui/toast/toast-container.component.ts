import { Component, ChangeDetectionStrategy, inject, ViewEncapsulation } from '@angular/core';
import { ToastService, Toast, ToastAction } from '@core/services/toast.service';
import { LucideX, LucideCheckCircle, LucideAlertCircle, LucideAlertTriangle, LucideInfo } from '@lucide/angular';

@Component({
  selector: 'app-toast-container',

  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [LucideX, LucideCheckCircle, LucideAlertCircle, LucideAlertTriangle, LucideInfo],
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
                <svg lucideCheckCircle [size]="18"></svg>
              }
              @case ('error') {
                <svg lucideAlertCircle [size]="18"></svg>
              }
              @case ('warning') {
                <svg lucideAlertTriangle [size]="18"></svg>
              }
              @default {
                <svg lucideInfo [size]="18"></svg>
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
      pointer-events: none;
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
      gap: 12px;
      padding: 12px 16px 14px 18px;
      border-radius: var(--radius-xl);
      background-color: var(--color-card);
      box-shadow: var(--shadow-xl);
      border: 1px solid var(--color-border);
      overflow: hidden;
      animation: toast-enter 280ms cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: auto;
    }

    .toast::before {
      content: '';
      position: absolute;
      inset: 0 auto 0 0;
      width: 3px;
      background: var(--toast-accent);
      border-radius: var(--radius-xl) 0 0 var(--radius-xl);
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

    /* ── Toast type variants ── */
    .toast-success {
      --toast-accent: var(--color-accent-500);
    }

    .toast-error {
      --toast-accent: var(--color-error-500);
    }

    .toast-warning {
      --toast-accent: var(--color-warning);
    }

    .toast-info {
      --toast-accent: var(--color-primary-500);
    }

    /* ── Icon badge — tinted surface using --color-surface as blend base ── */
    .toast-icon-badge {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--radius-md);
      background-color: color-mix(in srgb, var(--toast-accent) 14%, var(--color-surface));
      color: var(--toast-accent);
    }

    /* ── Message ── */
    .toast-body {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .toast-message {
      font-size: var(--text-sm);
      font-weight: 500;
      line-height: var(--leading-normal);
      color: var(--color-text);
    }

    /* ── Action buttons ── */
    .toast-actions {
      display: flex;
      gap: 6px;
    }

    .toast-action {
      padding: 4px 10px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--color-border);
      background: transparent;
      color: var(--color-text-secondary);
      font-size: var(--text-xs);
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
    }

    .toast-action:hover {
      background-color: var(--color-neutral-100);
      color: var(--color-text);
      border-color: var(--color-neutral-300);
    }

    .toast-action-primary {
      border-color: transparent;
      background-color: var(--toast-accent);
      color: var(--color-on-color);
    }

    .toast-action-primary:hover {
      filter: brightness(0.9);
      border-color: transparent;
      color: var(--color-on-color);
    }

    /* ── Close button ── */
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
      transition: background-color 0.15s ease, color 0.15s ease;
    }

    .toast-close:hover {
      background-color: var(--color-neutral-100);
      color: var(--color-text);
    }

    .toast-close:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }

    /* ── Progress bar ── */
    .toast-progress {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 2.5px;
      background: var(--toast-accent);
      opacity: 0.5;
      transform-origin: left;
      animation-name: toast-progress;
      animation-timing-function: linear;
      animation-fill-mode: forwards;
    }

    @keyframes toast-progress {
      from { transform: scaleX(1); }
      to   { transform: scaleX(0); }
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
