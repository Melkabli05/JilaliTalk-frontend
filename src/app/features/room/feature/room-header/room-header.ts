import { Component, ChangeDetectionStrategy, input, output, signal, computed, inject, DestroyRef } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { LucideArrowLeft, LucideCopy, LucideCheck, LucideVideoOff, LucideMonitorUp, LucideHand, LucideHandMetal, LucideArrowDownToLine, LucideLogIn, LucideGift, LucideSettings, LucideLogOut, LucideMusic, LucideRefreshCw, LucideEyeOff, LucideEye, LucideShield, LucideStar, LucideCaptions, LucideCaptionsOff, LucideEllipsisVertical, LucideX } from '@lucide/angular';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import { MicButtonComponent } from '../../ui/mic-button';
import { AvSettingsComponent } from '../audio-settings/av-settings';

@Component({
  selector: 'app-room-header',

  imports: [MicButtonComponent, TooltipDirective, AvSettingsComponent, LucideArrowLeft, LucideCopy, LucideCheck, LucideVideoOff, LucideMonitorUp, LucideHand, LucideHandMetal, LucideArrowDownToLine, LucideLogIn, LucideGift, LucideSettings, LucideLogOut, LucideMusic, LucideRefreshCw, LucideEyeOff, LucideEye, LucideShield, LucideStar, LucideCaptions, LucideCaptionsOff, LucideEllipsisVertical, LucideX],
  host: {
    '(document:keydown.escape)': 'closeOverflow()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="room-header">
      <div class="header-left">
        <button
          class="icon-btn back-btn"
          appTooltip="Leave room"
          tooltipPosition="right"
          aria-label="Go back"
          (click)="goBack.emit()"
        >
          <svg aria-hidden="true" lucideArrowLeft [size]="18"></svg>
        </button>
        <div
          class="ws-status"
          [class.ws-connected]="wsStatus() === 'connected'"
          [class.ws-reconnecting]="wsStatus() === 'reconnecting'"
          [class.ws-connecting]="wsStatus() === 'connecting'"
          [class.ws-disconnected]="wsStatus() === 'disconnected'"
          [appTooltip]="wsTooltip()"
          tooltipPosition="right"
          aria-label="WebSocket connection status"
        ></div>
        <div class="room-meta">
          <div class="room-title-row">
            <div class="name-wrapper">
              <h1 class="room-name">{{ name() }}</h1>
            </div>
          </div>
          <div class="room-subtitle">
            <span class="room-topic">{{ topic() }}</span>
            <span class="separator">·</span>
            <span class="room-cname" (click)="copyCname()" [attr.aria-label]="'Copy room ID ' + cname()">
              @if (cnameCopied()) {
                <svg aria-hidden="true" lucideCheck [size]="9"></svg>
              } @else {
                <svg aria-hidden="true" lucideCopy [size]="9"></svg>
              }
              <span class="cname-text">{{ shortCname() }}</span>
            </span>
          </div>
        </div>
        <button
          [class]="invisible() ? 'invisible-badge' : 'visible-badge'"
          class="hide-mobile"
          [appTooltip]="visibilityTooltip()"
          tooltipPosition="bottom"
          [attr.aria-label]="visibilityTooltip()"
          (click)="onToggleInvisible()"
        >
          @if (invisible()) {
            <svg aria-hidden="true" lucideEyeOff [size]="16"></svg>
          } @else {
            <svg aria-hidden="true" lucideEye [size]="16"></svg>
          }
        </button>
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
                <svg aria-hidden="true" lucideVideoOff [size]="16"></svg>
              </button>
              <button
                class="toolbar-btn c-screen hide-mobile"
                appTooltip="Screen share"
                tooltipPosition="bottom"
                (click)="onToggleCamOrShare()"
                aria-label="Screen share"
              >
                <svg aria-hidden="true" lucideMonitorUp [size]="16"></svg>
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
                  <svg aria-hidden="true" lucideArrowDownToLine [size]="16"></svg>
                }
                @case ('lower-hand') {
                  <svg aria-hidden="true" lucideHandMetal [size]="16"></svg>
                }
                @case ('join-stage') {
                  <svg aria-hidden="true" lucideLogIn [size]="16"></svg>
                }
                @default {
                  <svg aria-hidden="true" lucideHand [size]="16"></svg>
                }
              }
            </button>
          </div>
        }

        <button
          class="toolbar-btn c-more"
          appTooltip="More actions"
          tooltipPosition="bottom"
          aria-label="More actions"
          (click)="toggleOverflow()"
        >
          <svg aria-hidden="true" lucideEllipsisVertical [size]="16"></svg>
        </button>
      </div>

      <div class="header-right">
        <div class="secondary-actions hide-mobile">
          <!-- Always visible: refresh, managers (identity-neutral) -->
          <button
            class="toolbar-btn c-refresh"
            [appTooltip]="refreshing() ? 'Refreshing…' : 'Refresh'"
            tooltipPosition="bottom"
            [disabled]="refreshing()"
            (click)="onRefresh()"
            aria-label="Refresh room info"
          >
            <svg aria-hidden="true" lucideRefreshCw [size]="16" [class.spinning]="refreshing()"></svg>
          </button>

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
                <svg aria-hidden="true" lucideGift [size]="16"></svg>
              </button>
              <button
                class="toolbar-btn c-pitch"
                appTooltip="Voice pitch"
                tooltipPosition="bottom"
                (click)="onPitch()"
                aria-label="Pitch settings"
              >
                <svg aria-hidden="true" lucideMusic [size]="16"></svg>
              </button>
              <button
                class="toolbar-btn c-reward"
                appTooltip="Daily rewards"
                tooltipPosition="bottom"
                (click)="onReward()"
                aria-label="Daily rewards"
              >
                <svg aria-hidden="true" lucideStar [size]="16"></svg>
              </button>
              <button
                class="toolbar-btn c-settings"
                [class.active]="showSettings()"
                appTooltip="Noise suppression"
                tooltipPosition="bottom"
                (click)="showSettings.set(!showSettings())"
                aria-label="Noise suppression settings"
              >
                <svg aria-hidden="true" lucideSettings [size]="16"></svg>
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
            <svg aria-hidden="true" lucideShield [size]="16"></svg>
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
              <svg aria-hidden="true" lucideCaptions [size]="16"></svg>
            } @else {
              <svg aria-hidden="true" lucideCaptionsOff [size]="16"></svg>
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
          <svg aria-hidden="true" lucideLogOut [size]="16"></svg>
        </button>
      </div>
    </header>

    @if (showOverflow()) {
      <div class="overflow-backdrop" (click)="closeOverflow()"></div>
      <div
        class="overflow-panel"
        role="dialog"
        aria-label="More actions"
        (touchstart)="onTouchStart($event)"
        (touchmove)="onTouchMove($event)"
        (touchend)="onTouchEnd($event)"
      >
        <div class="overflow-handle" aria-hidden="true"></div>
        <div class="overflow-header">
          <span class="overflow-title">More actions</span>
          <button class="icon-btn" aria-label="Close menu" (click)="closeOverflow()">
            <svg aria-hidden="true" lucideX [size]="16"></svg>
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
          <button class="overflow-row" (click)="onRefresh()" [disabled]="refreshing()">
            <svg aria-hidden="true" lucideRefreshCw [size]="20" [class.spinning]="refreshing()"></svg>
            <span class="row-label">Refresh</span>
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
  styles: [`
    :host { display: block; height: 56px; }

    .room-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-2) var(--space-3);
      background: var(--color-card);
      border-bottom: 1px solid var(--color-border);
      gap: var(--space-2);
      height: 56px;
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
      background: var(--color-neutral-100);
      scrollbar-width: none;
      -ms-overflow-style: none;
      position: relative;
    }

    .media-controls,
    .engagement-controls {
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }

    .header-center::-webkit-scrollbar { display: none; }
    .header-center > * { flex-shrink: 0; }

    .header-right {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      flex: 1 1 0;
      justify-content: flex-end;
    }

    .icon-btn {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-md);
      background: none;
      border: none;
      cursor: pointer;
      color: var(--color-text-secondary);
      transition: background 0.15s, color 0.15s;
      flex-shrink: 0;
    }

    .icon-btn:hover {
      background: var(--color-neutral-100);
      color: var(--color-text);
    }

    .ws-status {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
      transition: background 0.2s;
      cursor: default;
    }

    .ws-connected    { background: var(--color-accent-500); }
    .ws-reconnecting { background: var(--color-gold-500); animation: pulse 1.2s ease-in-out infinite; }
    .ws-connecting   { background: var(--color-gold-500); animation: pulse 0.8s ease-in-out infinite; }
    .ws-disconnected { background: var(--color-warm-500); }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.35; }
    }

    .toolbar-btn {
      position: relative;
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-lg);
      background: var(--color-card);
      border: 1px solid transparent;
      cursor: pointer;
      color: var(--color-text-muted);
      transition:
        background 0.15s,
        color 0.15s,
        border-color 0.15s,
        box-shadow 0.15s;
      flex-shrink: 0;
    }

    .toolbar-btn:hover {
      box-shadow: var(--shadow-sm);
    }

    .toolbar-btn:active {
      transform: scale(0.92);
    }

    .toolbar-btn:disabled {
      cursor: default;
      opacity: 0.55;
    }

    .toolbar-btn:disabled:hover {
      transform: none;
      box-shadow: none;
    }

    .toolbar-btn:disabled:active {
      transform: none;
    }

    .spinning {
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Toggle states */
    .toolbar-btn.active {
      background: var(--color-primary-100);
      color: var(--color-primary-600);
      border-color: var(--color-primary-200);
    }

    .toolbar-btn.highlight {
      background: var(--color-gold-100);
      color: var(--color-gold-600);
      border-color: var(--color-gold-200);
    }

    /* Per-button colors */
    .toolbar-btn.c-refresh {
      color: var(--color-primary-600);
      background: var(--color-primary-50);
    }
    .toolbar-btn.c-refresh:hover {
      background: var(--color-primary-100);
      border-color: var(--color-primary-200);
    }

    .toolbar-btn.c-cam {
      color: var(--color-accent-600);
      background: var(--color-accent-50);
    }
    .toolbar-btn.c-cam:hover {
      background: var(--color-accent-100);
      border-color: var(--color-accent-200);
    }

    .toolbar-btn.c-screen {
      color: var(--color-primary-600);
      background: var(--color-primary-50);
    }
    .toolbar-btn.c-screen:hover {
      background: var(--color-primary-100);
      border-color: var(--color-primary-200);
    }

    .toolbar-btn.c-hand {
      color: var(--color-gold-600);
      background: var(--color-gold-50);
    }
    .toolbar-btn.c-hand:hover {
      background: var(--color-gold-100);
      border-color: var(--color-gold-200);
    }

    /* Join stage (moderator → direct entry — blue) */
    .toolbar-btn.c-hand-join {
      color: var(--color-primary-600);
      background: var(--color-primary-50);
    }
    .toolbar-btn.c-hand-join:hover {
      background: var(--color-primary-100);
      border-color: var(--color-primary-200);
    }

    /* Leave stage (on stage → exit — teal/green) */
    .toolbar-btn.c-hand-leave {
      color: var(--color-accent-600);
      background: var(--color-accent-50);
    }
    .toolbar-btn.c-hand-leave:hover {
      background: var(--color-accent-100);
      border-color: var(--color-accent-200);
    }

    .toolbar-btn.c-gift {
      color: var(--color-warm-600);
      background: var(--color-warm-50);
    }
    .toolbar-btn.c-gift:hover {
      background: var(--color-warm-100);
      border-color: var(--color-warm-200);
    }

    .toolbar-btn.c-pitch {
      color: var(--color-accent-600);
      background: var(--color-accent-50);
    }
    .toolbar-btn.c-pitch:hover {
      background: var(--color-accent-100);
      border-color: var(--color-accent-200);
    }

    .toolbar-btn.c-settings,
    .toolbar-btn.c-managers,
    .toolbar-btn.c-captions {
      color: var(--color-text-secondary);
      background: var(--color-neutral-50);
    }
    .toolbar-btn.c-settings:hover,
    .toolbar-btn.c-managers:hover,
    .toolbar-btn.c-captions:hover {
      background: var(--color-neutral-100);
      border-color: var(--color-neutral-200);
      color: var(--color-text);
    }

    .toolbar-btn.c-settings.active {
      background: var(--color-primary-50);
      color: var(--color-primary-600);
      border-color: var(--color-primary-200);
    }

    .toolbar-btn.danger {
      color: var(--color-warm-600);
      background: var(--color-warm-50);
    }
    .toolbar-btn.danger:hover {
      background: var(--color-warm-100);
      border-color: var(--color-warm-200);
    }

    .toolbar-sep {
      width: 1px;
      height: 20px;
      background: var(--color-border);
      margin: 0 var(--space-1);
      flex-shrink: 0;
    }

    /* Mic host */
    app-mic-button.tip {
      display: inline-flex;
    }

    .room-meta {
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
      flex: 1;
    }

    .room-title-row {
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }

    .invisible-badge,
    .visible-badge {
      position: relative;
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-lg);
      border: 1px solid;
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s, transform 0.12s;
      flex-shrink: 0;
    }
    .invisible-badge:hover,
    .visible-badge:hover { box-shadow: var(--shadow-sm); }
    .invisible-badge:active,
    .visible-badge:active { transform: scale(0.92); }

    .invisible-badge {
      color: var(--color-warm-600);
      background: var(--color-warm-50);
      border-color: var(--color-warm-200);
    }
    .invisible-badge:hover { background: var(--color-warm-100); border-color: var(--color-warm-300); }

    .visible-badge {
      color: var(--color-primary-600);
      background: var(--color-primary-50);
      border-color: var(--color-primary-200);
    }
    .visible-badge:hover { background: var(--color-primary-100); border-color: var(--color-primary-300); }

    .name-wrapper {
      overflow: hidden;
      flex: 1;
    }

    .room-name {
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-text);
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .room-subtitle {
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }

    .room-topic {
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 120px;
    }

    .separator {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .room-cname {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      cursor: pointer;
      font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
      padding: 1px 4px;
      border-radius: var(--radius-sm);
      transition: background 0.15s, color 0.15s;
    }

    .room-cname:hover {
      background: var(--color-neutral-100);
      color: var(--color-primary-500);
    }

    .cname-text {
      font-size: var(--text-xs);
    }

    /* Back button */
    .back-btn {
      flex-shrink: 0;
    }

    /* More button */
    .toolbar-btn.c-more {
      color: var(--color-text-secondary);
      background: var(--color-neutral-100);
    }
    .toolbar-btn.c-more:hover {
      background: var(--color-neutral-200);
      color: var(--color-text);
    }

    /* Secondary actions wrapper (desktop) */
    .secondary-actions {
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }

    /* Overflow menu */
    .overflow-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 100;
      animation: fade-in 0.2s ease-out;
    }

    @keyframes fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    .overflow-panel {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: var(--color-card);
      border-top-left-radius: var(--radius-2xl);
      border-top-right-radius: var(--radius-2xl);
      z-index: 101;
      padding: var(--space-2) var(--space-3);
      padding-bottom: calc(var(--space-3) + env(safe-area-inset-bottom, 0px));
      box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.2);
      animation: panel-enter 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      /* drag handle */
      touch-action: pan-y;
      user-select: none;
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

    .overflow-handle {
      width: 40px;
      height: 4px;
      border-radius: 2px;
      background: var(--color-neutral-300);
      margin: 0 auto var(--space-2);
    }
    :host-context(.dark) .overflow-handle {
      background: var(--color-neutral-600);
    }

    .overflow-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-3);
      padding-bottom: var(--space-2);
      border-bottom: 1px solid var(--color-border);
    }

    .overflow-title {
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-text);
    }

    .overflow-divider {
      height: 1px;
      background: var(--color-border);
      margin: var(--space-2) 0;
    }

    .overflow-list {
      display: flex;
      flex-direction: column;
    }

    .overflow-row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      width: 100%;
      padding: var(--space-3) var(--space-2);
      border-radius: var(--radius-lg);
      background: none;
      border: none;
      cursor: pointer;
      color: var(--color-text);
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      text-align: left;
      transition: background 0.12s, color 0.12s, transform 0.1s;
      -webkit-tap-highlight-color: transparent;
    }

    .overflow-row:active {
      background: var(--color-neutral-100);
      transform: scale(0.985);
    }

    .overflow-row:disabled {
      opacity: 0.4;
      cursor: default;
    }

    .overflow-row:disabled:active {
      background: none;
      transform: none;
    }

    .overflow-row svg {
      flex-shrink: 0;
      color: var(--color-text-secondary);
    }

    .row-label {
      flex: 1;
    }

    .row-badge {
      font-size: var(--text-2xs);
      font-weight: var(--font-semibold);
      padding: 2px 8px;
      border-radius: var(--radius-full);
      background: var(--color-accent-100);
      color: var(--color-accent-600);
    }

    .overflow-row-primary {
      color: var(--color-warm-600);
      font-weight: var(--font-semibold);
    }

    .overflow-row-primary svg {
      color: var(--color-warm-500);
    }

    .overflow-row-primary:active {
      background: var(--color-warm-50);
    }

    /* Responsive breakpoints */
    @media (max-width: 1023px) {
      .header-center {
        overflow-x: auto;
      }
    }

    @media (max-width: 699px) {
      .toolbar-btn {
        width: 32px;
        height: 32px;
      }
      .header-left {
        gap: var(--space-1);
      }
      .room-topic {
        max-width: 80px;
      }
      .overflow-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (max-width: 480px) {
      .room-subtitle {
        display: none;
      }
    }

    /* Mobile: hide desktop-secondary elements, show mobile-only */
    @media (max-width: 767px) {
      .hide-mobile {
        display: none !important;
      }
    }

    .hide {
      display: none !important;
    }

    /* Desktop: hide mobile-more button */
    @media (min-width: 768px) {
      .toolbar-btn.c-more {
        display: none;
      }
    }

    /* ─── Dark mode ─────────────────────────────────────────────────────── */
    :host-context(.dark) {
      .room-header {
        background: var(--color-neutral-800);
        border-color: var(--color-neutral-700);
      }

      .header-center {
        background: var(--color-neutral-800);
      }

      .icon-btn {
        color: var(--color-neutral-300);
      }

      .icon-btn:hover {
        background: var(--color-neutral-700);
        color: var(--color-neutral-100);
      }

      .toolbar-btn {
        background: var(--color-neutral-700);
        color: var(--color-neutral-300);
      }

      .toolbar-btn:hover {
        background: var(--color-neutral-600);
        color: var(--color-neutral-100);
      }

      .toolbar-btn.active {
        background: var(--color-primary-900);
        color: var(--color-primary-300);
        border-color: var(--color-primary-700);
      }

      .toolbar-btn.highlight {
        background: var(--color-gold-900);
        color: var(--color-gold-300);
        border-color: var(--color-gold-700);
      }

      .toolbar-btn.c-refresh {
        color: var(--color-primary-300);
        background: var(--color-primary-900);
      }
      .toolbar-btn.c-refresh:hover {
        background: var(--color-primary-800);
        border-color: var(--color-primary-700);
      }

      .toolbar-btn.c-cam {
        color: var(--color-accent-300);
        background: var(--color-accent-900);
      }
      .toolbar-btn.c-cam:hover {
        background: var(--color-accent-800);
        border-color: var(--color-accent-700);
      }

      .toolbar-btn.c-screen {
        color: var(--color-primary-300);
        background: var(--color-primary-900);
      }
      .toolbar-btn.c-screen:hover {
        background: var(--color-primary-800);
        border-color: var(--color-primary-700);
      }

      .toolbar-btn.c-hand {
        color: var(--color-gold-300);
        background: var(--color-gold-900);
      }
      .toolbar-btn.c-hand:hover {
        background: var(--color-gold-800);
        border-color: var(--color-gold-700);
      }

      .toolbar-btn.c-hand-join {
        color: var(--color-primary-300);
        background: var(--color-primary-900);
      }
      .toolbar-btn.c-hand-join:hover {
        background: var(--color-primary-800);
        border-color: var(--color-primary-700);
      }

      .toolbar-btn.c-hand-leave {
        color: var(--color-accent-300);
        background: var(--color-accent-900);
      }
      .toolbar-btn.c-hand-leave:hover {
        background: var(--color-accent-800);
        border-color: var(--color-accent-700);
      }

      .toolbar-btn.c-gift {
        color: var(--color-warm-300);
        background: var(--color-warm-900);
      }
      .toolbar-btn.c-gift:hover {
        background: var(--color-warm-800);
        border-color: var(--color-warm-700);
      }

      .toolbar-btn.c-pitch {
        color: var(--color-accent-300);
        background: var(--color-accent-900);
      }
      .toolbar-btn.c-pitch:hover {
        background: var(--color-accent-800);
        border-color: var(--color-accent-700);
      }

      .toolbar-btn.c-settings,
      .toolbar-btn.c-managers,
      .toolbar-btn.c-captions {
        color: var(--color-neutral-300);
        background: var(--color-neutral-700);
      }
      .toolbar-btn.c-settings:hover,
      .toolbar-btn.c-managers:hover,
      .toolbar-btn.c-captions:hover {
        background: var(--color-neutral-600);
        color: var(--color-neutral-100);
        border-color: var(--color-neutral-500);
      }

      .toolbar-btn.c-settings.active {
        background: var(--color-primary-900);
        color: var(--color-primary-300);
        border-color: var(--color-primary-600);
      }

      .toolbar-btn.danger {
        color: var(--color-warm-300);
        background: var(--color-warm-900);
      }
      .toolbar-btn.danger:hover {
        background: var(--color-warm-800);
        border-color: var(--color-warm-700);
      }

      .toolbar-sep {
        background: var(--color-neutral-600);
      }

      .invisible-badge {
        color: var(--color-warm-300);
        background: var(--color-warm-900);
        border-color: var(--color-warm-700);
      }
      .invisible-badge:hover { background: var(--color-warm-800); border-color: var(--color-warm-600); }

      .visible-badge {
        color: var(--color-primary-300);
        background: var(--color-primary-900);
        border-color: var(--color-primary-700);
      }
      .visible-badge:hover { background: var(--color-primary-800); border-color: var(--color-primary-600); }

      .ws-connected    { background: var(--color-accent-400); }
      .ws-reconnecting { background: var(--color-gold-400); }
      .ws-connecting   { background: var(--color-gold-400); }
      .ws-disconnected { background: var(--color-warm-400); }

      .room-name {
        color: var(--color-neutral-100);
      }

      .room-topic {
        color: var(--color-neutral-400);
      }

      .separator {
        color: var(--color-neutral-500);
      }

      .room-cname {
        color: var(--color-neutral-400);
      }

      .room-cname:hover {
        background: var(--color-neutral-700);
        color: var(--color-primary-400);
      }

      .toolbar-btn.c-more {
        color: var(--color-neutral-300);
        background: var(--color-neutral-700);
      }
      .toolbar-btn.c-more:hover {
        background: var(--color-neutral-600);
        color: var(--color-neutral-100);
      }

      .overflow-panel {
        background: var(--color-neutral-800);
      }

      .overflow-header {
        border-color: var(--color-neutral-700);
      }

      .overflow-title {
        color: var(--color-neutral-100);
      }

      .overflow-divider {
        background: var(--color-neutral-700);
      }

      .overflow-row {
        color: var(--color-neutral-100);
      }

      .overflow-row svg {
        color: var(--color-neutral-400);
      }

      .overflow-row:active {
        background: var(--color-neutral-700);
      }

      .row-badge {
        background: var(--color-accent-900);
        color: var(--color-accent-300);
      }

      .overflow-row-primary {
        color: var(--color-warm-300);
      }

      .overflow-row-primary svg {
        color: var(--color-warm-400);
      }

      .overflow-row-primary:active {
        background: var(--color-warm-900);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .spinning {
        animation: none;
      }
      .toolbar-btn:active {
        transform: none;
      }
      .overflow-backdrop,
      .overflow-panel {
        animation: none;
      }
      .overflow-row:active {
        transform: none;
      }
    }
  `]
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
  readonly wsStatus = input<'connecting' | 'connected' | 'reconnecting' | 'disconnected'>('disconnected');

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
  readonly goBack = output<void>();

  readonly cnameCopied = signal(false);
  readonly showSettings = signal(false);
  readonly showOverflow = signal(false);

  private copyResetTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly clipboard = inject(Clipboard);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.copyResetTimer) clearTimeout(this.copyResetTimer);
    });
  }

  readonly shortCname = computed<string>(() => {
    const c = this.cname();
    return c.length > 8 ? c.slice(0, 8) + '…' : c;
  });

  readonly wsTooltip = computed<string>(() => {
    switch (this.wsStatus()) {
      case 'connected':    return 'Live — realtime connected';
      case 'reconnecting': return 'Reconnecting…';
      case 'connecting':  return 'Connecting…';
      case 'disconnected': return 'Disconnected — tap to refresh';
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

  readonly visibilityTooltip = computed(() =>
    this.invisible() ? 'Go visible' : 'Go invisible',
  );

  copyCname(): void {
    const c = this.cname();
    if (!c || !this.clipboard.copy(c)) return;
    this.cnameCopied.set(true);
    if (this.copyResetTimer) clearTimeout(this.copyResetTimer);
    this.copyResetTimer = setTimeout(() => this.cnameCopied.set(false), 2000);
  }

  onToggleMic(): void { this.toggleMic.emit(); }
  onToggleCam(): void { this.toggleCam.emit(); }
  onToggleCamOrShare(): void { this.toggleCamOrShare.emit(); }
  onToggleHand(): void { this.toggleHand.emit(); }
  onGift(): void { this.gift.emit(); }
  onPitch(): void { this.pitch.emit(); }
  onSettings(): void { this.settings.emit(); }
  onManagers(): void { this.managers.emit(); }
  onReward(): void { this.reward.emit(); }
  onToggleCaption(): void { this.toggleCaption.emit(); }
  onToggleInvisible(): void { this.toggleInvisible.emit(); }
  onLeave(): void { this.leave.emit(); }
  onRefresh(): void { this.refresh.emit(); }
  toggleOverflow(): void { this.showOverflow.update((v) => !v); }
  closeOverflow(): void { this.showOverflow.set(false); }

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
