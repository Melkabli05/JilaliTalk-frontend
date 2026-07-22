import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { getLanguageById } from '@shared/data/languages';

@Component({
  selector: 'app-language-tag',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center min-w-0 max-w-full' },
  template: `
    @let entry = language();
    @if (entry) {
      <span class="inline-flex items-center gap-1 min-w-0 max-w-full">
        <img
          class="w-4 h-[11px] rounded-sm object-cover shrink-0"
          [src]="'https://flagcdn.com/w20/' + entry.countryCode + '.png'"
          [alt]="entry.name"
          loading="lazy"
        />
        <span class="text-xs text-neutral-500 whitespace-nowrap overflow-hidden text-ellipsis min-w-0">{{ entry.name }}</span>
      </span>
    }
  `,
})
export class LanguageTagComponent {
  readonly langId = input<number | null>(null);
  readonly language = computed(() => {
    const id = this.langId();
    return id ? getLanguageById(id) : undefined;
  });
}
