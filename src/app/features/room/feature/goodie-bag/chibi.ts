import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { GoodieStore } from './goodie-store';

@Component({
  selector: 'app-chibi',

  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.currentQuestion(); as q) {
      <div class="chibi-card">
        <p class="chibi-question">{{ q.question }}</p>
        <div class="chibi-options">
          @for (opt of q.options; track $index) {
            <button class="option-btn" (click)="onOption($index)">{{ opt }}</button>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: contents; }

    .chibi-card {
      padding: var(--space-3);
      background: var(--color-card);
      border-radius: var(--radius-xl);
      border: 1px solid var(--color-border);
    }
    .chibi-question {
      font-size: var(--text-sm);
      color: var(--color-text);
      margin: 0 0 var(--space-2);
    }
    .chibi-options {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }
    .option-btn {
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border);
      background: var(--color-neutral-50);
      color: var(--color-text);
      font-size: var(--text-sm);
      cursor: pointer;
      text-align: left;
      transition: background-color 0.15s;
    }
    :host-context(.dark) .option-btn {
      background: var(--color-neutral-800);
      border-color: var(--color-neutral-700);
      color: var(--color-neutral-100);
    }
    .option-btn:hover {
      background: var(--color-primary-50);
    }
    :host-context(.dark) .option-btn:hover {
      background: var(--color-primary-900);
    }
    .option-btn:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }
  `]
})
export class ChibiComponent {
  readonly store = inject(GoodieStore);

  onOption(index: number): void {
  }
}