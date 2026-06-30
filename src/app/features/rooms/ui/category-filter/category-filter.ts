import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { Category } from '../../data/rooms-model';

const PALETTES = [
  { bg: 'var(--color-primary-100)', color: 'var(--color-primary-700)', dot: 'var(--color-primary-500)' },
  { bg: 'var(--color-accent-100)', color: 'var(--color-accent-700)', dot: 'var(--color-accent-500)' },
  { bg: 'var(--color-warm-100)', color: 'var(--color-warm-700)', dot: 'var(--color-warm-500)' },
  { bg: 'var(--color-gold-100)', color: 'var(--color-gold-700)', dot: 'var(--color-gold-500)' },
  { bg: 'var(--color-primary-50)', color: 'var(--color-primary-600)', dot: 'var(--color-primary-400)' },
  { bg: 'var(--color-accent-50)', color: 'var(--color-accent-600)', dot: 'var(--color-accent-400)' },
] as const;

@Component({
  selector: 'app-category-filter',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="category-filter" aria-label="Filter rooms by category">
      <div class="pill-scroll">
                <button
          type="button"
          class="pill pill-all"
          [class.active]="selectedId() === null"
          (click)="selectCategory(null)"
          [attr.aria-pressed]="selectedId() === null"
        >
          <span class="dot dot-all"></span>
          All
        </button>

                @for (category of categories(); track category.id; let i = $index) {
          <button
            type="button"
            class="pill"
            [class.active]="selectedId() === category.id"
            [style.--cat-bg]="getPalette(i).bg"
            [style.--cat-color]="getPalette(i).color"
            [style.--cat-dot]="getPalette(i).dot"
            (click)="selectCategory(category.id)"
            [attr.aria-pressed]="selectedId() === category.id"
          >
            <span class="dot" [style.background]="getPalette(i).dot"></span>
            {{ category.name }}
          </button>
        }
      </div>
    </nav>
  `,
  styles: [`
    .category-filter { width: 100%; }

    .pill-scroll {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      overflow-x: auto;
      padding: var(--space-1) 0;
      scrollbar-width: none;
    }
    .pill-scroll::-webkit-scrollbar { display: none; }

    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: var(--radius-full);
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
      border: 1.5px solid var(--color-border);
      background: var(--color-card);
      color: var(--color-text-muted);
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .pill:hover {
      border-color: var(--cat-bg, var(--color-primary-300));
      color: var(--cat-color, var(--color-primary-600));
      background: var(--cat-bg, var(--color-primary-50));
    }

    .pill:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }

    .pill.active {
      border-color: var(--cat-dot, var(--color-primary-400));
      background: var(--cat-bg, var(--color-primary-50));
      color: var(--cat-color, var(--color-primary-700));
      font-weight: 600;
    }

    .pill.active:hover {
      transform: none;
    }

    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
      background: var(--cat-dot, var(--color-primary-400));
      opacity: 0.7;
    }

    .pill.active .dot {
      opacity: 1;
    }

        .pill-all .dot-all {
      background: linear-gradient(135deg, var(--color-primary-400), var(--color-accent-400));
    }
    .pill-all.active .dot-all {
      background: linear-gradient(135deg, var(--color-primary-500), var(--color-accent-500));
    }

    :host-context(.dark) {
      .pill {
        background: var(--color-neutral-800);
        border-color: var(--color-neutral-700);
        color: var(--color-neutral-300);
      }

      .pill:hover {
        background: var(--cat-bg, var(--color-neutral-700));
        color: var(--cat-color, var(--color-primary-300));
      }

      .pill.active {
        background: var(--cat-bg, var(--color-primary-900));
        color: var(--cat-color, var(--color-primary-200));
      }

      .pill-all .dot-all {
        background: linear-gradient(135deg, var(--color-primary-600), var(--color-accent-600));
      }

      .pill-all.active .dot-all {
        background: linear-gradient(135deg, var(--color-primary-500), var(--color-accent-500));
      }
    }
  `]
})
export class CategoryFilterComponent {
  readonly categories = input<readonly Category[]>([]);
  readonly selectedId = input<number | null>(null);
  readonly categoryChange = output<number | null>();

  getPalette(index: number) {
    return PALETTES[index % PALETTES.length]!;
  }

  selectCategory(categoryId: number | null): void {
    if (categoryId !== this.selectedId()) {
      this.categoryChange.emit(categoryId);
    }
  }
}
