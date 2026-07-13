import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { StageUser } from '../models/room-model';
import { UserRole } from '@core/models/user-role';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { LucideMicOff, LucideMic } from '@lucide/angular';
import { stageAriaLabel, stageRingColor, stageRoleLabel } from './stage-role.util';

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
          [priority]="true"
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
    :host {
      display: contents;

      --su-hover-bg: var(--color-neutral-50);
      --su-badge-border: var(--color-card);
      --su-badge-muted-bg: var(--color-warm-500);
      --su-badge-speaking-bg: var(--color-accent-500);
      --su-role-host-bg: var(--color-gold-100);
      --su-role-host-fg: var(--color-gold-600);
      --su-role-mod-bg: var(--color-primary-50);
      --su-role-mod-fg: var(--color-primary-600);
      --su-role-away-bg: var(--color-neutral-100);
      --su-role-away-fg: var(--color-text-muted);
    }
    :host-context(.dark) {
      --su-hover-bg: var(--color-neutral-800);
      --su-badge-border: var(--color-neutral-800);
      --su-badge-muted-bg: var(--color-warm-600);
      --su-badge-speaking-bg: var(--color-accent-400);
      --su-role-host-bg: var(--color-gold-900);
      --su-role-host-fg: var(--color-gold-300);
      --su-role-mod-bg: var(--color-primary-900);
      --su-role-mod-fg: var(--color-primary-300);
      --su-role-away-bg: var(--color-neutral-800);
      --su-role-away-fg: var(--color-text-muted);
    }

    .stage-user {
      display: flex; flex-direction: column; align-items: center; gap: var(--space-1);
      padding: var(--space-1); cursor: pointer; border: none; background: none;
      border-radius: var(--radius-lg); transition: background 0.15s;
    }
    .stage-user:hover { background: var(--su-hover-bg); }
    .stage-user:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }

    .avatar-wrapper {
      position: relative; display: inline-flex;
      border-radius: 50%;
      width: 100%;
      /* Ceiling matching app-avatar's original "xl" size (--space-16 = 64px) —
         stage-grid's columns are much wider on desktop (repeat(4, 1fr) across
         the full row) than on mobile, and without a cap this scales up with
         the column instead of just filling it, ballooning avatars far past
         their intended size on wide screens. */
      max-width: var(--space-16);
    }
    /* app-avatar's "xl" size token is a fixed 64px regardless of container —
       unlike .empty-avatar below (width: 100%; aspect-ratio: 1), which scales
       with the grid column. Overriding to the same scale-with-column pattern
       here keeps real stage users and empty placeholder slots visually
       identical in size at every viewport/column width, instead of drifting
       apart whenever the grid's column width changes. */
    .avatar-wrapper app-avatar {
      width: 100% !important;
      height: auto !important;
      aspect-ratio: 1;
    }

    .status-badge {
      position: absolute; bottom: -2px; right: -2px;
      width: 20px; height: 20px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid var(--su-badge-border);
    }
    .status-badge.muted { background: var(--su-badge-muted-bg); color: var(--color-on-color); }
    .status-badge.speaking { background: var(--su-badge-speaking-bg); color: var(--color-on-color); }

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
    .role-badge.host { background: var(--su-role-host-bg); color: var(--su-role-host-fg); }
    .role-badge.mod { background: var(--su-role-mod-bg); color: var(--su-role-mod-fg); }
    .role-badge.away { background: var(--su-role-away-bg); color: var(--su-role-away-fg); }

    /* Host/mod text badges are redundant with the crown already shown on the
       avatar (see [crownType] above) at the stage grid's compact mobile size —
       hide them there, but keep them on desktop where there's more room and
       the crown is smaller relative to the avatar. ":not(.away)" keeps the
       away indicator (a different, non-role concept) visible at every width. */
    @container room-page (max-width: 1023.98px) {
      .role-badge:not(.away) {
        display: none;
      }
    }
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

  readonly ringColor = computed(() => stageRingColor(this.user().role));

  readonly roleLabel = computed(() => stageRoleLabel(this.user().role));

  readonly roleBadgeClass = computed(() => this.roleLabel().toLowerCase() || 'no-role');

  readonly ariaLabel = computed(() =>
    stageAriaLabel(
      this.user().nickname,
      this.roleLabel(),
      this.user().isAway,
      this.user().isTurnOnMic,
      this.isSpeaking(),
    ),
  );
}
