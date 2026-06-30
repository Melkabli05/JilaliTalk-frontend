import { UserRole } from '@core/models/user-role';
import { createSearchMatcher } from '@shared/utils';

export const RoomType = {
  Voice: 'voice' as const,
  Live: 'live' as const,
};
export type RoomType = (typeof RoomType)[keyof typeof RoomType];

export const BusiType = {
  Live: 1,
  Voice: 2,
} as const;
export type BusiType = (typeof BusiType)[keyof typeof BusiType];

export const RoomStatus = {
  Idle: 0,
  Live: 1,
  Ended: 2,
} as const;
export type RoomStatus = (typeof RoomStatus)[keyof typeof RoomStatus];


export interface Channel {
  readonly cname: string;
  readonly busiType: BusiType;
  readonly name: string;
  readonly description: string | null;
  readonly langId: number;
  readonly langs: readonly number[] | null;
  readonly roomStatus: RoomStatus;
  readonly totalUserCount: number;
  readonly heatValue: number | null;
}

export interface HostUser {
  readonly userId: number;
  readonly nickname: string;
  readonly headUrl: string | null;
  readonly nationality: string | null;
}

export interface UserSummary {
  readonly nickname: string | null;
  readonly signature: string | null;
  readonly headUrl: string | null;
  readonly nationality: string | null;
  readonly nativeLang: number;
  readonly timeZone: number;
}

export interface RoomUserSummary {
  readonly userId: number;
  readonly nickname: string;
  readonly headUrl: string | null;
  readonly nationality: string | null;
  readonly cname: string | null;
  readonly isInRoom: boolean;
  readonly isOnMic: boolean;
  readonly isRaiseHand: boolean;
  readonly isTurnOnMic: boolean;
  readonly isTurnOnCam: boolean;
  readonly role: UserRole;
  readonly busiType: number;
  readonly isBannedComment: boolean;
  readonly isBannedMic: boolean;
  readonly dailyCostCoins: number;
  readonly giftLevel: number;
  readonly vipType: number;
  readonly fgLevel: number;
  readonly fgName: string;
  readonly fgIsActive: boolean;
  readonly base: UserSummary | null;
}

export interface CategoryTopic {
  readonly id: number;
  readonly name: string;
  readonly categoryId: number;
}

export interface Category {
  readonly id: number;
  readonly name: string;
  readonly bgColor: string | null;
  readonly fontColor: string | null;
  readonly topics: readonly CategoryTopic[];
}

export interface CategoryTopicTagSummary {
  readonly categoryId: number;
  readonly categoryName: string;
  readonly topicId: number | null;
  readonly topicName: string | null;
  readonly bgColor: string | null;
  readonly fontColor: string | null;
}

export interface LanguageGroup {
  readonly langId: number;
  readonly langs: readonly number[] | null;
  readonly langsLen: number;
}

export interface ChannelListItem {
  readonly channel: Channel;
  readonly hostUser: HostUser;
  readonly users: readonly RoomUserSummary[] | null;
  readonly token: string | null;
  readonly backgroundUrl: string | null;
  readonly categoryTopicTag: CategoryTopicTagSummary | null;
}

export interface ChannelListResponse {
  readonly items: readonly ChannelListItem[];
}

export function filterRooms(
  rooms: readonly ChannelListItem[],
  categoryId: number | null,
  langId: number | null,
  query: string,
): readonly ChannelListItem[] {
  let filtered = rooms;
  if (categoryId !== null) {
    filtered = filtered.filter((room) => room.categoryTopicTag?.categoryId === categoryId);
  }
  if (langId !== null) {
    filtered = filtered.filter((room) => room.channel.langId === langId);
  }
  if (query.trim()) {
    const matcher = createSearchMatcher(query);
    filtered = filtered
      .filter((room) =>
        matcher.matches([
          room.channel.name,
          room.channel.cname,
          room.channel.description,
          room.hostUser.nickname,
          room.categoryTopicTag?.categoryName,
          room.categoryTopicTag?.topicName,
          ...(room.users?.map((u) => u.nickname) ?? []),
        ]),
      )
      .map((room) => ({ room, rank: matcher.rank([room.channel.name, room.hostUser.nickname]) }))
      .sort((a, b) => a.rank - b.rank)
      .map(({ room }) => room);
  }
  return filtered;
}
