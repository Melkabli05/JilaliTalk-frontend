import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { StageUser } from '../data/room-model';
import { UserRole } from '@core/models/user-role';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { LucideMicOff, LucideMic } from '@lucide/angular';

@Component({
  selector: 'app-stage-user',

  imports: [AvatarComponent, LucideMicOff, LucideMic],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      class="stage-user"
      type="button"
      [attr.aria-label]="ariaLabel()"
      (click)="userClick.emit(user())"
    >
      <div class="avatar-wrapper">
        <app-avatar
          [src]="user().headUrl || ''"
          size="xl"
          [alt]="user().nickname"
          [status]="avatarStatus()"
          [ringColor]="ringColor()"
          [speaking]="isSpeaking() && user().isTurnOnMic"
          [flagCode]="user().nationality"
          [crownType]="user().role === UserRole.Host ? 1 : user().role === UserRole.Moderator ? 2 : null"
        />
        @if (!user().isTurnOnMic) {
          <div class="status-badge muted">
            <svg aria-hidden="true" lucideMicOff [size]="10"></svg>
          </div>
        } @else if (isSpeaking()) {
          <div class="status-badge speaking">
            <svg aria-hidden="true" lucideMic [size]="10"></svg>
          </div>
        }
      </div>

      <span class="user-name">{{ user().nickname }}</span>

      @if (user().isAway) {
        <span class="role-badge away">AWAY</span>
      } @else if (roleLabel()) {
        <span class="role-badge" [class]="roleBadgeClass()">
          {{ roleLabel() }}
        </span>
      }
    </button>
  `,
  styles: [`
    .stage-user {
      display: flex; flex-direction: column; align-items: center; gap: var(--space-1);
      padding: var(--space-1); cursor: pointer; border: none; background: none;
      border-radius: var(--radius-lg); transition: background 0.15s;
    }
    .stage-user:hover { background: var(--color-neutral-50); }
    :host-context(.dark) .stage-user:hover { background: var(--color-neutral-800); }
    .stage-user:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }

    .avatar-wrapper {
      position: relative; display: inline-flex;
      border-radius: 50%;
    }

    .status-badge {
      position: absolute; bottom: -2px; right: -2px;
      width: 20px; height: 20px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; border: 2px solid var(--color-card);
    }
    .status-badge.muted { background: var(--color-warm-500); color: white; }
    .status-badge.speaking { background: var(--color-accent-500); color: white; }

    :host-context(.dark) .status-badge {
      border-color: var(--color-neutral-800);
    }
    :host-context(.dark) .status-badge.muted {
      background: var(--color-warm-600);
    }
    :host-context(.dark) .status-badge.speaking {
      background: var(--color-accent-400);
    }

    .user-name {
      font-size: var(--text-xs); font-weight: var(--font-medium);
      color: var(--color-text-secondary); text-align: center; max-width: var(--avatar-label-width);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .stage-user:hover .user-name { color: var(--color-text); }

    .role-badge {
      font-size: var(--text-2xs); font-weight: var(--font-bold); letter-spacing: 0.5px;
      text-transform: uppercase; padding: 1px 6px; border-radius: var(--radius-full);
    }
    .role-badge.host { background: var(--color-gold-100); color: var(--color-gold-600); }
    .role-badge.mod { background: var(--color-primary-50); color: var(--color-primary-600); }
    .role-badge.away { background: var(--color-neutral-100); color: var(--color-text-muted); }
    :host-context(.dark) .role-badge.host { background: var(--color-gold-900); color: var(--color-gold-300); }
    :host-context(.dark) .role-badge.mod { background: var(--color-primary-900); color: var(--color-primary-300); }
    :host-context(.dark) .role-badge.away { background: var(--color-neutral-800); color: var(--color-text-muted); }
  `],
})
export class StageUserComponent {
  readonly UserRole = UserRole;
  readonly user = input.required<StageUser>();
  readonly speaking = input<boolean>(false);
  readonly userClick = output<StageUser>();

  readonly isSpeaking = computed(() => this.speaking());

  readonly avatarStatus = computed(() => {
    if (this.user().isAway) return 'offline' as const;
    if (!this.user().isTurnOnMic) return 'offline' as const;
    if (this.isSpeaking()) return 'speaking' as const;
    return 'online' as const;
  });

  readonly ringColor = computed(() => {
    switch (this.user().role) {
      case UserRole.Host: return 'var(--color-gold-400)';
      case UserRole.Moderator: return 'var(--color-primary-300)';
      default: return 'var(--color-neutral-200)';
    }
  });

  readonly roleLabel = computed(() => {
    switch (this.user().role) {
      case UserRole.Host: return 'HOST';
      case UserRole.Moderator: return 'MOD';
      default: return '';
    }
  });

  readonly roleBadgeClass = computed(() => this.roleLabel().toLowerCase() || 'no-role');

  ariaLabel(): string {
    const u = this.user();
    const parts = [u.nickname ?? 'User'];
    if (u.isAway) parts.push('away');
    else if (this.roleLabel()) parts.push(this.roleLabel());
    if (!u.isTurnOnMic) parts.push('muted');
    if (this.isSpeaking()) parts.push('speaking');
    return parts.join(', ');
  }
}
