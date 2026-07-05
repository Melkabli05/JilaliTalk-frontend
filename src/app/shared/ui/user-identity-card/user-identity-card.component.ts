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
    <div class="identity-card">
      <app-avatar
        [src]="avatarUrl()"
        [initials]="initials()"
        size="xl"
        [alt]="displayName()"
        [ringColor]="ringColor()"
        [crownType]="crownType()"
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
  readonly crownType = input<string | null>(null);
}