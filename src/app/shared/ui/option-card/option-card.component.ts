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
    <div class="options" role="listbox" [attr.aria-label]="'options'">
      @for (option of options(); track option.value) {
        <button
          type="button"
          role="option"
          class="option-card"
          [class.option-card--selected]="selected() === option.value"
          [class]="option.variantClass ?? ''"
          [attr.aria-selected]="selected() === option.value"
          [disabled]="loading()"
          (click)="cardSelected.emit(option.value)"
        >
          <div class="option-icon" [innerHTML]="option.icon" [class]="option.iconClass ?? ''"></div>
          <div class="option-content">
            <span class="option-title">{{ option.title }}</span>
            <span class="option-desc">{{ option.description }}</span>
          </div>
        </button>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .options {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .option-card {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      background: var(--color-card);
      cursor: pointer;
      text-align: left;
      transition: border-color 0.15s, background-color 0.15s, transform 0.1s;
      width: 100%;
      font-family: inherit;
    }

    .option-card:hover:not(:disabled) {
      border-color: var(--color-neutral-300);
      background: var(--color-neutral-50);
      transform: translateX(2px);
    }

    .option-card:active:not(:disabled) {
      transform: translateX(0);
    }

    .option-card:focus-visible {
      outline: var(--focus-ring);
      outline-offset: 2px;
    }

    .option-card:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    :host-context(.dark) .option-card:hover:not(:disabled) {
      border-color: var(--color-neutral-600);
      background: var(--color-neutral-700);
    }

    .option-card--subtle,
    .option-card--muted {
      border-style: dashed;
    }

    .option-card--gold {
      border-color: color-mix(in srgb, var(--color-gold-400) 50%, transparent);
      background: color-mix(in srgb, var(--color-gold-50) 50%, var(--color-card));
    }

    .option-card--gold:hover:not(:disabled) {
      border-color: var(--color-gold-400);
      background: var(--color-gold-50);
    }

    :host-context(.dark) .option-card--gold {
      background: color-mix(in srgb, var(--color-gold-900) 30%, var(--color-card));
    }

    :host-context(.dark) .option-card--gold:hover:not(:disabled) {
      background: color-mix(in srgb, var(--color-gold-900) 50%, var(--color-card));
    }

    .option-card--selected {
      border-color: var(--color-primary-400);
      background: color-mix(in srgb, var(--color-primary-50) 60%, var(--color-card));
    }

    :host-context(.dark) .option-card--selected {
      border-color: var(--color-primary-600);
      background: color-mix(in srgb, var(--color-primary-900) 40%, var(--color-card));
    }

    .option-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: var(--radius-md);
      flex-shrink: 0;
      color: var(--color-text-muted);
    }

    /* Icon variants */
    :host-context(.dark) .leave-icon,
    .leave-icon {
      background: var(--color-neutral-100);
      color: var(--color-text-muted);
    }

    :host-context(.dark) .leave-icon {
      background: var(--color-neutral-700);
      color: var(--color-neutral-300);
    }

    .listen-icon,
    .ghost-icon {
      background: color-mix(in srgb, var(--color-primary-100) 50%, transparent);
      color: var(--color-primary-500);
    }

    :host-context(.dark) .listen-icon,
    :host-context(.dark) .ghost-icon {
      background: color-mix(in srgb, var(--color-primary-800) 60%, transparent);
      color: var(--color-primary-300);
    }

    .gold-icon {
      background: color-mix(in srgb, var(--color-gold-400) 25%, transparent);
      color: var(--color-gold-600);
    }

    :host-context(.dark) .gold-icon {
      background: color-mix(in srgb, var(--color-gold-700) 30%, transparent);
      color: var(--color-gold-400);
    }

    .option-content {
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
    }

    .option-title {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text);
    }

    .option-desc {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      line-height: 1.4;
    }
  `],
})
export class OptionCardComponent {
  readonly options = input<readonly OptionCardOption[]>([]);
  readonly selected = input<unknown>(null);
  readonly loading = input(false);
  readonly cardSelected = output<unknown>();
}
