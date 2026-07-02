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
    :host {
      --gg-hover-bg: var(--color-neutral-100);
      --gg-name-fg: var(--color-text);
      --gg-price-fg: var(--color-text-secondary);
    }
    :host-context(.dark) {
      --gg-hover-bg: var(--color-neutral-800);
      --gg-name-fg: var(--color-neutral-200);
      --gg-price-fg: var(--color-neutral-400);
    }
    .gift-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); gap: var(--space-2); padding: var(--space-2); }
    .gift-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: var(--space-1);
      border: none;
      background: none;
      cursor: pointer;
      border-radius: var(--radius-md);
    }
    .gift-item:hover { background: var(--gg-hover-bg); }
    .gift-item img { width: 32px; height: 32px; object-fit: contain; }
    .gift-name { font-size: var(--text-2xs); color: var(--gg-name-fg); }
    .gift-price { font-size: var(--text-2xs); color: var(--gg-price-fg); }
  `]
})
export class GiftGridComponent {
  readonly store = inject(GiftsStore);
  readonly select = output<Gift>();
}