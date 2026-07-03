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
          <span class="room-name">{{ call.roomName }}</span>
        </button>
        <button
          type="button"
          class="mic-toggle"
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
    }
    .minimized-bar {
      position: fixed;
      left: var(--space-4);
      bottom: calc(var(--bottom-nav-height) + var(--space-4) + env(safe-area-inset-bottom));
      z-index: var(--z-modal);
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-full);
      background: var(--color-card);
      box-shadow: var(--shadow-lg);
      border: 1px solid var(--color-border);
      touch-action: none;
      cursor: grab;
    }
    .minimized-bar:active {
      cursor: grabbing;
    }
    @media (min-width: 1024px) {
      .minimized-bar {
        bottom: var(--space-4);
      }
    }
    .restore-area {
      display: flex;
      align-items: center;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
    }
    .room-name {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text);
      max-width: 140px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
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
    }
    .mic-toggle {
      background: var(--color-neutral-100);
      color: var(--color-text);
    }
    .leave-btn {
      background: var(--color-danger);
      color: var(--color-on-danger, #fff);
    }
    :host-context(.dark) .minimized-bar {
      background: var(--color-neutral-800);
      border-color: var(--color-neutral-700);
    }
    :host-context(.dark) .mic-toggle {
      background: var(--color-neutral-700);
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