import { DestroyRef, WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RoomApi } from '../api/room-api';
import { RoomStore } from '../store/room-store';
import { RoomRosterStore } from '../roster/roster-store';
import { RoomConnectionService } from '@core/realtime/room-connection.service';
import { ToastService } from '@core/services/toast.service';
import { StageUser } from '../models/room-model';
import { UserRole } from '@core/models/user-role';
import { httpErrorMessage } from '@shared/utils/http-error-message.util';

/** Voice-only: a user currently on stage taps the hand button to step down. */
export function leaveStage(
  cname: string,
  busiType: number,
  uid: number,
  rosterStore: RoomRosterStore,
  rcs: RoomConnectionService,
  api: RoomApi,
  toast: ToastService,
  handToggleBusy: WritableSignal<boolean>,
  destroyRef: DestroyRef,
): void {
  void rcs.stopAudio().catch(() => {});
  const stagedUser = rosterStore.getStageUser(uid);
  rosterStore.removeStageUser(uid);
  handToggleBusy.set(true);
  api.leaveStage(cname, busiType).pipe(
    takeUntilDestroyed(destroyRef),
  ).subscribe({
    next: () => {
      toast.info('You left the stage');
      handToggleBusy.set(false);
    },
    error: (err: unknown) => {
      if (stagedUser) rosterStore.revertRemoveStageUser(stagedUser);
      console.error('[room] leaveStage failed', err);
      toast.error(httpErrorMessage(err, 'Failed to leave stage'));
      handToggleBusy.set(false);
    },
  });
}

/** Voice-only: a moderator (not yet on stage) taps the hand button to join directly,
 *  skipping the raise-hand/approval flow regular audience members go through. */
export function joinStageAsModerator(
  cname: string,
  busiType: number,
  uid: number,
  roomStore: RoomStore,
  rosterStore: RoomRosterStore,
  rcs: RoomConnectionService,
  api: RoomApi,
  toast: ToastService,
  handToggleBusy: WritableSignal<boolean>,
  destroyRef: DestroyRef,
): void {
  const myUser: StageUser = {
    userId: uid,
    nickname: roomStore.nickname() || 'You',
    headUrl: roomStore.headUrl() || null,
    nationality: roomStore.nationality() || null,
    role: roomStore.myRole() as UserRole,
    isTurnOnMic: false,
    isTurnOnCam: false,
    isBannedComment: false,
    rippleId: 0,
    rippleUrl: null,
    rippleAnimalType: 0,
    rippleAnimalUrl: null,
    isAiUser: false,
  };
  rosterStore.addStageUser(myUser);
  handToggleBusy.set(true);
  api.joinStage(cname, busiType).pipe(
    takeUntilDestroyed(destroyRef),
  ).subscribe({
    next: () => {
      toast.info('You joined the stage');
      void rcs.startAudio().catch(() => {});
      handToggleBusy.set(false);
    },
    error: (err: unknown) => {
      rosterStore.removeStageUser(uid);
      console.error('[room] joinStage failed', err);
      toast.error(httpErrorMessage(err, 'Failed to join stage'));
      handToggleBusy.set(false);
    },
  });
}
