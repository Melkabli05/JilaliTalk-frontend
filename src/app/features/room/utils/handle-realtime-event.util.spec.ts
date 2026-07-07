import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ToastService } from '@core/services/toast.service';
import type { RoomApi } from '@features/room/api/room-api';
import { handleRealtimeEvent } from './handle-realtime-event.util';

function fakeApi(): RoomApi {
  return {
    stageInviteApproval: vi.fn(() => of(undefined)),
    approveManager: vi.fn(() => of(undefined)),
    raiseHandApproval: vi.fn(() => of(undefined)),
  } as unknown as RoomApi;
}

describe('handleRealtimeEvent', () => {
  it('does nothing for stage_invite — ImBootstrapService (IM socket) is the sole handler', async () => {
    const toast = new ToastService();
    const api = fakeApi();

    await handleRealtimeEvent({ type: 'stage_invite', userId: '42' }, api, toast, 'VR_1_2', 2, 42, false, () => 'Someone');

    expect(toast.toasts()).toHaveLength(0);
    expect(api.stageInviteApproval).not.toHaveBeenCalled();
  });

  it('does nothing for mod_invite — ImBootstrapService (IM socket) is the sole handler', async () => {
    const toast = new ToastService();
    const api = fakeApi();

    await handleRealtimeEvent({ type: 'mod_invite', userId: '42' }, api, toast, 'VR_1_2', 2, 42, false, () => 'Someone');

    expect(toast.toasts()).toHaveLength(0);
  });

  it('does nothing for mod_accepted/mod_removed/mod_unmuted — ImBootstrapService (IM socket) is the sole handler', async () => {
    const toast = new ToastService();
    const api = fakeApi();

    await handleRealtimeEvent({ type: 'mod_accepted', userId: '42' }, api, toast, 'VR_1_2', 2, 42, false, () => 'Someone');
    await handleRealtimeEvent({ type: 'mod_removed', userId: '42' }, api, toast, 'VR_1_2', 2, 42, false, () => 'Someone');
    await handleRealtimeEvent({ type: 'mod_unmuted', userId: '42' }, api, toast, 'VR_1_2', 2, 42, false, () => 'Someone');

    expect(toast.toasts()).toHaveLength(0);
  });

  it('shows an actionable toast for a host approving a raised hand', async () => {
    const toast = new ToastService();
    const api = fakeApi();

    await handleRealtimeEvent(
      { type: 'stage_raisehand', userId: '7', raisehandType: 1 },
      api, toast, 'VR_1_2', 2, 1, true, (uid) => (uid === 7 ? 'Sam' : 'Someone'),
    );

    expect(toast.toasts()[0]!.message).toBe('Sam wants to join the stage');
  });

  it('approving the raise-hand toast calls the approval API', async () => {
    const toast = new ToastService();
    const api = fakeApi();

    await handleRealtimeEvent(
      { type: 'stage_raisehand', userId: '7', raisehandType: 1 },
      api, toast, 'VR_1_2', 2, 1, true, () => 'Sam',
    );

    toast.toasts()[0]!.actions!.find((a) => a.label === 'Approve')!.run();

    expect(api.raiseHandApproval).toHaveBeenCalledWith('VR_1_2', 2, 7, 1);
  });

  it('ignores stage_raisehand when the current user is not the host', async () => {
    const toast = new ToastService();
    const api = fakeApi();

    await handleRealtimeEvent(
      { type: 'stage_raisehand', userId: '7', raisehandType: 1 },
      api, toast, 'VR_1_2', 2, 1, false, () => 'Sam',
    );

    expect(toast.toasts()).toHaveLength(0);
  });

  it('shows a self-only toast for stage_kick', async () => {
    const toast = new ToastService();
    const api = fakeApi();

    await handleRealtimeEvent(
      { type: 'stage_kick', userId: '42', managerName: 'Alex', cname: 'VR_1_2' },
      api, toast, 'VR_1_2', 2, 42, false, () => 'Someone',
    );

    expect(toast.toasts()[0]!.message).toBe('You were removed from the stage by Alex');
  });

  it('mutes self on stage_device_control', async () => {
    const toast = new ToastService();
    const api = fakeApi();

    await handleRealtimeEvent(
      { type: 'stage_device_control', userId: '42', deviceType: 1, switchType: 1 },
      api, toast, 'VR_1_2', 2, 42, false, () => 'Someone',
    );

    expect(toast.toasts()[0]!.message).toBe('You were muted');
  });
});
