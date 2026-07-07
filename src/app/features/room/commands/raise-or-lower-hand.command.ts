import { DestroyRef, WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RoomApi } from '../api/room-api';
import { RoomStore } from '../store/room-store';
import { ToastService } from '@core/services/toast.service';

/**
 * Shared "raise/lower hand" branch — handles the case where the user is a regular
 * audience member (not on stage, not a moderator). Optimistically flips the local
 * hand-raised state, then rolls it back if the API call fails.
 */
export function raiseOrLowerHand(
  cname: string,
  busiType: number,
  roomStore: RoomStore,
  api: RoomApi,
  toast: ToastService,
  handToggleBusy: WritableSignal<boolean>,
  destroyRef: DestroyRef,
): void {
  if (!roomStore.isVisible()) {
    toast.info('You are invisible — rejoin visibly to raise your hand');
    return;
  }
  if (handToggleBusy()) return;

  const wasRaised = roomStore.isHandRaised();
  const raised = !wasRaised;
  roomStore.setHandRaised(raised);
  handToggleBusy.set(true);

  api.raiseHand(cname, busiType, raised ? 1 : 2).pipe(
    takeUntilDestroyed(destroyRef),
  ).subscribe({
    next: () => handToggleBusy.set(false),
    error: (err: unknown) => {
      console.error('[room] raiseHand failed', err);
      toast.error(`Failed to update hand: ${err instanceof Error ? err.message : String(err)}`);
      roomStore.setHandRaised(wasRaised);
      handToggleBusy.set(false);
    },
  });
}
