import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { CountryFlagComponent } from '@shared/ui/host-flag/country-flag';
import { relativeTime } from '@shared/utils';
import { LucideCrown, LucideUsers } from '@lucide/angular';

export type UserListItemVariant = 'followers' | 'following' | 'visitors';

@Component({
  selector: 'app-user-list-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, CountryFlagComponent, LucideCrown, LucideUsers],
  template: `
    <div
      class="row"
      role="button"
      tabindex="0"
      [attr.aria-label]="'View ' + name() + '\\'s profile'"
      (click)="userClick.emit(userId())"
      (keydown.enter)="userClick.emit(userId())"
      (keydown.space)="$event.preventDefault(); userClick.emit(userId())"
    >
      <app-avatar [src]="headUrl() ?? ''" [initials]="initials()" size="md" [alt]="name()" />
      <div class="row-main">
        <div class="row-name-line">
          <span class="row-name">{{ name() }}</span>
          @if ((vipType() ?? 0) > 0) {
            <svg aria-hidden="true" lucideCrown [size]="11" class="vip-icon" />
          }
        </div>
        @if (nationality()) {
          <app-country-flag [code]="nationality()" [compact]="true" />
        }
      </div>
      <div class="row-trailing">
        @switch (variant()) {
          @case ('following') {
            @if (isMutual()) {
              <span class="badge badge-mutual">Mutual</span>
            }
          }
          @case ('visitors') {
            @if (visitTs(); as ts) {
              <span class="visit-meta">
                <svg aria-hidden="true" lucideUsers [size]="11" />
                {{ formatRelativeTime(ts) }}
                @if ((visitCnt() ?? 0) > 1) {
                  <span class="visit-count">&times;{{ visitCnt() }}</span>
                }
              </span>
            }
          }
        }
      </div>
    </div>
  `,
  styles: `
    .row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-lg);
      transition: background-color 0.15s ease;
      cursor: pointer;
    }
    .row:hover {
      background-color: var(--color-neutral-100);
    }
    .row:focus-visible {
      outline: var(--focus-ring);
      outline-offset: 2px;
    }
    :host-context(.dark) .row:hover {
      background-color: var(--color-neutral-800);
    }

    .row-main {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .row-name-line {
      display: flex;
      align-items: center;
      gap: 4px;
      min-width: 0;
    }

    .row-name {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    :host-context(.dark) .row-name {
      color: var(--color-neutral-100);
    }

    .vip-icon {
      flex-shrink: 0;
      color: var(--color-gold-500);
    }

    .row-trailing {
      flex-shrink: 0;
      display: flex;
      align-items: center;
    }

    .badge {
      font-size: var(--text-2xs);
      font-weight: var(--font-semibold);
      padding: 2px 8px;
      border-radius: var(--radius-full);
    }
    .badge-mutual {
      background: var(--color-primary-50);
      color: var(--color-primary-text);
    }
    :host-context(.dark) .badge-mutual {
      background: var(--color-primary-900);
      color: var(--color-primary-300);
    }

    .visit-meta {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: var(--text-2xs);
      color: var(--color-text-muted);
    }
    :host-context(.dark) .visit-meta {
      color: var(--color-neutral-400);
    }

    .visit-count {
      font-weight: var(--font-semibold);
    }
  `,
})
export class UserListItemComponent {
  readonly userId = input.required<number>();
  readonly name = input.required<string>();
  readonly headUrl = input<string | null>(null);
  readonly nationality = input<string | null>(null);
  readonly vipType = input<number | null>(null);
  readonly variant = input.required<UserListItemVariant>();
  readonly isMutual = input(false);
  readonly visitTs = input<number | null>(null);
  readonly visitCnt = input<number | null>(null);

  readonly userClick = output<number>();

  readonly initials = computed(() => this.name().slice(0, 2));

  /** Template bridge: Angular templates can only call class members, not module-scope imports. */
  protected formatRelativeTime(ts: number): string {
    return relativeTime(ts);
  }
}
