import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ToastService } from '@core/services/toast.service';
import type { RoomApi } from '../api/room-api';
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

  it('shows an informational toast for room_topic_share (type 47), no action yet', async () => {
    const toast = new ToastService();
    const api = fakeApi();

    await handleRealtimeEvent(
      { type: 'room_topic_share', cname: 'VR_1_2', categoryId: 1053, topicId: 2056, name: 'English learning' },
      api, toast, 'VR_1_2', 2, 1, false, () => 'Someone',
    );

    const t = toast.toasts()[0]!;
    expect(t.message).toBe('New topic: English learning');
    expect(t.actions).toBeUndefined();
  });

  it('skips props-applied toast for self', async () => {
    const toast = new ToastService();
    const api = fakeApi();

    await handleRealtimeEvent(
      { type: 'room_props_applied', cname: 'VR_1_2', userId: '42', propsId: 460, propsType: 7,
        animalType: 3, animalUrlV2: null, listBackgroundUrl: null, roomBigBackgroundUrl: null,
        soundWaveUrl: null, topListBackgroundUrl: null, backgroundPaid: 169 },
      api, toast, 'VR_1_2', 2, 42, false, () => 'Self',
    );

    expect(toast.toasts()).toHaveLength(0);
  });

  it('toasts other users when they apply props', async () => {
    const toast = new ToastService();
    const api = fakeApi();

    await handleRealtimeEvent(
      { type: 'room_props_applied', cname: 'VR_1_2', userId: '99', propsId: 460, propsType: 7,
        animalType: 3, animalUrlV2: null, listBackgroundUrl: null, roomBigBackgroundUrl: null,
        soundWaveUrl: null, topListBackgroundUrl: null, backgroundPaid: 169 },
      api, toast, 'VR_1_2', 2, 1, false, () => 'Other',
    );

    expect(toast.toasts()[0]!.message).toBe('Other changed their chat bubble');
  });

  it('shows a celebratory toast for purchase_vip', async () => {
    const toast = new ToastService();
    const api = fakeApi();

    await handleRealtimeEvent(
      { type: 'purchase_vip', cname: 'VR_1_2', sendUid: '99', giftId: 50, giftName: 'VIP Month',
        giftType: 7, giftNumber: 1, label: 'VIP', smallPic: null, title: 'Bought VIP!' },
      api, toast, 'VR_1_2', 2, 1, false, () => 'Someone',
    );

    expect(toast.toasts()[0]!.message).toBe('Bought VIP!');
  });

  it('thanks the sender for receive_vip_gifts', async () => {
    const toast = new ToastService();
    const api = fakeApi();

    await handleRealtimeEvent(
      { type: 'receive_vip_gifts', cname: 'VR_1_2', sendUserId: '99', sendNickName: 'Santa',
        sendType: 3, vipTime: 0, showTime: 0 },
      api, toast, 'VR_1_2', 2, 1, false, () => 'Someone',
    );

    expect(toast.toasts()[0]!.message).toBe('Santa sent you a VIP gift!');
  });

  it('announces fg_upgrade_award', async () => {
    const toast = new ToastService();
    const api = fakeApi();

    await handleRealtimeEvent(
      { type: 'fg_upgrade_award', id: 42, awardType: 'fg', icon: 'https://i/c.png', content: 'Reached Level 5!' },
      api, toast, 'VR_1_2', 2, 1, false, () => 'Someone',
    );

    expect(toast.toasts()[0]!.message).toBe('Reached Level 5!');
  });

  it('announces treasure_reward title', async () => {
    const toast = new ToastService();
    const api = fakeApi();

    await handleRealtimeEvent(
      { type: 'treasure_reward', title: 'Battle Royale', campResult: null, rewardInfo: null,
        taskTypeNew: 'tr', openCycle: 1, openLevel: 5, animalType: 2, animalUrl: null,
        participateUserIds: [], rewardUserIds: [], noPrivilegeUserIds: [],
        rewardPopupColor: null, mainTextColor: null, subTextColor: null, taskDescColor: null },
      api, toast, 'VR_1_2', 2, 1, false, () => 'Someone',
    );

    expect(toast.toasts()[0]!.message).toBe('Battle Royale');
  });
});
