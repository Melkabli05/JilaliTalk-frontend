/**
 * DmMessageType covers the six shapes the legacy {@code sendTextMessage} dispatch
 * in prvgmsgpacket.js produced (text/image/introduction/gift/voice_room/live_link).
 * The Angular DmMessageList group also displays the room-share shapes as a single
 * "DM-meta" card rather than a bubble so they don't look like chat text.
 */
export type DmMessageType = 'text' | 'image' | 'gift' | 'introduction' | 'voice_room_shared' | 'live_room_shared';

export interface DmMessage {
  readonly id: string;
  readonly type: DmMessageType;
  readonly text?: string;
  readonly imageUrl?: string;
  readonly giftId?: number;
  readonly count?: number;
  readonly fromNickname?: string;
  /** For room_share messages: the {@code cname} identifying the room. */
  readonly cname?: string;
  /** For {@code voice_room_shared}: how many listeners the room has right now. */
  readonly voiceCount?: number;
  readonly ts: number;
}

export interface DmConversation {
  readonly userId: string;
  readonly nickname: string;
  readonly messages: readonly DmMessage[];
  readonly unread: number;
  readonly lastTs: number;
  readonly isTyping: boolean;
}
