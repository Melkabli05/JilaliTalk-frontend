import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { LucideLoader2 } from '@lucide/angular';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'muted' | 'gold' | 'soft-primary' | 'soft-accent' | 'soft-warm' | 'soft-gold' | 'soft-neutral' | 'soft-invisible';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';
type IconPosition = 'start' | 'end';

const BASE_CLASSES =
  'inline-flex items-center justify-center gap-2 font-medium rounded-md border border-transparent ' +
  'cursor-pointer transition-colors duration-150 text-sm no-underline w-full ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ' +
  'aria-disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:pointer-events-none ' +
  'motion-reduce:transition-none';

/** height/padding/font-size per size step. Icon-only swaps padding for a matching width. */
const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: 'h-7 px-2 text-xs',
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  // 44px, not 40: Apple HIG and WCAG 2.5.5 both put the minimum comfortable touch target
  // at 44x44pt — lg is the size primary/submit CTAs use, so it's the one worth holding to
  // that floor.
  lg: 'h-11 px-6 text-base',
};
const ICON_ONLY_SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: 'w-7 p-0',
  sm: 'w-8 p-0',
  md: 'w-9 p-0',
  lg: 'w-11 p-0',
};

/** Color/background per variant, light + dark. Tailwind's built-in default palette
 *  replaces this project's --color-primary/accent/warm/gold/neutral design tokens. */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500',
  secondary:
    'bg-neutral-100 text-neutral-900 border-neutral-200 hover:bg-neutral-200 ' +
    'dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700 dark:hover:bg-neutral-700',
  ghost:
    'bg-transparent text-neutral-900 hover:bg-neutral-100 ' +
    'dark:text-neutral-200 dark:hover:bg-neutral-700',
  destructive: 'bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-500',
  muted:
    'bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200 ' +
    'dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700 dark:hover:bg-neutral-700',
  gold: 'bg-amber-500 text-neutral-800 hover:bg-amber-600 dark:bg-amber-600 dark:text-neutral-900 dark:hover:bg-amber-500',
  'soft-primary': 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800',
  'soft-accent': 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900 dark:text-emerald-200 dark:hover:bg-emerald-800',
  'soft-warm': 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800',
  'soft-gold': 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-200 dark:hover:bg-amber-800',
  'soft-neutral': 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700',
  'soft-invisible':
    'bg-neutral-500/12 text-neutral-700 border-neutral-200 hover:bg-neutral-500/20 ' +
    'dark:bg-neutral-400/18 dark:text-neutral-200 dark:border-neutral-700 dark:hover:bg-neutral-400/28',
};

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
        <svg aria-hidden="true" lucideLoader2 [size]="iconSize()" class="animate-spin motion-reduce:animate-none"></svg>
      }
      <ng-content />
    </button>
  `,
  /** :host { display: inline-flex } is the only remaining non-utility rule — Angular's
   *  Emulated encapsulation has no way to put a class="" attribute on the host tag from
   *  within its own template. Everything else (sizing, color, radius, spacing, the spinner
   *  animation) is computed as a Tailwind utility class string in buttonClasses() below. */
  styles: [`:host { display: inline-flex; }`],
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
    const classes = [BASE_CLASSES, VARIANT_CLASSES[this.variant()]];
    classes.push(this.iconOnly() ? ICON_ONLY_SIZE_CLASSES[this.size()] : SIZE_CLASSES[this.size()]);
    if (this.pill()) classes.push('rounded-full');
    return classes.join(' ');
  });

  iconSize = computed(() => {
    const sizes: Record<ButtonSize, number> = { xs: 12, sm: 12, md: 14, lg: 16 };
    return sizes[this.size()];
  });
}
