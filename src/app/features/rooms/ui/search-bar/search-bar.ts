import { Component, ChangeDetectionStrategy, input, model, signal } from '@angular/core';
import { LucideSearch, LucideX } from '@lucide/angular';

@Component({
  selector: 'app-search-bar',
  imports: [LucideSearch, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="search" [class.focused]="focused()" [class.has-value]="!!value()">
      <svg aria-hidden="true" lucideSearch [size]="14" class="search-icon"></svg>
      <input
        class="search-input"
        type="search"
        [placeholder]="placeholder()"
        [value]="value()"
        (input)="onInput($event)"
        (focus)="focused.set(true)"
        (blur)="focused.set(false)"
        (keydown.escape)="clear()"
        [attr.aria-label]="placeholder()"
      />
      @if (value()) {
        <button
          type="button"
          class="search-clear"
          (mousedown)="$event.preventDefault()"
          (click)="clear()"
          aria-label="Clear search"
        >
          <svg aria-hidden="true" lucideX [size]="10"></svg>
        </button>
      }
    </div>
  `,
  styles: [`
    :host { display: block; flex: 1; min-width: 0; }

    /* ── Wrapper ──────────────────────────────────────── */
    .search {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      height: 36px;
      padding: 0 var(--space-2) 0 var(--space-3);
      border-radius: var(--radius-full);
      background: var(--color-neutral-100);
      border: 1.5px solid var(--color-border);
      box-shadow: inset 0 1px 2px hsl(0deg 0% 0% / 4%);
      transition:
        background-color 0.15s ease,
        border-color 0.15s ease,
        box-shadow 0.15s ease;
    }

    .search:hover:not(.focused) {
      border-color: var(--color-neutral-300);
    }

    .search.focused {
      background: var(--color-card);
      border-color: var(--color-primary-400);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary-500) 12%, transparent);
    }

    /* ── Icon ─────────────────────────────────────────── */
    .search-icon {
      flex-shrink: 0;
      color: var(--color-text-muted);
      transition: color 0.15s ease;
      pointer-events: none;
    }

    .search.focused .search-icon {
      color: var(--color-primary-400);
    }

    /* ── Input ────────────────────────────────────────── */
    .search-input {
      flex: 1;
      min-width: 0;
      border: none;
      background: transparent;
      color: var(--color-text);
      font-size: var(--text-sm);
      line-height: 1;
      outline: none;
    }

    .search-input::placeholder {
      color: var(--color-text-muted);
    }

    .search-input::-webkit-search-cancel-button,
    .search-input::-webkit-search-decoration {
      display: none;
    }

    /* ── Clear button ─────────────────────────────────── */
    .search-clear {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 18px;
      height: 18px;
      padding: 0;
      border: none;
      border-radius: var(--radius-full);
      background: var(--color-neutral-400);
      color: var(--color-on-color);
      cursor: pointer;
      transition: background-color 0.15s ease, transform 0.1s ease;
    }

    .search-clear:hover {
      background: var(--color-neutral-500);
      transform: scale(1.1);
    }

    .search-clear:active {
      transform: scale(0.92);
    }

    .search-clear:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }

    /* ── Dark mode ────────────────────────────────────── */
    :host-context(.dark) .search {
      background: var(--color-neutral-900);
      border-color: var(--color-neutral-700);
      box-shadow: none;
    }

    :host-context(.dark) .search:hover:not(.focused) {
      border-color: var(--color-neutral-600);
    }

    :host-context(.dark) .search.focused {
      background: var(--color-neutral-800);
      border-color: var(--color-primary-400);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary-500) 20%, transparent);
    }

    :host-context(.dark) .search.focused .search-icon {
      color: var(--color-primary-300);
    }

    :host-context(.dark) .search-input {
      color: var(--color-neutral-100);
    }

    :host-context(.dark) .search-input::placeholder {
      color: var(--color-neutral-500);
    }

    :host-context(.dark) .search-icon {
      color: var(--color-neutral-500);
    }

    :host-context(.dark) .search-clear {
      background: var(--color-neutral-600);
    }

    :host-context(.dark) .search-clear:hover {
      background: var(--color-neutral-500);
    }

    /* ── Reduced motion ───────────────────────────────── */
    @media (prefers-reduced-motion: reduce) {
      .search,
      .search-icon,
      .search-clear { transition: none; }
    }
  `],
})
export class SearchBarComponent {
  readonly placeholder = input<string>('Search rooms…');
  readonly value = model<string>('');

  protected readonly focused = signal(false);

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }

  protected clear(): void {
    this.value.set('');
  }
}
