import { Component, ChangeDetectionStrategy, inject, output } from '@angular/core';
import { GiftsStore, Gift } from './gifts-store';

@Component({
  selector: 'app-gift-grid',

  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gift-grid">
      @for (gift of store.gifts(); track gift.id) {
        <button class="gift-item" (click)="select.emit(gift)">
          <img [src]="gift.iconUrl" [alt]="gift.name" loading="lazy" />
          <span class="gift-name">{{ gift.name }}</span>
          <span class="gift-price">{{ gift.price }}</span>
        </button>
      }
    </div>
  `,
  styles: [`
    .gift-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); gap: var(--space-2); padding: var(--space-2); }
    .gift-item { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: var(--space-1); border: none; background: none; cursor: pointer; border-radius: var(--radius-md); }
    .gift-item:hover { background: var(--color-neutral-100); }
    :host-context(.dark) .gift-item:hover { background: var(--color-neutral-800); }
    .gift-item img { width: 32px; height: 32px; object-fit: contain; }
    .gift-name { font-size: var(--text-2xs); color: var(--color-text); }
    .gift-price { font-size: var(--text-2xs); color: var(--color-text-secondary); }
    :host-context(.dark) .gift-name { color: var(--color-neutral-200); }
    :host-context(.dark) .gift-price { color: var(--color-neutral-400); }
  `]
})
export class GiftGridComponent {
  readonly store = inject(GiftsStore);
  readonly select = output<Gift>();
}