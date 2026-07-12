export interface StageUserEvent {
  readonly userId: string;
  readonly nickname: string | null;
  readonly headUrl: string | null;
}

export interface ReplyInfoEvent {
  readonly msgId: string;
  readonly fromId: number;
  readonly fromNickname: string;
  readonly text: string;
  readonly msgType: string;
}

export interface CommentEvent {
  readonly id: string;
  readonly userId: string;
  readonly nickname: string;
  readonly headUrl: string;
  readonly text: string;
  readonly ts: number;
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

export type RoomRealtimeEvent =
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
  | { readonly type: 'raw'; readonly originalType: string; readonly payload: unknown }
  | { readonly type: 'error'; readonly message: string };