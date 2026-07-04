// src/app/features/profile/ui/blocked-list.ts
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { BlockedUser } from '../models/profile.model';
import { LucideShieldOff } from '@lucide/angular';

@Component({
  selector: 'app-blocked-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, LucideShieldOff],
  template: `
    @if (users().length === 0) {
      <div class="empty-state">
        <svg aria-hidden="true" lucideShieldOff [size]="28" class="empty-icon" />
        <p class="empty-text">No blocked users</p>
      </div>
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
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      padding: var(--space-8) var(--space-4);
      color: var(--color-text-muted);
    }
    :host-context(.dark) .empty-state {
      color: var(--color-neutral-400);
    }
    .empty-icon {
      opacity: 0.5;
    }
    .empty-text {
      margin: 0;
      font-size: var(--text-sm);
    }

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
