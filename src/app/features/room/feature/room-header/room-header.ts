import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  inject,
  DestroyRef,
  ElementRef,
  viewChild,
} from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import {
  LucideCopy,
  LucideCheck,
  LucideVideoOff,
  LucideMonitorUp,
  LucideHand,
  LucideHandMetal,
  LucideArrowDownToLine,
  LucideLogIn,
  LucideGift,
  LucideSettings,
  LucideLogOut,
  LucideMusic,
  LucideRefreshCw,
  LucideEyeOff,
  LucideEye,
  LucideShield,
  LucideStar,
  LucideCaptions,
  LucideCaptionsOff,
  LucideEllipsisVertical,
  LucideX,
  LucideMinimize2,
} from '@lucide/angular';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import { MicButtonComponent } from '../../ui/mic-button';
import { AvSettingsComponent } from '../audio-settings/av-settings';

@Component({
  selector: 'app-room-header',

  imports: [
    MicButtonComponent,
    TooltipDirective,
    AvSettingsComponent,
    LucideCopy,
    LucideCheck,
    LucideVideoOff,
    LucideMonitorUp,
    LucideHand,
    LucideHandMetal,
    LucideArrowDownToLine,
    LucideLogIn,
    LucideGift,
    LucideSettings,
    LucideLogOut,
    LucideMusic,
    LucideRefreshCw,
    LucideEyeOff,
    LucideEye,
    LucideShield,
    LucideStar,
    LucideCaptions,
    LucideCaptionsOff,
    LucideEllipsisVertical,
    LucideX,
    LucideMinimize2,
  ],
  host: {
    '(document:keydown.escape)': 'closeOverflow(); closeRoomInfo();',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="room-header">
      <div class="header-left">
        <div
          class="ws-status"
          [class.ws-connected]="wsStatus() === 'connected'"
          [class.ws-reconnecting]="wsStatus() === 'reconnecting'"
          [class.ws-connecting]="wsStatus() === 'connecting'"
          [class.ws-disconnected]="wsStatus() === 'disconnected'"
          [class.ws-tappable]="wsStatus() === 'disconnected'"
          [appTooltip]="wsTooltip()"
          tooltipPosition="right"
          [attr.role]="wsStatus() === 'disconnected' ? 'button' : null"
          [attr.tabindex]="wsStatus() === 'disconnected' ? 0 : null"
          [attr.aria-label]="wsStatus() === 'disconnected' ? 'Disconnected — tap to refresh' : 'WebSocket connection status'"
          (click)="onStatusClick()"
          (keydown.enter)="onStatusClick()"
          (keydown.space)="$event.preventDefault(); onStatusClick()"
        ></div>
        <span class="visually-hidden" aria-live="polite">{{ wsTooltip() }}</span>
        <div class="room-meta">
          <button
            #roomNameBtn
            type="button"
            class="room-name-btn"
            [attr.aria-expanded]="showRoomInfo()"
            aria-haspopup="dialog"
            aria-label="Room info"
            (click)="toggleRoomInfo()"
          >
            <h1 class="room-name">{{ name() }}</h1>
          </button>
          @if (showRoomInfo()) {
            <div class="info-backdrop" (click)="closeRoomInfo()"></div>
            <div
              #roomInfoPanel
              class="room-info-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Room info"
              tabindex="-1"
            >
              <div class="room-info-row">
                <span class="room-info-label">Topic</span>
                <span class="room-info-value">{{ topic() || 'No topic set' }}</span>
              </div>
              <div class="room-info-row">
                <span class="room-info-label">Room ID</span>
                <button type="button" class="room-info-copy" (click)="copyCname()">
                  <span class="cname-text">{{ cname() }}</span>
                  @if (cnameCopied()) {
                    <svg aria-hidden="true" lucideCheck [size]="16"></svg>
                  } @else {
                    <svg aria-hidden="true" lucideCopy [size]="16"></svg>
                  }
                </button>
              </div>
              <button
                type="button"
                class="room-info-visibility"
                (click)="onToggleInvisible(); closeRoomInfo()"
              >
                @if (invisible()) {
                  <svg aria-hidden="true" lucideEyeOff [size]="18"></svg>
                } @else {
                  <svg aria-hidden="true" lucideEye [size]="18"></svg>
                }
                <span>{{ visibilityTooltip() }}</span>
              </button>
            </div>
          }
        </div>
      </div>

      <div class="header-center">
        <!-- Invisible: all media controls are hidden — mic, cam, screen are meaningless -->
        @if (!invisible()) {
          <div class="media-controls">
            <app-mic-button
              class="tip"
              [appTooltip]="isMicOn() ? 'Mute' : 'Speak'"
              tooltipPosition="bottom"
              [isOn]="isMicOn()"
              [speaking]="micSpeaking()"
              [busy]="micBusy()"
              (toggled)="onToggleMic()"
            />

            @if (isCamOn() !== false) {
              <button
                class="toolbar-btn c-cam hide-mobile"
                [class.active]="isCamOn()"
                [class.highlight]="isCamOn()"
                [appTooltip]="isCamOn() ? 'Turn off camera' : 'Turn on camera'"
                tooltipPosition="bottom"
                [disabled]="camBusy()"
                (click)="onToggleCam()"
                aria-label="Toggle camera"
              >
                <svg aria-hidden="true" lucideVideoOff [size]="18"></svg>
              </button>
              <button
                class="toolbar-btn c-screen hide-mobile"
                appTooltip="Screen share"
                tooltipPosition="bottom"
                (click)="onToggleCamOrShare()"
                aria-label="Screen share"
              >
                <svg aria-hidden="true" lucideMonitorUp [size]="18"></svg>
              </button>
              <div class="toolbar-sep hide-mobile"></div>
            }

            <button
              class="toolbar-btn c-hand"
              [class.highlight]="handIcon() === 'lower-hand'"
              [class.c-hand-leave]="handIcon() === 'leave-stage'"
              [class.c-hand-join]="handIcon() === 'join-stage'"
              [appTooltip]="handTooltip()"
              tooltipPosition="bottom"
              (click)="onToggleHand()"
              [attr.aria-label]="handTooltip()"
            >
              @switch (handIcon()) {
                @case ('leave-stage') {
                  <svg aria-hidden="true" lucideArrowDownToLine [size]="18"></svg>
                }
                @case ('lower-hand') {
                  <svg aria-hidden="true" lucideHandMetal [size]="18"></svg>
                }
                @case ('join-stage') {
                  <svg aria-hidden="true" lucideLogIn [size]="18"></svg>
                }
                @default {
                  <svg aria-hidden="true" lucideHand [size]="18"></svg>
                }
              }
            </button>
          </div>
        }

        <!-- Always visible on every screen size: refresh, next to the more-actions button -->
        <button
          class="toolbar-btn c-refresh"
          [appTooltip]="refreshing() ? 'Refreshing…' : 'Refresh'"
          tooltipPosition="bottom"
          [disabled]="refreshing()"
          (click)="onRefresh()"
          aria-label="Refresh room info"
        >
          <svg aria-hidden="true" lucideRefreshCw [size]="18" [class.spinning]="refreshing()"></svg>
        </button>

        <button
          #moreBtn
          class="toolbar-btn c-more"
          appTooltip="More actions"
          tooltipPosition="bottom"
          aria-label="More actions"
          [attr.aria-expanded]="showOverflow()"
          aria-haspopup="dialog"
          (click)="toggleOverflow()"
        >
          <svg aria-hidden="true" lucideEllipsisVertical [size]="18"></svg>
        </button>
      </div>

      <div class="header-right">
        <div class="secondary-actions hide-mobile">
          <!-- Engagement actions that reveal identity — hidden when invisible -->
          @if (!invisible()) {
            <div class="engagement-controls">
              <button
                class="toolbar-btn c-gift"
                appTooltip="Send gift"
                tooltipPosition="bottom"
                (click)="onGift()"
                aria-label="Send gift"
              >
                <svg aria-hidden="true" lucideGift [size]="18"></svg>
              </button>
              <button
                class="toolbar-btn c-pitch"
                appTooltip="Voice pitch"
                tooltipPosition="bottom"
                (click)="onPitch()"
                aria-label="Pitch settings"
              >
                <svg aria-hidden="true" lucideMusic [size]="18"></svg>
              </button>
              <button
                class="toolbar-btn c-reward"
                appTooltip="Daily rewards"
                tooltipPosition="bottom"
                (click)="onReward()"
                aria-label="Daily rewards"
              >
                <svg aria-hidden="true" lucideStar [size]="18"></svg>
              </button>
              <button
                class="toolbar-btn c-settings"
                [class.active]="showSettings()"
                appTooltip="Noise suppression"
                tooltipPosition="bottom"
                (click)="showSettings.set(!showSettings())"
                aria-label="Noise suppression settings"
              >
                <svg aria-hidden="true" lucideSettings [size]="18"></svg>
              </button>
              @if (showSettings()) {
                <app-av-settings (onClose)="showSettings.set(false)" />
              }
            </div>
          }

          <button
            class="toolbar-btn c-managers"
            appTooltip="Managers"
            tooltipPosition="bottom"
            (click)="onManagers()"
            aria-label="View room managers"
          >
            <svg aria-hidden="true" lucideShield [size]="18"></svg>
          </button>

          <!-- Captions: always visible — useful for watching in any mode -->
          <button
            class="toolbar-btn c-captions"
            [class.active]="captionEnabled()"
            [appTooltip]="captionEnabled() ? 'Turn off captions' : 'Turn on captions'"
            tooltipPosition="bottom"
            (click)="onToggleCaption()"
            [attr.aria-label]="captionEnabled() ? 'Turn off captions' : 'Turn on captions'"
          >
            @if (captionEnabled()) {
              <svg aria-hidden="true" lucideCaptions [size]="18"></svg>
            } @else {
              <svg aria-hidden="true" lucideCaptionsOff [size]="18"></svg>
            }
          </button>
        </div>

        <button
          class="toolbar-btn"
          appTooltip="Minimize"
          tooltipPosition="left"
          (click)="onMinimize()"
          aria-label="Minimize room"
        >
          <svg aria-hidden="true" lucideMinimize2 [size]="18"></svg>
        </button>

        <button
          class="toolbar-btn danger"
          appTooltip="Leave room"
          tooltipPosition="left"
          (click)="onLeave()"
          aria-label="Leave room"
        >
          <svg aria-hidden="true" lucideLogOut [size]="18"></svg>
        </button>
      </div>
    </header>

    @if (showOverflow()) {
      <div class="overflow-backdrop" (click)="closeOverflow()"></div>
      <div
        #overflowPanel
        class="overflow-panel"
        role="dialog"
        aria-modal="true"
        aria-label="More actions"
        tabindex="-1"
        (touchstart)="onTouchStart($event)"
        (touchmove)="onTouchMove($event)"
        (touchend)="onTouchEnd($event)"
      >
        <div class="overflow-handle" aria-hidden="true"></div>
        <div class="overflow-header">
          <span class="overflow-title">More actions</span>
          <button class="icon-btn" aria-label="Close menu" (click)="closeOverflow()">
            <svg aria-hidden="true" lucideX [size]="18"></svg>
          </button>
        </div>

        <!-- Section 1: Identity — always visible -->
        <div class="overflow-list">
          <button class="overflow-row" (click)="onToggleInvisible()">
            @if (invisible()) {
              <svg aria-hidden="true" lucideEye [size]="20"></svg>
            } @else {
              <svg aria-hidden="true" lucideEyeOff [size]="20"></svg>
            }
            <span class="row-label">{{ invisible() ? 'Go visible' : 'Go invisible' }}</span>
          </button>
          <button class="overflow-row" (click)="onManagers()">
            <svg aria-hidden="true" lucideShield [size]="20"></svg>
            <span class="row-label">Managers</span>
          </button>
        </div>

        <div class="overflow-divider"></div>

        <!-- Section 2: Moderation (identity-neutral) -->
        <div class="overflow-list">
          <button class="overflow-row" (click)="onReward()">
            <svg aria-hidden="true" lucideStar [size]="20"></svg>
            <span class="row-label">Daily rewards</span>
          </button>
        </div>

        <div class="overflow-divider"></div>

        <!-- Section 3: Captions — always visible (useful for watching) -->
        <div class="overflow-list">
          <button class="overflow-row" (click)="onToggleCaption()">
            @if (captionEnabled()) {
              <svg aria-hidden="true" lucideCaptions [size]="20"></svg>
            } @else {
              <svg aria-hidden="true" lucideCaptionsOff [size]="20"></svg>
            }
            <span class="row-label">{{ captionEnabled() ? 'Captions on' : 'Captions off' }}</span>
            @if (captionEnabled()) {
              <span class="row-badge active">On</span>
            }
          </button>
        </div>

        <!-- Section 4: Media — hidden when invisible (mic/cam/pitch = broadcasting only) -->
        @if (!invisible()) {
          <div class="overflow-divider"></div>
          <div class="overflow-list">
            @if (isCamOn() !== false) {
              <button class="overflow-row" (click)="onToggleCam()">
                <svg aria-hidden="true" lucideVideoOff [size]="20"></svg>
                <span class="row-label">{{ isCamOn() ? 'Stop camera' : 'Start camera' }}</span>
              </button>
              <button class="overflow-row" (click)="onToggleCamOrShare()">
                <svg aria-hidden="true" lucideMonitorUp [size]="20"></svg>
                <span class="row-label">Share screen</span>
              </button>
            }
            <button class="overflow-row" (click)="onPitch()">
              <svg aria-hidden="true" lucideMusic [size]="20"></svg>
              <span class="row-label">Voice pitch</span>
            </button>
            <button class="overflow-row" (click)="showSettings.set(!showSettings())">
              <svg aria-hidden="true" lucideSettings [size]="20"></svg>
              <span class="row-label">Mic settings</span>
            </button>
          </div>
          @if (showSettings()) {
            <app-av-settings (onClose)="showSettings.set(false)" />
          }
        }

        <div class="overflow-divider"></div>

        <!-- Section 5: Engagement — hidden when invisible (reveals identity) -->
        @if (!invisible()) {
          <div class="overflow-list">
            <button class="overflow-row overflow-row-primary" (click)="onGift()">
              <svg aria-hidden="true" lucideGift [size]="20"></svg>
              <span class="row-label">Send a gift</span>
            </button>
          </div>
        }
      </div>
    }
  `,
  styleUrl: './room-header.scss',
})
export class RoomHeaderComponent {
  readonly name = input<string>('');
  readonly topic = input<string>('');
  readonly cname = input<string>('');
  readonly isMicOn = input<boolean>(false);
  readonly micSpeaking = input<boolean>(false);
  readonly micBusy = input<boolean>(false);
  readonly isCamOn = input<boolean>(false);
  readonly camBusy = input<boolean>(false);
  readonly isHandRaised = input<boolean>(false);
  readonly isOnStage = input<boolean>(false);
  readonly isModerator = input<boolean>(false);
  readonly refreshing = input<boolean>(false);
  readonly invisible = input<boolean>(false);
  readonly captionEnabled = input<boolean>(false);
  readonly wsStatus = input<'connecting' | 'connected' | 'reconnecting' | 'disconnected'>(
    'disconnected',
  );

  readonly leave = output<void>();
  readonly minimize = output<void>();
  readonly refresh = output<void>();
  readonly toggleMic = output<void>();
  readonly toggleCam = output<void>();
  readonly toggleCamOrShare = output<void>();
  readonly toggleHand = output<void>();
  readonly gift = output<void>();
  readonly pitch = output<void>();
  readonly settings = output<void>();
  readonly managers = output<void>();
  readonly reward = output<void>();
  readonly toggleCaption = output<void>();
  readonly toggleInvisible = output<void>();

  readonly cnameCopied = signal(false);
  readonly showSettings = signal(false);
  readonly showOverflow = signal(false);
  readonly showRoomInfo = signal(false);

  private copyResetTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly clipboard = inject(Clipboard);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.copyResetTimer) clearTimeout(this.copyResetTimer);
    });
  }

  readonly wsTooltip = computed<string>(() => {
    switch (this.wsStatus()) {
      case 'connected':
        return 'Live — realtime connected';
      case 'reconnecting':
        return 'Reconnecting…';
      case 'connecting':
        return 'Connecting…';
      case 'disconnected':
        return 'Disconnected — tap to refresh';
    }
  });

  readonly handTooltip = computed<string>(() => {
    if (this.isOnStage()) return 'Leave stage';
    if (this.isHandRaised()) return 'Lower hand';
    if (this.isModerator()) return 'Join stage';
    return 'Raise hand';
  });

  readonly handIcon = computed<'leave-stage' | 'lower-hand' | 'join-stage' | 'raise'>(() => {
    if (this.isOnStage()) return 'leave-stage';
    if (this.isHandRaised()) return 'lower-hand';
    if (this.isModerator()) return 'join-stage';
    return 'raise';
  });

  readonly visibilityTooltip = computed(() => (this.invisible() ? 'Go visible' : 'Go invisible'));

  copyCname(): void {
    const c = this.cname();
    if (!c || !this.clipboard.copy(c)) return;
    this.cnameCopied.set(true);
    if (this.copyResetTimer) clearTimeout(this.copyResetTimer);
    this.copyResetTimer = setTimeout(() => this.cnameCopied.set(false), 2000);
  }

  onToggleMic(): void {
    this.toggleMic.emit();
  }
  onToggleCam(): void {
    this.toggleCam.emit();
  }
  onToggleCamOrShare(): void {
    this.toggleCamOrShare.emit();
  }
  onToggleHand(): void {
    this.toggleHand.emit();
  }
  onGift(): void {
    this.gift.emit();
  }
  onPitch(): void {
    this.pitch.emit();
  }
  onSettings(): void {
    this.settings.emit();
  }
  onManagers(): void {
    this.managers.emit();
  }
  onReward(): void {
    this.reward.emit();
  }
  onToggleCaption(): void {
    this.toggleCaption.emit();
  }
  onToggleInvisible(): void {
    this.toggleInvisible.emit();
  }
  onLeave(): void {
    this.leave.emit();
  }
  onMinimize(): void {
    this.minimize.emit();
  }
  onRefresh(): void {
    this.refresh.emit();
  }
  onStatusClick(): void {
    if (this.wsStatus() === 'disconnected') {
      this.onRefresh();
    }
  }
  private readonly moreBtn = viewChild<ElementRef<HTMLButtonElement>>('moreBtn');
  private readonly overflowPanel = viewChild<ElementRef<HTMLElement>>('overflowPanel');

  toggleOverflow(): void {
    const opening = !this.showOverflow();
    this.showOverflow.set(opening);
    if (opening) {
      queueMicrotask(() => this.overflowPanel()?.nativeElement.focus());
    }
  }
  closeOverflow(): void {
    const wasOpen = this.showOverflow();
    this.showOverflow.set(false);
    if (wasOpen) {
      queueMicrotask(() => this.moreBtn()?.nativeElement.focus());
    }
  }
  private readonly roomNameBtn = viewChild<ElementRef<HTMLButtonElement>>('roomNameBtn');
  private readonly roomInfoPanel = viewChild<ElementRef<HTMLElement>>('roomInfoPanel');

  toggleRoomInfo(): void {
    const opening = !this.showRoomInfo();
    this.showRoomInfo.set(opening);
    if (opening) {
      queueMicrotask(() => this.roomInfoPanel()?.nativeElement.focus());
    }
  }
  closeRoomInfo(): void {
    const wasOpen = this.showRoomInfo();
    this.showRoomInfo.set(false);
    if (wasOpen) {
      queueMicrotask(() => this.roomNameBtn()?.nativeElement.focus());
    }
  }

  private touchStartY = 0;

  onTouchStart(event: TouchEvent): void {
    this.touchStartY = event.touches[0]!.clientY;
  }

  onTouchMove(event: TouchEvent): void {
    const delta = event.touches[0]!.clientY - this.touchStartY;
    if (delta > 0) {
      (event.currentTarget as HTMLElement).style.transform = `translateY(${delta}px)`;
      (event.currentTarget as HTMLElement).style.transition = 'none';
    }
  }

  onTouchEnd(event: TouchEvent): void {
    const delta = event.changedTouches[0]!.clientY - this.touchStartY;
    const panel = event.currentTarget as HTMLElement;
    panel.style.transform = '';
    panel.style.transition = '';
    if (delta > 80) this.closeOverflow();
  }
}
