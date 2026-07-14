import {
  Component,
  ChangeDetectionStrategy,
  input,
  model,
  output,
  computed,
  signal,
} from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { LucideEye, LucideEyeOff } from '@lucide/angular';

let nextId = 0;

@Component({
  selector: 'app-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideEye, LucideEyeOff],
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
          [type]="effectiveType()"
          [placeholder]="placeholder()"
          [disabled]="disabled()"
          [readonly]="readonly()"
          [required]="required()"
          [class]="sizeClass()"
          [class.input-has-toggle]="type() === 'password'"
          [value]="value()"
          [attr.inputmode]="inputmode() || null"
          [attr.enterkeyhint]="enterkeyhint() || null"
          [attr.autocapitalize]="autocapitalize()"
          [attr.aria-invalid]="ariaInvalid() ? 'true' : null"
          [attr.aria-required]="required() ? 'true' : null"
          [attr.aria-describedby]="ariaDescribedBy()"
          [attr.autocomplete]="autocomplete() || null"
          (input)="onInput($event)"
          (blur)="onBlur()"
        />
        @if (type() === 'password') {
          <button
            type="button"
            class="password-toggle"
            [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
            [attr.aria-pressed]="showPassword()"
            (click)="togglePasswordVisibility()"
          >
            @if (showPassword()) {
              <svg aria-hidden="true" lucideEyeOff [size]="17"></svg>
            } @else {
              <svg aria-hidden="true" lucideEye [size]="17"></svg>
            }
          </button>
        }
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
    .input-has-toggle { padding-right: 44px; }

    .password-toggle {
      position: absolute;
      right: 2px;
      top: 50%;
      transform: translateY(-50%);
      width: 40px;
      height: 40px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      border-radius: var(--radius-md);
      color: var(--color-text-muted);
      cursor: pointer;
      transition: color 0.15s ease;
    }
    .password-toggle:hover { color: var(--color-text); }
    .password-toggle:focus-visible {
      outline: var(--focus-ring);
      outline-offset: -2px;
    }
    :host-context(.dark) .password-toggle:hover { color: var(--color-neutral-100); }

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
  /** Written by the signal-forms `Field`/`FormField` directive from `field.touched()` — see
   *  `touch` below for the other half of this contract (`FormValueControl.touch` /
   *  `FormUiControl.touched`, `@angular/forms/signals`). This must stay a plain `input()`, not
   *  a `model()`: `model()` auto-generates a `touchedChange` output, which the framework's
   *  custom-control binding does NOT listen for (it listens for an output literally named
   *  `touch`, void-typed) — a `model()` here silently breaks the touched relay instead of
   *  erroring, since every property on this contract is optional. */
  readonly touched = input<boolean>(false);
  readonly touch = output<void>();
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

  /** Only `type="password"` fields get a reveal toggle — for every other type this is just
   *  `type()` unchanged, so the toggle button and its state never appear on e.g. email/text
   *  inputs. */
  protected readonly showPassword = signal(false);
  protected readonly effectiveType = computed(() =>
    this.type() === 'password' && this.showPassword() ? 'text' : this.type(),
  );

  protected togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  /** `invalid`/`errors` from signal-form's [formField] binding reflect live validation
   *  state, independent of touch — a required-but-empty field is "invalid" from the moment
   *  the form is constructed, not just after the user does something. Gating on `touched()`
   *  is what turns that into "don't show it until the user has actually interacted with this
   *  field" (or the form was submitted, which the `touched` input also picks up — see
   *  `HelloTalkAuthClientImpl` equivalent... no, see the signal-forms `Field` directive,
   *  which marks all descendants touched on a failed submit attempt). The explicit
   *  `errorMessage` input bypasses this gate entirely — callers that pass it are opting into
   *  showing it unconditionally. */
  protected readonly showError = computed(
    () => !!this.errorMessage() || (this.touched() && (this.invalid() || this.errors().length > 0)),
  );

  protected readonly errorText = computed(
    () => this.errorMessage() || this.errors()[0]?.message || '',
  );

  protected readonly ariaInvalid = computed(
    () => this.touched() && (this.invalid() || this.errors().length > 0),
  );

  protected readonly ariaDescribedBy = computed(() =>
    this.showError() && this.errorText() ? this.errorId : null,
  );

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }

  protected onBlur(): void {
    this.touch.emit();
  }
}