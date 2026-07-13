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
  template: `
    <div class="identity-card" [class.identity-card--vip]="vip()">
      <app-avatar
        [src]="avatarUrl()"
        [initials]="initials()"
        size="xl"
        [alt]="displayName()"
        [ringColor]="ringColor()"
        [crownType]="crownType()"
        [clickable]="true"
      />
      <div class="identity-main">
        <div class="name-row">
          <span class="user-name">{{ displayName() }}</span>
          <ng-content select="[nameBadge]" />
        </div>
        @if (username()) {
          <span class="user-handle">&#64;{{ username() }}</span>
        }
        <div class="meta-row">
          <ng-content select="[metaChips]" />
        </div>
      </div>
    </div>
    @if (signature()) {
      <p class="bio">{{ signature() }}</p>
    }
  `,
  styles: [`
    :host { display: block; }

    .identity-card {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-4);
    }

    .identity-card--vip {
      border-bottom: 2px solid var(--color-gold-400);
    }

    .identity-main {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .name-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .user-name {
      font-size: var(--text-lg);
      font-weight: var(--font-semibold);
      color: var(--color-text);
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .user-handle {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    .meta-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-wrap: wrap;
    }

    .bio {
      padding: 0 var(--space-4) var(--space-3);
      margin: 0;
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      line-height: 1.4;
      /* Clamp long bios to 2 lines — enough to show intent without blowing the modal.
         The scrollable identity-wrapper below handles overflow if the full bio is needed. */
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `],
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
