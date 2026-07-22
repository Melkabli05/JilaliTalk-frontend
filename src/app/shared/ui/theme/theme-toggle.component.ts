import { Component, ChangeDetectionStrategy, inject, ViewEncapsulation } from '@angular/core';
import { LucideMoon, LucideSun } from '@lucide/angular';
import { ThemeService } from '@core/services/theme.service';

@Component({
  selector: 'app-theme-toggle',

  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [LucideMoon, LucideSun],
  template: `
    <button
      type="button"
      (click)="themeService.toggle()"
      class="inline-flex items-center justify-center size-9 rounded-md border-0 bg-transparent
             text-neutral-900 dark:text-neutral-100 cursor-pointer transition-colors duration-150
             hover:bg-neutral-100 dark:hover:bg-neutral-700
             focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      [attr.aria-label]="themeService.isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
    >
      @if (themeService.isDark()) {
        <svg aria-hidden="true" lucideMoon [size]="20"></svg>
      } @else {
        <svg aria-hidden="true" lucideSun [size]="20"></svg>
      }
    </button>
  `,
})
export class ThemeToggleComponent {
  themeService = inject(ThemeService);
}
