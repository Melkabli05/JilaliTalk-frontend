import type { RemoteUser } from '@core/realtime/agora-rtc.service';
import type { UserInfoService } from '@core/services/user-info.service';
import type { AudienceUser } from '@features/room/data/room-model';
import { createGhostAudienceUser } from '@features/room/data/room-model';
import type { RoomConnectionService } from '@core/realtime/room-connection.service';
import type { BaseRoomStore } from '../state/base-room-store';
import type { StageStore } from '../state/stage-store';
import type { AudienceStore } from '../state/audience-store';

export interface GhostAudienceInputs {
  readonly remoteUsers: readonly RemoteUser[];
  readonly reqUserId: number;
  readonly selfUserId: number;
  readonly stageUserIds: readonly number[];
  readonly audienceUserIds: readonly number[];
  readonly isVisible: boolean;
}

function knownUids(inputs: GhostAudienceInputs): ReadonlySet<number> {
  return new Set<number>([inputs.selfUserId, ...inputs.stageUserIds, ...inputs.audienceUserIds]);
}

function ghostRemoteUsers(inputs: GhostAudienceInputs): readonly RemoteUser[] {
  const known = knownUids(inputs);
  return inputs.remoteUsers.filter((u) => u.uid !== 0 && !u.isScreenShare && !known.has(u.uid));
}

export function buildGhostAudienceInputs(
  rcs: RoomConnectionService,
  reqUserId: number,
  roomStore: BaseRoomStore,
  stageStore: StageStore,
  audienceStore: AudienceStore,
): GhostAudienceInputs {
  return {
    remoteUsers: rcs.remoteUsers,
    reqUserId,
    selfUserId: roomStore.userId(),
    stageUserIds: stageStore.stageUsers().map((u) => u.userId),
    audienceUserIds: audienceStore.audienceUsers().map((u) => u.userId),
    isVisible: roomStore.isVisible(),
  };
}

export function fetchMissingGhostInfo(inputs: GhostAudienceInputs, userInfoService: UserInfoService): void {
  const uids = ghostRemoteUsers(inputs).map((u) => u.uid);
  if (!inputs.isVisible) uids.push(inputs.selfUserId);

  for (const uid of uids) {
    if (uid > 0 && (!userInfoService.getUserInfo(uid) || userInfoService.isStale(uid))) void userInfoService.fetchUserInfo(uid);
  }
}

export function buildAudienceWithGhosts(
  inputs: GhostAudienceInputs,
  busiType: number,
  userInfoService: UserInfoService,
  audienceUsers: readonly AudienceUser[],
): readonly AudienceUser[] {
  const ghosts = ghostRemoteUsers(inputs).map((u) => {
    const info = userInfoService.getUserInfo(u.uid);
    return createGhostAudienceUser(
      u.uid,
      info?.nickname ?? `Ghost (${u.uid})`,
      info?.details?.base?.headUrl ?? null,
      false,
      busiType,
    );
  });

  if (!inputs.isVisible && inputs.reqUserId > 0) {
    const info = userInfoService.getUserInfo(inputs.reqUserId);
    ghosts.push(createGhostAudienceUser(
      inputs.reqUserId,
      info?.nickname ?? `Ghost ${inputs.reqUserId}`,
      info?.details?.base?.headUrl ?? null,
      true,
      busiType,
    ));
  }

  const visibleUsers = audienceUsers.filter((u) => !u.isGhost);

  return ghosts.length ? [...ghosts, ...visibleUsers] : visibleUsers;
}