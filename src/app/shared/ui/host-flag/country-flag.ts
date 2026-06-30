import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { getCountryByCode } from '@shared/data/countries';

@Component({
  selector: 'app-country-flag',
  imports: [NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let entry = country();
    @if (code() && entry) {
      <span class="country-flag">
        <img
          class="flag-img"
          [ngSrc]="'https://flagcdn.com/w20/' + code()!.toLowerCase() + '.png'"
          [alt]="entry.name"
          width="16"
          height="11"
          loading="lazy"
        />
        @if (!compact()) {
          <span class="country-name">{{ entry.name }}</span>
        }
      </span>
    } @else if (code() && !entry) {
      <span class="country-flag">
        <img
          class="flag-img"
          [ngSrc]="'https://flagcdn.com/w20/' + code()!.toLowerCase() + '.png'"
          [alt]="code()!"
          width="16"
          height="11"
          loading="lazy"
        />
        @if (!compact()) {
          <span class="country-name">{{ code() }}</span>
        }
      </span>
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        min-width: 0;
        max-width: 100%;
      }
      .country-flag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        min-width: 0;
        max-width: 100%;
      }
      .flag-img {
        width: 16px;
        height: 11px;
        border-radius: 2px;
        object-fit: cover;
        flex-shrink: 0;
      }
      .country-name {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
      }
    `,
  ],
})
export class CountryFlagComponent {
  readonly code = input<string | null>(null);
  readonly compact = input(false);
  readonly country = computed(() => {
    const c = this.code();
    return c ? getCountryByCode(c) : undefined;
  });
}
