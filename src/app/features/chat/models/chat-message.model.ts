import type { IntroductionPayload } from '@core/realtime/ht-protocol/packet-framer.util';

export type ChatDelivery = 'sent' | 'delivered' | 'read';

export type ChatMessage =
  | ChatTextMessage
  | ChatImageMessage
  | ChatGiftMessage
  | ChatIntroductionMessage
  | ChatVoiceRoomSharedMessage
  | ChatLiveRoomSharedMessage;

interface ChatMessageBase {
  readonly id: string;
  readonly ts: number;
  readonly fromUserId: string;
  readonly fromNickname: string;
  readonly fromHeadUrl: string | null;
  readonly delivery?: ChatDelivery;
}

export interface ChatTextMessage extends ChatMessageBase {
  readonly type: 'text';
  readonly text: string;
}

export interface ChatImageMessage extends ChatMessageBase {
  readonly type: 'image';
  readonly imageUrl: string;
}

export interface ChatGiftMessage extends ChatMessageBase {
  readonly type: 'gift';
  readonly giftId: number;
  readonly count: number;
}

export interface ChatIntroductionMessage extends ChatMessageBase {
  readonly type: 'introduction';
  readonly target: IntroductionPayload;
}

export interface ChatVoiceRoomSharedMessage extends ChatMessageBase {
  readonly type: 'voice_room_shared';
  readonly cname: string;
  readonly listenerCount?: number;
}

export interface ChatLiveRoomSharedMessage extends ChatMessageBase {
  readonly type: 'live_room_shared';
  readonly cname: string;
}

export interface ChatConversation {
  readonly peerUserId: string;
  readonly nickname: string;
  readonly headUrl: string | null;
  readonly messages: readonly ChatMessage[];
  readonly unread: number;
  readonly lastTs: number;
  readonly isTyping: boolean;
}

export interface ChatUserSummary {
  readonly userId: string;
  readonly nickname: string;
  readonly headUrl: string | null;
  readonly nationality?: string | null;
  readonly isMutual?: boolean;
}

export type ChatConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export type ChatUserPickerTab = 'following' | 'followers' | 'visitors' | 'byId';

export type ChatMessageType = ChatMessage['type'];