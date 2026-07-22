import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';

/**
 * Shared identity-card header used by `user-info-modal` and `user-action-modal`.
 * Owns the avatar + name + handle + signature layout shell; consumers project their
 * own differing chips via the `[metaChips]` slot (and an optional `[nameBadge]`
 * for inline badges like sex).
 *
 * Dumb component: no service injection, no store access. Inputs in, two
 * projection slots out. See CLAUDE.md §6.
 */
@Component({
  selector: 'app-user-identity-card',
  imports: [AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div
      class="flex items-center gap-3 p-4"
      [class]="vip() ? 'border-b-2 border-amber-400' : ''"
    >
      <app-avatar
        [src]="avatarUrl()"
        [initials]="initials()"
        size="xl"
        [alt]="displayName()"
        [ringColor]="ringColor()"
        [crownType]="crownType()"
        [clickable]="true"
      />
      <div class="flex-1 min-w-0 flex flex-col gap-1">
        <div class="flex items-center gap-2">
          <span class="text-lg font-semibold text-neutral-900 dark:text-neutral-100 max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap">{{ displayName() }}</span>
          <ng-content select="[nameBadge]" />
        </div>
        @if (username()) {
          <span class="text-sm text-neutral-500">&#64;{{ username() }}</span>
        }
        <div class="flex items-center gap-2 flex-wrap">
          <ng-content select="[metaChips]" />
        </div>
      </div>
    </div>
    @if (signature()) {
      <p class="px-4 pb-3 m-0 text-sm text-neutral-500 leading-snug line-clamp-2">{{ signature() }}</p>
    }
  `,
})
export class UserIdentityCardComponent {
  readonly avatarUrl = input.required<string>();
  readonly initials = input.required<string>();
  readonly displayName = input.required<string>();
  readonly username = input<string | null>(null);
  readonly signature = input<string | null>(null);
  readonly ringColor = input<string | null>(null);
  readonly crownType = input<1 | 2 | null>(null);
  readonly vip = input(false);
}
