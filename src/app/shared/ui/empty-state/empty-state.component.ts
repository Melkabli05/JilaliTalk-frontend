import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideInbox } from '@lucide/angular';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideInbox],
  template: `
    <div class="empty-state" [class.empty-state--compact]="compact()">
      <div class="empty-icon" aria-hidden="true">
        <svg lucideInbox [size]="iconSize()"></svg>
      </div>
      <p class="empty-title">{{ title() }}</p>
      @if (body()) {
        <p class="empty-body">{{ body() }}</p>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: var(--space-2);
      padding: var(--space-8) var(--space-4); text-align: center;
      color: var(--color-text-muted);
      animation: emptyIn 320ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
    }
    .empty-state--compact {
      padding: var(--space-5) var(--space-3);
    }
    .empty-icon {
      width: 64px; height: 64px; border-radius: var(--radius-xl);
      background: color-mix(in srgb, var(--color-primary-500) 10%, transparent);
      color: var(--color-primary-500);
      display: flex; align-items: center; justify-content: center;
      animation: iconFloat 4s ease-in-out infinite;
    }
    .empty-state--compact .empty-icon { width: 48px; height: 48px; }
    .empty-title {
      font-size: var(--text-sm); font-weight: var(--font-semibold);
      color: var(--color-text); margin: 0;
    }
    .empty-body { font-size: var(--text-xs); margin: 0; max-width: min(280px, 80vw); }
    @keyframes emptyIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes iconFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-3px); }
    }
    @media (prefers-reduced-motion: reduce) {
      .empty-state, .empty-icon { animation: none; }
    }
  `],
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly body = input<string>('');
  readonly iconSize = input<number>(28);
  readonly compact = input<boolean>(false);
}
