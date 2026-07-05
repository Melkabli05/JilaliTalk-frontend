import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CdkDrag } from '@angular/cdk/drag-drop';
import { LucideMic, LucideMicOff, LucidePhoneOff } from '@lucide/angular';
import { RoomConnectionService } from '@core/realtime/room-connection.service';
import { ACTIVE_CALL_READER } from '@core/tokens/active-call-reader.token';

@Component({
  selector: 'app-minimized-room-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDrag, LucideMic, LucideMicOff, LucidePhoneOff],
  template: `
    @if (snapshot(); as call) {
      <div class="minimized-bar" cdkDrag cdkDragBoundary=".app-shell">
        <button type="button" class="restore-area" (click)="restore(call.cname, call.busiType)">
          <span class="live-dot" aria-hidden="true"></span>
          <span class="room-name">{{ call.roomName }}</span>
        </button>
        <button
          type="button"
          class="mic-toggle"
          [class.is-muted]="!call.isMicOn"
          [attr.aria-label]="call.isMicOn ? 'Mute microphone' : 'Unmute microphone'"
          (click)="toggleMic(call.isMicOn)"
        >
          @if (call.isMicOn) {
            <svg aria-hidden="true" lucideMic [size]="16"></svg>
          } @else {
            <svg aria-hidden="true" lucideMicOff [size]="16"></svg>
          }
        </button>
        <button
          type="button"
          class="leave-btn"
          aria-label="Leave room"
          (click)="leave()"
        >
          <svg aria-hidden="true" lucidePhoneOff [size]="16"></svg>
        </button>
      </div>
    }
  `,
  styles: [`
    :host {
      display: contents;
      --bar-chip-bg: var(--color-neutral-100);
      --bar-chip-hover-bg: var(--color-neutral-200);
    }
    :host-context(.dark) {
      --bar-chip-bg: var(--color-neutral-700);
      --bar-chip-hover-bg: var(--color-neutral-600);
    }
    .minimized-bar {
      position: fixed;
      left: max(var(--space-4), env(safe-area-inset-left));
      bottom: calc(var(--bottom-nav-height) + var(--space-4) + env(safe-area-inset-bottom));
      z-index: var(--z-toast);
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-2) var(--space-2) var(--space-2);
      border-radius: var(--radius-full);
      background: var(--color-card);
      box-shadow: var(--shadow-lg);
      border: 1px solid var(--color-border);
      touch-action: none;
      cursor: grab;
      opacity: 0;
      transform: scale(0.9);
      animation: var(--animate-pop-in);
    }
    .minimized-bar:active {
      cursor: grabbing;
    }
    @media (hover: hover) and (pointer: fine) {
      .minimized-bar:hover {
        box-shadow: var(--shadow-xl);
      }
    }
    @media (min-width: 1024px) {
      .minimized-bar {
        bottom: var(--space-4);
      }
    }
    @media (max-width: 380px) {
      .room-name {
        max-width: 96px;
      }
    }
    .restore-area {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-height: var(--space-9);
      background: none;
      border: none;
      border-radius: var(--radius-full);
      padding: 0 var(--space-1);
      cursor: inherit;
      transition: background 0.15s ease;
    }
    .restore-area:active {
      background: var(--bar-chip-bg);
    }
    .restore-area:focus-visible,
    .mic-toggle:focus-visible,
    .leave-btn:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }
    .live-dot {
      width: 6px;
      height: 6px;
      flex-shrink: 0;
      border-radius: 50%;
      background: var(--color-live);
      animation: var(--animate-pulse-live);
    }
    .room-name {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text);
      max-width: 140px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: color 0.15s ease;
    }
    .restore-area:active .room-name {
      color: var(--color-primary-500);
    }
    @media (hover: hover) and (pointer: fine) {
      .restore-area:hover .room-name,
      .restore-area:focus-visible .room-name {
        color: var(--color-primary-500);
      }
    }
    .mic-toggle,
    .leave-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: var(--space-9);
      height: var(--space-9);
      border-radius: var(--radius-full);
      border: none;
      cursor: pointer;
      transition: background 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease;
    }
    /* Bumped to the WCAG comfortable touch-target size on touch devices;
       kept compact for mouse/trackpad pointers so the bar stays small on desktop. */
    @media (pointer: coarse) {
      .mic-toggle,
      .leave-btn {
        width: var(--touch-target-min);
        height: var(--touch-target-min);
      }
    }
    @media (hover: hover) and (pointer: fine) {
      .mic-toggle:hover,
      .leave-btn:hover {
        box-shadow: var(--shadow-sm);
      }
      .mic-toggle:hover {
        background: var(--bar-chip-hover-bg);
      }
      .leave-btn:hover {
        background: var(--color-error-700);
      }
    }
    .mic-toggle:active,
    .leave-btn:active {
      transform: scale(0.9);
    }
    .mic-toggle {
      background: var(--bar-chip-bg);
      color: var(--color-text);
    }
    .mic-toggle.is-muted {
      color: var(--color-error-600);
    }
    .leave-btn {
      background: var(--color-error-600);
      color: var(--color-on-color);
    }
    @media (prefers-reduced-motion: reduce) {
      .minimized-bar {
        opacity: 1;
        transform: none;
        animation: none;
      }
      .live-dot {
        animation: none;
      }
      .minimized-bar,
      .restore-area,
      .mic-toggle,
      .leave-btn,
      .room-name {
        transition: none;
      }
    }
  `],
})
export class MinimizedRoomBarComponent {
  private readonly router = inject(Router);
  private readonly rcs = inject(RoomConnectionService);
  private readonly activeCall = inject(ACTIVE_CALL_READER);

  readonly snapshot = this.activeCall.snapshot;

  restore(cname: string, busiType: number): void {
    void this.router.navigate(['/room', cname, busiType]);
  }

  toggleMic(isCurrentlyOn: boolean): void {
    void this.rcs.setMicEnabled(!isCurrentlyOn).then(() => {
      this.activeCall.updateMicState(!isCurrentlyOn);
    });
  }

  leave(): void {
    void this.activeCall.leave();
  }
}