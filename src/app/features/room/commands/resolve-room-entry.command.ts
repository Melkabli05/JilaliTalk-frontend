import { RoomConnectionService } from '@core/realtime/room-connection.service';
import { HtRoomConnectionService } from '@core/realtime/ht-room-connection.service';
import { ActiveCallStore } from '@store/active-call.store';

/**
 * Call at the top of doEnterRoom(), before roomStore.enterRoom(). Returns whether this
 * entry is a minimize→restore for `cname` (same room as the active-call snapshot).
 * If the snapshot instead points at a *different* room — the user minimized room A, then
 * navigated straight to room B instead of restoring — room A's RTC connection is still
 * open and its snapshot is stale, so this tears both down before B's entry proceeds.
 * If the WS gave up while the user was minimized (5 reconnect attempts failed), the
 * restore path would otherwise skip bffWs.connect() and leave the user in a "restored"
 * room with a permanently dead socket — forces a fresh full connect in that case by
 * returning false, so doEnterRoom() re-enters the WS + RTC + RTM branches.
 */
export async function resolveRoomEntry(
  cname: string,
  rcs: RoomConnectionService,
  bffWs: HtRoomConnectionService,
  activeCallStore: ActiveCallStore,
): Promise<boolean> {
  const snapshotMatch = activeCallStore.cname() === cname;
  const isRestore = snapshotMatch && activeCallStore.minimized();
  if (activeCallStore.minimized() && !isRestore) {
    await rcs.leave().catch(() => {});
    activeCallStore.clear();
  }
  if (isRestore && bffWs.gaveUp(cname)) {
    bffWs.disconnect().catch(() => {});
    return false;
  }
  return isRestore;
}
