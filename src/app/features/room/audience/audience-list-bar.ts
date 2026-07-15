import { Component, ChangeDetectionStrategy, input, output, viewChild, ElementRef, effect } from '@angular/core';
import { LucideSearch, LucideX, LucideLayoutGrid, LucideList, LucideChevronDown } from '@lucide/angular';
import { ViewMode } from './audience-list-shared';

/**
 * Pure presentational toolbar — title/count, search toggle + input, grid/list
 * view toggle, collapse button. Owns no state of its own beyond focusing the
 * search input when showSearch flips true (it owns that DOM element, so it's
 * the natural place for that one piece of local behavior); everything else is
 * inputs down / outputs up, orchestrated by the parent AudienceListComponent.
 */
@Component({
  selector: 'app-audience-list-bar',
  imports: [LucideSearch, LucideX, LucideLayoutGrid, LucideList, LucideChevronDown],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="audience-header">
      <div class="header-left">
        <span class="audience-title">Audience</span>
        <span class="audience-count">
          @if (searchQuery()) {
            {{ filteredCount() }} of {{ totalCount() }}
          } @else {
            {{ filteredCount() }}
          }
          {{ filteredCount() === 1 ? 'listener' : 'listeners' }}
        </span>
      </div>
      <div class="header-right">
        @if (!collapsed()) {
          <button
            class="tool-btn"
            [class.active]="showSearch()"
            (click)="toggleSearch.emit()"
            [attr.aria-label]="showSearch() ? 'Close search' : 'Search audience'"
          >
            @if (showSearch()) {
              <svg aria-hidden="true" lucideX [size]="12"></svg>
            } @else {
              <svg aria-hidden="true" lucideSearch [size]="12"></svg>
            }
          </button>
          <div class="view-toggle">
            <button
              class="toggle-btn"
              [class.active]="viewMode() === 'grid'"
              [attr.aria-pressed]="viewMode() === 'grid'"
              (click)="viewModeChange.emit('grid')"
              aria-label="Grid view"
            >
              <svg aria-hidden="true" lucideLayoutGrid [size]="11"></svg>
            </button>
            <button
              class="toggle-btn"
              [class.active]="viewMode() === 'list'"
              [attr.aria-pressed]="viewMode() === 'list'"
              (click)="viewModeChange.emit('list')"
              aria-label="List view"
            >
              <svg aria-hidden="true" lucideList [size]="11"></svg>
            </button>
          </div>
        }
        <button
          class="tool-btn collapse-btn"
          [class.collapsed]="collapsed()"
          (click)="toggleCollapsed.emit()"
          [attr.aria-expanded]="!collapsed()"
          [attr.aria-label]="collapsed() ? 'Expand audience list' : 'Collapse audience list'"
        >
          <svg aria-hidden="true" lucideChevronDown [size]="14"></svg>
        </button>
      </div>
    </div>

    @if (showSearch()) {
      <div class="search-row">
        <div class="search-box">
          <svg aria-hidden="true" lucideSearch [size]="13" class="search-icon"></svg>
          <input
            #searchInput
            class="search-input"
            type="search"
            inputmode="search"
            enterkeyhint="search"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            placeholder="Search by name or language..."
            [value]="searchQuery()"
            (input)="onSearchInput($event)"
            (keydown.escape)="searchEscape.emit()"
            aria-label="Search audience members"
          />
          @if (searchQuery()) {
            <button class="search-clear-btn" type="button" (click)="clearSearch.emit()" aria-label="Clear search">
              <svg aria-hidden="true" lucideX [size]="11"></svg>
            </button>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .audience-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-2) var(--space-3);
      border-bottom: 1px solid var(--color-border);
      flex-shrink: 0;
    }

    .header-left,
    .header-right {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .header-right {
      gap: var(--space-1);
    }

    .audience-title {
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-text);
    }

    .audience-count {
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      padding: 1px 6px;
      border-radius: var(--radius-full);
      background: var(--color-neutral-100);
    }

    .tool-btn {
      /* Mobile-first: 44px meets WCAG 2.5.5 AAA minimum tap target */
      width: var(--touch-target-min);
      height: var(--touch-target-min);
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--color-text-muted);
      transition: background 0.15s, color 0.15s;
    }

    .tool-btn:hover,
    .tool-btn.active {
      background: var(--color-neutral-100);
      color: var(--color-text);
    }

    /* Haptic-style active feedback for touch — keeps it in base so it
       also works on pointer devices as a click affordance. */
    .tool-btn:active:not(.active):not(:disabled) {
      background: var(--color-neutral-200);
      transform: scale(0.92);
    }

    .collapse-btn svg {
      transition: transform 0.15s;
    }

    .collapse-btn.collapsed svg {
      transform: rotate(-90deg);
    }

    .view-toggle {
      display: flex;
      background: var(--color-neutral-100);
      border-radius: var(--radius-sm);
      padding: 2px;
      gap: var(--space-1);
    }

    .toggle-btn {
      /* Mobile-first: 44px tap target */
      width: var(--touch-target-min);
      height: var(--touch-target-min);
      border-radius: 4px;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      cursor: pointer;
      color: var(--color-text-muted);
      transition: background 0.15s, color 0.15s;
    }

    .toggle-btn.active {
      background: var(--color-card);
      color: var(--color-primary-text);
    }

    .toggle-btn:active:not(.active) {
      background: var(--color-neutral-200);
    }

    .search-row {
      padding: var(--space-1) var(--space-3);
      border-bottom: 1px solid var(--color-border);
    }

    .search-box {
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-icon {
      position: absolute;
      left: var(--space-2);
      color: var(--color-text-muted);
      pointer-events: none;
    }

    .search-input {
      width: 100%;
      /* Mobile-first: 16px prevents iOS Safari from auto-zooming on focus.
         Desktop reduces this to var(--text-xs) via the min-width query below. */
      padding: 10px 32px;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border);
      background: var(--color-neutral-50);
      font-size: var(--text-base);
      color: var(--color-text);
      outline: none;
    }

    .search-input:focus {
      border-color: var(--color-primary-400);
    }

    .search-input::placeholder {
      color: var(--color-text-muted);
    }

    .search-input:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }

    .search-clear-btn {
      position: absolute;
      right: 4px;
      /* Mobile-first: 32px — easier to tap than the desktop 20px */
      width: 32px;
      height: 32px;
      border-radius: var(--radius-full);
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--color-text-muted);
      transition: background 0.15s, color 0.15s;
    }

    .search-clear-btn:hover {
      background: var(--color-neutral-100);
      color: var(--color-text);
    }

    .search-clear-btn:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }

    /* Desktop: scale controls down now that precise pointer input is available */
    @media (min-width: 1024px) {
      .search-input {
        font-size: var(--text-xs);
        padding: var(--space-1) 28px;
      }

      .tool-btn {
        width: var(--icon-btn-size);
        height: var(--icon-btn-size);
      }

      .tool-btn:active:not(.active):not(:disabled) {
        transform: none;
      }

      .toggle-btn {
        width: 26px;
        height: 26px;
      }

      .search-clear-btn {
        width: 20px;
        height: 20px;
      }
    }

    /* Dark mode */
    :host-context(.dark) {
      .audience-count {
        background: var(--color-neutral-700);
        color: var(--color-neutral-400);
      }

      .tool-btn {
        color: var(--color-neutral-400);
      }

      .tool-btn:hover,
      .tool-btn.active {
        background: var(--color-neutral-700);
        color: var(--color-neutral-100);
      }

      .view-toggle {
        background: var(--color-neutral-800);
      }

      .toggle-btn.active {
        background: var(--color-neutral-700);
        color: var(--color-primary-300);
      }

      .search-input {
        background: var(--color-neutral-800);
        color: var(--color-neutral-200);
        border-color: var(--color-neutral-700);
      }

      .search-input::placeholder {
        color: var(--color-neutral-500);
      }

      .search-clear-btn:hover {
        background: var(--color-neutral-700);
        color: var(--color-neutral-100);
      }
    }
  `],
})
export class AudienceListBarComponent {
  readonly totalCount = input.required<number>();
  readonly filteredCount = input.required<number>();
  readonly searchQuery = input.required<string>();
  readonly showSearch = input.required<boolean>();
  readonly viewMode = input.required<ViewMode>();
  readonly collapsed = input.required<boolean>();

  readonly toggleSearch = output<void>();
  readonly viewModeChange = output<ViewMode>();
  readonly toggleCollapsed = output<void>();
  readonly searchInputChange = output<string>();
  readonly searchEscape = output<void>();
  readonly clearSearch = output<void>();

  private readonly searchInputRef = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  constructor() {
    effect(() => {
      if (this.showSearch()) {
        this.searchInputRef()?.nativeElement.focus();
      }
    });
  }

  onSearchInput(event: Event): void {
    this.searchInputChange.emit((event.target as HTMLInputElement).value);
  }
}
