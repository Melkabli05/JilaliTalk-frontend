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
      class="theme-toggle"
      [attr.aria-label]="themeService.isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
    >
      @if (themeService.isDark()) {
        <svg aria-hidden="true" lucideMoon [size]="20"></svg>
      } @else {
        <svg aria-hidden="true" lucideSun [size]="20"></svg>
      }
    </button>
  `,
  styles: [`
    .theme-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--space-9);
      height: var(--space-9);
      border-radius: var(--radius-md);
      border: none;
      background: transparent;
      color: var(--color-text);
      cursor: pointer;
      transition: background-color 0.15s ease;
    }

    .theme-toggle:hover {
      background-color: var(--color-neutral-100);
    }

    .dark .theme-toggle:hover {
      background-color: var(--color-neutral-700);
    }

    .theme-toggle:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }
  `]
})
export class ThemeToggleComponent {
  themeService = inject(ThemeService);
}
