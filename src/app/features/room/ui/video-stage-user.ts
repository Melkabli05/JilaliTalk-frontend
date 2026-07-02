import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  DestroyRef,
  inject,
  effect,
  viewChild,
  ElementRef,
} from '@angular/core';
import { StageUser } from '../data/room-model';
import { UserRole } from '@core/models/user-role';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { LucideMicOff, LucideCrown, LucideMaximize2, LucideMinimize2 } from '@lucide/angular';

export interface PlayableVideoTrack {
  play(container: HTMLElement): void;
  stop(): void;
}

@Component({
  selector: 'app-video-stage-user',
  imports: [AvatarComponent, LucideMicOff, LucideCrown, LucideMaximize2, LucideMinimize2],
  host: {
    '(document:fullscreenchange)': 'onFullscreenChange()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="tile"
      role="button"
      tabindex="0"
      [class.speaking]="isActiveSpeaker()"
      [attr.aria-label]="ariaLabel()"
      (click)="userClick.emit(user())"
      (keydown.enter)="userClick.emit(user())"
      (keydown.space)="$event.preventDefault(); userClick.emit(user())"
    >
      <div class="video-container" #tileContainer>
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

        <button
          class="expand-btn"
          type="button"
          (click)="onExpandClick($event)"
          [attr.aria-label]="expanded() ? 'Exit fullscreen' : 'Fullscreen'"
        >
          @if (expanded()) {
            <svg aria-hidden="true" lucideMinimize2 [size]="11" />
          } @else {
            <svg aria-hidden="true" lucideMaximize2 [size]="11" />
          }
        </button>

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
    </div>
  `,
  styles: [
    `
      :host {
        display: contents;

        --vsu-video-bg: var(--color-neutral-200);
        --vsu-crown-bg: var(--color-gold-100);
        --vsu-crown-border: var(--color-gold-200);
        --vsu-crown-fg: var(--color-gold-500);
        --vsu-mic-bg: var(--color-warm-500);
        --vsu-mic-border: var(--color-card);
        --vsu-overlay-bg: color-mix(in srgb, var(--color-black) 50%, transparent);
        --vsu-overlay-hover-bg: color-mix(in srgb, var(--color-black) 70%, transparent);
        --vsu-overlay-fg: var(--color-on-color);
        --vsu-badge-default-bg: color-mix(in srgb, var(--color-on-color) 20%, transparent);
        --vsu-badge-default-fg: var(--color-on-color);
        --vsu-badge-speaker-bg: color-mix(in srgb, var(--color-on-color) 15%, transparent);
      }
      :host-context(.dark) {
        --vsu-video-bg: var(--color-neutral-700);
        --vsu-crown-bg: var(--color-gold-900);
        --vsu-crown-border: var(--color-gold-700);
        --vsu-crown-fg: var(--color-gold-300);
        --vsu-mic-bg: var(--color-warm-600);
        --vsu-mic-border: var(--color-neutral-800);
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
        background: var(--vsu-video-bg);
        border-radius: var(--radius-lg);
        overflow: hidden;
      }

      .video-container:fullscreen {
        border-radius: 0;
        background: var(--color-black);
      }

      .expand-btn {
        position: absolute;
        top: 4px;
        right: 4px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: var(--vsu-overlay-bg);
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--vsu-overlay-fg);
        cursor: pointer;
        z-index: 3;
      }
      .expand-btn:hover {
        background: var(--vsu-overlay-hover-bg);
      }
      .expand-btn:focus-visible {
        outline: var(--focus-ring);
        outline-offset: 2px;
      }

      .speak-ring {
        position: absolute;
        inset: 0;
        border-radius: var(--radius-lg);
        border: 2px solid var(--color-accent-400);
        pointer-events: none;
        z-index: 2;
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
        background: var(--vsu-crown-bg);
        border: 1px solid var(--vsu-crown-border);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--vsu-crown-fg);
        z-index: 3;
      }

      .mic-badge {
        position: absolute;
        bottom: 8px;
        right: 8px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: var(--vsu-mic-bg);
        border: 1.5px solid var(--vsu-mic-border);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-on-color);
        z-index: 3;
      }

      .name-overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 4px 8px;
        background: var(--vsu-overlay-bg);
        color: var(--vsu-overlay-fg);
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
        font-size: var(--text-2xs);
        font-weight: var(--font-bold);
        letter-spacing: 0.5px;
        text-transform: uppercase;
        padding: 1px 5px;
        border-radius: var(--radius-full);
        background: var(--vsu-badge-default-bg);
      }
      .role-badge.host {
        background: var(--color-primary-500);
        color: var(--color-on-color);
      }
      .role-badge.mod {
        background: var(--color-gold-400);
        color: var(--color-gold-900);
      }
      .role-badge.speaker {
        background: var(--vsu-badge-speaker-bg);
        color: var(--vsu-badge-default-fg);
      }
      .role-badge.ai {
        background: color-mix(in srgb, var(--color-accent-400) 70%, var(--color-on-color));
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
  private readonly tileContainerRef = viewChild<ElementRef<HTMLDivElement>>('tileContainer');
  readonly expanded = signal(false);

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

  onExpandClick(event: Event): void {
    event.stopPropagation();
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    const el = this.tileContainerRef()?.nativeElement;
    void el?.requestFullscreen().catch(() => {});
  }

  onFullscreenChange(): void {
    this.expanded.set(document.fullscreenElement === this.tileContainerRef()?.nativeElement);
  }
}
