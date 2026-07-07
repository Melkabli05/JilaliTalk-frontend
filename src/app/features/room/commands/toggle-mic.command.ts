import { DestroyRef } from '@angular/core';
import { EMPTY, firstValueFrom } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RoomApi } from '../api/room-api';
import { RoomStore } from '../store/room-store';
import { RoomRosterStore } from '../roster/roster-store';
import { RoomConnectionService } from '@core/realtime/room-connection.service';
import { ToastService } from '@core/services/toast.service';

/**
 * A moderator/host who isn't visually on the stage grid taps the mic button directly (it's
 * shown to every visible room member, not gated by stage status). Previously this disconnected
 * and fully reconnected the RTC session in ghost mode before calling setMicEnabled(true) — but
 * disconnect() nulls out the mic track, ghost-mode reconnect skips the setClientRole('host')
 * promotion needed to publish, and setMicEnabled() only toggles an *existing* track, so this
 * was a guaranteed no-op at best. Fixed to match Agora's own recommended flow: stay in the same
 * RTC session and publish directly — the client is already in non-ghost mode from the initial
 * room join, so startAudio() correctly promotes it to host and creates+publishes the track.
 */
async function talkFromUnderstage(
  roomStore: RoomStore,
  rcs: RoomConnectionService,
): Promise<void> {
  const rtcInfo = roomStore.rtcInfo();
  await rcs.startAudio(rtcInfo?.token ?? null);
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
 * on-stage user, direct publish for a moderator talking without being on the visual stage)
 * and notifies other stage members' mute state. Video's equivalent is toggle-cam.command.ts —
 * kept separate rather than merged since the two media types have different RTC track
 * setup (audio-only publisher flow here vs video here has no "understage" concept).
 */
export async function toggleMic(
  roomStore: RoomStore,
  rosterStore: RoomRosterStore,
  rcs: RoomConnectionService,
  api: RoomApi,
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
      // Deliberately NOT calling rcs.stopAudio() here first — a track already exists after
      // a prior publish (the common mute→unmute case), and destroying + recreating it on
      // every unmute forces a full getUserMedia() re-acquisition and RTC renegotiation each
      // time, which is exactly the kind of repeated teardown/rebuild that produces audio
      // artifacts. The existing-track branch below (setMicEnabled(true)) is the intended
      // lightweight path; only actually missing a track (first publish this session) goes
      // through the create-and-publish branch.
      if (!rcs.localAudioTrack()) {
        if (rosterStore.isOnStage(uid)) {
          const cname = roomStore.cname();
          const publisherToken = cname
            ? (await firstValueFrom(api.fetchPublisherToken(cname))).token
            : null;
          await rcs.startAudio(publisherToken);
        } else {
          await talkFromUnderstage(roomStore, rcs);
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
