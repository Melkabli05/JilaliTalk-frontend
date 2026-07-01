import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';

@Component({
  selector: 'app-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'badge',
    '[class]': 'modifierClasses()',
    '[attr.role]': 'role() || null',
    '[attr.aria-label]': 'ariaLabel() || null',
  },
  template: `<ng-content />`,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      font-weight: var(--font-medium);
      border-radius: var(--radius-full);
      white-space: nowrap;
    }
    :host(:focus-visible) {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }
    :host(.badge-sm) { height: 20px; padding: 0 var(--space-2); font-size: 10px; }
    :host(.badge-md) { height: 24px; padding: 0 var(--space-3); font-size: var(--text-xs); }

    :host(.badge-default) {
      background-color: var(--color-neutral-100);
      color: var(--color-text);
    }
    :host-context(.dark) .badge-default {
      background-color: var(--color-neutral-800);
      color: var(--color-neutral-200);
    }

    :host(.badge-primary) { background-color: var(--color-primary-500); color: var(--color-on-color); }
    :host(.badge-accent)  { background-color: var(--color-accent-500);  color: var(--color-on-color); }
    :host(.badge-warm)    { background-color: var(--color-warm-500);    color: var(--color-on-color); }
    :host(.badge-gold)    { background-color: var(--color-gold-500);    color: var(--color-on-color); }
    :host-context(.dark) {
      :host(.badge-primary) { background-color: var(--color-primary-400); }
      :host(.badge-accent)  { background-color: var(--color-accent-400);  }
      :host(.badge-warm)     { background-color: var(--color-warm-400);     }
      :host(.badge-gold)    { background-color: var(--color-gold-400);    }
    }
  `],
})
export class BadgeComponent {
  readonly variant = input<'default' | 'primary' | 'accent' | 'warm' | 'gold'>('default');
  readonly size = input<'sm' | 'md'>('md');
  readonly role = input<string>('');
  readonly ariaLabel = input<string>('');

  protected readonly modifierClasses = computed(
    () => `badge-${this.variant()} badge-${this.size()}`
  );
}