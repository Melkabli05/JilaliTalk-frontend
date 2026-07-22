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

const OPTION_BASE =
  'flex items-center gap-2 w-full py-2 px-3 border-0 bg-transparent text-neutral-600 dark:text-neutral-300 ' +
  'text-xs text-left cursor-pointer transition-colors duration-100 ' +
  'max-lg:py-3 max-lg:px-3 max-lg:text-sm max-lg:min-h-11';

@Component({
  selector: 'app-language-select',
  imports: [OverlayModule, LucideChevronDown, LucideSearch, LucideCheck, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <button
      type="button"
      class="flex items-center gap-2 w-full h-9 px-3 rounded-md text-left cursor-pointer
             border border-neutral-200 dark:border-neutral-700
             bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm
             transition-[border-color,box-shadow] duration-150
             hover:border-neutral-300 dark:hover:border-neutral-600
             focus-visible:outline-none focus-visible:border-blue-500 focus-visible:shadow-[0_0_0_3px_rgb(59_130_246/10%)]
             disabled:opacity-50 disabled:cursor-not-allowed"
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
        <img class="w-[18px] h-[13px] rounded-sm object-cover shrink-0" [src]="'https://flagcdn.com/w20/' + lang.countryCode + '.png'" [alt]="''" loading="lazy" />
        <span class="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{{ lang.name }}</span>
      } @else {
        <span class="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-neutral-500">Select a language</span>
      }
      <svg
        aria-hidden="true"
        lucideChevronDown
        [size]="14"
        class="text-neutral-500 transition-transform duration-200 shrink-0"
        [class.rotate-180]="isOpen()"
      />
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
      <div class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg overflow-hidden animate-[langSelectFadeIn_0.15s_ease] motion-reduce:animate-none">
        <div class="relative p-2 border-b border-neutral-200 dark:border-neutral-700">
          <svg aria-hidden="true" lucideSearch [size]="11" class="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
          <input
            type="search"
            inputmode="search"
            enterkeyhint="search"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            class="w-full h-9 max-lg:h-11 pr-2 pl-[26px] border-0 rounded-md box-border outline-none
                   bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-200
                   text-xs max-lg:text-base
                   placeholder:text-neutral-500
                   focus:shadow-[0_0_0_1px_#93c5fd]
                   [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
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
            <button
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 max-lg:w-8 max-lg:h-8 p-0
                     border-0 rounded-sm bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-300 cursor-pointer
                     transition-colors duration-100
                     hover:bg-neutral-300 hover:text-neutral-900
                     dark:hover:bg-neutral-600"
              aria-label="Clear search"
              (click)="clearSearch($event)"
            >
              <svg aria-hidden="true" lucideX [size]="10" />
            </button>
          }
        </div>

        @if (query() && filtered().length === 0) {
          <p class="py-4 px-3 text-center text-neutral-500 text-xs">No languages match "{{ query() }}"</p>
        } @else {
          <div
            class="max-h-52 overflow-y-auto py-1 [scrollbar-width:thin] [scrollbar-color:#d4d4d4_transparent]
                   [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-neutral-300 [&::-webkit-scrollbar-thumb]:rounded-sm"
            id="lang-select-listbox"
            role="listbox"
            aria-label="Language"
          >
            @for (lang of filtered(); track lang.id; let i = $index) {
              <button
                type="button"
                [id]="'lang-select-opt-' + i"
                [class]="optionClass(lang.id, i)"
                role="option"
                [attr.aria-selected]="value() === lang.id"
                (click)="select(lang.id)"
                (mouseenter)="focusedIndex.set(i)"
                #option
              >
                <img class="w-5 h-3.5 rounded-sm object-cover shrink-0" [src]="'https://flagcdn.com/w20/' + lang.countryCode + '.png'" [alt]="''" loading="lazy" />
                <span class="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{{ lang.name }}</span>
                @if (value() === lang.id) {
                  <svg aria-hidden="true" lucideCheck [size]="14" class="shrink-0 text-blue-600 dark:text-blue-300" />
                }
              </button>
            }
          </div>
        }
      </div>
    </ng-template>
  `,
  /** The two entrance/selection keyframes are genuine motion design, no Tailwind built-in
   *  equivalent for this specific fade-in-from-scale-98 dropdown animation. */
  styles: [`
    @keyframes langSelectFadeIn {
      from { opacity: 0; transform: scale(0.98) translateY(-4px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
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

  /** Combines the OPTION_BASE utility string with the selected/focused state classes —
   *  a computed function since Tailwind can't express "selected AND focused" as a static
   *  template class list without knowing both booleans at once. */
  protected optionClass(langId: number, index: number): string {
    const selected = this.value() === langId;
    const focused = this.focusedIndex() === index;
    const classes = [OPTION_BASE];
    if (selected && focused) {
      classes.push('text-blue-700 bg-blue-50 font-medium dark:bg-blue-900 dark:text-blue-300');
    } else if (selected) {
      classes.push('text-blue-700 bg-blue-50 font-medium dark:bg-blue-900 dark:text-blue-300');
    } else if (focused) {
      classes.push('bg-neutral-50 dark:bg-neutral-800');
    } else {
      classes.push('hover:bg-neutral-50 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100');
    }
    return classes.join(' ');
  }

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
