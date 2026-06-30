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
  template: `
    <button
      type="button"
      class="select-trigger"
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
        <span class="category-swatch" [style.background]="getSwatchColors(selectedIndex()).bg" [style.color]="getSwatchColors(selectedIndex()).color">
          <svg aria-hidden="true" lucideTag [size]="11" />
          <span class="category-name">{{ category.name }}</span>
        </span>
      } @else {
        <span class="select-value placeholder">{{ categories().length === 0 ? 'Loading categories…' : 'Select a category' }}</span>
      }
      <svg aria-hidden="true" lucideChevronDown [size]="14" class="chevron" [class.rotated]="isOpen()" />
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
      <div class="category-dropdown" role="listbox" [attr.aria-label]="'Category'">
        <div class="dropdown-header">
          <span class="dropdown-label">Category</span>
        </div>
        <div class="dropdown-list">
          @for (category of categories(); track category.id) {
            <button
              type="button"
              class="category-option"
              [class.selected]="value() === category.id"
              role="option"
              [attr.aria-selected]="value() === category.id"
              (click)="select(category.id)"
            >
              <span class="category-swatch" [style.background]="getSwatchColors($index).bg" [style.color]="getSwatchColors($index).color">
                <svg aria-hidden="true" lucideTag [size]="11" />
                <span class="category-name">{{ category.name }}</span>
              </span>
              @if (value() === category.id) {
                <svg aria-hidden="true" lucideCheck [size]="14" class="check-icon" />
              }
            </button>
          }
        </div>
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
      height: 40px;
      padding: 0 var(--space-3);
      border: 1.5px solid var(--color-border);
      border-radius: var(--radius-lg);
      background-color: var(--color-card);
      color: var(--color-text);
      font-size: var(--text-sm);
      text-align: left;
      cursor: pointer;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.15s ease;
    }
    .select-trigger:hover {
      border-color: var(--color-primary-300);
      background-color: var(--color-neutral-50);
    }
    .select-trigger:focus-visible {
      outline: none;
      border-color: var(--color-primary-500);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary-500) 15%, transparent);
    }
    .select-trigger:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      background-color: var(--color-neutral-100);
    }
    .select-trigger:disabled:hover {
      border-color: var(--color-border);
    }
    :host-context(.dark) .select-trigger {
      background-color: var(--color-neutral-800);
      border-color: var(--color-neutral-600);
    }
    :host-context(.dark) .select-trigger:hover {
      border-color: var(--color-primary-400);
      background-color: var(--color-neutral-700);
    }
    :host-context(.dark) .select-trigger:disabled {
      background-color: var(--color-neutral-900);
    }

    .select-value {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .select-value.placeholder { color: var(--color-text-muted); }

    .chevron {
      color: var(--color-text-muted);
      transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      flex-shrink: 0;
      margin-left: auto;
    }
    .chevron.rotated { transform: rotate(180deg); }

    .category-swatch {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: var(--radius-full);
      font-size: var(--text-xs);
      font-weight: 600;
      line-height: 1.2;
      letter-spacing: 0.01em;
      box-shadow:
        inset 0 0 0 1px rgba(0, 0, 0, 0.06),
        inset 0 1px 2px rgba(255, 255, 255, 0.4);
      position: relative;
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

    .category-dropdown {
      background-color: var(--color-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-dropdown);
      overflow: hidden;
      animation: dropdownFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      transform-origin: top center;
    }

    .dropdown-header {
      padding: var(--space-3) var(--space-3) var(--space-2);
      border-bottom: 1px solid var(--color-border);
    }
    .dropdown-label {
      font-size: var(--text-xs);
      font-weight: 600;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .dropdown-list {
      padding: var(--space-1);
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-height: 280px;
      overflow-y: auto;
    }

    .category-option {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      width: 100%;
      padding: var(--space-2) var(--space-2);
      border: none;
      border-radius: var(--radius-md);
      background: transparent;
      cursor: pointer;
      transition: background-color 0.15s ease, transform 0.1s ease;
    }
    .category-option:hover {
      background-color: var(--color-primary-50);
      transform: translateX(2px);
    }
    .category-option:focus-visible {
      outline: none;
      background-color: var(--color-primary-50);
    }
    .category-option.selected {
      background-color: color-mix(in srgb, var(--color-primary-100) 60%, transparent);
    }
    .category-option.selected:hover {
      background-color: var(--color-primary-100);
    }

    :host-context(.dark) .category-option:hover {
      background-color: var(--color-neutral-700);
    }
    :host-context(.dark) .category-option:focus-visible {
      background-color: var(--color-neutral-700);
    }
    :host-context(.dark) .category-option.selected {
      background-color: color-mix(in srgb, var(--color-primary-900) 50%, transparent);
    }
    :host-context(.dark) .category-option.selected:hover {
      background-color: var(--color-primary-900);
    }

    .check-icon {
      color: var(--color-primary-600);
      flex-shrink: 0;
      animation: checkPop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    :host-context(.dark) .check-icon { color: var(--color-primary-300); }
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

  private static readonly PALETTES = [
    { bg: 'var(--color-primary-100)', color: 'var(--color-primary-700)' },
    { bg: 'var(--color-accent-100)', color: 'var(--color-accent-700)' },
    { bg: 'var(--color-warm-100)', color: 'var(--color-warm-700)' },
    { bg: 'var(--color-gold-100)', color: 'var(--color-gold-700)' },
    { bg: 'var(--color-primary-50)', color: 'var(--color-primary-600)' },
    { bg: 'var(--color-accent-50)', color: 'var(--color-accent-600)' },
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
