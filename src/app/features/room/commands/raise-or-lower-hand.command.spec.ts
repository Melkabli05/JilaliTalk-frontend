import { of, throwError } from 'rxjs';
import { DestroyRef, signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { ToastService } from '@core/services/toast.service';
import type { RoomApi } from '../api/room-api';
import type { RoomStore } from '../store/room-store';
import { raiseOrLowerHand } from './raise-or-lower-hand.command';

function fakeDestroyRef(): DestroyRef {
  return { onDestroy: () => () => {} } as unknown as DestroyRef;
}

function fakeRoomStore(overrides: { isVisible?: boolean; isHandRaised?: boolean } = {}): RoomStore & { setHandRaised: ReturnType<typeof vi.fn> } {
  const setHandRaised = vi.fn();
  return {
    isVisible: () => overrides.isVisible ?? true,
    isHandRaised: () => overrides.isHandRaised ?? false,
    setHandRaised,
  } as unknown as RoomStore & { setHandRaised: ReturnType<typeof vi.fn> };
}

describe('raiseOrLowerHand', () => {
  it('does nothing and toasts when the user is invisible', () => {
    const roomStore = fakeRoomStore({ isVisible: false });
    const api = { raiseHand: vi.fn() } as unknown as RoomApi;
    const toast = new ToastService();

    raiseOrLowerHand('VR_1_2', 2, roomStore, api, toast, signal(false), fakeDestroyRef());

    expect(api.raiseHand).not.toHaveBeenCalled();
    expect(toast.toasts()[0]!.message).toContain('invisible');
  });

  it('ignores a second call while already busy', () => {
    const roomStore = fakeRoomStore();
    const api = { raiseHand: vi.fn() } as unknown as RoomApi;
    const toast = new ToastService();

    raiseOrLowerHand('VR_1_2', 2, roomStore, api, toast, signal(true), fakeDestroyRef());

    expect(api.raiseHand).not.toHaveBeenCalled();
  });

  it('optimistically raises the hand, then clears busy on success', () => {
    const roomStore = fakeRoomStore({ isHandRaised: false });
    const api = { raiseHand: vi.fn(() => of(undefined)) } as unknown as RoomApi;
    const toast = new ToastService();
    const busy = signal(false);

    raiseOrLowerHand('VR_1_2', 2, roomStore, api, toast, busy, fakeDestroyRef());

    expect(roomStore.setHandRaised).toHaveBeenCalledWith(true);
    expect(api.raiseHand).toHaveBeenCalledWith('VR_1_2', 2, 1);
    expect(busy()).toBe(false);
  });

  it('sends raisehandType 2 when lowering an already-raised hand', () => {
    const roomStore = fakeRoomStore({ isHandRaised: true });
    const api = { raiseHand: vi.fn(() => of(undefined)) } as unknown as RoomApi;
    const toast = new ToastService();

    raiseOrLowerHand('VR_1_2', 2, roomStore, api, toast, signal(false), fakeDestroyRef());

    expect(roomStore.setHandRaised).toHaveBeenCalledWith(false);
    expect(api.raiseHand).toHaveBeenCalledWith('VR_1_2', 2, 2);
  });

  it('rolls back the optimistic update and toasts on API failure', () => {
    const roomStore = fakeRoomStore({ isHandRaised: false });
    const api = { raiseHand: vi.fn(() => throwError(() => new Error('boom'))) } as unknown as RoomApi;
    const toast = new ToastService();
    const busy = signal(false);

    raiseOrLowerHand('VR_1_2', 2, roomStore, api, toast, busy, fakeDestroyRef());

    // First call optimistically set it to true; the rollback call restores false (wasRaised).
    expect(roomStore.setHandRaised).toHaveBeenNthCalledWith(1, true);
    expect(roomStore.setHandRaised).toHaveBeenNthCalledWith(2, false);
    expect(busy()).toBe(false);
    expect(toast.toasts()[0]!.type).toBe('error');
  });
});
