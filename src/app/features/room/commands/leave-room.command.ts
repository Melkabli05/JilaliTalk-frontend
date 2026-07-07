import { RoomConnectionService } from '@core/realtime/room-connection.service';
import { BffRoomSocketService } from '@core/realtime/bff-room-socket.service';
import { ActiveCallStore } from '@store/active-call.store';
import { RoomStore } from '../store/room-store';
import { clearMediaSessionMetadata } from '../utils/media-session.util';

/**
 * The full "leave the room" side-effect sequence: tear down RTC, tell the backend, close
 * the realtime socket, clear the minimize snapshot, and clear the OS media-session tile.
 * Navigation is the caller's concern, not this command's — the page component's onLeave
 * navigates only after RoomFacade.leave (which forwards to this) resolves, in a `finally`
 * so it still runs if this throws.
 */
export async function leaveRoom(
  rcs: RoomConnectionService,
  roomStore: RoomStore,
  bffWs: BffRoomSocketService,
  activeCallStore: ActiveCallStore,
): Promise<void> {
  await rcs.leave();
  await roomStore.leaveRoom();
  bffWs.disconnect();
  activeCallStore.clear();
  clearMediaSessionMetadata();
}
