import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { UserInfo } from '@core/services/user-info.service';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { CountryFlagComponent } from '@shared/ui/host-flag/country-flag';
import { LanguageTagComponent } from '@shared/ui/host-flag/language-tag';
import { LucideCrown } from '@lucide/angular';
@Component({
  selector: 'app-profile-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, CountryFlagComponent, LanguageTagComponent, LucideCrown],
  template: `
    <div class="identity-card" [class.identity-card--vip]="isTopVip()">
      <app-avatar
        [src]="avatarUrl()"
        [initials]="initials()"
        size="xl"
        [alt]="displayName()"
        [ringColor]="isTopVip() ? 'var(--color-gold-300)' : 'var(--color-primary-300)'"
        [priority]="true"
      />
      <div class="identity-main">
        <div class="name-row">
          <span class="user-name">{{ displayName() }}</span>
          @if (isTopVip()) {
            <span class="chip chip-gold"><svg aria-hidden="true" lucideCrown [size]="9"></svg>VIP</span>
          } @else if (vipType() > 0) {
            <span class="chip chip-primary"><svg aria-hidden="true" lucideCrown [size]="9"></svg>VIP</span>
          }
        </div>
        @if (username()) {
          <span class="user-handle">&#64;{{ username() }}</span>
        }
        @if (signature()) {
          <p class="bio">{{ signature() }}</p>
        }
        <div class="meta-row">
          @if (nationality()) {
            <app-country-flag [code]="nationality()" />
          }
          @if (location(); as loc) {
            <span class="meta-text">{{ loc }}</span>
          }
          @if (regDays() != null) {
            <span class="meta-text muted">Member for {{ regDays() }}d</span>
          }
        </div>
        @if (nativeLang() || learnLangs().length) {
          <div class="lang-row">
            @if (nativeLang(); as lang) {
              <app-language-tag [langId]="lang" />
            }
            @if (learnLangs().length) {
              <span class="meta-text muted">also learning</span>
              @for (lang of learnLangs(); track lang.langId) {
                <app-language-tag [langId]="lang.langId" />
              }
            }
          </div>
        }
        @if (tagChips().length) {
          <div class="tags-row">
            @for (chip of tagChips(); track $index) {
              <span class="tag">{{ chip }}</span>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .identity-card {
      display: flex;
      align-items: flex-start;
      gap: var(--space-4);
      padding: var(--space-5);
      background: var(--color-card);
      border-radius: var(--radius-xl);
      border: 1px solid var(--color-border);
    }
    .identity-card--vip {
      border-color: var(--color-gold-400);
    }
    :host-context(.dark) .identity-card {
      background: var(--color-neutral-800);
      border-color: var(--color-neutral-700);
    }
    .identity-main {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      min-width: 0;
      flex: 1;
    }
    .name-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .user-name {
      font-size: var(--text-xl);
      font-weight: var(--font-bold);
      color: var(--color-text);
    }
    :host-context(.dark) .user-name {
      color: var(--color-neutral-100);
    }
    .user-handle {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }
    :host-context(.dark) .user-handle {
      color: var(--color-neutral-400);
    }
    .bio {
      margin: 0;
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      line-height: var(--leading-normal);
    }
    :host-context(.dark) .bio {
      color: var(--color-neutral-300);
    }
    .meta-row,
    .lang-row,
    .tags-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .meta-text {
      font-size: var(--text-xs);
      color: var(--color-text);
    }
    .meta-text.muted {
      color: var(--color-text-muted);
    }
    :host-context(.dark) .meta-text {
      color: var(--color-neutral-200);
    }
    :host-context(.dark) .meta-text.muted {
      color: var(--color-neutral-400);
    }
    .tag {
      font-size: var(--text-xs);
      padding: 2px 10px;
      border-radius: var(--radius-full);
      background: var(--color-neutral-100);
      color: var(--color-text-secondary);
      border: 1px solid var(--color-neutral-200);
    }
    :host-context(.dark) .tag {
      background: var(--color-neutral-700);
      color: var(--color-neutral-300);
      border-color: var(--color-neutral-600);
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: var(--text-2xs);
      font-weight: var(--font-semibold);
      padding: 2px 6px;
      border-radius: var(--radius-full);
    }
    .chip-gold {
      background: var(--color-gold-50);
      color: var(--color-gold-600);
    }
    .chip-primary {
      background: var(--color-primary-50);
      color: var(--color-primary-600);
    }
    :host-context(.dark) .chip-gold {
      background: color-mix(in srgb, var(--color-gold-500) 20%, transparent);
      color: var(--color-gold-300);
    }
    :host-context(.dark) .chip-primary {
      background: var(--color-primary-900);
      color: var(--color-primary-300);
    }
    @container profile-page (min-width: 640px) {
      .identity-card {
        align-items: center;
      }
    }
  `,
})
export class ProfileHeaderComponent {
  readonly info = input<UserInfo | null>(null);
  private readonly details = computed(() => this.info()?.details ?? null);
  private readonly base = computed(() => this.details()?.base ?? null);
  readonly displayName = computed(() => this.info()?.nickname ?? 'User');
  readonly avatarUrl = computed(() => this.base()?.headUrl ?? '');
  readonly initials = computed(() => this.displayName().slice(0, 2));
  readonly username = computed(() => this.info()?.username ?? null);
  readonly signature = computed(() => this.base()?.signature ?? null);
  readonly nationality = computed(() => this.info()?.nationality ?? null);
  readonly regDays = computed(() => this.info()?.regDays ?? null);
  readonly vipType = computed(() => this.base()?.vipType ?? 0);
  /** vipType 100 is the top VIP tier — the same magic number this repo checks in several
   *  other places (room's event-card/comment-list/user-action-modal, shared's
   *  user-info-modal). Named locally rather than 0/1 > 0 "regular vip", since the meaning
   *  of the threshold, not just its value, is what a reader needs. */
  readonly isTopVip = computed(() => this.vipType() === 100);
  readonly nativeLang = computed(() => this.base()?.nativeLang ?? null);
  readonly learnLangs = computed(() => this.base()?.learnLangs ?? []);
  readonly tagChips = computed<readonly string[]>(() => this.info()?.tags ?? []);
  /** `info().city`/`fullCountry` are the BFF's flattened summary of `details.location`'s
   *  raw fields (see `UserProfileDetails`'s doc comment) — prefer the summary since it's
   *  what the BFF considers current, and fall back to the nested value only when the
   *  summary field is missing. */
  readonly location = computed(() => {
    const loc = this.details()?.location;
    const city = this.info()?.city ?? loc?.city ?? null;
    const country = this.info()?.fullCountry ?? loc?.fullCountry ?? null;
    const parts = [city, country].filter((p): p is string => !!p);
    return parts.length ? parts.join(', ') : null;
  });
}
