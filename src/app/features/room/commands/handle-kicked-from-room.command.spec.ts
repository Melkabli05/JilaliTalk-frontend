import { describe, expect, it, vi } from 'vitest';
import { ToastService } from '@core/services/toast.service';
import type { NotificationReporter } from '@core/tokens/notification-reporter.token';
import type { RoomStore } from '../store/room-store';
import type { RoomRosterStore } from '../roster/roster-store';
import { handleKickedFromRoom } from './handle-kicked-from-room.command';

function fakeRoomStore(overrides: { name?: string; isVisible?: boolean } = {}): RoomStore {
  return {
    name: () => overrides.name ?? 'Chill Voice Room',
    isVisible: () => overrides.isVisible ?? true,
  } as unknown as RoomStore;
}

function fakeRosterStore(): RoomRosterStore {
  return {
    stageUsers: () => [],
    audienceUsers: () => [],
  } as unknown as RoomRosterStore;
}

function fakeNotifications(): NotificationReporter {
  return { notify: vi.fn(), notifyUserEvent: vi.fn() };
}

describe('handleKickedFromRoom', () => {
  it('goes invisible when the user was visible at the time of the kick', async () => {
    const roomStore = fakeRoomStore({ isVisible: true });
    const rosterStore = fakeRosterStore();
    const toast = new ToastService();
    const notifications = fakeNotifications();
    const goInvisibleLocally = vi.fn(() => Promise.resolve());

    await handleKickedFromRoom('Alex', 'VR_1_2', 2, roomStore, rosterStore, toast, notifications, goInvisibleLocally);

    expect(goInvisibleLocally).toHaveBeenCalledWith('VR_1_2', 2);
  });

  it('does not go invisible again when the user was already invisible (a ghost)', async () => {
    const roomStore = fakeRoomStore({ isVisible: false });
    const rosterStore = fakeRosterStore();
    const toast = new ToastService();
    const notifications = fakeNotifications();
    const goInvisibleLocally = vi.fn(() => Promise.resolve());

    await handleKickedFromRoom('Alex', 'VR_1_2', 2, roomStore, rosterStore, toast, notifications, goInvisibleLocally);

    expect(goInvisibleLocally).not.toHaveBeenCalled();
  });

  it('always shows a warning toast, regardless of visibility', async () => {
    const roomStore = fakeRoomStore({ isVisible: false });
    const rosterStore = fakeRosterStore();
    const toast = new ToastService();
    const notifications = fakeNotifications();

    await handleKickedFromRoom('Alex', 'VR_1_2', 2, roomStore, rosterStore, toast, notifications, vi.fn());

    expect(toast.toasts()[0]!.type).toBe('warning');
  });

  it('falls back to a nameless notification when the manager cannot be matched in the roster', async () => {
    const roomStore = fakeRoomStore();
    const rosterStore = fakeRosterStore();
    const toast = new ToastService();
    const notifications = fakeNotifications();

    await handleKickedFromRoom('Ghost Mod', 'VR_1_2', 2, roomStore, rosterStore, toast, notifications, vi.fn());

    expect(notifications.notify).toHaveBeenCalled();
    expect(notifications.notifyUserEvent).not.toHaveBeenCalled();
  });
});
