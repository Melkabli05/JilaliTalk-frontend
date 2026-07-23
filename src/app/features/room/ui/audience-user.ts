import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { AudienceUser } from '../models/room-model';
import { UserRole } from '@core/models/user-role';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { getLanguageById } from '@shared/data/languages';
import { initialsFrom } from '@shared/utils';
import { LucideArrowUpToLine, LucideGhost, LucideHand, LucideMic, LucideMicOff, LucideRefreshCw } from '@lucide/angular';
import {
  audienceAriaLabel,
  audienceLanguageRingColor,
  audienceModeBadgeClass,
  audienceModeLabel,
} from './audience-user.util';

export type AudienceUserDisplay = 'grid' | 'list';

@Component({
  selector: 'app-audience-user',

  imports: [AvatarComponent, LucideArrowUpToLine, LucideGhost, LucideHand, LucideMic, LucideMicOff, LucideRefreshCw],
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
          <div class="hand-indicator" aria-hidden="true">
            <svg lucideHand [size]="10"></svg>
          </div>
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

        @if (isSelf()) {
          <button
            type="button"
            class="self-mic-btn"
            [class.on]="isMicOn()"
            [class.ghost]="isGhost()"
            [disabled]="speakBusy()"
            (click)="emitSpeak($event)"
            [attr.aria-label]="isMicOn() ? 'Stop speaking from audience' : 'Speak from audience'"
            [attr.aria-pressed]="isMicOn()"
            [title]="isMicOn() ? 'Stop speaking' : isGhost() ? 'Speak invisibly (ghost mic)' : 'Speak from audience'"
          >
            @if (speakBusy()) {
              <svg aria-hidden="true" lucideRefreshCw [size]="10" class="spinning"></svg>
            } @else if (isMicOn()) {
              <svg aria-hidden="true" lucideMic [size]="10"></svg>
            } @else {
              <svg aria-hidden="true" lucideMicOff [size]="10"></svg>
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
            <div class="raise-hand-indicator" aria-hidden="true">
              <svg lucideHand [size]="14"></svg>
            </div>
          }
          @if (isSelf()) {
            <button
              type="button"
              class="self-mic-btn list"
              [class.on]="isMicOn()"
              [class.ghost]="isGhost()"
              [disabled]="speakBusy()"
              (click)="emitSpeak($event)"
              [attr.aria-label]="isMicOn() ? 'Stop speaking from audience' : 'Speak from audience'"
              [attr.aria-pressed]="isMicOn()"
              [title]="isMicOn() ? 'Stop speaking' : isGhost() ? 'Speak invisibly (ghost mic)' : 'Speak from audience'"
            >
              @if (speakBusy()) {
                <svg aria-hidden="true" lucideRefreshCw [size]="12" class="spinning"></svg>
              } @else if (isMicOn()) {
                <svg aria-hidden="true" lucideMic [size]="12"></svg>
              } @else {
                <svg aria-hidden="true" lucideMicOff [size]="12"></svg>
              }
            </button>
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
    :host {
      display: contents;

      --au-hover-bg: var(--color-neutral-50);
      --au-invite-overlay-bg: var(--color-primary-500);
      --au-ghost-bg: var(--color-neutral-700);
      --au-ghost-fg: var(--color-neutral-100);
      --au-ghost-border: var(--color-card);
      --au-hand-bg: var(--color-card);
      --au-hand-border: var(--color-border);
      --au-mode-normal-bg: var(--color-neutral-100);
      --au-mode-normal-fg: var(--color-text-muted);
      --au-mode-mod-bg: var(--color-primary-50);
      --au-mode-mod-fg: var(--color-primary-600);
      --au-nickname: var(--color-text);
      --au-meta: var(--color-text-muted);
      --au-you-bg: var(--color-primary-50);
      --au-you-fg: var(--color-primary-600);
      --au-invite-bg: var(--color-primary-50);
      --au-invite-fg: var(--color-primary-500);
      --au-invite-hover-bg: var(--color-primary-100);
    }
    :host-context(.dark) {
      --au-hover-bg: var(--color-neutral-800);
      --au-invite-overlay-bg: var(--color-primary-400);
      --au-ghost-bg: var(--color-neutral-600);
      --au-ghost-fg: var(--color-neutral-100);
      --au-ghost-border: var(--color-neutral-800);
      --au-hand-bg: var(--color-neutral-800);
      --au-hand-border: var(--color-neutral-700);
      --au-mode-normal-bg: var(--color-neutral-700);
      --au-mode-normal-fg: var(--color-neutral-300);
      --au-mode-mod-bg: var(--color-primary-900);
      --au-mode-mod-fg: var(--color-primary-300);
      --au-nickname: var(--color-neutral-100);
      --au-meta: var(--color-neutral-400);
      --au-you-bg: var(--color-primary-900);
      --au-you-fg: var(--color-primary-300);
      --au-invite-bg: var(--color-primary-900);
      --au-invite-fg: var(--color-primary-300);
      --au-invite-hover-bg: var(--color-primary-800);
    }

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
    .audience-user.grid:hover { background: var(--au-hover-bg); }

    .av-button {
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      border: none; background: none; cursor: pointer; padding: 0;
    }
    .av-button:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); border-radius: var(--radius-md); }

    .invite-overlay-btn {
      position: absolute; top: 0; right: 0;
      width: 20px; height: 20px; border-radius: var(--radius-md);
      background: var(--au-invite-overlay-bg); color: var(--color-on-color); border: none;
      display: flex; align-items: center; justify-content: center; cursor: pointer;
      opacity: 0; transition: opacity 0.15s;
    }
    .audience-user.grid:hover .invite-overlay-btn,
    .invite-overlay-btn:focus-visible { opacity: 1; }
    .invite-overlay-btn:focus-visible { outline: var(--focus-ring); outline-offset: 1px; }
    .invite-overlay-btn:disabled { cursor: not-allowed; opacity: 0.7; }

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
    .mode-badge.normal { background: var(--au-mode-normal-bg); color: var(--au-mode-normal-fg); }
    .mode-badge.moderator { background: var(--au-mode-mod-bg); color: var(--au-mode-mod-fg); }
    .mode-badge.ghost { background: var(--color-neutral-700); color: var(--color-neutral-100); }

    .ghost-indicator {
      position: absolute; bottom: -2px; right: -2px;
      width: 16px; height: 16px; border-radius: 50%;
      background: var(--au-ghost-bg); color: var(--au-ghost-fg);
      border: 1px solid var(--au-ghost-border);
      display: flex; align-items: center; justify-content: center;
    }

    .av-wrap { position: relative; display: inline-flex; border-radius: 50%; }

    .hand-indicator {
      position: absolute; top: -2px; right: -2px;
      width: 16px; height: 16px; border-radius: 50%;
      background: var(--au-hand-bg); border: 1px solid var(--au-hand-border);
      display: flex; align-items: center; justify-content: center;
      font-size: var(--text-2xs); line-height: 1;
    }

    .audience-user.list {
      display: flex; align-items: center; gap: var(--space-3);
      width: 100%; padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-xl); text-align: left;
    }
    .audience-user.list:hover { background: var(--au-hover-bg); }

    .info-col { flex: 1; min-width: 0; }
    .name-row { display: flex; align-items: center; gap: var(--space-1); }
    .nickname {
      font-size: var(--text-xs); font-weight: var(--font-semibold);
      color: var(--au-nickname);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .you-badge {
      font-size: var(--text-2xs); font-weight: var(--font-bold);
      background: var(--au-you-bg); color: var(--au-you-fg);
      padding: 0 4px; border-radius: var(--radius-sm);
    }

    .meta-row { display: flex; align-items: center; gap: var(--space-1); margin-top: 1px; }
    .level-badge,
    .meta-sep,
    .learning-langs { font-size: var(--text-2xs); color: var(--au-meta); }
    .learning-langs { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .action-col { flex-shrink: 0; display: flex; align-items: center; gap: var(--space-1); }

    .raise-hand-indicator {
      width: 24px; height: 24px; border-radius: 50%;
      background: var(--color-warm-400); display: flex; align-items: center; justify-content: center;
      color: var(--color-on-color);
      font-size: 11px;
    }

    .invite-btn {
      width: 32px; height: 32px; border-radius: var(--radius-lg);
      display: flex; align-items: center; justify-content: center;
      background: var(--au-invite-bg); color: var(--au-invite-fg);
      border: none; cursor: pointer; transition: background 0.15s, opacity 0.15s;
    }
    .invite-btn:hover { background: var(--au-invite-hover-bg); }
    .invite-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .invite-btn:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }

    /* "Speak from audience" mic — rendered on the local user's own row only. Sits at the
       same anchor as the invite-overlay-btn (top-right of the avatar) so the two never
       collide (host sees invite, self sees mic). Grid variant is small + circular and
       lights up primary when active. List variant mirrors the invite-btn style. */
    .self-mic-btn {
      position: absolute; top: 0; right: 0;
      width: 20px; height: 20px; border-radius: var(--radius-md);
      background: var(--au-invite-bg); color: var(--au-invite-fg);
      border: none; display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: background 0.15s, color 0.15s;
    }
    .self-mic-btn.on { background: var(--au-invite-overlay-bg); color: var(--color-on-color); }
    /* Invisible ('ghost') local-user row — use the ghost-muted palette so the affordance
       reads as 'invisible mic', distinct from the visible audience mic. */
    .self-mic-btn.ghost { background: var(--au-ghost-bg); color: var(--au-ghost-fg); border: 1px dashed var(--au-ghost-border); }
    .self-mic-btn.ghost.on { background: var(--au-invite-overlay-bg); color: var(--color-on-color); border-style: solid; }
    .self-mic-btn:hover { background: var(--au-invite-hover-bg); }
    .self-mic-btn.ghost:hover { background: var(--au-ghost-bg); opacity: 0.85; }
    .self-mic-btn.on:hover { background: var(--au-invite-overlay-bg); opacity: 0.9; }
    .self-mic-btn:disabled { opacity: 0.7; cursor: not-allowed; }
    .self-mic-btn:focus-visible { outline: var(--focus-ring); outline-offset: 1px; }

    .self-mic-btn.list {
      position: static; width: 32px; height: 32px; border-radius: var(--radius-lg);
    }
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
  /** True when the local user is currently publishing audio from the audience row. */
  readonly isMicOn = input<boolean>(false);
  /** True while the local mic-toggle request is in flight. */
  readonly speakBusy = input<boolean>(false);

  readonly invite = output<AudienceUser>();
  readonly userClick = output<AudienceUser>();
  /** Emitted when the local user taps their own audience-row mic button. */
  readonly speak = output<void>();

  readonly displayName = computed(() => this.user().base?.nickname ?? 'User');
  readonly initials = computed(() => initialsFrom(this.displayName()));

  readonly isGhost = computed(() => this.user().isGhost === true);
  readonly isSelf = computed(() => this.user().userId === this.currentUserId() && this.currentUserId() !== 0);

  readonly hostLang = computed(() => {
    const langId = this.user().base?.nativeLang;
    return langId ? getLanguageById(langId) : null;
  });

  readonly ringColor = computed(() => audienceLanguageRingColor(this.hostLang()?.name));

  readonly modeLabel = computed(() => audienceModeLabel(this.user().role, this.isGhost()));

  readonly modeBadgeClass = computed(() => audienceModeBadgeClass(this.user().role, this.isGhost()));

  readonly ariaLabel = computed(() =>
    audienceAriaLabel(this.user(), this.displayName(), this.modeLabel(), this.isGhost()),
  );

  emitInvite(event: Event): void {
    event.stopPropagation();
    this.invite.emit(this.user());
  }

  emitSpeak(event: Event): void {
    event.stopPropagation();
    this.speak.emit();
  }

  onGridClick(): void {
    this.userClick.emit(this.user());
  }
}