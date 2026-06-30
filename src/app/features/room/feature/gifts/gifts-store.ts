import { Injectable, signal } from '@angular/core';
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

@Injectable()
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