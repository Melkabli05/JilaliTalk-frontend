import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  input,
  model,
  signal,
  computed,
  viewChild,
  viewChildren,
} from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';
import { FormValueControl } from '@angular/forms/signals';
import { LANGUAGES, getLanguageById } from '@shared/data/languages';
import { LucideChevronDown, LucideSearch, LucideCheck, LucideX } from '@lucide/angular';

@Component({
  selector: 'app-language-select',
  imports: [OverlayModule, LucideChevronDown, LucideSearch, LucideCheck, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="select-trigger"
      cdkOverlayOrigin
      #trigger="cdkOverlayOrigin"
      #triggerEl
      [id]="id()"
      [disabled]="disabled()"
      (click)="toggle()"
      [attr.aria-expanded]="isOpen()"
      aria-haspopup="listbox"
    >
      @if (selected(); as lang) {
        <img class="flag-icon" [src]="'https://flagcdn.com/w20/' + lang.countryCode + '.png'" [alt]="''" loading="lazy" />
        <span class="select-value">{{ lang.name }}</span>
      } @else {
        <span class="select-value placeholder">Select a language</span>
      }
      <svg aria-hidden="true" lucideChevronDown [size]="14" class="chevron" [class.rotated]="isOpen()" />
    </button>

    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="trigger"
      [cdkConnectedOverlayOpen]="isOpen()"
      [cdkConnectedOverlayHasBackdrop]="true"
      cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
      [cdkConnectedOverlayOffsetY]="4"
      [cdkConnectedOverlayWidth]="triggerWidth()"
      (backdropClick)="close()"
      (detach)="close()"
      (overlayKeydown)="onOverlayKeydown($event)"
    >
      <div class="lang-dropdown">
        <div class="lang-search">
          <svg aria-hidden="true" lucideSearch [size]="11" class="search-icon" />
          <input
            type="text"
            class="lang-search-input"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="lang-select-listbox"
            aria-expanded="true"
            [attr.aria-activedescendant]="activeDescendantId()"
            placeholder="Search language..."
            [value]="query()"
            (input)="onSearchInput($event)"
            (keydown.escape)="close()"
            (keydown.arrowDown)="moveFocus(1, $event)"
            (keydown.arrowUp)="moveFocus(-1, $event)"
            (keydown.enter)="confirmSelection($event)"
            aria-label="Search languages"
          />
          @if (query()) {
            <button type="button" class="search-clear" aria-label="Clear search" (click)="clearSearch($event)">
              <svg aria-hidden="true" lucideX [size]="10" />
            </button>
          }
        </div>

        @if (query() && filtered().length === 0) {
          <p class="lang-empty">No languages match "{{ query() }}"</p>
        } @else {
          <div class="lang-options" id="lang-select-listbox" role="listbox" aria-label="Language">
            @for (lang of filtered(); track lang.id; let i = $index) {
              <button
                type="button"
                [id]="'lang-select-opt-' + i"
                class="lang-option"
                [class.selected]="value() === lang.id"
                [class.focused]="focusedIndex() === i"
                role="option"
                [attr.aria-selected]="value() === lang.id"
                (click)="select(lang.id)"
                (mouseenter)="focusedIndex.set(i)"
                #option
              >
                <img class="flag-icon-sm" [src]="'https://flagcdn.com/w20/' + lang.countryCode + '.png'" [alt]="''" loading="lazy" />
                <span class="lang-option-name">{{ lang.name }}</span>
                @if (value() === lang.id) {
                  <svg aria-hidden="true" lucideCheck [size]="14" class="check-icon" />
                }
              </button>
            }
          </div>
        }
      </div>
    </ng-template>
  `,
  styles: [`
    :host { display: block; }

    .select-trigger {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      width: 100%;
      height: 36px;
      padding: 0 var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background-color: var(--color-card);
      color: var(--color-text);
      font-size: var(--text-sm);
      text-align: left;
      cursor: pointer;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .select-trigger:hover { border-color: var(--color-neutral-300); }
    .select-trigger:focus-visible {
      outline: none;
      border-color: var(--color-primary-500);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary-500) 10%, transparent);
    }
    .select-trigger:disabled { opacity: 0.5; cursor: not-allowed; }
    :host-context(.dark) .select-trigger:hover { border-color: var(--color-neutral-600); }

    .select-value {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .select-value.placeholder { color: var(--color-text-muted); }

    .flag-icon { width: 18px; height: 13px; border-radius: 2px; object-fit: cover; flex-shrink: 0; }
    .chevron { color: var(--color-text-muted); transition: transform 0.2s ease; flex-shrink: 0; }
    .chevron.rotated { transform: rotate(180deg); }

    .lang-dropdown {
      background-color: var(--color-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-dropdown);
      overflow: hidden;
      animation: langSelectFadeIn 0.15s ease;
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
    :host-context(.dark) .lang-search-input { background-color: var(--color-neutral-800); color: var(--color-neutral-200); }
    :host-context(.dark) .lang-search-input::placeholder { color: var(--color-neutral-500); }

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
      border: none;
      border-radius: var(--radius-sm);
      background-color: var(--color-neutral-200);
      color: var(--color-text-muted);
      cursor: pointer;
      padding: 0;
      transition: background-color 0.1s ease, color 0.1s ease;
    }
    .search-clear:hover { background-color: var(--color-neutral-300); color: var(--color-text); }
    :host-context(.dark) .search-clear { background-color: var(--color-neutral-700); color: var(--color-neutral-300); }
    :host-context(.dark) .search-clear:hover { background-color: var(--color-neutral-600); }

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
    .lang-option.selected { color: var(--color-primary-600); background-color: var(--color-primary-50); font-weight: var(--font-medium); }
    .lang-option.focused { background-color: var(--color-neutral-50); }
    .lang-option.selected.focused { background-color: var(--color-primary-50); }
    :host-context(.dark) .lang-option { color: var(--color-neutral-300); }
    :host-context(.dark) .lang-option:hover { background-color: var(--color-neutral-800); color: var(--color-neutral-100); }
    :host-context(.dark) .lang-option.selected { background-color: var(--color-primary-900); color: var(--color-primary-300); }
    :host-context(.dark) .lang-option.focused { background-color: var(--color-neutral-800); }

    .lang-option-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .check-icon { color: var(--color-primary-600); flex-shrink: 0; }
    :host-context(.dark) .check-icon { color: var(--color-primary-300); }

    .flag-icon-sm { width: 20px; height: 14px; border-radius: 2px; object-fit: cover; flex-shrink: 0; }
    .lang-empty { padding: var(--space-4) var(--space-3); text-align: center; color: var(--color-text-muted); font-size: var(--text-xs); }
  `],
})
export class LanguageSelectComponent implements FormValueControl<number> {
  readonly value = model<number>(LANGUAGES[0]?.id ?? 1);
  readonly disabled = input<boolean>(false);
  readonly id = input<string>('');

  private readonly triggerEl = viewChild<ElementRef<HTMLElement>>('triggerEl');
  private readonly optionEls = viewChildren<ElementRef<HTMLElement>>('option');

  readonly isOpen = signal(false);
  readonly query = signal('');
  readonly focusedIndex = signal(-1);
  readonly triggerWidth = signal<number>(240);

  readonly selected = computed(() => getLanguageById(this.value()));

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter((l) => l.name.toLowerCase().includes(q));
  });

  readonly activeDescendantId = computed(() =>
    this.focusedIndex() >= 0 ? `lang-select-opt-${this.focusedIndex()}` : undefined,
  );

  toggle(): void {
    if (this.disabled()) return;
    this.isOpen.update((open) => !open);
    if (this.isOpen()) {
      this.triggerWidth.set(this.triggerEl()?.nativeElement.offsetWidth ?? 240);
      this.query.set('');
      this.focusedIndex.set(Math.max(0, LANGUAGES.findIndex((l) => l.id === this.value())));
    }
  }

  close(): void {
    this.isOpen.set(false);
    this.query.set('');
    this.focusedIndex.set(-1);
  }

  onSearchInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.focusedIndex.set(0);
  }

  clearSearch(event: Event): void {
    event.stopPropagation();
    this.query.set('');
    this.focusedIndex.set(0);
  }

  onOverlayKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.close();
  }

  select(langId: number): void {
    this.value.set(langId);
    this.close();
  }

  moveFocus(delta: number, event: Event): void {
    event.preventDefault();
    const items = this.filtered();
    const next = Math.max(0, Math.min(items.length - 1, this.focusedIndex() + delta));
    this.focusedIndex.set(next);
    this.optionEls()[next]?.nativeElement.scrollIntoView({ block: 'nearest' });
  }

  confirmSelection(event: Event): void {
    event.preventDefault();
    const lang = this.filtered()[this.focusedIndex()];
    if (lang) this.select(lang.id);
  }
}
