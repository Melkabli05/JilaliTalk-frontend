import { of } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { AuthStore } from '@core/auth/auth.store';
import { ToastService } from '@core/services/toast.service';
import { NOTIFICATION_REPORTER } from '@core/tokens/notification-reporter.token';
import { ROOM_INVITE_GATEWAY, RoomInviteGateway } from '@core/tokens/room-invite-gateway.token';
import { ImBootstrapService } from './im-bootstrap.service';
import { ImSocketService } from './im-socket.service';
import type { ImEvent } from './im-events';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  readonly url: string;
  readyState = 0;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  close(): void {
    this.readyState = 3;
  }
}

describe('ImBootstrapService', () => {
  let imSocket: ImSocketService;
  let toast: ToastService;
  let notify: ReturnType<typeof vi.fn>;
  let notifyUserEvent: ReturnType<typeof vi.fn>;
  let gateway: {
    approveStageInvite: Mock<RoomInviteGateway['approveStageInvite']>;
    approveModInvite: Mock<RoomInviteGateway['approveModInvite']>;
  };
  let imSock: FakeWebSocket;

  function push(event: ImEvent): void {
    imSock.onmessage?.({ data: JSON.stringify(event) });
    TestBed.flushEffects();
  }

  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal('WebSocket', Object.assign(FakeWebSocket, { OPEN: 1, CLOSED: 3 }));
    notify = vi.fn();
    notifyUserEvent = vi.fn();
    gateway = {
      approveStageInvite: vi.fn<RoomInviteGateway['approveStageInvite']>(() => of(undefined)),
      approveModInvite: vi.fn<RoomInviteGateway['approveModInvite']>(() => of(undefined)),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthStore, useValue: { isAuthenticated: () => true, user: () => ({ userId: 42 }) } },
        { provide: NOTIFICATION_REPORTER, useValue: { notify, notifyUserEvent } },
        { provide: ROOM_INVITE_GATEWAY, useValue: gateway satisfies RoomInviteGateway },
      ],
    });

    TestBed.inject(ImBootstrapService);
    TestBed.flushEffects(); // auth effect runs once: isAuthenticated() true -> imSocket.connect()

    imSocket = TestBed.inject(ImSocketService);
    toast = TestBed.inject(ToastService);
    imSock = FakeWebSocket.instances[0]!;
  });

  it('shows an actionable toast for stage_invite, unconditionally', () => {
    push({ type: 'stage_invite', userId: '9', cname: 'VR_1_2' });

    const toasts = toast.toasts();
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.message).toBe('The host invited you to join the stage');
    expect(toasts[0]!.actions).toHaveLength(2);
    expect(notify).not.toHaveBeenCalled();
  });

  it('accepting the stage_invite toast calls the gateway with accepted=true', () => {
    push({ type: 'stage_invite', userId: '9', cname: 'VR_1_2' });

    toast.toasts()[0]!.actions!.find((a) => a.label === 'Accept')!.run();

    expect(gateway.approveStageInvite).toHaveBeenCalledWith('VR_1_2', true);
  });

  it('declining the stage_invite toast calls the gateway with accepted=false', () => {
    push({ type: 'stage_invite', userId: '9', cname: 'VR_1_2' });

    toast.toasts()[0]!.actions!.find((a) => a.label === 'Decline')!.run();

    expect(gateway.approveStageInvite).toHaveBeenCalledWith('VR_1_2', false);
  });

  it('shows an actionable toast for mod_invite and accepts using the current user id', () => {
    push({ type: 'mod_invite', userId: '9', cname: 'VR_1_2' });

    toast.toasts()[0]!.actions!.find((a) => a.label === 'Accept')!.run();

    expect(gateway.approveModInvite).toHaveBeenCalledWith('VR_1_2', 42);
  });

  it('toasts mod_accepted/mod_removed/mod_unmuted unconditionally, without notifying', () => {
    push({ type: 'mod_accepted', userId: '9' });
    push({ type: 'mod_removed', userId: '9' });
    push({ type: 'mod_unmuted', userId: '9' });

    expect(toast.toasts()).toHaveLength(3);
    expect(notify).not.toHaveBeenCalled();
  });

  it('notifies passive social events (follow) as a user-linked notification, without toasting', () => {
    push({ type: 'follow', userId: '7', nickname: 'Sam', headUrl: 'https://x/sam.jpg', status: 1 });

    expect(notifyUserEvent).toHaveBeenCalledWith({
      type: 'info',
      title: 'New follower',
      message: 'Sam followed you',
      userId: 7,
      avatarUrl: 'https://x/sam.jpg',
      nickname: 'Sam',
    });
    expect(notify).not.toHaveBeenCalled();
    expect(toast.toasts()).toHaveLength(0);
  });

  it('falls back to a plain notification for follow when no userId is present', () => {
    push({ type: 'follow', userId: '', nickname: 'Sam', status: 2 });

    expect(notify).toHaveBeenCalledWith('info', 'New follower', 'Sam followed you back');
    expect(notifyUserEvent).not.toHaveBeenCalled();
  });

  it('notifies profile_visit as a user-linked notification using the visitor nickname', () => {
    push({ type: 'profile_visit', visitorUserId: '7', nickname: 'Sam', headUrl: 'https://x/sam.jpg' });

    expect(notifyUserEvent).toHaveBeenCalledWith({
      type: 'info',
      title: 'Profile visit',
      message: 'Sam visited your profile',
      userId: 7,
      avatarUrl: 'https://x/sam.jpg',
      nickname: 'Sam',
    });
  });

  it('falls back to "Someone" for profile_visit when the backend omits a nickname (never shows the raw userId)', () => {
    push({ type: 'profile_visit', visitorUserId: '169335562' });

    expect(notifyUserEvent).toHaveBeenCalledWith({
      type: 'info',
      title: 'Profile visit',
      message: 'Someone visited your profile',
      userId: 169335562,
      avatarUrl: null,
      nickname: null,
    });
  });

  it('notifies gift_message as a user-linked notification', () => {
    push({ type: 'gift_message', fromUserId: '11', fromNickname: 'Amal', fromHeadUrl: 'https://x/amal.jpg', giftId: 5, count: 2 });

    expect(notifyUserEvent).toHaveBeenCalledWith({
      type: 'info',
      title: 'Gift received',
      message: 'Amal sent you a gift',
      userId: 11,
      avatarUrl: 'https://x/amal.jpg',
      nickname: 'Amal',
    });
  });

  it('notifies introduction_message as a user-linked notification', () => {
    push({ type: 'introduction_message', fromUserId: '12', fromNickname: 'Youssef', fromHeadUrl: 'https://x/y.jpg' });

    expect(notifyUserEvent).toHaveBeenCalledWith({
      type: 'info',
      title: 'Introduction',
      message: 'Youssef sent you an introduction',
      userId: 12,
      avatarUrl: 'https://x/y.jpg',
      nickname: 'Youssef',
    });
  });

  it('still toasts an account ban', () => {
    push({ type: 'account_status', status: 'banned' });

    expect(toast.toasts()).toHaveLength(1);
    expect(toast.toasts()[0]!.type).toBe('error');
  });
});
