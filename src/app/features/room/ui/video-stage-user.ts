import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  DestroyRef,
  inject,
  effect,
  viewChild,
  ElementRef,
} from '@angular/core';
import { StageUser } from '../data/room-model';
import { UserRole } from '@core/models/user-role';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { LucideMicOff, LucideCrown } from '@lucide/angular';

export interface PlayableVideoTrack {
  play(container: HTMLElement): void;
  stop(): void;
}

@Component({
  selector: 'app-video-stage-user',
  imports: [AvatarComponent, LucideMicOff, LucideCrown],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      class="tile"
      type="button"
      [class.speaking]="isActiveSpeaker()"
      [attr.aria-label]="ariaLabel()"
      (click)="userClick.emit(user())"
    >
      <div class="video-container">
        @if (isActiveSpeaker()) {
          <div class="speak-ring" aria-hidden="true"></div>
        }

        @if (hasVideoTrack()) {
          <div #videoContainer class="video-feed"></div>
        } @else {
          <div class="avatar-fallback">
            <app-avatar [src]="user().headUrl || ''" size="xl" [alt]="user().nickname" />
          </div>
        }

        @if (isHost()) {
          <div class="crown-badge" aria-hidden="true">
            <svg lucideCrown [size]="10" />
          </div>
        }

        @if (!user().isTurnOnMic) {
          <div class="mic-badge" aria-hidden="true">
            <svg lucideMicOff [size]="10" />
          </div>
        }

        <div class="name-overlay">
          <span class="name">{{ user().nickname }}</span>
          @if (user().isAiUser) {
            <span class="role-badge ai">AI</span>
          } @else if (roleLabel()) {
            <span class="role-badge" [class]="roleBadgeClass()">{{ roleLabel() }}</span>
          } @else {
            <span class="role-badge speaker">SPK</span>
          }
        </div>
      </div>
    </button>
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .tile {
        position: relative;
        padding: 0;
        border: none;
        border-radius: var(--radius-lg);
        background: transparent;
        cursor: pointer;
        overflow: hidden;
        width: 100%;
      }
      .tile:focus-visible {
        outline: var(--focus-ring);
        outline-offset: 2px;
      }

      .video-container {
        position: relative;
        width: 100%;
        height: 100%;
        background: var(--color-neutral-200);
        border-radius: var(--radius-lg);
        overflow: hidden;
      }
      :host-context(.dark) .video-container {
        background: var(--color-neutral-700);
      }

      .speak-ring {
        position: absolute;
        inset: 0;
        border-radius: var(--radius-lg);
        border: 2px solid var(--color-accent-400);
        pointer-events: none;
        z-index: 2;
      }
      :host-context(.dark) .speak-ring {
        border-color: var(--color-accent-400);
      }

      .video-feed {
        width: 100%;
        height: 100%;
      }

      .avatar-fallback {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .crown-badge {
        position: absolute;
        top: 4px;
        left: 4px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: var(--color-gold-100);
        border: 1px solid var(--color-gold-200);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-gold-500);
        z-index: 3;
      }
      :host-context(.dark) .crown-badge {
        background: var(--color-gold-900);
        border-color: var(--color-gold-700);
        color: var(--color-gold-300);
      }

      .mic-badge {
        position: absolute;
        bottom: 8px;
        right: 8px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: var(--color-warm-500);
        border: 1.5px solid var(--color-card);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        z-index: 3;
      }
      :host-context(.dark) .mic-badge {
        background: var(--color-warm-600);
        border-color: var(--color-neutral-800);
      }

      .name-overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 4px 8px;
        background: rgba(0, 0, 0, 0.5);
        color: #fff;
        display: flex;
        align-items: center;
        gap: 4px;
        z-index: 3;
      }
      .name-overlay .name {
        font-size: var(--text-xs);
        font-weight: var(--font-medium);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 120px;
      }

      .role-badge {
        font-size: 9px;
        font-weight: var(--font-bold);
        letter-spacing: 0.5px;
        text-transform: uppercase;
        padding: 1px 5px;
        border-radius: var(--radius-full);
        background: rgba(255, 255, 255, 0.2);
      }
      .role-badge.host {
        background: var(--color-primary-500);
        color: #fff;
      }
      .role-badge.mod {
        background: var(--color-gold-400);
        color: var(--color-gold-900);
      }
      .role-badge.speaker {
        background: rgba(255, 255, 255, 0.15);
        color: #fff;
      }
      .role-badge.ai {
        background: color-mix(in srgb, var(--color-accent-400) 70%, #fff);
        color: var(--color-accent-900);
      }
    `,
  ],
})
export class VideoStageUserComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly user = input.required<StageUser>();
  readonly videoTrack = input<PlayableVideoTrack | null>(null);
  readonly speaking = input(false);
  readonly userClick = output<StageUser>();

  readonly hasVideoTrack = computed(() => this.videoTrack() !== null);

  private readonly videoContainerRef = viewChild<ElementRef<HTMLDivElement>>('videoContainer');

  protected readonly isActiveSpeaker = computed(() => this.speaking() && this.user().isTurnOnMic);

  protected readonly isHost = computed(() => this.user().role === UserRole.Host);
  protected readonly isModerator = computed(() => this.user().role === UserRole.Moderator);
  protected readonly roleLabel = computed(() => {
    if (this.isHost()) return 'HOST';
    if (this.isModerator()) return 'MOD';
    return '';
  });
  protected readonly roleBadgeClass = computed(() => this.roleLabel().toLowerCase());

  constructor() {
    let attached: PlayableVideoTrack | null = null;
    effect(() => {
      const track = this.videoTrack();
      const container = this.videoContainerRef();

      if (track !== attached) {
        attached?.stop();
        attached = track;
      }

      if (track && container) {
        (track as any).play(container.nativeElement, { fit: 'cover' });
      }
    });
    this.destroyRef.onDestroy(() => attached?.stop());
  }

  protected readonly ariaLabel = computed(() => {
    const u = this.user();
    const parts = [u.nickname];
    if (this.roleLabel()) parts.push(this.roleLabel());
    parts.push(!u.isTurnOnMic ? 'muted' : this.isActiveSpeaker() ? 'speaking' : 'mic on');
    parts.push(this.hasVideoTrack() ? 'camera on' : 'camera off');
    return parts.join(', ');
  });
}
