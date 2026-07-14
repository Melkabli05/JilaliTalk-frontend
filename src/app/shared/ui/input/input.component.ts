import {
  Component,
  ChangeDetectionStrategy,
  input,
  model,
  computed,
} from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';

let nextId = 0;

@Component({
  selector: 'app-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="input-wrapper">
      @if (label()) {
        <label [for]="inputId" class="input-label">
          {{ label() }}
          @if (required()) {
            <span class="required-mark" aria-hidden="true">*</span>
          }
        </label>
      }
      <div class="input-inner">
        <input
          [id]="inputId"
          [type]="type()"
          [placeholder]="placeholder()"
          [disabled]="disabled()"
          [readonly]="readonly()"
          [required]="required()"
          [class]="sizeClass()"
          [value]="value()"
          [attr.inputmode]="inputmode() || null"
          [attr.enterkeyhint]="enterkeyhint() || null"
          [attr.autocapitalize]="autocapitalize()"
          [attr.aria-invalid]="ariaInvalid() ? 'true' : null"
          [attr.aria-required]="required() ? 'true' : null"
          [attr.aria-describedby]="ariaDescribedBy()"
          [attr.autocomplete]="autocomplete() || null"
          (input)="onInput($event)"
          (blur)="touched.set(true)"
        />
        <ng-content />
      </div>
      @if (showError()) {
        <span [id]="errorId" class="input-error" role="alert">{{ errorText() }}</span>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    input {
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }

    .input-wrapper {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }
    .input-label {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text);
    }
    :host-context(.dark) .input-label {
      color: var(--color-neutral-200);
    }
    .required-mark {
      color: var(--color-warm-500);
      margin-left: 2px;
    }

    .input-inner {
      position: relative;
      display: flex;
      align-items: center;
    }

    .input {
      width: 100%;
      appearance: none;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background-color: var(--color-card);
      color: var(--color-text);
      font-size: max(16px, var(--text-sm));
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .input::placeholder {
      color: var(--color-text-muted);
    }
    .input:focus {
      outline: none;
      border-color: var(--color-primary-500);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary-500) 10%, transparent);
    }
    .input:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }
    :host([aria-invalid='true']) .input {
      border-color: var(--color-warm-500);
    }
    :host([aria-invalid='true']) .input:focus {
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-warm-500) 10%, transparent);
    }
    .input:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .input-sm { height: 36px; padding: 0 var(--space-3); font-size: max(16px, var(--text-xs)); }
    .input-md { height: 44px; padding: 0 var(--space-4); font-size: max(16px, var(--text-sm)); }
    .input-lg { height: 48px; padding: 0 var(--space-4); font-size: var(--text-base); }

    .input-error {
      font-size: var(--text-xs);
      color: var(--color-warm-500);
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }
    :host-context(.dark) .input-error {
      color: var(--color-warm-400);
    }
  `],
})
export class InputComponent implements FormValueControl<string> {
  readonly value = model<string>('');
  readonly disabled = input<boolean>(false);
  readonly touched = model<boolean>(false);
  readonly errors = input<readonly ValidationError[]>([]);
  readonly invalid = input<boolean>(false);
  readonly readonly = input<boolean>(false);
  readonly required = input<boolean>(false);

  readonly type = input<'text' | 'email' | 'password' | 'number' | 'search'>('text');
  readonly placeholder = input<string>('');
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly label = input<string>('');
  readonly errorMessage = input<string>('');
  readonly autocomplete = input<string>('');
  readonly inputmode = input<'text' | 'numeric' | 'decimal' | 'email' | 'tel' | 'url' | 'search'>('text');
  readonly enterkeyhint = input<'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send'>('enter');
  readonly autocapitalize = input<'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters'>('off');

  protected readonly inputId = `app-input-${nextId++}`;
  protected readonly errorId = `${this.inputId}-error`;

  protected readonly sizeClass = computed(() => `input input-${this.size()}`);

  /** Combines both the explicit errorMessage input AND errors from signal-form's [formField] binding. */
  protected readonly showError = computed(
    () => this.invalid() || !!this.errorMessage() || this.errors().length > 0,
  );

  protected readonly errorText = computed(
    () => this.errorMessage() || this.errors()[0]?.message || '',
  );

  protected readonly ariaInvalid = computed(
    () => this.invalid() || this.errors().length > 0,
  );

  protected readonly ariaDescribedBy = computed(() =>
    this.showError() && this.errorText() ? this.errorId : null,
  );

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }
}