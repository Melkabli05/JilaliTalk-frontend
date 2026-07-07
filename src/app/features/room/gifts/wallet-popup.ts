import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { GIFTS_READER } from './gifts-store';

@Component({
  selector: 'app-wallet-popup',

  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wallet-popup">
      @if (store.wallet(); as wallet) {
        <div class="wallet-balance">
          <span class="balance-label">Balance</span>
          <span class="balance-value">{{ wallet.balance }} {{ wallet.currency }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: contents; }
    .wallet-popup {
      padding: var(--space-3);
      background: var(--color-card);
      border-radius: var(--radius-lg);
      border: 1px solid var(--color-border);
    }
    .wallet-balance {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .balance-label {
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
    }
    :host-context(.dark) .balance-label { color: var(--color-neutral-400); }
    .balance-value {
      font-size: var(--text-lg);
      font-weight: var(--font-bold);
      color: var(--color-text);
    }
    :host-context(.dark) .balance-value { color: var(--color-neutral-100); }
  `]
})
export class WalletPopupComponent {
  readonly store = inject(GIFTS_READER);
}