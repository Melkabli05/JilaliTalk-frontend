import { describe, expect, it, vi } from 'vitest';
import type { RoomConnectionService } from '@core/realtime/room-connection.service';
import type { HtRoomConnectionService } from '@core/realtime/ht-room-connection.service';
import type { ActiveCallStore } from '@store/active-call.store';
import { resolveRoomEntry } from './resolve-room-entry.command';

function fakeRcs(): RoomConnectionService {
  return { leave: vi.fn(() => Promise.resolve()) } as unknown as RoomConnectionService;
}

function fakeBffWs(gaveUp = false): HtRoomConnectionService {
  return {
    gaveUp: vi.fn(() => gaveUp),
    disconnect: vi.fn(() => Promise.resolve()),
  } as unknown as HtRoomConnectionService;
}

function fakeActiveCallStore(overrides: { cname?: string | null; minimized?: boolean } = {}): ActiveCallStore {
  return {
    cname: () => overrides.cname ?? null,
    minimized: () => overrides.minimized ?? false,
    clear: vi.fn(),
  } as unknown as ActiveCallStore;
}

describe('resolveRoomEntry', () => {
  it('is not a restore, and leaves nothing connected, for a fresh entry with no minimized snapshot', async () => {
    const rcs = fakeRcs();
    const bffWs = fakeBffWs();
    const activeCallStore = fakeActiveCallStore({ cname: null, minimized: false });

    const isRestore = await resolveRoomEntry('VR_1_2', rcs, bffWs, activeCallStore);

    expect(isRestore).toBe(false);
    expect(rcs.leave).not.toHaveBeenCalled();
  });

  it('tears down the stale connection when minimized for a *different* room than the one being entered', async () => {
    const rcs = fakeRcs();
    const bffWs = fakeBffWs();
    const activeCallStore = fakeActiveCallStore({ cname: 'OTHER_ROOM', minimized: true });

    const isRestore = await resolveRoomEntry('VR_1_2', rcs, bffWs, activeCallStore);

    expect(isRestore).toBe(false);
    expect(rcs.leave).toHaveBeenCalled();
    expect(activeCallStore.clear).toHaveBeenCalled();
  });

  it('is a restore when minimized snapshot matches the room being entered', async () => {
    const rcs = fakeRcs();
    const bffWs = fakeBffWs(false);
    const activeCallStore = fakeActiveCallStore({ cname: 'VR_1_2', minimized: true });

    const isRestore = await resolveRoomEntry('VR_1_2', rcs, bffWs, activeCallStore);

    expect(isRestore).toBe(true);
    expect(rcs.leave).not.toHaveBeenCalled();
  });

  it('forces a fresh connect (not a restore) when the socket already gave up on this room', async () => {
    const rcs = fakeRcs();
    const bffWs = fakeBffWs(true);
    const activeCallStore = fakeActiveCallStore({ cname: 'VR_1_2', minimized: true });

    const isRestore = await resolveRoomEntry('VR_1_2', rcs, bffWs, activeCallStore);

    expect(isRestore).toBe(false);
    expect(bffWs.disconnect).toHaveBeenCalled();
  });
});
