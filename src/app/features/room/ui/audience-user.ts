import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { AudienceUser } from '../data/room-model';
import { UserRole } from '@core/models/user-role';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { getLanguageById } from '@shared/data/languages';
import { initialsFrom } from '@shared/utils';
import { LucideArrowUpToLine, LucideGhost, LucideRefreshCw } from '@lucide/angular';

export type AudienceUserDisplay = 'grid' | 'list';

@Component({
  selector: 'app-audience-user',

  imports: [AvatarComponent, LucideArrowUpToLine, LucideGhost, LucideRefreshCw],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.role]': "display() === 'grid' ? 'listitem' : null",
  },
  template: `
    @if (display() === 'grid') {
      <div class="audience-user grid">
        <button
          class="av-button"
          type="button"
          [attr.aria-label]="ariaLabel()"
          [attr.aria-disabled]="isGhost() ? 'true' : null"
          (click)="onGridClick()"
        >
          <div class="av-wrap">
            <app-avatar
              [src]="user().base?.headUrl || ''"
              [initials]="initials()"
              size="lg"
              [alt]="displayName()"
              [ringColor]="ringColor()"
              [speaking]="speaking()"
              [flagCode]="user().base?.nationality ?? null"
              [crownType]="user().role === UserRole.Moderator ? 2 : null"
            />
            @if (isGhost()) {
              <div class="ghost-indicator" aria-hidden="true">
                <svg lucideGhost [size]="10"></svg>
              </div>
            }
          </div>

          <span class="user-name" [title]="displayName()">{{ displayName() }}</span>
          @if (modeLabel()) {
            <span class="mode-badge" [class]="modeBadgeClass()">{{ modeLabel() }}</span>
          }
        </button>

        @if (user().isRaiseHand) {
          <div class="hand-indicator" aria-hidden="true">✋</div>
        }

        @if (canInvite() && !isGhost()) {
          <button
            type="button"
            class="invite-overlay-btn"
            [disabled]="inviteBusy()"
            (click)="emitInvite($event)"
            [attr.aria-label]="'Invite ' + displayName() + ' to stage'"
            title="Invite to stage"
          >
            @if (inviteBusy()) {
              <svg aria-hidden="true" lucideRefreshCw [size]="10" class="spinning"></svg>
            } @else {
              <svg aria-hidden="true" lucideArrowUpToLine [size]="10"></svg>
            }
          </button>
        }
      </div>
    } @else {
      <div class="audience-user list">
        <div class="av-wrap">
          <app-avatar
            [src]="user().base?.headUrl || ''"
            [initials]="initials()"
            size="lg"
            [alt]="displayName()"
            [ringColor]="ringColor()"
            [speaking]="speaking()"
            [flagCode]="user().base?.nationality ?? null"
            [crownType]="user().role === UserRole.Moderator ? 2 : null"
          />
          @if (isGhost()) {
            <div class="ghost-indicator" aria-hidden="true">
              <svg lucideGhost [size]="10"></svg>
            </div>
          }
        </div>

        <div class="info-col">
          <div class="name-row">
            <span class="nickname" [title]="displayName()">{{ displayName() }}</span>
            @if (isSelf()) {
              <span class="you-badge">You</span>
            } @else if (isGhost()) {
              <span class="mode-badge ghost">Connecting…</span>
            }
          </div>
          <div class="meta-row">
            @if (isGhost()) {
              <span class="level-badge">Joining the room…</span>
            } @else {
              <span class="level-badge">Lv.{{ user().fgLevel }}</span>
              @if (hostLang(); as lang) {
                <span class="meta-sep">·</span>
                <span class="learning-langs">{{ lang.name }}</span>
              }
            }
          </div>
        </div>

        <div class="action-col">
          @if (user().isRaiseHand) {
            <div class="raise-hand-indicator" aria-hidden="true">✋</div>
          }
          @if (canInvite() && !isGhost()) {
            <button
              type="button"
              class="invite-btn"
              [disabled]="inviteBusy()"
              (click)="emitInvite($event)"
              [attr.aria-label]="inviteBusy() ? 'Inviting…' : 'Invite ' + displayName() + ' to stage'"
              title="Invite to stage"
            >
              @if (inviteBusy()) {
                <svg aria-hidden="true" lucideRefreshCw [size]="12" class="spinning"></svg>
              } @else {
                <svg aria-hidden="true" lucideArrowUpToLine [size]="12"></svg>
              }
            </button>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .audience-user {
      border: none; background: none; cursor: pointer;
      transition: background 0.15s; font-family: inherit;
    }
    .audience-user:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }

    .audience-user.grid {
      display: flex; flex-direction: column; align-items: center;
      padding: var(--space-1); border-radius: var(--radius-md);
      position: relative;
    }
    .audience-user.grid:hover { background: var(--color-neutral-50); }
    :host-context(.dark) .audience-user.grid:hover { background: var(--color-neutral-800); }

    .av-button {
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      border: none; background: none; cursor: pointer; padding: 0;
    }
    .av-button[aria-disabled="true"] { cursor: default; }
    .av-button:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); border-radius: var(--radius-md); }

    .invite-overlay-btn {
      position: absolute; top: 0; right: 0;
      width: 20px; height: 20px; border-radius: var(--radius-md);
      background: var(--color-primary-500); color: white; border: none;
      display: flex; align-items: center; justify-content: center; cursor: pointer;
      opacity: 0; transition: opacity 0.15s;
    }
    .audience-user.grid:hover .invite-overlay-btn,
    .invite-overlay-btn:focus-visible { opacity: 1; }
    .invite-overlay-btn:focus-visible { outline: var(--focus-ring); outline-offset: 1px; }
    .invite-overlay-btn:disabled { cursor: not-allowed; opacity: 0.7; }
    :host-context(.dark) .invite-overlay-btn { background: var(--color-primary-400); color: white; }

    .spinning { animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .user-name {
      font-size: var(--text-xs); font-weight: var(--font-medium);
      color: var(--color-text-secondary); text-align: center; max-width: var(--avatar-label-width);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .audience-user.grid:hover .user-name { color: var(--color-text); }

    .mode-badge {
      font-size: var(--text-2xs); font-weight: var(--font-bold); letter-spacing: 0.5px;
      text-transform: uppercase; padding: 1px 5px; border-radius: var(--radius-full);
    }
    .mode-badge.normal { background: var(--color-neutral-100); color: var(--color-text-muted); }
    .mode-badge.moderator { background: var(--color-primary-50); color: var(--color-primary-600); }
    .mode-badge.ghost { background: var(--color-neutral-700); color: var(--color-neutral-100); }
    :host-context(.dark) .mode-badge.normal { background: var(--color-neutral-700); color: var(--color-neutral-300); }
    :host-context(.dark) .mode-badge.moderator { background: var(--color-primary-900); color: var(--color-primary-300); }

    .ghost-indicator {
      position: absolute; bottom: -2px; right: -2px;
      width: 16px; height: 16px; border-radius: 50%;
      background: var(--color-neutral-700); color: var(--color-neutral-100);
      border: 1px solid var(--color-card);
      display: flex; align-items: center; justify-content: center;
    }
    :host-context(.dark) .ghost-indicator {
      background: var(--color-neutral-600);
      border-color: var(--color-neutral-800);
    }

    .av-wrap {
      position: relative; display: inline-flex;
      border-radius: 50%;
    }

    .hand-indicator {
      position: absolute; top: -2px; right: -2px;
      width: 16px; height: 16px; border-radius: 50%;
      background: var(--color-card); border: 1px solid var(--color-border);
      display: flex; align-items: center; justify-content: center;
      font-size: var(--text-2xs); line-height: 1;
    }
    :host-context(.dark) .hand-indicator {
      background: var(--color-neutral-800); border-color: var(--color-neutral-700);
    }

    .audience-user.list {
      display: flex; align-items: center; gap: var(--space-3);
      width: 100%; padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-xl); text-align: left;
    }
    .audience-user.list:hover { background: var(--color-neutral-50); }
    :host-context(.dark) .audience-user.list:hover { background: var(--color-neutral-800); }

    .info-col { flex: 1; min-width: 0; }
    .name-row { display: flex; align-items: center; gap: var(--space-1); }
    .nickname { font-size: var(--text-xs); font-weight: var(--font-semibold); color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .you-badge {
      font-size: var(--text-2xs); font-weight: var(--font-bold);
      background: var(--color-primary-50); color: var(--color-primary-600);
      padding: 0 4px; border-radius: var(--radius-sm);
    }
    :host-context(.dark) .you-badge { background: var(--color-primary-900); color: var(--color-primary-300); }

    .meta-row { display: flex; align-items: center; gap: var(--space-1); margin-top: 1px; }
    .level-badge { font-size: var(--text-2xs); color: var(--color-text-muted); }
    .meta-sep { font-size: var(--text-2xs); color: var(--color-text-muted); }
    .learning-langs { font-size: var(--text-2xs); color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    :host-context(.dark) {
      .nickname { color: var(--color-neutral-100); }
      .level-badge, .meta-sep, .learning-langs { color: var(--color-neutral-400); }
    }

    .action-col { flex-shrink: 0; display: flex; align-items: center; gap: var(--space-1); }

    .raise-hand-indicator {
      width: 24px; height: 24px; border-radius: 50%;
      background: var(--color-warm-400); display: flex; align-items: center; justify-content: center; color: white;
      font-size: 11px;
    }

    .invite-btn {
      width: 32px; height: 32px; border-radius: var(--radius-lg);
      display: flex; align-items: center; justify-content: center;
      background: var(--color-primary-50); color: var(--color-primary-500);
      border: none; cursor: pointer; transition: background 0.15s, opacity 0.15s;
    }
    .invite-btn:hover { background: var(--color-primary-100); }
    .invite-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .invite-btn:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
    :host-context(.dark) .invite-btn {
      background: var(--color-primary-900);
      color: var(--color-primary-300);
    }
    :host-context(.dark) .invite-btn:hover { background: var(--color-primary-800); }
  `],
})
export class AudienceUserComponent {
  readonly UserRole = UserRole;

  readonly user = input.required<AudienceUser>();
  readonly display = input<AudienceUserDisplay>('grid');
  readonly canInvite = input<boolean>(false);
  readonly inviteBusy = input<boolean>(false);
  readonly speaking = input<boolean>(false);
  readonly currentUserId = input<number>(0);

  readonly invite = output<AudienceUser>();
  readonly userClick = output<AudienceUser>();

  readonly displayName = computed(() => this.user().base?.nickname ?? 'User');
  readonly initials = computed(() => initialsFrom(this.displayName()));

  readonly isGhost = computed(() => this.user().isGhost === true);
  readonly isSelf = computed(() => this.user().userId === this.currentUserId() && this.currentUserId() !== 0);

  readonly hostLang = computed(() => {
    const langId = this.user().base?.nativeLang;
    return langId ? getLanguageById(langId) : null;
  });

  readonly ringColor = computed(() => {
    const lang = this.hostLang()?.name ?? '';
    if (lang.includes('English')) return 'var(--color-neutral-300)';
    if (lang.includes('Japanese')) return 'var(--color-warm-300)';
    if (lang.includes('Korean')) return 'var(--color-primary-300)';
    if (lang.includes('Chinese')) return 'var(--color-warm-400)';
    if (lang.includes('Spanish')) return 'var(--color-warm-400)';
    return 'var(--color-border)';
  });

  readonly modeLabel = computed(() => {
    if (this.isGhost()) return '';
    return this.user().role === UserRole.Moderator ? 'MOD' : '';
  });

  readonly modeBadgeClass = computed(() => {
    if (this.isGhost()) return 'ghost';
    return this.user().role === UserRole.Moderator ? 'moderator' : 'normal';
  });

  readonly ariaLabel = computed(() => {
    const u = this.user();
    const parts = [this.displayName(), this.modeLabel()];
    if (this.isGhost()) parts.push('connecting');
    if (u.isRaiseHand) parts.push('hand raised');
    return parts.filter(Boolean).join(', ');
  });

  emitInvite(event: Event): void {
    event.stopPropagation();
    this.invite.emit(this.user());
  }

  onGridClick(): void {
    if (this.isGhost()) return;
    this.userClick.emit(this.user());
  }
}