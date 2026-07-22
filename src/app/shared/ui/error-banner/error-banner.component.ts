import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { LucideAlertCircle } from '@lucide/angular';

@Component({
  selector: 'app-error-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAlertCircle],
  template: `
    @if (message()) {
      <div
        class="flex items-center gap-2 p-3 rounded-md text-xs
               bg-red-50 border border-red-200 text-red-700
               dark:bg-red-900 dark:border-red-700 dark:text-red-200"
        role="alert"
        aria-live="assertive"
      >
        <svg aria-hidden="true" lucideAlertCircle [size]="14"></svg>
        {{ message() }}
      </div>
    }
  `,
  styles: [`:host { display: contents; }`],
})
export class ErrorBannerComponent {
  readonly message = input<string | null>(null);
}
