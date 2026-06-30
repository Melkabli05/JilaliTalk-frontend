import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { LucideLoader2 } from '@lucide/angular';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'muted' | 'gold' | 'soft-primary' | 'soft-accent' | 'soft-warm' | 'soft-gold' | 'soft-neutral';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';
type IconPosition = 'start' | 'end';

@Component({
  selector: 'app-button',

  imports: [LucideLoader2],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [type]="type()"
      [class]="buttonClasses()"
      [disabled]="disabled() || loading()"
      [attr.aria-disabled]="disabled() || loading() ? 'true' : null"
      [attr.aria-busy]="loading() ? 'true' : null"
    >
      @if (loading()) {
        <svg aria-hidden="true" lucideLoader2 [size]="iconSize()" class="btn-spinner"></svg>
      }
      <ng-content />
    </button>
  `,
  styles: [`
    :host {
      display: inline-flex;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      font-weight: var(--font-medium);
      border-radius: var(--radius-md);
      border: 1px solid transparent;
      cursor: pointer;
      transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, opacity 0.15s ease;
      font-size: var(--text-sm);
      text-decoration: none;
      width: 100%;
      background-color: var(--btn-bg, var(--color-primary-500));
      color: var(--btn-color, white);
      border-color: var(--btn-border, transparent);
    }

    .btn:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }

    .btn:hover:not([aria-disabled="true"]) {
      background-color: var(--btn-hover-bg, var(--color-primary-600));
    }

    /* Sizes */
    .btn-xs  { height: 28px; padding: 0 var(--space-2); font-size: var(--text-xs); }
    .btn-sm  { height: 32px; padding: 0 var(--space-3); font-size: var(--text-xs); }
    .btn-md  { height: 36px; padding: 0 var(--space-4); font-size: var(--text-sm); }
    .btn-lg  { height: 40px; padding: 0 var(--space-6); font-size: var(--text-base); }

    /* Icon only */
    .btn-icon-only.btn-xs { width: 28px; padding: 0; }
    .btn-icon-only.btn-sm { width: 32px; padding: 0; }
    .btn-icon-only.btn-md { width: 36px; padding: 0; }
    .btn-icon-only.btn-lg { width: 40px; padding: 0; }

    /* Pill */
    .btn-pill { border-radius: var(--radius-full); }

    /* Spinner */
    .btn-spinner { animation: spin 1s linear infinite; }

    .btn-primary   { --btn-bg: var(--color-primary-500); --btn-color: white; --btn-hover-bg: var(--color-primary-600); }
    .btn-secondary { --btn-bg: var(--color-neutral-100); --btn-color: var(--color-text); --btn-border: var(--color-border); --btn-hover-bg: var(--color-neutral-200); }
    .btn-ghost     { --btn-bg: transparent; --btn-color: var(--color-text); --btn-border: transparent; --btn-hover-bg: var(--color-neutral-100); }
    .btn-muted     { --btn-bg: var(--color-neutral-100); --btn-color: var(--color-text-secondary); --btn-border: var(--color-border); --btn-hover-bg: var(--color-neutral-200); }
    .btn-destructive { --btn-bg: var(--color-warm-500); --btn-color: white; --btn-hover-bg: var(--color-warm-600); }
    .btn-gold      { --btn-bg: var(--color-gold-500); --btn-color: var(--color-neutral-800); --btn-hover-bg: var(--color-gold-600); }
    .btn-soft-primary { --btn-bg: var(--color-primary-50); --btn-color: var(--color-primary-700); --btn-hover-bg: var(--color-primary-100); }
    .btn-soft-accent  { --btn-bg: var(--color-accent-50); --btn-color: var(--color-accent-700); --btn-hover-bg: var(--color-accent-100); }
    .btn-soft-warm    { --btn-bg: var(--color-warm-50); --btn-color: var(--color-warm-700); --btn-hover-bg: var(--color-warm-100); }
    .btn-soft-gold    { --btn-bg: var(--color-gold-50); --btn-color: var(--color-gold-700); --btn-hover-bg: var(--color-gold-100); }
    .btn-soft-neutral { --btn-bg: var(--color-neutral-100); --btn-color: var(--color-neutral-600); --btn-hover-bg: var(--color-neutral-200); }

    :host-context(.dark) {
      .btn-primary   { --btn-bg: var(--color-primary-600); --btn-hover-bg: var(--color-primary-500); }
      .btn-secondary { --btn-bg: var(--color-neutral-800); --btn-color: var(--color-neutral-200); --btn-border: var(--color-neutral-700); --btn-hover-bg: var(--color-neutral-700); }
      .btn-ghost     { --btn-color: var(--color-neutral-200); --btn-hover-bg: var(--color-neutral-700); }
      .btn-muted     { --btn-bg: var(--color-neutral-800); --btn-color: var(--color-neutral-300); --btn-border: var(--color-neutral-700); --btn-hover-bg: var(--color-neutral-700); }
      .btn-destructive { --btn-bg: var(--color-warm-600); --btn-hover-bg: var(--color-warm-500); }
      .btn-gold      { --btn-bg: var(--color-gold-600); --btn-color: var(--color-neutral-900); --btn-hover-bg: var(--color-gold-500); }
      .btn-soft-primary { --btn-bg: var(--color-primary-900); --btn-color: var(--color-primary-200); --btn-hover-bg: var(--color-primary-800); }
      .btn-soft-accent  { --btn-bg: var(--color-accent-900); --btn-color: var(--color-accent-200); --btn-hover-bg: var(--color-accent-800); }
      .btn-soft-warm    { --btn-bg: var(--color-warm-900); --btn-color: var(--color-warm-200); --btn-hover-bg: var(--color-warm-800); }
      .btn-soft-gold    { --btn-bg: var(--color-gold-900); --btn-color: var(--color-gold-200); --btn-hover-bg: var(--color-gold-800); }
      .btn-soft-neutral { --btn-bg: var(--color-neutral-800); --btn-color: var(--color-neutral-200); --btn-hover-bg: var(--color-neutral-700); }
    }

    /* Disabled */
    .btn[aria-disabled="true"],
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }

    @media (prefers-reduced-motion: reduce) {
      .btn, .btn-spinner { transition: none; animation: none; }
    }
  `]
})
export class ButtonComponent {
  variant = input<ButtonVariant>('primary');
  size = input<ButtonSize>('md');
  disabled = input<boolean>(false);
  loading = input<boolean>(false);
  iconOnly = input<boolean>(false);
  pill = input<boolean>(false);
  type = input<'button' | 'submit' | 'reset'>('button');

  buttonClasses = computed(() => {
    const classes = ['btn', `btn-${this.variant()}`, `btn-${this.size()}`];
    if (this.iconOnly()) classes.push('btn-icon-only');
    if (this.pill()) classes.push('btn-pill');
    return classes.join(' ');
  });

  iconSize = computed(() => {
    const sizes: Record<ButtonSize, number> = { xs: 12, sm: 12, md: 14, lg: 16 };
    return sizes[this.size()];
  });
}