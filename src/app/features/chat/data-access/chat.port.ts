import type { Signal } from '@angular/core';
import type { IntroductionPayload } from '@core/realtime/ht-protocol/packet-framer.util';
import type { ChatConnectionStatus, ChatUserSummary } from '../models/chat-message.model';

export interface ChatProfilePage {
  readonly list: readonly ChatUserSummary[];
  readonly more: boolean;
  readonly pageIndex: number | null;
}

export interface ChatProfileDirectory {
  following(limit: number): Promise<ChatProfilePage>;
  followers(page: number, limit: number): Promise<ChatProfilePage>;
  visitors(page: number): Promise<ChatProfilePage>;
  byId(userId: number): Promise<ChatUserSummary | null>;
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
  readonly target: IntroductionPayload;
}

export type ChatTransportEvent =
  | { readonly type: 'text_message'; readonly peerUserId: string; readonly fromNickname: string; readonly fromHeadUrl: string | null; readonly text: string; readonly ts: number }
  | { readonly type: 'image_message'; readonly peerUserId: string; readonly fromNickname: string; readonly fromHeadUrl: string | null; readonly imageUrl: string; readonly ts: number }
  | { readonly type: 'gift_message'; readonly peerUserId: string; readonly fromNickname: string; readonly fromHeadUrl: string | null; readonly giftId: number; readonly count: number; readonly ts: number }
  | {
      readonly type: 'introduction_message';
      readonly peerUserId: string;
      readonly fromNickname: string;
      readonly fromHeadUrl: string | null;
      readonly ts: number;
      readonly target: IntroductionPayload;
    }
  | { readonly type: 'voice_room_shared'; readonly peerUserId: string; readonly fromNickname: string; readonly fromHeadUrl: string | null; readonly cname: string; readonly listenerCount?: number; readonly ts: number }
  | { readonly type: 'live_room_shared'; readonly peerUserId: string; readonly fromNickname: string; readonly fromHeadUrl: string | null; readonly cname: string; readonly ts: number }
  | { readonly type: 'typing_indicator'; readonly peerUserId: string; readonly isTyping: boolean }
  | { readonly type: 'read_receipt'; readonly msgId: string }
  | { readonly type: 'message_ack'; readonly msgId: string; readonly prefix: number };

export interface ChatTransport {
  readonly events: Signal<readonly ChatTransportEvent[]>;
  readonly status: Signal<ChatConnectionStatus>;
  connect(): void;
  sendText(peerId: number, body: ChatOutboundText): string | null;
  sendIntroduction(peerId: number, body: ChatOutboundIntroduction): string | null;
  sendTyping(peerId: number, isTyping: boolean): void;
  sendReadReceipt(peerId: number, msgId: string): void;
}