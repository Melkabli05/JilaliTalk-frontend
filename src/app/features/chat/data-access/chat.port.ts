import type { Signal } from '@angular/core';
import type {
  DmSendGift,
  IntroductionPayload,
} from '@core/realtime/dm-send-payload.model';
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

export interface ChatOutboundImage {
  readonly msgId: string;
  readonly url: string;
  readonly width?: number;
  readonly height?: number;
  readonly size?: number;
  readonly mimeType?: string;
  readonly fromNickname: string;
  readonly fromProfileTs: number;
}

export interface ChatOutboundGift {
  readonly msgId: string;
  readonly gift: DmSendGift;
  readonly fromNickname: string;
  readonly fromProfileTs: number;
}

export interface ChatOutboundRoomShare {
  readonly msgId: string;
  readonly cname: string;
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
  | { readonly type: 'text_message'; readonly peerUserId: string; readonly fromNickname: string; readonly fromHeadUrl: string | null; readonly text: string; readonly ts: number; readonly msgId?: string }
  | { readonly type: 'image_message'; readonly peerUserId: string; readonly fromNickname: string; readonly fromHeadUrl: string | null; readonly imageUrl: string; readonly ts: number; readonly msgId?: string }
  | { readonly type: 'gift_message'; readonly peerUserId: string; readonly fromNickname: string; readonly fromHeadUrl: string | null; readonly giftId: number; readonly count: number; readonly msgId?: string }
  | {
      readonly type: 'introduction_message';
      readonly peerUserId: string;
      readonly fromNickname: string;
      readonly fromHeadUrl: string | null;
      readonly ts: number;
      readonly target: IntroductionPayload;
      readonly msgId?: string;
    }
  | {
      readonly type: 'voice_room_shared';
      readonly peerUserId: string;
      readonly fromNickname: string;
      readonly fromHeadUrl: string | null;
      readonly cname: string;
      readonly headUrl: string | null;
      readonly listenerCount?: number;
      readonly msgId?: string;
      readonly roomName?: string | null;
      readonly topicName?: string | null;
      readonly backgroundUrl?: string | null;
    }
  | {
      readonly type: 'live_room_shared';
      readonly peerUserId: string;
      readonly fromNickname: string;
      readonly fromHeadUrl: string | null;
      readonly cname: string;
      readonly headUrl: string | null;
      readonly msgId?: string;
      readonly activityName?: string | null;
      readonly topicName?: string | null;
      readonly backgroundUrl?: string | null;
    }
  | { readonly type: 'typing_indicator'; readonly peerUserId: string; readonly isTyping: boolean }
  | { readonly type: 'read_receipt'; readonly msgId: string }
  | { readonly type: 'message_ack'; readonly msgId: string; readonly prefix: number };

export interface ChatTransport {
  readonly events: Signal<readonly ChatTransportEvent[]>;
  readonly status: Signal<ChatConnectionStatus>;
  /** Append-only log of msgIds that failed to POST upstream. The chat store watches this
   *  signal in its constructor and flips matching optimistic outbound messages from
   *  {@code delivery: 'sent'} → {@code delivery: 'failed'}, which then surfaces a
   *  "Tap to retry" affordance in the chat-page bubble template. */
  readonly sendFailures: Signal<readonly string[]>;
  connect(): void;
  sendText(peerId: number, body: ChatOutboundText): string | null;
  sendImage(peerId: number, body: ChatOutboundImage): string | null;
  sendGift(peerId: number, body: ChatOutboundGift): string | null;
  sendVoiceRoom(peerId: number, body: ChatOutboundRoomShare): string | null;
  sendLiveLink(peerId: number, body: ChatOutboundRoomShare): string | null;
  sendIntroduction(peerId: number, body: ChatOutboundIntroduction): string | null;
  sendTyping(peerId: number, isTyping: boolean): void;
  sendReadReceipt(peerId: number, msgId: string): void;
  /** Drain the failure log — called by the chat store once it has consumed each msgId. */
  clearSendFailures(): void;
}