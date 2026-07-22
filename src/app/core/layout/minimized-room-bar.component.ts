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
      <div
        class="minimized-bar fixed flex items-center gap-2 p-2 rounded-full
               bg-white dark:bg-neutral-900
               border border-neutral-200 dark:border-neutral-700
               shadow-lg [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-xl
               [touch-action:none] cursor-grab active:cursor-grabbing
               opacity-0 scale-90 animate-pop-in
               motion-reduce:opacity-100 motion-reduce:scale-100 motion-reduce:![animation:none]
               left-[max(1rem,env(safe-area-inset-left))]
               bottom-[calc(var(--bottom-nav-height)+1rem+env(safe-area-inset-bottom))]
               lg:bottom-4"
        cdkDrag
        cdkDragBoundary=".app-shell"
      >
        <button
          type="button"
          class="group restore-area flex items-center gap-2 min-h-9 bg-none border-0 rounded-full px-1
                 cursor-inherit transition-colors duration-150
                 active:bg-neutral-100 dark:active:bg-neutral-700
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500
                 motion-reduce:transition-none"
          (click)="restore(call.cname, call.busiType)"
        >
          <span class="size-1.5 shrink-0 rounded-full bg-red-500 animate-pulse-live motion-reduce:![animation:none]" aria-hidden="true"></span>
          <span
            class="room-name max-w-[140px] max-[380px]:max-w-[96px] whitespace-nowrap overflow-hidden text-ellipsis
                   text-sm font-medium text-neutral-900 dark:text-neutral-100
                   transition-colors duration-150 motion-reduce:transition-none
                   group-active:text-blue-600
                   [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-blue-600
                   [@media(hover:hover)_and_(pointer:fine)]:group-focus-visible:text-blue-600"
          >{{ call.roomName }}</span>
        </button>
        @if (!call.isInvisible) {
          <button
            type="button"
            class="mic-toggle flex items-center justify-center size-9 [@media(pointer:coarse)]:size-11
                   rounded-full border-0 cursor-pointer
                   bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100
                   transition-[background,transform,box-shadow] duration-150
                   active:scale-90
                   [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-sm
                   [@media(hover:hover)_and_(pointer:fine)]:hover:bg-neutral-200
                   dark:[@media(hover:hover)_and_(pointer:fine)]:hover:bg-neutral-600
                   focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500
                   motion-reduce:transition-none"
            [class.is-muted]="!call.isMicOn"
            [class]="!call.isMicOn ? 'text-red-600' : ''"
            [attr.aria-label]="call.isMicOn ? 'Mute microphone' : 'Unmute microphone'"
            (click)="toggleMic(call.isMicOn)"
          >
            @if (call.isMicOn) {
              <svg aria-hidden="true" lucideMic [size]="16"></svg>
            } @else {
              <svg aria-hidden="true" lucideMicOff [size]="16"></svg>
            }
          </button>
        }
        <button
          type="button"
          class="leave-btn flex items-center justify-center size-9 [@media(pointer:coarse)]:size-11
                 rounded-full border-0 cursor-pointer
                 bg-red-600 text-white
                 transition-[background,transform,box-shadow] duration-150
                 active:scale-90
                 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-sm
                 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-red-700
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500
                 motion-reduce:transition-none"
          aria-label="Leave room"
          (click)="leave()"
        >
          <svg aria-hidden="true" lucidePhoneOff [size]="16"></svg>
        </button>
      </div>
    }
  `,
  /**
   * Only structural/functional CSS remains: :host display:contents (required for a
   * component whose only child is fixed-position, same reasoning as the sibling
   * layout components), and z-index (--z-toast: shared stacking coordination with
   * the toast/notification layer, not a color/style choice).
   */
  styles: [`
    :host { display: contents; }
    .minimized-bar { z-index: var(--z-toast); }
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
