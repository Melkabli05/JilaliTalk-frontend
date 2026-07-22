import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  input,
  model,
  signal,
  computed,
  effect,
  viewChild,
} from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';
import { FormValueControl } from '@angular/forms/signals';
import { Category } from '@shared/data/categories';
import { LucideChevronDown, LucideCheck, LucideTag } from '@lucide/angular';

@Component({
  selector: 'app-category-select',
  imports: [OverlayModule, LucideChevronDown, LucideCheck, LucideTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <button
      type="button"
      class="flex items-center gap-2 w-full h-10 px-3 rounded-lg text-left cursor-pointer
             border-[1.5px] border-neutral-200 dark:border-neutral-600
             bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-sm
             transition-[border-color,box-shadow,background-color] duration-150
             hover:border-blue-300 hover:bg-neutral-50
             dark:hover:border-blue-400 dark:hover:bg-neutral-700
             focus-visible:outline-none focus-visible:border-blue-500 focus-visible:shadow-[0_0_0_3px_rgb(59_130_246/15%)]
             disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:hover:border-neutral-200
             dark:disabled:bg-neutral-900"
      cdkOverlayOrigin
      #trigger="cdkOverlayOrigin"
      #triggerEl
      [id]="id()"
      [disabled]="disabled() || categories().length === 0"
      (click)="toggle()"
      [attr.aria-expanded]="isOpen()"
      aria-haspopup="listbox"
    >
      @if (selected(); as category) {
        <span class="category-swatch inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-semibold leading-tight tracking-[0.01em] relative"
              [style.background]="getSwatchColors(selectedIndex()).bg" [style.color]="getSwatchColors(selectedIndex()).color">
          <svg aria-hidden="true" lucideTag [size]="11" />
          <span class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{{ category.name }}</span>
        </span>
      } @else {
        <span class="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-neutral-500">{{ categories().length === 0 ? 'Loading categories…' : 'Select a category' }}</span>
      }
      <svg
        aria-hidden="true"
        lucideChevronDown
        [size]="14"
        class="text-neutral-500 transition-transform duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)] shrink-0 ml-auto"
        [class.rotate-180]="isOpen()"
      />
    </button>

    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="trigger"
      [cdkConnectedOverlayOpen]="isOpen()"
      [cdkConnectedOverlayHasBackdrop]="true"
      cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
      [cdkConnectedOverlayOffsetY]="6"
      [cdkConnectedOverlayWidth]="triggerWidth()"
      (backdropClick)="close()"
      (detach)="close()"
      (overlayKeydown)="onOverlayKeydown($event)"
    >
      <div
        class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg overflow-hidden
               animate-[dropdownFadeIn_0.2s_cubic-bezier(0.16,1,0.3,1)] origin-top motion-reduce:animate-none"
        role="listbox"
        [attr.aria-label]="'Category'"
      >
        <div class="py-2 px-3 pb-2 border-b border-neutral-200 dark:border-neutral-700">
          <span class="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Category</span>
        </div>
        <div class="p-1 flex flex-col gap-0.5 max-h-[280px] overflow-y-auto">
          @for (category of categories(); track category.id) {
            <button
              type="button"
              class="flex items-center justify-between gap-3 w-full py-2 px-2 rounded-md border-0 bg-transparent cursor-pointer
                     transition-[background-color,transform] duration-150
                     hover:bg-blue-50 hover:translate-x-0.5
                     focus-visible:outline-none focus-visible:bg-blue-50
                     dark:hover:bg-neutral-700 dark:focus-visible:bg-neutral-700
                     max-lg:py-3 max-lg:px-2 max-lg:min-h-11"
              [class]="value() === category.id
                ? 'bg-blue-100/60 hover:bg-blue-100 dark:bg-blue-900/50 dark:hover:bg-blue-900'
                : ''"
              role="option"
              [attr.aria-selected]="value() === category.id"
              (click)="select(category.id)"
            >
              <span class="category-swatch inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-semibold leading-tight tracking-[0.01em] relative"
                    [style.background]="getSwatchColors($index).bg" [style.color]="getSwatchColors($index).color">
                <svg aria-hidden="true" lucideTag [size]="11" />
                <span class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{{ category.name }}</span>
              </span>
              @if (value() === category.id) {
                <svg aria-hidden="true" lucideCheck [size]="14" class="shrink-0 text-blue-600 dark:text-blue-300 animate-[checkPop_0.2s_cubic-bezier(0.34,1.56,0.64,1)]" />
              }
            </button>
          }
        </div>
      </div>
    </ng-template>
  `,
  /**
   * Remaining scoped CSS: the .category-swatch embossed sheen (::before gradient overlay
   * and inset shadows) has no Tailwind utility equivalent, and the two entrance keyframes
   * (dropdown fade-in, check-mark pop) are genuine motion design.
   */
  styles: [`
    .category-swatch {
      box-shadow:
        inset 0 0 0 1px rgba(0, 0, 0, 0.06),
        inset 0 1px 2px rgba(255, 255, 255, 0.4);
    }
    .category-swatch::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 60%);
      pointer-events: none;
    }
    :host-context(.dark) .category-swatch {
      box-shadow:
        inset 0 0 0 1px rgba(255, 255, 255, 0.1),
        inset 0 1px 2px rgba(0, 0, 0, 0.15);
    }
    :host-context(.dark) .category-swatch::before {
      background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 60%);
    }
    @keyframes dropdownFadeIn {
      from { opacity: 0; transform: scale(0.98) translateY(-4px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes checkPop {
      from { transform: scale(0); }
      to { transform: scale(1); }
    }
  `],
})
export class CategorySelectComponent implements FormValueControl<number | null> {
  readonly value = model<number | null>(null);
  readonly categories = input<readonly Category[]>([]);
  readonly disabled = input<boolean>(false);
  readonly id = input<string>('');

  private readonly triggerEl = viewChild<ElementRef<HTMLElement>>('triggerEl');

  readonly isOpen = signal(false);
  readonly triggerWidth = signal<number>(240);

  readonly selected = computed(() => this.categories().find((c) => c.id === this.value()) ?? null);
  readonly selectedIndex = computed(() => this.categories().findIndex((c) => c.id === this.value()));

  /** Tailwind's built-in default palette (blue/emerald/red/amber), cycled per category index. */
  private static readonly PALETTES = [
    { bg: '#dbeafe', color: '#1d4ed8' }, // blue-100 / blue-700
    { bg: '#d1fae5', color: '#047857' }, // emerald-100 / emerald-700
    { bg: '#fee2e2', color: '#b91c1c' }, // red-100 / red-700
    { bg: '#fef3c7', color: '#b45309' }, // amber-100 / amber-700
    { bg: '#eff6ff', color: '#2563eb' }, // blue-50 / blue-600
    { bg: '#ecfdf5', color: '#059669' }, // emerald-50 / emerald-600
  ] as const;

  getSwatchColors(categoryIndex: number): { bg: string; color: string } {
    const palette = CategorySelectComponent.PALETTES[categoryIndex % CategorySelectComponent.PALETTES.length] ?? CategorySelectComponent.PALETTES[0]!;
    return { bg: palette.bg, color: palette.color };
  }

  constructor() {
    effect(() => {
      const categories = this.categories();
      if (this.value() === null && categories.length > 0) {
        this.value.set(categories[0]?.id ?? null);
      }
    });
  }

  toggle(): void {
    if (this.disabled() || this.categories().length === 0) return;
    this.isOpen.update((open) => !open);
    if (this.isOpen()) {
      this.triggerWidth.set(this.triggerEl()?.nativeElement.offsetWidth ?? 240);
    }
  }

  close(): void {
    this.isOpen.set(false);
  }

  onOverlayKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.close();
  }

  select(categoryId: number): void {
    this.value.set(categoryId);
    this.close();
  }
}
