import { Component, ChangeDetectionStrategy, input, output, signal, computed } from '@angular/core';
import { getStarterComments } from './starter-comments.util';

@Component({
  selector: 'app-starter-comments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="starter-comments" role="group" aria-label="Suggested messages">
      @for (phrase of phrases(); track phrase) {
        <button
          type="button"
          class="starter-chip"
          [disabled]="sending() || disabled()"
          (click)="onPick(phrase)"
        >{{ phrase }}</button>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      flex-shrink: 0;
    }
    .starter-comments {
      display: flex;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      overflow-x: auto;
      overscroll-behavior-x: contain;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    .starter-comments::-webkit-scrollbar { display: none; }

    .starter-chip {
      flex-shrink: 0;
      white-space: nowrap;
      padding: 6px var(--space-3);
      border-radius: var(--radius-full);
      border: 1px solid var(--color-border);
      background: var(--color-card);
      color: var(--color-primary-text);
      font-size: var(--text-xs);
      font-weight: var(--font-medium);
      cursor: pointer;
    }
    :host-context(.dark) .starter-chip { color: var(--color-primary-300); }
    .starter-chip:disabled { opacity: 0.5; cursor: default; }
    .starter-chip:active:not(:disabled) { transform: scale(0.96); }
    .starter-chip:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
  `],
})
export class StarterCommentsComponent {
  readonly langId = input<number>(1);
  readonly disabled = input(false);
  readonly pick = output<string>();

  protected readonly phrases = computed(() => getStarterComments(this.langId()));
  protected readonly sending = signal(false);

  onPick(phrase: string): void {
    if (this.sending() || this.disabled()) return;
    this.sending.set(true);
    this.pick.emit(phrase);
  }
}
