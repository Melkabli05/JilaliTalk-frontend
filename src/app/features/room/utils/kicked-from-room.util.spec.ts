import { describe, expect, it } from 'vitest';
import { buildKickedFromRoomOutcome, resolveManagerIdentity } from './kicked-from-room.util';
import type { AudienceUser, StageUser } from '../models/room-model';

function stageUser(overrides: Partial<StageUser> & { userId: number; nickname: string }): StageUser {
  return {
    headUrl: null,
    nationality: null,
    role: 1,
    isTurnOnMic: true,
    isTurnOnCam: false,
    isBannedComment: false,
    rippleId: 0,
    rippleUrl: null,
    rippleAnimalType: 0,
    rippleAnimalUrl: null,
    isAiUser: false,
    ...overrides,
  } as StageUser;
}

function audienceUser(overrides: Partial<AudienceUser> & { userId: number }): AudienceUser {
  return {
    isOnMic: false,
    isRaiseHand: false,
    isTurnOnMic: false,
    isTurnOnCam: false,
    role: 3,
    busiType: 2,
    isBannedComment: false,
    isBannedMic: false,
    dailyCostCoins: 0,
    giftLevel: 0,
    vipType: 0,
    fgLevel: 0,
    fgName: '',
    fgIsActive: false,
    base: null,
    ...overrides,
  } as AudienceUser;
}

describe('buildKickedFromRoomOutcome', () => {
  it('flags that the user should go invisible when they were visible at the time of the kick', () => {
    const outcome = buildKickedFromRoomOutcome('Alex', 'Chill Voice Room', true);
    expect(outcome.shouldGoInvisible).toBe(true);
  });

  it('does not re-toggle visibility when the user was already invisible (already a ghost)', () => {
    const outcome = buildKickedFromRoomOutcome('Alex', 'Chill Voice Room', false);
    expect(outcome.shouldGoInvisible).toBe(false);
  });

  it('includes the manager name and room name in the toast message', () => {
    const outcome = buildKickedFromRoomOutcome('Alex', 'Chill Voice Room', true);
    expect(outcome.toastMessage).toBe('You were removed from Chill Voice Room by Alex');
  });

  it('includes the manager name and room name in the persistent notification', () => {
    const outcome = buildKickedFromRoomOutcome('Alex', 'Chill Voice Room', true);
    expect(outcome.notificationTitle).toBe('Removed from room');
    expect(outcome.notificationMessage).toBe('Alex removed you from Chill Voice Room');
  });
});

describe('resolveManagerIdentity', () => {
  it('finds the manager by nickname among the stage users', () => {
    const identity = resolveManagerIdentity(
      'Alex',
      [stageUser({ userId: 7, nickname: 'Alex', headUrl: 'https://x/alex.png' })],
      [],
    );
    expect(identity).toEqual({ userId: 7, avatarUrl: 'https://x/alex.png' });
  });

  it('falls back to the audience list when the manager is not on stage', () => {
    const identity = resolveManagerIdentity(
      'Alex',
      [],
      [audienceUser({ userId: 9, base: { nickname: 'Alex', signature: null, headUrl: null, nationality: null, nativeLang: -1, timeZone: 0 } })],
    );
    expect(identity).toEqual({ userId: 9, avatarUrl: null });
  });

  it('returns null when no roster entry matches the manager name', () => {
    const identity = resolveManagerIdentity('Ghost Mod', [], []);
    expect(identity).toBeNull();
  });
});
