import { Component, ChangeDetectionStrategy, output, input } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';

export interface OptionCardOption {
  readonly icon: string;
  readonly title: string;
  readonly description: string;
  readonly value: unknown;
  readonly variantClass?: string;
  readonly iconClass?: string;
}

@Component({
  selector: 'app-option-card',
  imports: [A11yModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2" role="listbox" [attr.aria-label]="'options'">
      @for (option of options(); track option.value) {
        <button
          type="button"
          role="option"
          class="option-card flex items-center gap-3 p-3 rounded-lg cursor-pointer text-left w-full font-[inherit]
                 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900
                 transition-[border-color,background-color,transform] duration-150
                 hover:not-disabled:border-neutral-300 hover:not-disabled:bg-neutral-50 hover:not-disabled:translate-x-0.5
                 dark:hover:not-disabled:border-neutral-600 dark:hover:not-disabled:bg-neutral-700
                 active:not-disabled:translate-x-0
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500
                 disabled:opacity-50 disabled:cursor-not-allowed"
          [class.option-card--selected]="selected() === option.value"
          [class]="option.variantClass ?? ''"
          [attr.aria-selected]="selected() === option.value"
          [disabled]="loading()"
          (click)="cardSelected.emit(option.value)"
        >
          <div
            class="option-icon flex items-center justify-center w-9 h-9 rounded-md shrink-0 text-neutral-500"
            [innerHTML]="option.icon"
            [class]="option.iconClass ?? ''"
          ></div>
          <div class="flex flex-col gap-px min-w-0">
            <span class="text-sm font-medium text-neutral-900 dark:text-neutral-100">{{ option.title }}</span>
            <span class="text-xs text-neutral-500 leading-snug">{{ option.description }}</span>
          </div>
        </button>
      }
    </div>
  `,
  /**
   * Consumers (region-block-dialog, vip-limit-dialog) pass free-form variantClass/iconClass
   * strings, so those specific hook class names stay as scoped CSS selectors here rather
   * than template utility classes — but every value inside is now a literal Tailwind-palette
   * color, not a --color-* design token.
   */
  styles: [`
    :host { display: block; }

    .option-card--subtle,
    .option-card--muted { border-style: dashed; }

    .option-card--gold {
      border-color: rgb(251 191 36 / 50%); /* amber-400/50 */
      background: color-mix(in srgb, rgb(255 251 235) 50%, white); /* amber-50 mixed with card */
    }
    .option-card--gold:hover:not(:disabled) {
      border-color: #fbbf24; /* amber-400 */
      background: #fffbeb; /* amber-50 */
    }
    :host-context(.dark) .option-card--gold {
      background: color-mix(in srgb, rgb(120 53 15) 30%, rgb(23 23 23)); /* amber-900 mixed with dark card */
    }
    :host-context(.dark) .option-card--gold:hover:not(:disabled) {
      background: color-mix(in srgb, rgb(120 53 15) 50%, rgb(23 23 23));
    }

    .option-card--selected {
      border-color: #60a5fa; /* blue-400 */
      background: color-mix(in srgb, rgb(239 246 255) 60%, white); /* blue-50 mixed with card */
    }
    :host-context(.dark) .option-card--selected {
      border-color: #2563eb; /* blue-600 */
      background: color-mix(in srgb, rgb(30 58 138) 40%, rgb(23 23 23)); /* blue-900 mixed with dark card */
    }

    .leave-icon { background: #f5f5f5; color: #737373; } /* neutral-100 / neutral-500 */
    :host-context(.dark) .leave-icon { background: #404040; color: #d4d4d4; } /* neutral-700 / neutral-300 */

    .listen-icon, .ghost-icon {
      background: rgb(219 234 254 / 50%); /* blue-100/50 */
      color: #3b82f6; /* blue-500 */
    }
    :host-context(.dark) .listen-icon,
    :host-context(.dark) .ghost-icon {
      background: rgb(30 64 175 / 60%); /* blue-800/60 */
      color: #93c5fd; /* blue-300 */
    }

    .gold-icon { background: rgb(251 191 36 / 25%); color: #d97706; } /* amber-400/25, amber-600 */
    :host-context(.dark) .gold-icon { background: rgb(180 83 9 / 30%); color: #fbbf24; } /* amber-700/30, amber-400 */
  `],
})
export class OptionCardComponent {
  readonly options = input<readonly OptionCardOption[]>([]);
  readonly selected = input<unknown>(null);
  readonly loading = input(false);
  readonly cardSelected = output<unknown>();
}
