import type { AudienceUser, StageUser } from '../models/room-model';

export interface ManagerIdentity {
  readonly userId: number;
  readonly avatarUrl: string | null;
}

/** Best-effort: the room_kick event only carries the manager's display name, not their
 *  userId, so we match it against the room's current roster to find a clickable identity. */
export function resolveManagerIdentity(
  managerName: string,
  stageUsers: readonly StageUser[],
  audienceUsers: readonly AudienceUser[],
): ManagerIdentity | null {
  const onStage = stageUsers.find((u) => u.nickname === managerName);
  if (onStage) return { userId: onStage.userId, avatarUrl: onStage.headUrl };

  const inAudience = audienceUsers.find((u) => u.base?.nickname === managerName);
  if (inAudience) return { userId: inAudience.userId, avatarUrl: inAudience.base?.headUrl ?? null };

  return null;
}

export interface KickedFromRoomOutcome {
  readonly shouldGoInvisible: boolean;
  readonly toastMessage: string;
  readonly notificationTitle: string;
  readonly notificationMessage: string;
}

export function buildKickedFromRoomOutcome(
  managerName: string,
  roomName: string,
  isCurrentlyVisible: boolean,
): KickedFromRoomOutcome {
  return {
    shouldGoInvisible: isCurrentlyVisible,
    toastMessage: `You were removed from ${roomName} by ${managerName}`,
    notificationTitle: 'Removed from room',
    notificationMessage: `${managerName} removed you from ${roomName}`,
  };
}
