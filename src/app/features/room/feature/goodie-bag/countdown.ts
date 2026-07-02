import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { GoodieStore } from './goodie-store';

@Component({
  selector: 'app-countdown',

  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.isPlaying() && store.timeLeft() > 0) {
      <div class="countdown">
        <span class="countdown-num">{{ store.timeLeft() }}</span>
        <span class="countdown-label">sec left</span>
      </div>
    }
  `,
  styles: [`
    :host { display: contents; }
    .countdown {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: var(--space-2);
    }
    .countdown-num {
      font-size: var(--text-2xl);
      font-weight: var(--font-bold);
      color: var(--color-primary-500);
    }
    .countdown-label {
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
    }
  `]
})
export class CountdownComponent {
  readonly store = inject(GoodieStore);
}