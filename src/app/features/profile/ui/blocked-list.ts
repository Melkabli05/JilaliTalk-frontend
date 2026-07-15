import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { BlockedUser } from '../models/profile.model';
import { LucideShieldOff } from '@lucide/angular';
import { EmptyStateComponent } from '@shared/ui/empty-state/empty-state.component';
@Component({
  selector: 'app-blocked-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, LucideShieldOff, EmptyStateComponent],
  template: `
    @if (users().length === 0) {
      <app-empty-state title="No blocked users" [compact]="true">
        <svg empty-state-icon aria-hidden="true" lucideShieldOff [size]="24"></svg>
      </app-empty-state>
    } @else {
      <ul class="list">
        @for (user of users(); track user.userId) {
          <li class="row">
            <app-avatar
              [src]="user.headUrl ?? ''"
              [initials]="(user.nickName ?? 'U').slice(0, 2)"
              size="md"
              [alt]="user.nickName ?? 'Blocked user'"
            />
            <span class="row-name">{{ user.nickName ?? 'Unknown user' }}</span>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }
    .row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
    }
    .row-name {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text);
    }
    :host-context(.dark) .row-name {
      color: var(--color-neutral-100);
    }
  `,
})
export class BlockedListComponent {
  readonly users = input<readonly BlockedUser[]>([]);
}
