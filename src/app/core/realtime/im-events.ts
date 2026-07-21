export type ImEvent =
  | { readonly type: 'connection-state'; readonly state: 'connecting' | 'connected' | 'disconnected' }
  | { readonly type: 'profile_visit'; readonly visitorUserId: string; readonly nickname?: string; readonly headUrl?: string }
  | { readonly type: 'stage_invite'; readonly userId: string; readonly cname: string }
  | { readonly type: 'mod_invite'; readonly userId: string; readonly cname: string }
  | { readonly type: 'mod_accepted'; readonly userId: string }
  | { readonly type: 'mod_removed'; readonly userId: string }
  | { readonly type: 'mod_unmuted'; readonly userId: string }
  | { readonly type: 'follow'; readonly userId: string; readonly nickname: string; readonly headUrl?: string; readonly status: number }
  | { readonly type: 'text_message'; readonly fromUserId: string; readonly fromNickname: string; readonly fromHeadUrl?: string; readonly text: string; readonly ts: number; readonly msgId?: string }
  | { readonly type: 'image_message'; readonly fromUserId: string; readonly fromNickname: string; readonly fromHeadUrl?: string; readonly imageUrl: string; readonly ts: number; readonly msgId?: string }
  | { readonly type: 'gift_message'; readonly fromUserId: string; readonly fromNickname: string; readonly fromHeadUrl?: string; readonly giftId: number; readonly count: number; readonly msgId?: string }
  | {
      readonly type: 'introduction_message';
      readonly fromUserId: string;
      readonly fromNickname: string;
      readonly fromHeadUrl?: string;
      readonly targetUserId: string;
      readonly targetNickname: string;
      readonly targetHeadUrl?: string | null;
      readonly targetSex?: string | null;
      readonly targetAge?: number | null;
      readonly targetNationality?: string | null;
      readonly targetBio?: string | null;
      readonly msgId?: string;
    }
  | {
      readonly type: 'voice_room_shared';
      readonly fromUserId: string;
      readonly fromNickname: string;
      readonly cname: string;
      readonly headUrl: string | null;
      readonly count?: number;
      readonly msgId?: string;
      readonly roomName?: string | null;
      readonly topicName?: string | null;
    }
  | {
      readonly type: 'live_room_shared';
      readonly fromUserId: string;
      readonly fromNickname: string;
      readonly cname: string;
      readonly headUrl: string | null;
      readonly msgId?: string;
      readonly activityName?: string | null;
      readonly topicName?: string | null;
    }
  | { readonly type: 'group_message'; readonly senderId: string; readonly senderName: string; readonly roomName: string; readonly text: string }
  | { readonly type: 'typing_indicator'; readonly fromUserId: string; readonly isTyping: boolean }
  | { readonly type: 'read_receipt'; readonly msgId: string }
  | { readonly type: 'message_ack'; readonly msgId: string; readonly sequence: number; readonly prefix: number }
  | { readonly type: 'account_status'; readonly status: 'banned' | 'session_mismatch' }
  | { readonly type: 'error'; readonly message: string };
