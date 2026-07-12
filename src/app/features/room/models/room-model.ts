import { UserRole } from '@core/models/user-role';

export type { UserRole } from '@core/models/user-role';

export interface RoomUserBase {
  readonly nickname: string | null;
  readonly signature: string | null;
  readonly headUrl: string | null;
  readonly nationality: string | null;
  readonly nativeLang: number;
  readonly timeZone: number;
}

export interface StageUser {
  readonly userId: number;
  readonly nickname: string;
  readonly headUrl: string | null;
  readonly nationality: string | null;
  readonly role: UserRole;
  readonly isTurnOnMic: boolean;
  readonly isTurnOnCam: boolean;
  readonly isBannedComment: boolean;
  readonly rippleId: number;
  readonly rippleUrl: string | null;
  readonly rippleAnimalType: number;
  readonly rippleAnimalUrl: string | null;
  readonly isAiUser: boolean;
  readonly isAway?: boolean;
}

export interface AudienceUser {
  readonly userId: number;
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
  readonly base: RoomUserBase | null;
  readonly isGhost?: boolean;
}

export function createGhostAudienceUser(
  uid: number,
  nickname: string,
  headUrl: string | null = null,
  isSelf = false,
  busiType = 2,
): AudienceUser {
  return {
    userId: uid,
    isOnMic: false,
    isRaiseHand: false,
    isTurnOnMic: false,
    isTurnOnCam: false,
    role: UserRole.Normal,
    busiType,
    isBannedComment: false,
    isBannedMic: false,
    dailyCostCoins: 0,
    giftLevel: 0,
    vipType: 0,
    fgLevel: 0,
    fgName: '',
    fgIsActive: false,
    base: {
      nickname: isSelf ? `${nickname} (You)` : nickname,
      signature: null,
      headUrl,
      nationality: null,
      nativeLang: -1,
      timeZone: 0,
    },
    isGhost: true,
  };
}

export interface StageUsersResponse {
  readonly isHostInRoom: boolean;
  readonly list: readonly StageUser[];
}

export interface AudienceUsersResponse {
  readonly list: readonly AudienceUser[];
  readonly audienceTotal: number;
}

export interface GiftEventCard {
  readonly kind: 'gift';
  readonly id: string;
  readonly ts: number;
  readonly userId: number;
  readonly nickname: string;
  readonly headUrl: string | null;
  readonly nationality: string | null;
  readonly receiverUserId: number;
  readonly receiverNickname: string;
  readonly receiverHeadUrl: string | null;
  readonly receiverNationality: string | null;
  readonly giftName: string;
  readonly giftCount: number;
  readonly giftIconUrl: string | null;
  readonly coinAmount: number;
  readonly vipType: number;
  readonly giftLevel: number;
}

export interface FollowEventCard {
  readonly kind: 'follow';
  readonly id: string;
  readonly ts: number;
  readonly userId: number;
  readonly nickname: string;
  readonly headUrl: string | null;
  readonly isFollowBack: boolean;
}

export interface JoinEventCard {
  readonly kind: 'user_join';
  readonly id: string;
  readonly ts: number;
  readonly userId: number;
  readonly nickname: string;
  readonly headUrl: string | null;
  readonly nationality: string | null;
}

export interface QuitEventCard {
  readonly kind: 'user_quit';
  readonly id: string;
  readonly ts: number;
  readonly userId: number;
  readonly nickname: string;
  readonly headUrl: string | null;
  readonly nationality: string | null;
}

export interface RaiseHandEventCard {
  readonly kind: 'stage_raisehand';
  readonly id: string;
  readonly ts: number;
  readonly userId: number;
  readonly nickname: string;
  readonly headUrl: string | null;
  readonly nationality: string | null;
  readonly isRaised: boolean;
}

export interface WhiteboardEventCard {
  readonly kind: 'whiteboard_activated' | 'whiteboard_deactivated';
  readonly id: string;
  readonly ts: number;
  readonly activated: boolean;
}

export interface ModEventCard {
  readonly kind: 'mod_accepted' | 'mod_removed';
  readonly id: string;
  readonly ts: number;
  readonly userId: number;
  readonly nickname: string;
  readonly headUrl: string | null;
  readonly nationality: string | null;
  readonly isAccepted: boolean;
}

export interface KickEventCard {
  readonly kind: 'stage_kick' | 'room_kick';
  readonly id: string;
  readonly ts: number;
  readonly userId: number;
  readonly nickname: string;
  readonly headUrl: string | null;
  readonly nationality: string | null;
  readonly managerName: string;
}

export type EventCard =
  | GiftEventCard
  | FollowEventCard
  | JoinEventCard
  | QuitEventCard
  | RaiseHandEventCard
  | WhiteboardEventCard
  | ModEventCard
  | KickEventCard;

export type CommentOrEvent = Comment | EventCard;

export interface Comment {
  readonly _id: string;
  /**
   * Client-generated nonce for optimistic-insert dedup. Present on
   * locally-inserted comments (before the server echo), then cleared
   * once the echo lands and the temp row is replaced. Never sent
   * over the wire to other clients.
   */
  readonly clientNonce?: string;
  /** Server-side Unix→milliseconds converted value — no client transform needed. */
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
  readonly userId: number;
  readonly nickname: string;
  readonly headUrl: string | null;
  readonly nationality: string | null;
  readonly role: UserRole;
  readonly vipType: number;
  readonly msg: {
    text: { text: string };
    replyInfo?: {
      msgId: string;
      fromId: number;
      fromNickname: string;
      text: string;
      msgType: string;
    } | null;
  };
  readonly dayRankLevel: number;
  readonly giftLevel: number;
  readonly fgLevel: number;
  readonly fgName: string;
  readonly fgIsActive: boolean;
  readonly bubbleId: number;
  readonly bubbleUrl: string | null;
  readonly bubbleColor: string;
  readonly hitBad: number;
  readonly bubbleAnimalType: number;
  readonly bubbleAnimalUrl: string | null;
}

export interface CommentsResponse {
  readonly items: readonly Comment[] | null;
  readonly hasNext: boolean;
  readonly oldestId: string;
}

export interface SendCommentPayload {
  readonly cname: string;
  readonly busiType: number;
  readonly nickname: string;
  readonly headUrl: string | null;
  readonly nationality: string | null;
  readonly role: number;
  readonly text: string;
  /** Client-generated UUID; echoed back on the WS comment event so the
   *  sender can replace the optimistic row with the server-authoritative
   *  one (dedup-by-clientNonce). */
  readonly clientNonce?: string;
  readonly replyInfo?: {
    readonly msgId: string;
    readonly fromId: number;
    readonly fromNickname: string;
    readonly text: string;
    readonly msgType: string;
  } | null;
}
export interface RtcInfo {
  readonly appId: string | null;
  readonly token: string | null;
  readonly engine: string | null;
}

export interface LiveRoomInfo {
  readonly hostInfo: {
    readonly userId: number;
  } | null;
  readonly reqUserInfo: {
    readonly userId: number;
    readonly role: UserRole;
    readonly base: UserBase | null;
  } | null;
  readonly channelInfo: {
    readonly cname: string | null;
    readonly name: string | null;
    readonly langId: number;
    readonly topic?: string | null;
    readonly rtcInfo: RtcInfo | null;
  } | null;
}

export interface UserBase {
  readonly nickname: string | null;
  readonly signature: string | null;
  readonly headUrl: string | null;
  readonly nationality: string | null;
  readonly nativeLang: number;
  readonly teachLang2: number;
  readonly teachLang2Level: number;
  readonly teachLang3: number;
  readonly teachLang3Level: number;
  readonly learnLang1: number;
  readonly learnLang1Level: number;
  readonly learnLang2: number;
  readonly learnLang2Level: number;
  readonly learnLang3: number;
  readonly learnLang3Level: number;
  readonly learnLang4: number;
  readonly learnLang4Level: number;
  readonly learnLang5: number;
  readonly learnLang5Level: number;
  readonly timeZone: number;
}

export interface Ripple {
  readonly rippleId: number;
  readonly rippleUrl: string | null;
  readonly rippleAnimalType: number;
  readonly rippleAnimalUrl: string | null;
}

export interface CategoryTopicTag {
  readonly categoryId: number;
  readonly categoryName: string | null;
  readonly icon: string | null;
  readonly selectedIcon: string | null;
  readonly bgColor: string | null;
  readonly fontColor: string | null;
  readonly topicId: number;
  readonly topicName: string | null;
}

export interface ConfigInfo {
  readonly heartbeatSecond: number;
  readonly showBlindBoxGift: boolean;
  readonly levelUpShow: boolean;
  readonly upLevel: number;
  readonly giftSendShow: boolean;
  readonly entranceEffectSwitchStatus: boolean;
  readonly giftEffectSwitchStatus: boolean;
  readonly commentVipTagShow: boolean;
  readonly commentAdminTagShow: boolean;
  readonly stageListAdminTagShow: boolean;
}

export interface RoomLevelInfo {
  readonly level: number;
  readonly levelIcon: string | null;
  readonly levelRtlIcon: string | null;
  readonly levelIconV2: string | null;
  readonly levelRtlIconV2: string | null;
  readonly labelFontColor: string | null;
}

export interface VoiceRoomManager {
  readonly userId: number;
  readonly headUrl: string | null;
  readonly nationality: string | null;
  readonly nickName: string | null;
  readonly userName: string | null;
  readonly shortFullPy: string | null;
  readonly fullPy: string | null;
  readonly stayTime: number;
  readonly isOnline: number;
}

export interface VoiceRoomInfo {
  readonly hostInfo: {
    readonly userId: number;
    readonly base: UserBase | null;
    readonly isTeacher: boolean;
    readonly isExpert: boolean;
  } | null;
  readonly reqUserInfo: {
    readonly userId: number;
    readonly base: UserBase | null;
    readonly role: UserRole;
    readonly isMute: boolean;
    readonly isBannedComment: boolean;
    readonly relationType: number;
    readonly isOnMic: boolean;
    readonly isTurnOnMic: boolean;
    readonly paymentStatusForSession: boolean;
    readonly ripple: Ripple | null;
    readonly internalUser: boolean;
    readonly isUseHappyChatCard: boolean;
    readonly isShowWeekCard: boolean;
    readonly remainJoinDurSecs: number;
    readonly joinDurExpiredAt: number;
    readonly luckyBagIcon: string | null;
  } | null;
  readonly channelInfo: {
    readonly name: string | null;
    readonly langId: number;
    readonly langs: readonly number[] | null;
    readonly topic?: string | null;
    readonly notice: string | null;
    readonly noticePinType: number;
    readonly hourRank: number;
    readonly topLastHourRanking: boolean;
    readonly pinnedComment: string | null;
    readonly allowCommentStatus: number;
    readonly roomStatus: number;
    readonly startedAt: number;
    readonly audienceCount: number;
    readonly raiseHandUserCount: number;
    readonly onMicCount: number;
    readonly totalActiveNum: number;
    readonly roomDuration: number;
    readonly visibleStatus: number;
    readonly category: string | null;
    readonly privateRoomKey: string | null;
    readonly categoryTopicTag: CategoryTopicTag | null;
    readonly gameType: number;
    readonly tagType: number;
    readonly hasTreasureBox: boolean;
    readonly rtcInfo: RtcInfo | null;
  } | null;
  readonly configInfo: ConfigInfo | null;
  readonly roomLevelInfo: RoomLevelInfo | null;
  readonly managers: readonly VoiceRoomManager[] | null;
}

export interface SignItem {
  readonly signDay: number;
  readonly giftId: number;
  readonly giftInfo: string;
  readonly giftType: number;
  readonly giftNumber: number;
  readonly signStatus: number;
  readonly toDay: boolean;
  readonly giftName: string;
  readonly thumb: string;
}

export interface VoiceSignPanelResponse {
  readonly signList: readonly SignItem[];
  readonly toDaySigned: boolean;
  readonly consecutiveDays: number;
}

export interface RewardItem {
  readonly id: number;
  readonly giftId: number;
  readonly type: number;
  readonly cardType: number;
  readonly name: string;
  readonly number: number;
  readonly icon: string;
  readonly multiName: string;
}

export interface RoomLevelRewardResponse {
  readonly items: readonly RewardItem[];
}

export interface ExpData {
  readonly exp: number;
  readonly maxExp: number;
}

export interface Equity {
  readonly id: number;
  readonly name: string;
  readonly multiName: string | null;
  readonly icon: string;
  readonly multiContent: string | null;
  readonly status: number;
  readonly sort: number;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly equityType: number;
  readonly number: number;
  readonly outsideIcon: string | null;
  readonly giftId: number;
  readonly giftType: number;
  readonly thum: string | null;
  readonly cardType: number;
  readonly thumDark: string | null;
  readonly iconDark: string | null;
  readonly outsideIconDark: string | null;
  readonly labelFontColor: string | null;
  readonly thumV2: string | null;
  readonly iconV2: string | null;
  readonly roomName: string | null;
}

export interface RoomLevelConfigItem {
  readonly roomLevel: number;
  readonly experience: number;
  readonly levelUpExperience: number;
  readonly rewards: readonly RewardItem[] | null;
  readonly bigLevel: number;
  readonly bigLevelNew: number;
  readonly roomStyleUrl: string | null;
  readonly levelName: string | null;
  readonly exp: ExpData | null;
  readonly equitys: readonly Equity[] | null;
}

export interface RoomLevelConfigResponse {
  readonly items: readonly RoomLevelConfigItem[] | null;
}

export interface TaskItem {
  readonly taskId: number;
  readonly name: string;
  readonly type: number;
  readonly status: number;
  readonly icon: string | null;
  readonly rewardId: number;
  readonly rewardType: number;
  readonly rewardAmount: number;
  readonly rewardName: string | null;
  readonly rewardIcon: string | null;
  readonly jumpType: number;
  readonly jumpUrl: string | null;
  readonly description: string | null;
  readonly [key: string]: unknown;
}

export interface VoiceTasksResponse {
  readonly items: readonly TaskItem[] | null;
}

export interface Manager {
  readonly userId: number;
  readonly cname: string;
  readonly isInRoom: boolean;
  readonly nationality: string | null;
  readonly nickname: string;
  readonly role: number;
  readonly headUrl: string | null;
  readonly stayTime: number;
}

export interface ManagerListResponse {
  readonly managerList: readonly Manager[];
}

export interface CaptionEntry {
  readonly id: string;
  readonly cname: string;
  readonly userId: number;
  readonly nickName: string;
  readonly headUrl: string | null;
  readonly nationality: string | null;
  readonly roleType: number;
  readonly resultId: string;
  readonly text: string;
  readonly createdAt: number;
  readonly updateAt: number;
}

export interface CaptionHistoryResponse {
  readonly list: readonly CaptionEntry[];
  readonly hasMore: boolean;
}
