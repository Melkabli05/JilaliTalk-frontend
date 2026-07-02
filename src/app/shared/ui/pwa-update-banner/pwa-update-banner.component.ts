import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { PwaUpdateService } from '@core/services/pwa-update.service';
import { LucideRefreshCw } from '@lucide/angular';

@Component({
  selector: 'app-pwa-update-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideRefreshCw],
  template: `
    <div class="update-banner" role="status" aria-live="polite">
      <span class="update-banner__text">A new version of JilaliTalk is available.</span>
      <button
        type="button"
        class="update-banner__btn"
        (click)="activate()"
        aria-label="Reload to update"
      >
        <svg aria-hidden="true" lucideRefreshCw [size]="14"></svg>
        Reload to update
      </button>
    </div>
  `,
  styles: `
    :host {
      display: contents;
    }

    .update-banner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: 0.625rem 1rem;
      background: var(--color-primary, #4F46E5);
      color: #fff;
      font-size: 0.875rem;
      font-weight: 500;
      position: sticky;
      bottom: 0;
      z-index: 50;
    }

    .update-banner__text {
      line-height: 1.4;
    }

    .update-banner__btn {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.375rem 0.875rem;
      background: rgba(255, 255, 255, 0.2);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.4);
      border-radius: 6px;
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s;

      &:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      &:focus-visible {
        outline: 2px solid #fff;
        outline-offset: 2px;
      }
    }
  `,
})
export class PwaUpdateBannerComponent {
  private readonly pwaUpdate = inject(PwaUpdateService);

  async activate(): Promise<void> {
    await this.pwaUpdate.activateUpdate();
  }
}
