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
        ></div>
        <span class="visually-hidden" aria-live="polite">{{ wsTooltip() }}</span>
        <div class="room-meta">
          <button
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
            <div class="room-info-panel" role="dialog" aria-label="Room info">
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
              <button type="button" class="room-info-visibility" (click)="onToggleInvisible()">
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
  styles: [
    `
      /* ─── Theming via custom properties ─────────────────────────────
         Dark-mode swaps to overridden --rh-* tokens below; the rules
         themselves never duplicate selectors. */
      :host {
        display: block;
        height: var(--room-header-height);
        container-type: inline-size;
        container-name: room-header;

        /* Light theme tokens */
        --rh-bg: var(--color-card);
        --rh-border: var(--color-border);
        --rh-chip-bg: var(--color-neutral-100);
        --rh-text: var(--color-text);
        --rh-text-muted: var(--color-text-muted);
        --rh-text-secondary: var(--color-text-secondary);

        /* Toolbar button colors (per-button variants override these) */
        --rh-btn-bg: var(--color-card);
        --rh-btn-color: var(--color-text-muted);
        --rh-btn-border: transparent;
        --rh-btn-hover-shadow: var(--shadow-sm);

        /* State button colors */
        --rh-btn-active-bg: var(--color-primary-100);
        --rh-btn-active-color: var(--color-primary-600);
        --rh-btn-active-border: var(--color-primary-200);

        --rh-btn-highlight-bg: var(--color-gold-100);
        --rh-btn-highlight-color: var(--color-gold-600);
        --rh-btn-highlight-border: var(--color-gold-200);

        /* Status dot */
        --rh-ws-connected: var(--color-accent-500);
        --rh-ws-reconnecting: var(--color-gold-500);
        --rh-ws-connecting: var(--color-gold-500);
        --rh-ws-disconnected: var(--color-warm-500);

        /* Channel-fill buttons */
        --rh-btn-primary-fg: var(--color-primary-600);
        --rh-btn-primary-bg: var(--color-primary-50);
        --rh-btn-primary-hover-bg: var(--color-primary-100);
        --rh-btn-primary-hover-border: var(--color-primary-200);

        --rh-btn-accent-fg: var(--color-accent-600);
        --rh-btn-accent-bg: var(--color-accent-50);
        --rh-btn-accent-hover-bg: var(--color-accent-100);
        --rh-btn-accent-hover-border: var(--color-accent-200);

        --rh-btn-gold-fg: var(--color-gold-600);
        --rh-btn-gold-bg: var(--color-gold-50);
        --rh-btn-gold-hover-bg: var(--color-gold-100);
        --rh-btn-gold-hover-border: var(--color-gold-200);

        --rh-btn-warm-fg: var(--color-warm-600);
        --rh-btn-warm-bg: var(--color-warm-50);
        --rh-btn-warm-hover-bg: var(--color-warm-100);
        --rh-btn-warm-hover-border: var(--color-warm-200);

        --rh-btn-neutral-fg: var(--color-text-secondary);
        --rh-btn-neutral-bg: var(--color-neutral-50);
        --rh-btn-neutral-hover-bg: var(--color-neutral-100);
        --rh-btn-neutral-hover-border: var(--color-neutral-200);
        --rh-btn-neutral-hover-color: var(--color-text);

        /* Sep / misc */
        --rh-sep: var(--color-border);
        --rh-handle-bg: var(--color-neutral-300);
      }

      :host-context(.dark) {
        --rh-bg: var(--color-neutral-800);
        --rh-border: var(--color-neutral-700);
        --rh-chip-bg: var(--color-neutral-800);
        --rh-text: var(--color-neutral-100);
        --rh-text-muted: var(--color-neutral-400);
        --rh-text-secondary: var(--color-neutral-300);

        --rh-btn-bg: var(--color-neutral-700);
        --rh-btn-color: var(--color-neutral-300);
        --rh-btn-border: transparent;

        --rh-btn-active-bg: var(--color-primary-900);
        --rh-btn-active-color: var(--color-primary-300);
        --rh-btn-active-border: var(--color-primary-700);

        --rh-btn-highlight-bg: var(--color-gold-900);
        --rh-btn-highlight-color: var(--color-gold-300);
        --rh-btn-highlight-border: var(--color-gold-700);

        --rh-ws-connected: var(--color-accent-400);
        --rh-ws-reconnecting: var(--color-gold-400);
        --rh-ws-connecting: var(--color-gold-400);
        --rh-ws-disconnected: var(--color-warm-400);

        --rh-btn-primary-fg: var(--color-primary-300);
        --rh-btn-primary-bg: var(--color-primary-900);
        --rh-btn-primary-hover-bg: var(--color-primary-800);
        --rh-btn-primary-hover-border: var(--color-primary-700);

        --rh-btn-accent-fg: var(--color-accent-300);
        --rh-btn-accent-bg: var(--color-accent-900);
        --rh-btn-accent-hover-bg: var(--color-accent-800);
        --rh-btn-accent-hover-border: var(--color-accent-700);

        --rh-btn-gold-fg: var(--color-gold-300);
        --rh-btn-gold-bg: var(--color-gold-900);
        --rh-btn-gold-hover-bg: var(--color-gold-800);
        --rh-btn-gold-hover-border: var(--color-gold-700);

        --rh-btn-warm-fg: var(--color-warm-300);
        --rh-btn-warm-bg: var(--color-warm-900);
        --rh-btn-warm-hover-bg: var(--color-warm-800);
        --rh-btn-warm-hover-border: var(--color-warm-700);

        --rh-btn-neutral-fg: var(--color-neutral-300);
        --rh-btn-neutral-bg: var(--color-neutral-700);
        --rh-btn-neutral-hover-bg: var(--color-neutral-600);
        --rh-btn-neutral-hover-border: var(--color-neutral-500);
        --rh-btn-neutral-hover-color: var(--color-neutral-100);

        --rh-sep: var(--color-neutral-600);
        --rh-handle-bg: var(--color-neutral-600);
      }

      /* ─── Header shell ────────────────────────────────────────────── */
      .room-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-2) var(--space-3);
        background: var(--rh-bg);
        border-bottom: 1px solid var(--rh-border);
        box-shadow: var(--shadow-xs);
        gap: var(--space-2);
        height: var(--room-header-height);
        box-sizing: border-box;
      }

      .header-left {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex: 1 1 0;
        min-width: 0;
      }

      .header-center {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        flex: 0 1 auto;
        min-width: 0;
        padding: var(--space-1);
        border-radius: var(--radius-xl);
        background: var(--rh-chip-bg);
        scrollbar-width: none;
        -ms-overflow-style: none;
        position: relative;
      }
      .header-center::-webkit-scrollbar { display: none; }
      .header-center > * { flex-shrink: 0; }

      .media-controls,
      .engagement-controls {
        display: flex;
        align-items: center;
        gap: var(--space-1);
      }

      .header-right {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        flex: 1 1 0;
        justify-content: flex-end;
      }

      /* ─── Icon buttons (copy, more, etc.) ──────────────────────────── */
      .icon-btn {
        width: var(--touch-target-min);
        height: var(--touch-target-min);
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-md);
        background: none;
        border: none;
        cursor: pointer;
        color: var(--rh-text-secondary);
        transition: background 0.15s, color 0.15s;
        flex-shrink: 0;
        -webkit-user-select: none;
        user-select: none;
      }
      .icon-btn:hover {
        background: var(--color-neutral-100);
        color: var(--rh-text);
      }
      :host-context(.dark) .icon-btn:hover {
        background: var(--color-neutral-700);
        color: var(--color-neutral-100);
      }

      /* ─── WebSocket status dot ─────────────────────────────────────── */
      .ws-status {
        width: var(--space-3);
        height: var(--space-3);
        border-radius: 50%;
        flex-shrink: 0;
        transition: background 0.2s;
        cursor: default;
      }
      .ws-connected { background: var(--rh-ws-connected); }
      .ws-reconnecting {
        background: var(--rh-ws-reconnecting);
        animation: pulse 1.2s ease-in-out infinite;
      }
      .ws-connecting {
        background: var(--rh-ws-connecting);
        animation: pulse 0.8s ease-in-out infinite;
      }
      .ws-disconnected { background: var(--rh-ws-disconnected); }
      .ws-status.ws-tappable { cursor: pointer; }
      .ws-status.ws-tappable:focus-visible {
        outline: var(--focus-ring);
        outline-offset: var(--focus-ring-offset);
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.35; }
      }

      /* ─── Toolbar buttons (mic / cam / hand / gift / etc.) ─────────── */
      .toolbar-btn {
        position: relative;
        width: var(--toolbar-btn-size);
        height: var(--toolbar-btn-size);
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-lg);
        background: var(--rh-btn-bg);
        border: 1px solid var(--rh-btn-border);
        cursor: pointer;
        color: var(--rh-btn-color);
        transition:
          background 0.15s,
          color 0.15s,
          border-color 0.15s,
          box-shadow 0.15s;
        flex-shrink: 0;
        -webkit-user-select: none;
        user-select: none;
      }
      .toolbar-btn:hover { box-shadow: var(--rh-btn-hover-shadow); }
      .toolbar-btn:active { transform: scale(0.92); }
      .toolbar-btn:disabled { cursor: default; opacity: 0.55; }
      .toolbar-btn:disabled:hover { transform: none; box-shadow: none; }
      .toolbar-btn:disabled:active { transform: none; }
      .toolbar-btn.active {
        background: var(--rh-btn-active-bg);
        color: var(--rh-btn-active-color);
        border-color: var(--rh-btn-active-border);
      }
      .toolbar-btn.highlight {
        background: var(--rh-btn-highlight-bg);
        color: var(--rh-btn-highlight-color);
        border-color: var(--rh-btn-highlight-border);
      }

      /* Per-button color variants — every variant is just a token override. */
      .toolbar-btn.c-refresh,
      .toolbar-btn.c-screen {
        color: var(--rh-btn-primary-fg);
        background: var(--rh-btn-primary-bg);
      }
      .toolbar-btn.c-refresh:hover,
      .toolbar-btn.c-screen:hover {
        background: var(--rh-btn-primary-hover-bg);
        border-color: var(--rh-btn-primary-hover-border);
      }
      .toolbar-btn.c-cam,
      .toolbar-btn.c-pitch,
      .toolbar-btn.c-hand-leave {
        color: var(--rh-btn-accent-fg);
        background: var(--rh-btn-accent-bg);
      }
      .toolbar-btn.c-cam:hover,
      .toolbar-btn.c-pitch:hover,
      .toolbar-btn.c-hand-leave:hover {
        background: var(--rh-btn-accent-hover-bg);
        border-color: var(--rh-btn-accent-hover-border);
      }
      .toolbar-btn.c-hand {
        color: var(--rh-btn-gold-fg);
        background: var(--rh-btn-gold-bg);
      }
      .toolbar-btn.c-hand:hover {
        background: var(--rh-btn-gold-hover-bg);
        border-color: var(--rh-btn-gold-hover-border);
      }
      .toolbar-btn.c-hand-join {
        color: var(--rh-btn-primary-fg);
        background: var(--rh-btn-primary-bg);
      }
      .toolbar-btn.c-hand-join:hover {
        background: var(--rh-btn-primary-hover-bg);
        border-color: var(--rh-btn-primary-hover-border);
      }
      .toolbar-btn.c-gift,
      .toolbar-btn.danger {
        color: var(--rh-btn-warm-fg);
        background: var(--rh-btn-warm-bg);
      }
      .toolbar-btn.c-gift:hover,
      .toolbar-btn.danger:hover {
        background: var(--rh-btn-warm-hover-bg);
        border-color: var(--rh-btn-warm-hover-border);
      }
      .toolbar-btn.c-settings,
      .toolbar-btn.c-managers,
      .toolbar-btn.c-captions {
        color: var(--rh-btn-neutral-fg);
        background: var(--rh-btn-neutral-bg);
      }
      .toolbar-btn.c-settings:hover,
      .toolbar-btn.c-managers:hover,
      .toolbar-btn.c-captions:hover {
        background: var(--rh-btn-neutral-hover-bg);
        border-color: var(--rh-btn-neutral-hover-border);
        color: var(--rh-btn-neutral-hover-color);
      }
      .toolbar-btn.c-settings.active {
        background: var(--rh-btn-primary-bg);
        color: var(--rh-btn-primary-fg);
        border-color: var(--rh-btn-primary-hover-border);
      }
      .toolbar-btn.c-more {
        color: var(--rh-btn-neutral-fg);
        background: var(--rh-btn-neutral-hover-bg);
      }
      .toolbar-btn.c-more:hover {
        background: var(--rh-btn-neutral-bg);
        color: var(--rh-text);
      }

      .spinning { animation: spin 0.8s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }

      .toolbar-sep {
        width: 1px;
        height: 20px;
        background: var(--rh-sep);
        margin: 0 var(--space-1);
        flex-shrink: 0;
      }

      app-mic-button.tip { display: inline-flex; }

      /* ─── Room identity (name + tap-to-open info panel) ─────────────── */
      .room-meta {
        position: relative;
        display: flex;
        min-width: 0;
        flex: 1;
      }
      .room-name-btn {
        display: flex;
        align-items: center;
        min-width: 0;
        max-width: 100%;
        padding: var(--space-1) var(--space-2);
        margin: 0 calc(var(--space-2) * -1);
        border: none;
        border-radius: var(--radius-md);
        background: none;
        cursor: pointer;
        transition: background 0.15s;
        -webkit-user-select: none;
        user-select: none;
      }
      .room-name-btn:hover,
      .room-name-btn[aria-expanded='true'] {
        background: var(--color-neutral-100);
      }
      :host-context(.dark) .room-name-btn:hover,
      :host-context(.dark) .room-name-btn[aria-expanded='true'] {
        background: var(--color-neutral-700);
      }
      .room-name {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--rh-text);
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .info-backdrop {
        position: fixed;
        inset: 0;
        z-index: var(--z-overlay);
        background: transparent;
      }
      .room-info-panel {
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        z-index: calc(var(--z-overlay) + 1);
        width: max-content;
        min-width: 220px;
        max-width: min(320px, 90vw);
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding: var(--space-3);
        background: var(--rh-bg);
        border: 1px solid var(--rh-border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-dropdown);
        animation: panel-fade-in 0.15s ease-out;
      }
      @keyframes panel-fade-in {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .room-info-row {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .room-info-label {
        font-size: var(--text-2xs);
        font-weight: var(--font-medium);
        color: var(--rh-text-muted);
        text-transform: uppercase;
        letter-spacing: var(--letter-spacing-wide);
      }
      .room-info-value {
        font-size: var(--text-sm);
        color: var(--rh-text);
        word-break: break-word;
      }
      .room-info-copy {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
        min-height: var(--touch-target-min);
        padding: 0 var(--space-2);
        margin: 0 calc(var(--space-2) * -1);
        border: none;
        border-radius: var(--radius-md);
        background: none;
        cursor: pointer;
        color: var(--rh-text);
        font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
        font-size: var(--text-sm);
        transition: background 0.15s, color 0.15s;
      }
      .room-info-copy:hover {
        background: var(--color-neutral-100);
        color: var(--color-primary-500);
      }
      :host-context(.dark) .room-info-copy:hover {
        background: var(--color-neutral-700);
        color: var(--color-primary-400);
      }
      .cname-text { flex: 1; text-align: left; overflow-wrap: anywhere; }

      .room-info-visibility {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        min-height: var(--touch-target-min);
        padding: 0 var(--space-2);
        margin: 0 calc(var(--space-2) * -1);
        border: none;
        border-top: 1px solid var(--rh-border);
        border-radius: var(--radius-md);
        background: none;
        cursor: pointer;
        color: var(--rh-btn-warm-fg);
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        transition: background 0.15s;
      }
      .room-info-visibility:hover {
        background: var(--rh-btn-warm-bg);
      }
      .secondary-actions {
        display: flex;
        align-items: center;
        gap: var(--space-1);
      }

      /* ─── Overflow menu (mobile bottom-sheet) ──────────────────────── */
      .overflow-backdrop {
        position: fixed;
        inset: 0;
        background: color-mix(in srgb, var(--color-black) 40%, transparent);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        z-index: var(--z-toast);
        animation: fade-in 0.2s ease-out;
      }
      @keyframes fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .overflow-panel {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: var(--rh-bg);
        border-top-left-radius: var(--radius-2xl);
        border-top-right-radius: var(--radius-2xl);
        z-index: calc(var(--z-toast) + 1);
        padding: var(--space-2) var(--space-3);
        padding-bottom: calc(var(--space-3) + env(safe-area-inset-bottom, 0px));
        box-shadow: var(--shadow-modal);
        animation: panel-enter 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        touch-action: pan-y;
        user-select: none;
        -webkit-user-select: none;
        max-height: min(85dvh, calc(100dvh - var(--app-header-height) - env(safe-area-inset-top, 0px)));
        display: flex;
        flex-direction: column;
        overscroll-behavior: contain;
      }
      @keyframes panel-enter {
        from {
          opacity: 0;
          transform: translateY(24px) scale(0.96);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      .overflow-panel:focus { outline: none; }

      .overflow-handle {
        width: 40px;
        height: 4px;
        border-radius: 2px;
        background: var(--rh-handle-bg);
        margin: 0 auto var(--space-2);
        flex-shrink: 0;
      }
      .overflow-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--space-3);
        padding-bottom: var(--space-2);
        border-bottom: 1px solid var(--rh-border);
        flex-shrink: 0;
      }
      .overflow-title {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--rh-text);
      }
      .overflow-divider {
        height: 1px;
        background: var(--rh-border);
        margin: var(--space-2) 0;
        flex-shrink: 0;
      }
      .overflow-list {
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        overscroll-behavior: contain;
        min-height: 0;
      }
      .overflow-row {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        width: 100%;
        min-height: var(--touch-target-min);
        padding: var(--space-3) var(--space-2);
        box-sizing: border-box;
        border-radius: var(--radius-lg);
        background: none;
        border: none;
        cursor: pointer;
        color: var(--rh-text);
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        text-align: left;
        transition: background 0.12s, color 0.12s, transform 0.1s;
        -webkit-tap-highlight-color: transparent;
        -webkit-user-select: none;
        user-select: none;
      }
      .overflow-row:active {
        background: var(--color-neutral-100);
        transform: scale(0.985);
      }
      :host-context(.dark) .overflow-row:active {
        background: var(--color-neutral-700);
      }
      .overflow-row:disabled { opacity: 0.4; cursor: default; }
      .overflow-row:disabled:active { background: none; transform: none; }
      .overflow-row svg {
        flex-shrink: 0;
        color: var(--rh-text-secondary);
      }
      :host-context(.dark) .overflow-row svg {
        color: var(--color-neutral-400);
      }
      .row-label { flex: 1; }
      .row-badge {
        font-size: var(--text-2xs);
        font-weight: var(--font-semibold);
        padding: 2px 8px;
        border-radius: var(--radius-full);
        background: var(--color-accent-100);
        color: var(--color-accent-600);
      }
      :host-context(.dark) .row-badge {
        background: var(--color-accent-900);
        color: var(--color-accent-300);
      }
      .overflow-row-primary {
        color: var(--rh-btn-warm-fg);
        font-weight: var(--font-semibold);
      }
      .overflow-row-primary svg { color: var(--color-warm-500); }
      :host-context(.dark) .overflow-row-primary svg { color: var(--color-warm-400); }
      .overflow-row-primary:active { background: var(--rh-btn-warm-bg); }
      :host-context(.dark) .overflow-row-primary:active { background: var(--color-warm-900); }

      .hide { display: none !important; }
      .hide-mobile { display: none; }

      /* ─── Container queries (the page lives inside .app-main; the room
             decides its layout based on available width, not viewport) ── */
      @container room-header (max-width: 1023.98px) {
        .header-center {
          overflow-x: auto;
          overscroll-behavior-x: contain;
          scroll-padding-inline: var(--space-2);
        }
        .hide-mobile { display: none !important; }
      }
      @container room-header (min-width: 768px) {
        .toolbar-btn.c-more { display: none; }
      }
      @container room-header (max-width: 699.98px) {
        .header-left { gap: var(--space-1); }
      }
    `,
  ],
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
  toggleRoomInfo(): void {
    this.showRoomInfo.update((v) => !v);
  }
  closeRoomInfo(): void {
    this.showRoomInfo.set(false);
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
