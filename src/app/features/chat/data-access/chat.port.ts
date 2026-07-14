import type { ChatConnectionStatus, ChatUserSummary } from '../models/chat-message.model';

export interface ChatProfileDirectory {
  following(limit: number): Promise<ChatProfilePage>;
  followers(page: number, limit: number): Promise<ChatProfilePage>;
  visitors(page: number): Promise<ChatProfilePage>;
  byId(userId: number): Promise<ChatUserSummary | null>;
}

export interface ChatProfilePage {
  readonly list: readonly ChatUserSummary[];
  readonly more: boolean;
  readonly pageIndex: number | null;
}

export interface ChatTransport {
  readonly events: import('@angular/core').Signal<readonly ChatTransportEvent[]>;
  readonly status: import('@angular/core').Signal<ChatConnectionStatus>;
  connect(): void;
  sendText(peerId: number, body: ChatOutboundText): string | null;
  sendIntroduction(peerId: number, body: ChatOutboundIntroduction): string | null;
  sendTyping(peerId: number, isTyping: boolean): void;
  sendReadReceipt(peerId: number, msgId: string): void;
}

export interface ChatOutboundText {
  readonly msgId: string;
  readonly text: string;
  readonly fromNickname: string;
  readonly fromProfileTs: number;
}

export interface ChatOutboundIntroduction {
  readonly msgId: string;
  readonly fromNickname: string;
  readonly fromProfileTs: number;
  readonly target: import('@core/realtime/ht-protocol/packet-framer.util').IntroductionPayload;
}

export type ChatTransportEvent =
  | { readonly type: 'text_message'; readonly peerUserId: string; readonly fromNickname: string; readonly fromHeadUrl: string | null; readonly text: string; readonly ts: number; readonly msgId: string }
  | { readonly type: 'image_message'; readonly peerUserId: string; readonly fromNickname: string; readonly fromHeadUrl: string | null; readonly imageUrl: string; readonly ts: number; readonly msgId: string }
  | { readonly type: 'gift_message'; readonly peerUserId: string; readonly fromNickname: string; readonly fromHeadUrl: string | null; readonly giftId: number; readonly count: number; readonly ts: number; readonly msgId: string }
  | {
      readonly type: 'introduction_message';
      readonly peerUserId: string;
      readonly fromNickname: string;
      readonly fromHeadUrl: string | null;
      readonly ts: number;
      readonly msgId: string;
      readonly target: import('@core/realtime/ht-protocol/packet-framer.util').IntroductionPayload;
    }
  | { readonly type: 'voice_room_shared'; readonly peerUserId: string; readonly fromNickname: string; readonly fromHeadUrl: string | null; readonly cname: string; readonly listenerCount?: number; readonly ts: number; readonly msgId: string }
  | { readonly type: 'live_room_shared'; readonly peerUserId: string; readonly fromNickname: string; readonly fromHeadUrl: string | null; readonly cname: string; readonly ts: number; readonly msgId: string }
  | { readonly type: 'typing_indicator'; readonly peerUserId: string; readonly isTyping: boolean }
  | { readonly type: 'read_receipt'; readonly msgId: string }
  | { readonly type: 'message_ack'; readonly msgId: string; readonly prefix: number };