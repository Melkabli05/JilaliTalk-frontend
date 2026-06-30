import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { getLanguageById } from '@shared/data/languages';

@Component({
  selector: 'app-language-tag',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let entry = language();
    @if (entry) {
      <span class="language-tag">
        <img
          class="flag-img"
          [src]="'https://flagcdn.com/w20/' + entry.countryCode + '.png'"
          [alt]="entry.name"
          loading="lazy"
        />
        <span class="language-name">{{ entry.name }}</span>
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
      .language-tag {
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
      .language-name {
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
export class LanguageTagComponent {
  readonly langId = input<number | null>(null);
  readonly language = computed(() => {
    const id = this.langId();
    return id ? getLanguageById(id) : undefined;
  });
}
