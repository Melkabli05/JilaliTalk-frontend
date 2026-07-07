import { RoomStore } from '../store/room-store';
import { ActiveCallStore } from '@store/active-call.store';
import { clearMediaSessionMetadata } from '../utils/media-session.util';

export function minimizeRoom(
  roomStore: RoomStore,
  activeCallStore: ActiveCallStore,
  busiType: number,
): void {
  const cname = roomStore.cname();
  if (!cname) return;
  activeCallStore.minimize(
    cname,
    busiType,
    roomStore.name(),
    roomStore.isMicOn(),
    !roomStore.isVisible(),
  );
  // Same mediaSession clear as leaveRoom() — without this, the iOS lock-screen
  // tile lingers after minimize, and the bar UI's "playing" state would never reset.
  clearMediaSessionMetadata();
}
