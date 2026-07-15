import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { PwaUpdateService } from '@core/services/pwa-update.service';
import { LucideRefreshCw } from '@lucide/angular';

@Component({
  selector: 'app-pwa-update-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideRefreshCw],
  template: `
    <div class="update-toast" role="status" aria-live="polite">
      <div class="update-toast__icon" aria-hidden="true">
        <svg lucideRefreshCw [size]="18"></svg>
      </div>

      <div class="update-toast__body">
        <span class="update-toast__text">
          A new version of JilaliTalk is available.
        </span>

        <button
          type="button"
          class="update-toast__action"
          (click)="activate()"
        >
          Reload to update
        </button>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: contents;
    }

    .update-toast {
      position: fixed;
      top: calc(var(--app-header-height) + env(safe-area-inset-top, 0px) + var(--space-3));
      left: 50%;
      transform: translateX(var(--update-toast-translate, -50%));
      z-index: var(--z-toast);
      display: flex;
      align-items: center;
      gap: 12px;
      width: calc(100% - 32px);
      max-width: 380px;
      padding: 12px 14px;
      border-radius: var(--radius-xl);
      background-color: var(--color-card);
      box-shadow: var(--shadow-xl);
      border: 1px solid var(--color-border);
      animation: update-toast-enter 280ms cubic-bezier(0.16, 1, 0.3, 1);
    }

    @media (min-width: 1024px) {
      .update-toast {
        --update-toast-translate: calc(-50% + var(--sidebar-width) / 2);
      }
    }

    @keyframes update-toast-enter {
      from {
        opacity: 0;
        transform: translateX(var(--update-toast-translate, -50%))
          translateY(-12px) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translateX(var(--update-toast-translate, -50%))
          translateY(0) scale(1);
      }
    }

    .update-toast__icon {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--radius-md);
      background-color: color-mix(
        in srgb,
        var(--color-primary, #4f46e5) 14%,
        var(--color-surface)
      );
      color: var(--color-primary, #4f46e5);
    }

    .update-toast__body {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .update-toast__text {
      font-size: var(--text-sm);
      font-weight: 500;
      line-height: var(--leading-normal);
      color: var(--color-text);
    }

    .update-toast__action {
      align-self: flex-start;
      padding: 4px 10px;
      border-radius: var(--radius-sm);
      border: none;
      background-color: var(--color-primary, #4f46e5);
      color: var(--color-on-color, #fff);
      font-size: var(--text-xs);
      font-weight: 600;
      cursor: pointer;
      transition: filter 0.15s ease;
    }

    .update-toast__action:hover {
      filter: brightness(0.9);
    }

    .update-toast__action:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }
  `,
})
export class PwaUpdateBannerComponent {
  readonly pwaUpdate = inject(PwaUpdateService);

  async activate(): Promise<void> {
    await this.pwaUpdate.activateUpdate();
  }
}