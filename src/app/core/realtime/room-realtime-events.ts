export interface StageUserEvent {
  readonly userId: string | null;
  readonly nickname: string | null;
  readonly headUrl: string | null;
  readonly nationality: string | null;
  /** 1 = host, 2 = mod, 3 = audience (Android live convention). */
  readonly role: number;
  readonly seatId: number;
  readonly vipLogo: string | null;
  readonly vipLogoAnim: string | null;
  readonly vipType: number;
  readonly dayRankLevel: number;
  readonly giftLevel: number;
  readonly gType: number;
  readonly screenShareUid: number;
  readonly enterEffectId: number;
  readonly enterEffectAnimalType: number;
  readonly enterEffectAnimalUrl: string | null;
  readonly enterEffectPaid: number;
  readonly rippleAnimalType: number;
  readonly rippleAnimalUrl: string | null;
  readonly rippleUrl: string | null;
  readonly isOnStage: boolean;
  readonly isFirstJoin: boolean;
  readonly isInRoom: boolean;
  readonly isTurnOnMic: boolean;
  readonly isTurnOnCam: boolean;
  readonly inviteUserId: string | null;
  readonly inviteNickname: string | null;
  readonly inviteHeadUrl: string | null;
  readonly inviteNationality: string | null;
  readonly bubbleId: number;
  readonly bubbleUrl: string | null;
  readonly bubbleColor: string;
  readonly bubbleAnimalType: number;
  readonly bubbleAnimalUrl: string | null;
  readonly fgLevel: number;
  readonly fgName: string | null;
  readonly fgIsActive: boolean;
  readonly followerId: number;
  readonly followeeId: number;
  readonly audienceTotal: number;
  readonly raiseHandCount: number;
  readonly medalWallIcon: string | null;
  readonly joinTime: number;
  readonly createdAt: number;
  readonly pinnedStatus: number;
  readonly pinnedType: string | null;
  readonly teamIndex: number;
  readonly status: number;
  readonly type: number;
  readonly name: string | null;
  readonly label: string | null;
  readonly level: number;
  readonly reason: string | null;
  readonly notice: string | null;
  readonly tipText: string | null;
  readonly shareStatus: string | null;
  readonly location: string | null;
}

export interface ReplyInfoEvent {
  readonly msgId: string;
  readonly fromId: number;
  readonly fromNickname: string;
  readonly text: string;
  readonly msgType: string;
  readonly sendTime: number;
}

export interface CommentEvent {
  readonly id: string;
  /** Android LiveWSSMessage.msg_id — distinct from `id` (which is notify_info._id). */
  readonly msgId: string | null;
  readonly userId: string;
  readonly nickname: string;
  readonly headUrl: string;
  readonly text: string;
  readonly ts: number;
  /** ms epoch from notify_info.msg.server_ts; 0 if absent. */
  readonly serverTime: number;
  /** ms epoch from notify_info.msg.send_time; 0 if absent. */
  readonly sendTime: number;
  readonly msgModel: string | null;
  readonly source: string | null;
  /** Profile-tour marker (1 = profile-tour post). */
  readonly fromProfileTs: number;
  readonly replyInfo: ReplyInfoEvent | null;
  /** Echoed back from the sendComment request payload when the BFF
   *  supports it. Lets the sender dedup the optimistic insert. */
  readonly clientNonce?: string;
  readonly nationality: string | null;
  readonly role: number;
  readonly vipType: number;
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

export interface GiftEvent {
  readonly sendUid: string;
  readonly sendNickname: string;
  readonly sendHeadUrl: string | null;
  readonly sendNation: string | null;
  readonly receiverUid: string;
  readonly receiverNickname: string;
  readonly receiverHeadUrl: string | null;
  readonly receiverNation: string | null;
  readonly smallPic: string | null;
  readonly giftId: number;
  readonly giftNumber: number;
  readonly giftVal: number;
  readonly vipType: number;
  readonly giftLevel: number;
  readonly dayRankLevel: number;
}

/** LiveWSSReward — single reward entry inside a show popup / reward-list. */
export interface Reward {
  readonly rewardId: number;
  readonly awardType: number;
  readonly name: string | null;
  readonly number: number;
  readonly animalType: number;
  readonly animalUrl: string | null;
  readonly virtualVal: number;
  readonly isMysteryGift: boolean;
}

/** LiveWSSCampResultEntity — vote/camp tally nested under TreasureReward. */
export interface CampResult {
  readonly optionLeftName: string | null;
  readonly optionRightName: string | null;
  /** 1 = left won, 2 = right won, 0 = tie / unknown. */
  readonly optionResult: number;
  readonly voteCountLeft: number;
  readonly voteCountRight: number;
}

export type RoomRealtimeEvent =
  | { readonly type: 'connection-state'; readonly state: 'connecting' | 'connected' | 'reconnecting' | 'disconnected' }
  | { readonly type: 'user_join'; readonly userId: string; readonly nickname: string; readonly headUrl: string | null; readonly nationality: string | null; readonly isBannedComment: boolean }
  | { readonly type: 'user_quit'; readonly userId: string }
  | { readonly type: 'stage_join'; readonly stageUser: StageUserEvent }
  | { readonly type: 'stage_quit'; readonly userId: string }
  | { readonly type: 'stage_raisehand'; readonly userId: string; readonly raisehandType: 1 | 2 }
  | { readonly type: 'stage_invite'; readonly userId: string }
  | { readonly type: 'comment'; readonly comment: CommentEvent }
  | { readonly type: 'gift'; readonly gifts: readonly GiftEvent[] }
  | { readonly type: 'stage_device_control'; readonly userId: string; readonly deviceType: number; readonly switchType: number }
  | { readonly type: 'mod_invite'; readonly userId: string }
  | { readonly type: 'whiteboard_activated'; readonly cname: string }
  | { readonly type: 'whiteboard_deactivated'; readonly cname: string }
  | { readonly type: 'mic_opened'; readonly userId: string }
  | { readonly type: 'mic_closed'; readonly userId: string }
  | { readonly type: 'mod_unmuted'; readonly userId: string }
  | { readonly type: 'room_kick'; readonly userId: string; readonly nickname: string; readonly managerName: string; readonly cname: string }
  | { readonly type: 'stage_kick'; readonly userId: string; readonly managerName: string; readonly cname: string }
  | { readonly type: 'mod_accepted'; readonly userId: string }
  | { readonly type: 'mod_removed'; readonly userId: string }
  | { readonly type: 'follow'; readonly userId: string; readonly nickname: string; readonly headUrl: string | null; readonly status: number }
  | { readonly type: 'lucky_bag'; readonly luckyBagId: string; readonly luckyBagNumber: number; readonly cname: string }
  | { readonly type: 'room_topic_share'; readonly cname: string; readonly categoryId: number; readonly topicId: number; readonly name: string }
  | { readonly type: 'room_props_applied'; readonly cname: string; readonly userId: string; readonly propsId: number; readonly propsType: number; readonly animalType: number; readonly animalUrlV2: string | null; readonly listBackgroundUrl: string | null; readonly roomBigBackgroundUrl: string | null; readonly soundWaveUrl: string | null; readonly topListBackgroundUrl: string | null; readonly backgroundPaid: number }
  | { readonly type: 'gift_wish'; readonly giftId: number; readonly smallPic: string | null; readonly configGiftCount: number; readonly receivedGiftCount: number; readonly virtualVal: number }
  | { readonly type: 'reward_info'; readonly userId: string | null; readonly nickname: string | null; readonly headUrl: string | null; readonly nation: string | null; readonly rewards: readonly Reward[] }
  | { readonly type: 'purchase_vip'; readonly cname: string; readonly sendUid: string | null; readonly giftId: number; readonly giftName: string | null; readonly giftType: number; readonly giftNumber: number; readonly label: string | null; readonly smallPic: string | null; readonly title: string | null }
  | { readonly type: 'receive_vip_gifts'; readonly cname: string; readonly sendUserId: string | null; readonly sendNickName: string | null; readonly sendType: number; readonly vipTime: number; readonly showTime: number }
  | { readonly type: 'treasure_reward'; readonly title: string | null; readonly campResult: CampResult | null; readonly rewardInfo: { readonly userId: string | null; readonly nickname: string | null; readonly headUrl: string | null; readonly nation: string | null; readonly rewards: readonly Reward[] } | null; readonly taskTypeNew: string | null; readonly openCycle: number; readonly openLevel: number; readonly animalType: number; readonly animalUrl: string | null; readonly participateUserIds: readonly string[]; readonly rewardUserIds: readonly string[]; readonly noPrivilegeUserIds: readonly string[]; readonly rewardPopupColor: string | null; readonly mainTextColor: string | null; readonly subTextColor: string | null; readonly taskDescColor: string | null }
  | { readonly type: 'fg_upgrade_award'; readonly id: number; readonly awardType: string | null; readonly icon: string | null; readonly content: string | null }
  | { readonly type: 'raw'; readonly originalType: string; readonly payload: unknown }
  | { readonly type: 'error'; readonly message: string };

// ---- AI-captioning / subtitle channel (cc) ----
// Same WebSocket as RoomRealtimeEvent, separate stream — opt-in via ?cc=1 on /ws/ht/{cname}.

export type RoomCcRealtimeEvent =
  | { readonly type: 'connection-state'; readonly state: 'connecting' | 'connected' | 'reconnecting' | 'disconnected' }
  | { readonly type: 'subtitle_start'; readonly cname: string | null; readonly speakerId: string | null; readonly speakerNickname: string | null; readonly speakerHeadUrl: string | null; readonly nationality: string | null; readonly roleType: number; readonly id: string | null }
  | { readonly type: 'subtitle_end'; readonly cname: string | null }
  | { readonly type: 'subtitle_disabled'; readonly cname: string | null }
  | { readonly type: 'subtitle_line'; readonly cname: string | null; readonly id: string | null; readonly text: string | null; readonly userId: string | null; readonly nickName: string | null; readonly headUrl: string | null; readonly nationality: string | null; readonly roleType: number; readonly createAt: number; readonly updateAt: number; readonly resultId: number; readonly enabled: boolean | null; readonly expiredAt: number | null }
  | { readonly type: 'subtitle_experience_activated'; readonly cname: string | null; readonly userId: string | null }
  | { readonly type: 'subtitle_expired'; readonly cname: string | null; readonly expiredAt: number }
  | { readonly type: 'raw'; readonly originalType: string; readonly payload: unknown }
  | { readonly type: 'error'; readonly message: string };
