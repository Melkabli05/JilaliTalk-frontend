import { Service, InjectionToken, Signal, signal } from '@angular/core';
import { CollectionStore } from '@shared/utils/collection-store';

export interface Gift {
  readonly id: number;
  readonly name: string;
  readonly iconUrl: string;
  readonly price: number;
}

export interface WalletInfo {
  readonly balance: number;
  readonly currency: string;
}

/** Read-only surface for gift-grid.ts / wallet-popup.ts — they only display the
 *  catalog and balance, never mutate them (that happens via room-page-base.ts). */
export interface GiftsReader {
  readonly gifts: Signal<readonly Gift[]>;
  readonly wallet: Signal<WalletInfo | null>;
}

export interface GiftsWriter {
  setGifts(gifts: Gift[]): void;
  setWallet(info: WalletInfo): void;
}

export const GIFTS_READER = new InjectionToken<GiftsReader>('GIFTS_READER');
export const GIFTS_WRITER = new InjectionToken<GiftsWriter>('GIFTS_WRITER');

@Service({ autoProvided: false })
export class GiftsStore extends CollectionStore<Gift> {
  readonly gifts = this.items;
  readonly wallet = signal<WalletInfo | null>(null);

  setGifts(gifts: Gift[]): void {
    this.setCollection(gifts);
  }

  setWallet(info: WalletInfo): void {
    this.wallet.set(info);
  }

  override reset(): void {
    super.reset();
    this.wallet.set(null);
  }
}