import { RoomConnectionService } from '@core/realtime/room-connection.service';
import { HtRoomConnectionService } from '@core/realtime/ht-room-connection.service';
import { ActiveCallStore } from '@store/active-call.store';
import { RoomStore } from '../store/room-store';
import { RoomRosterStore } from '../roster/roster-store';

/**
 * Local-only side effects of becoming invisible — no roster leave/join REST call. Clears
 * only the stage list via `updateStageUsers([])`, not `rosterStore.reset()`, which would
 * also wipe the cname the audience-reconcile poll depends on and pause it unnecessarily
 * while the user is merely invisible, not actually leaving the room.
 */
export async function goInvisibleLocally(
  cname: string,
  busiType: number,
  roomStore: RoomStore,
  rosterStore: RoomRosterStore,
  rcs: RoomConnectionService,
  bffWs: HtRoomConnectionService,
  activeCallStore: ActiveCallStore,
  syncVisibilityToUrl: (isVisible: boolean) => void,
): Promise<void> {
  roomStore.setVisibility(false);
  syncVisibilityToUrl(false);
  activeCallStore.setInvisible(true);
  rosterStore.updateStageUsers([]);
  await rcs.stopAudio();
  bffWs.connect(cname, 0, busiType, null);
}
