import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  input,
  output,
  signal,
  computed,
  viewChildren,
} from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';
import { LANGUAGES, getLanguageById } from '@shared/data/languages';
import { LucideGlobe, LucideSearch, LucideChevronDown, LucideX } from '@lucide/angular';

@Component({
  selector: 'app-language-filter',
  imports: [OverlayModule, LucideGlobe, LucideSearch, LucideChevronDown, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="language-filter">
      <button
        type="button"
        class="lang-trigger"
        cdkOverlayOrigin
        #trigger="cdkOverlayOrigin"
        [class.active]="selectedId() !== null"
        (click)="toggleDropdown()"
        [attr.aria-expanded]="isOpen()"
        aria-haspopup="listbox"
        aria-label="Filter by language"
      >
        @if (selectedId() !== null) {
          <img class="flag-icon" [src]="flagUrl()" [alt]="selectedLanguage()?.name ?? ''" loading="lazy" />
        } @else {
          <svg aria-hidden="true" lucideGlobe [size]="14"></svg>
        }
        <span class="lang-name">{{ selectedLanguage()?.name ?? 'All languages' }}</span>
        <svg aria-hidden="true" lucideChevronDown [size]="12" class="chevron" [class.rotated]="isOpen()"></svg>
      </button>

      <ng-template
        cdkConnectedOverlay
        [cdkConnectedOverlayOrigin]="trigger"
        [cdkConnectedOverlayOpen]="isOpen()"
        [cdkConnectedOverlayHasBackdrop]="true"
        cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
        [cdkConnectedOverlayOffsetY]="4"
        (backdropClick)="close()"
        (detach)="close()"
        (overlayKeydown)="onOverlayKeydown($event)"
      >
        <div class="lang-dropdown">
          <div class="lang-search">
            <svg aria-hidden="true" lucideSearch [size]="11" class="search-icon"></svg>
            <input
              type="text"
              class="lang-search-input"
              role="combobox"
              aria-autocomplete="list"
              aria-controls="lang-listbox"
              aria-expanded="true"
              [attr.aria-activedescendant]="activeDescendantId()"
              placeholder="Search language..."
              [value]="searchQuery()"
              (input)="onSearchInput($event)"
              (keydown.escape)="close()"
              (keydown.arrowDown)="moveFocus(1, $event)"
              (keydown.arrowUp)="moveFocus(-1, $event)"
              (keydown.enter)="confirmSelection($event)"
              aria-label="Search languages"
            />
            @if (searchQuery()) {
              <button
                type="button"
                class="search-clear"
                aria-label="Clear search"
                (click)="clearSearch($event)"
              >
                <svg aria-hidden="true" lucideX [size]="10"></svg>
              </button>
            }
          </div>

          @if (searchQuery() && filteredLanguages().length === 0) {
            <p class="lang-empty">No languages match "{{ searchQuery() }}"</p>
          } @else {
            <div class="lang-options" id="lang-listbox" role="listbox" aria-label="Select language">
              <button
                type="button"
                id="lang-opt--1"
                class="lang-option"
                [class.selected]="selectedId() === null"
                [class.focused]="focusedIndex() === -1"
                role="option"
                [attr.aria-selected]="selectedId() === null"
                (click)="selectLanguage(null)"
                (mouseenter)="setFocusedIndex(-1)"
                #option
              >
                <svg aria-hidden="true" lucideGlobe [size]="12"></svg>
                All
                @if (searchQuery()) {
                  <span class="lang-option-count">{{ LANGUAGES.length }}</span>
                }
              </button>

              @for (lang of filteredLanguages(); track lang.id; let i = $index) {
                <button
                  type="button"
                  [id]="'lang-opt-' + i"
                  class="lang-option"
                  [class.selected]="selectedId() === lang.id"
                  [class.focused]="focusedIndex() === i"
                  role="option"
                  [attr.aria-selected]="selectedId() === lang.id"
                  (click)="selectLanguage(lang.id)"
                  (mouseenter)="setFocusedIndex(i)"
                  #option
                >
                  <img
                    class="flag-icon-sm"
                    [src]="'https://flagcdn.com/w20/' + lang.countryCode + '.png'"
                    [alt]="lang.name"
                    loading="lazy"
                  />
                  {{ lang.name }}
                </button>
              }
            </div>
          }
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    .language-filter { position: relative; }
    .lang-trigger {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      height: 40px;
      border: none;
      border-radius: var(--radius-xl);
      background-color: var(--color-neutral-100);
      color: var(--color-text-secondary);
      font-size: var(--text-xs);
      cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
      white-space: nowrap;
    }
    .lang-trigger:hover { color: var(--color-text); background-color: var(--color-neutral-200); }
    .lang-trigger:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
    .lang-trigger.active {
      background-color: var(--color-primary-50);
      color: var(--color-primary-600);
      box-shadow: 0 0 0 1px var(--color-primary-200);
    }
    .flag-icon { width: 18px; height: 13px; border-radius: 3px; object-fit: cover; flex-shrink: 0; }
    .lang-name { max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .chevron { transition: transform 0.2s ease; flex-shrink: 0; }
    .chevron.rotated { transform: rotate(180deg); }
    .lang-dropdown {
      width: 240px;
      background-color: var(--color-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-dropdown);
      overflow: hidden;
      animation: fadeIn 0.15s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .lang-search { position: relative; padding: var(--space-2); border-bottom: 1px solid var(--color-border); }
    .search-icon {
      position: absolute;
      left: calc(var(--space-2) + var(--space-2));
      top: 50%;
      transform: translateY(-50%);
      color: var(--color-text-muted);
      pointer-events: none;
    }
    .lang-search-input {
      width: 100%;
      height: 36px;
      padding: 0 var(--space-2) 0 calc(var(--space-2) + 18px);
      border: none;
      border-radius: var(--radius-md);
      background-color: var(--color-neutral-100);
      color: var(--color-text);
      font-size: var(--text-xs);
      outline: none;
      box-sizing: border-box;
    }
    .lang-search-input::placeholder { color: var(--color-text-muted); }
    .lang-search-input:focus { box-shadow: 0 0 0 1px var(--color-primary-300); }
    .lang-options {
      max-height: 208px;
      overflow-y: auto;
      padding: var(--space-1) 0;
      scrollbar-width: thin;
      scrollbar-color: var(--color-neutral-300) transparent;
    }
    .lang-options::-webkit-scrollbar { width: 4px; }
    .lang-options::-webkit-scrollbar-thumb { background-color: var(--color-neutral-300); border-radius: 2px; }
    .lang-option {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      width: 100%;
      padding: var(--space-2) var(--space-3);
      border: none;
      background: transparent;
      color: var(--color-text-secondary);
      font-size: var(--text-xs);
      text-align: left;
      cursor: pointer;
      transition: background-color 0.1s ease, color 0.1s ease;
    }
    .lang-option:hover { background-color: var(--color-neutral-50); color: var(--color-text); }
    .lang-option:focus-visible { outline: none; background-color: var(--color-neutral-50); }
    .lang-option.selected {
      color: var(--color-primary-600);
      background-color: var(--color-primary-50);
      font-weight: var(--font-medium);
    }
    .lang-option.focused { background-color: var(--color-neutral-50); }
    .lang-option.selected.focused { background-color: var(--color-primary-50); }
    .flag-icon-sm { width: 20px; height: 14px; border-radius: 2px; object-fit: cover; flex-shrink: 0; }
    .lang-empty { padding: var(--space-4) var(--space-3); text-align: center; color: var(--color-text-muted); font-size: var(--text-xs); }
    .lang-option-count {
      margin-left: auto;
      font-size: 10px;
      color: var(--color-text-muted);
    }

    :host-context(.dark) {
      .lang-trigger {
        background-color: var(--color-neutral-800);
        color: var(--color-neutral-300);
      }
      .lang-trigger:hover {
        background-color: var(--color-neutral-700);
        color: var(--color-neutral-100);
      }
      .lang-trigger.active {
        background-color: var(--color-primary-900);
        color: var(--color-primary-300);
        box-shadow: 0 0 0 1px var(--color-primary-700);
      }

      .lang-search-input {
        background-color: var(--color-neutral-800);
        color: var(--color-neutral-200);
      }
      .lang-search-input::placeholder { color: var(--color-neutral-500); }

      .search-clear {
        background-color: var(--color-neutral-700);
        color: var(--color-neutral-300);
      }
      .search-clear:hover { background-color: var(--color-neutral-600); }

      .lang-option { color: var(--color-neutral-300); }
      .lang-option:hover { background-color: var(--color-neutral-800); color: var(--color-neutral-100); }
      .lang-option:focus-visible { background-color: var(--color-neutral-800); }
      .lang-option.selected { background-color: var(--color-primary-900); color: var(--color-primary-300); }
      .lang-option.focused { background-color: var(--color-neutral-800); }
      .lang-option.selected.focused { background-color: var(--color-primary-900); }

      .lang-empty { color: var(--color-neutral-400); }

      .lang-option-count { color: var(--color-neutral-400); }
    }
  `],
})
export class LanguageFilterComponent {
  readonly LANGUAGES = LANGUAGES;

  private readonly optionEls = viewChildren<ElementRef<HTMLElement>>('option');

  readonly selectedId = input<number | null>(null);
  readonly languageChange = output<number | null>();

  readonly isOpen = signal(false);
  readonly searchQuery = signal('');
  readonly focusedIndex = signal(-1);

  readonly selectedLanguage = computed(() => {
    const id = this.selectedId();
    return id !== null ? getLanguageById(id) : null;
  });

  readonly flagUrl = computed(() => {
    const lang = this.selectedLanguage();
    return lang ? `https://flagcdn.com/w40/${lang.countryCode}.png` : '';
  });

  readonly filteredLanguages = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) return LANGUAGES;
    return LANGUAGES.filter((l) => l.name.toLowerCase().includes(query));
  });

  readonly activeDescendantId = computed(() => `lang-opt-${this.focusedIndex()}`);

  onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    this.focusedIndex.set(-1);
  }

  clearSearch(event: Event): void {
    event.stopPropagation();
    this.searchQuery.set('');
    this.focusedIndex.set(-1);
  }

  onOverlayKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.close();
  }

  toggleDropdown(): void {
    this.isOpen.update((v) => !v);
    if (this.isOpen()) {
      this.searchQuery.set('');
      this.focusedIndex.set(-1);
    }
  }

  close(): void {
    this.isOpen.set(false);
    this.searchQuery.set('');
    this.focusedIndex.set(-1);
  }

  selectLanguage(langId: number | null): void {
    this.languageChange.emit(langId);
    this.close();
  }

  setFocusedIndex(index: number): void {
    this.focusedIndex.set(index);
  }

  moveFocus(delta: number, event: Event): void {
    event.preventDefault();
    const items = this.filteredLanguages();
    const next = Math.max(-1, Math.min(items.length - 1, this.focusedIndex() + delta));
    this.focusedIndex.set(next);
    this.scrollFocusedIntoView();
  }

  private scrollFocusedIntoView(): void {
    const els = this.optionEls();
    const el = els[this.focusedIndex() + 1]?.nativeElement;
    el?.scrollIntoView({ block: 'nearest' });
  }

  confirmSelection(event: Event): void {
    event.preventDefault();
    const items = this.filteredLanguages();
    const idx = this.focusedIndex();
    if (idx === -1) {
      this.selectLanguage(null);
    } else if (items[idx]) {
      this.selectLanguage(items[idx].id);
    }
  }
}
