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

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-9 px-3 text-[max(16px,0.75rem)]',
  md: 'h-11 px-4 text-[max(16px,0.875rem)]',
  lg: 'h-12 px-4 text-base',
};

@Component({
  selector: 'app-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideEye, LucideEyeOff],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-1">
      @if (label()) {
        <label [for]="inputId" class="text-sm font-medium text-neutral-900 dark:text-neutral-200">
          {{ label() }}
          @if (required()) {
            <span class="text-red-500 ml-0.5" aria-hidden="true">*</span>
          }
        </label>
      }
      <div class="relative flex items-center">
        <input
          [id]="inputId"
          [type]="effectiveType()"
          [placeholder]="placeholder()"
          [disabled]="disabled()"
          [readonly]="readonly()"
          [required]="required()"
          [class]="inputClasses()"
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
            class="absolute right-0.5 top-1/2 -translate-y-1/2 w-10 h-10 inline-flex items-center justify-center
                   border-0 bg-transparent rounded-md text-neutral-500 cursor-pointer
                   transition-colors duration-150
                   hover:text-neutral-900 dark:hover:text-neutral-100
                   focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500"
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
        <span [id]="errorId" class="text-xs text-red-500 dark:text-red-400 flex items-center gap-1" role="alert">{{ errorText() }}</span>
      }
    </div>
  `,
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

  /**
   * Base classes + size + the invalid-state border/ring. Previously the invalid styling was
   * a `:host([aria-invalid='true'])` CSS selector — but `aria-invalid` was only ever set on
   * the inner `<input>`, never the host, so that rule never actually matched anything. Wiring
   * it here (driven by the same `ariaInvalid()` signal already used for the attribute) is a
   * direct byproduct of moving this to a computed class list, not a scope change.
   */
  protected readonly inputClasses = computed(() => {
    const classes = [
      'w-full appearance-none rounded-md border bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100',
      'transition-[border-color,box-shadow] duration-150',
      'placeholder:text-neutral-500',
      'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      '[touch-action:manipulation] [-webkit-tap-highlight-color:transparent]',
      SIZE_CLASSES[this.size()],
    ];
    if (this.type() === 'password') classes.push('pr-11');
    if (this.ariaInvalid()) {
      classes.push('border-red-500 focus:border-red-500 focus:shadow-[0_0_0_3px_rgb(239_68_68/10%)]');
    } else {
      classes.push('border-neutral-200 dark:border-neutral-700 focus:border-blue-500 focus:shadow-[0_0_0_3px_rgb(59_130_246/10%)]');
    }
    return classes.join(' ');
  });

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
