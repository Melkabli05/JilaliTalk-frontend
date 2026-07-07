import { DestroyRef } from '@angular/core';
import { EMPTY, firstValueFrom } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RoomApi } from '../api/room-api';
import { RoomStore } from '../store/room-store';
import { RoomRosterStore } from '../roster/roster-store';
import { RoomConnectionService } from '@core/realtime/room-connection.service';
import { ToastService } from '@core/services/toast.service';

async function talkFromUnderstage(
  roomStore: RoomStore,
  rcs: RoomConnectionService,
  agoraAppId: string,
): Promise<void> {
  const cname = roomStore.cname();
  if (!cname) throw new Error('No active room');
  const uid = roomStore.userId();
  const rtcInfo = roomStore.rtcInfo();
  const token = rtcInfo?.token ?? null;
  const appId = rtcInfo?.appId?.trim() ? rtcInfo.appId : agoraAppId;
  await rcs.agora.disconnect();
  await rcs.agora.connect(cname, uid, token, appId, true);
  await rcs.setMicEnabled(true);
}

function notifyStageMicState(
  uid: number,
  mute: boolean,
  roomStore: RoomStore,
  rosterStore: RoomRosterStore,
  api: RoomApi,
  destroyRef: DestroyRef,
): void {
  const cname = roomStore.cname();
  if (!cname || !rosterStore.isOnStage(uid)) return;
  api.muteUser(cname, roomStore.busiType(), uid, mute).pipe(
    takeUntilDestroyed(destroyRef),
    tap({ error: (err: unknown) => console.warn('[RoomPage] notifyStageMicState failed', err) }),
    catchError(() => EMPTY),
  ).subscribe();
}

/**
 * Voice-room mic toggle: manages the underlying RTC track (publisher token fetch for an
 * on-stage user, "understage" reconnect for a moderator who isn't yet on stage) and
 * notifies other stage members' mute state. Video's equivalent is toggle-cam.command.ts —
 * kept separate rather than merged since the two media types have different RTC track
 * setup (audio-only publisher flow here vs video here has no "understage" concept).
 */
export async function toggleMic(
  roomStore: RoomStore,
  rosterStore: RoomRosterStore,
  rcs: RoomConnectionService,
  api: RoomApi,
  agoraAppId: string,
  destroyRef: DestroyRef,
  destroying: () => boolean,
  toast: ToastService,
): Promise<void> {
  const isOn = roomStore.isMicOn();
  const uid = roomStore.userId();

  if (isOn) {
    await rcs.setMicEnabled(false);
    if (destroying()) return;
    roomStore.setMicOn(false);
    rosterStore.updateUserMicStatus(uid, false);
    notifyStageMicState(uid, true, roomStore, rosterStore, api, destroyRef);
  } else {
    try {
      await rcs.stopAudio();
      if (!rcs.localAudioTrack()) {
        if (rosterStore.isOnStage(uid)) {
          const cname = roomStore.cname();
          const publisherToken = cname
            ? (await firstValueFrom(api.fetchPublisherToken(cname))).token
            : null;
          await rcs.startAudio(publisherToken);
        } else {
          await talkFromUnderstage(roomStore, rcs, agoraAppId);
        }
      } else {
        await rcs.setMicEnabled(true);
      }
      if (destroying()) return;
      roomStore.setMicOn(true);
      rosterStore.updateUserMicStatus(uid, true);
      notifyStageMicState(uid, false, roomStore, rosterStore, api, destroyRef);
    } catch {
      toast.error('Failed to start microphone');
    }
  }
}
