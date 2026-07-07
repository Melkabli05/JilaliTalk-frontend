import { firstValueFrom } from 'rxjs';
import { RoomApi } from '../api/room-api';
import { RoomStore } from '../store/room-store';
import { RoomRosterStore } from '../roster/roster-store';
import { RoomConnectionService } from '@core/realtime/room-connection.service';
import { ToastService } from '@core/services/toast.service';

/** Video-room camera toggle — see toggle-mic.command.ts for the voice equivalent. */
export async function toggleCam(
  roomStore: RoomStore,
  rosterStore: RoomRosterStore,
  rcs: RoomConnectionService,
  api: RoomApi,
  destroying: () => boolean,
  toast: ToastService,
): Promise<void> {
  const isOn = roomStore.isCamOn();
  const uid = roomStore.userId();

  if (isOn) {
    await rcs.setCamEnabled(false);
    if (destroying()) return;
    roomStore.setCamOn(false);
    rosterStore.updateUserCamStatus(uid, false);
  } else {
    try {
      if (!rcs.localVideoTrack()) {
        const cname = roomStore.cname();
        const publisherToken = cname
          ? (await firstValueFrom(api.fetchPublisherToken(cname))).token
          : null;
        await rcs.startVideo(publisherToken);
      } else {
        await rcs.setCamEnabled(true);
      }
      if (destroying()) return;
      roomStore.setCamOn(true);
      rosterStore.updateUserCamStatus(uid, true);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to start camera: ${reason}`);
    }
  }
}
