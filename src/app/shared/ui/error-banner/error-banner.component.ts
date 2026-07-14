import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { LucideAlertCircle } from '@lucide/angular';

@Component({
  selector: 'app-error-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAlertCircle],
  template: `
    @if (message()) {
      <div class="error-banner" role="alert" aria-live="assertive">
        <svg aria-hidden="true" lucideAlertCircle [size]="14"></svg>
        {{ message() }}
      </div>
    }
  `,
  styles: [`
    :host { display: contents; }
    .error-banner {
      display: flex; align-items: center; gap: var(--space-2);
      padding: var(--space-3); background: var(--color-error-50);
      border: 1px solid var(--color-error-200); border-radius: var(--radius-md);
      font-size: var(--text-xs); color: var(--color-error-700);
    }
    :host-context(.dark) .error-banner {
      background: var(--color-error-900);
      border-color: var(--color-error-700);
      color: var(--color-error-200);
    }
  `],
})
export class ErrorBannerComponent {
  readonly message = input<string | null>(null);
}