import { Component, ChangeDetectionStrategy, input, model, ViewEncapsulation } from '@angular/core';
import { LucideSearch, LucideX } from '@lucide/angular';

@Component({
  selector: 'app-search-bar',

  imports: [LucideSearch, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="search-bar">
      <svg aria-hidden="true" lucideSearch [size]="14" class="search-icon"></svg>
      <input
        type="search"
        class="search-input"
        [placeholder]="placeholder()"
        [value]="value()"
        (input)="onInput($event)"
        (keydown.escape)="clearSearch()"
        aria-label="Search rooms"
      />
      @if (value()) {
        <button
          type="button"
          class="search-clear"
          (click)="clearSearch()"
          aria-label="Clear search"
        >
          <svg aria-hidden="true" lucideX [size]="12"></svg>
        </button>
      }
    </div>
  `,
  styles: [`
    .search-bar {
      position: relative;
      flex: 1;
      min-width: 240px;
      max-width: 400px;
    }

    .search-icon {
      position: absolute;
      left: var(--space-3);
      top: 50%;
      transform: translateY(-50%);
      color: var(--color-text-muted);
      pointer-events: none;
    }

    .search-input {
      width: 100%;
      height: 36px;
      padding: 0 var(--space-3) 0 calc(var(--space-3) + 20px);
      border: none;
      border-radius: var(--radius-lg);
      background-color: var(--color-neutral-100);
      color: var(--color-text);
      font-size: var(--text-xs);
      transition: all 0.15s ease;
    }

    .search-input::placeholder {
      color: var(--color-text-muted);
    }

    .search-input:focus-visible {
      outline: none;
      box-shadow: 0 0 0 2px var(--color-primary-400);
    }

        .search-input::-webkit-search-cancel-button,
    .search-input::-webkit-search-decoration {
      display: none;
    }

    :host-context(.dark) {
      .search-input {
        background-color: var(--color-neutral-800);
        color: var(--color-neutral-100);
      }

      .search-input::placeholder {
        color: var(--color-neutral-500);
      }

      .search-icon {
        color: var(--color-neutral-500);
      }

      .search-input:focus-visible {
        box-shadow: 0 0 0 2px var(--color-primary-300);
      }

      .search-clear {
        background-color: var(--color-neutral-700);
        color: var(--color-neutral-400);
      }

      .search-clear:hover {
        background-color: var(--color-neutral-500);
        color: var(--color-neutral-100);
      }
    }

    .search-clear {
      position: absolute;
      right: var(--space-2);
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      padding: 0;
      border: none;
      border-radius: var(--radius-full);
      background-color: var(--color-neutral-200);
      color: var(--color-text-muted);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .search-clear:hover {
      background-color: var(--color-neutral-300);
      color: var(--color-text);
    }

    .search-clear:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }
  `]
})
export class SearchBarComponent {
  readonly placeholder = input<string>('Search rooms...');
  readonly value = model<string>('');

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.value.set(input.value);
  }

  clearSearch(): void {
    this.value.set('');
  }
}
