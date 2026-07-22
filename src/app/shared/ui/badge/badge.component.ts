import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';

const SIZE_CLASSES: Record<'sm' | 'md', string> = {
  sm: 'h-5 px-2 text-[10px]',
  md: 'h-6 px-3 text-xs',
};

/** Tailwind's built-in default palette replaces this project's
 *  --color-primary/accent/warm/gold design tokens. */
const VARIANT_CLASSES: Record<'default' | 'primary' | 'accent' | 'warm' | 'gold', string> = {
  default: 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-200',
  primary: 'bg-blue-500 text-white dark:bg-blue-400',
  accent: 'bg-emerald-500 text-white dark:bg-emerald-400',
  warm: 'bg-red-500 text-white dark:bg-red-400',
  gold: 'bg-amber-500 text-white dark:bg-amber-400',
};

@Component({
  selector: 'app-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'inline-flex items-center font-medium rounded-full whitespace-nowrap ' +
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500',
    '[class]': 'modifierClasses()',
    '[attr.role]': 'role() || null',
    '[attr.aria-label]': 'ariaLabel() || null',
  },
  template: `<ng-content />`,
})
export class BadgeComponent {
  readonly variant = input<'default' | 'primary' | 'accent' | 'warm' | 'gold'>('default');
  readonly size = input<'sm' | 'md'>('md');
  readonly role = input<string>('');
  readonly ariaLabel = input<string>('');

  protected readonly modifierClasses = computed(
    () => `${VARIANT_CLASSES[this.variant()]} ${SIZE_CLASSES[this.size()]}`
  );
}
