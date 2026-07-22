import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { getCountryByCode } from '@shared/data/countries';

@Component({
  selector: 'app-country-flag',
  imports: [NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center min-w-0 max-w-full' },
  template: `
    @let entry = country();
    @if (code() && entry) {
      <span class="inline-flex items-center gap-1 min-w-0 max-w-full">
        <img
          class="w-4 h-[11px] rounded-sm object-cover shrink-0"
          [ngSrc]="'https://flagcdn.com/w20/' + code()!.toLowerCase() + '.png'"
          [alt]="entry.name"
          width="16"
          height="11"
          loading="lazy"
        />
        @if (!compact()) {
          <span class="text-xs text-neutral-500 whitespace-nowrap overflow-hidden text-ellipsis min-w-0">{{ entry.name }}</span>
        }
      </span>
    } @else if (code() && !entry) {
      <span class="inline-flex items-center gap-1 min-w-0 max-w-full">
        <img
          class="w-4 h-[11px] rounded-sm object-cover shrink-0"
          [ngSrc]="'https://flagcdn.com/w20/' + code()!.toLowerCase() + '.png'"
          [alt]="code()!"
          width="16"
          height="11"
          loading="lazy"
        />
        @if (!compact()) {
          <span class="text-xs text-neutral-500 whitespace-nowrap overflow-hidden text-ellipsis min-w-0">{{ code() }}</span>
        }
      </span>
    }
  `,
})
export class CountryFlagComponent {
  readonly code = input<string | null>(null);
  readonly compact = input(false);
  readonly country = computed(() => {
    const c = this.code();
    return c ? getCountryByCode(c) : undefined;
  });
}
