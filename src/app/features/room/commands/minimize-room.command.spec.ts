import { describe, expect, it, vi } from 'vitest';
import type { RoomStore } from '../store/room-store';
import type { ActiveCallStore } from '@store/active-call.store';
import { minimizeRoom } from './minimize-room.command';

function fakeRoomStore(cname: string | null): RoomStore {
  return {
    cname: () => cname,
    name: () => 'Chill Voice Room',
    isMicOn: () => true,
    isVisible: () => true,
  } as unknown as RoomStore;
}

describe('minimizeRoom', () => {
  it('does nothing when there is no active room', () => {
    const roomStore = fakeRoomStore(null);
    const activeCallStore = { minimize: vi.fn() } as unknown as ActiveCallStore;

    minimizeRoom(roomStore, activeCallStore, 2);

    expect(activeCallStore.minimize).not.toHaveBeenCalled();
  });

  it('snapshots cname, busiType, name, mic state, and invisibility', () => {
    const roomStore = fakeRoomStore('VR_1_2');
    const activeCallStore = { minimize: vi.fn() } as unknown as ActiveCallStore;

    minimizeRoom(roomStore, activeCallStore, 2);

    expect(activeCallStore.minimize).toHaveBeenCalledWith('VR_1_2', 2, 'Chill Voice Room', true, false);
  });
});
