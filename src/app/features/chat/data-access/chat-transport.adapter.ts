import { Service, Signal, computed, inject } from '@angular/core';
import { HtImConnectionService } from '@core/realtime/ht-im-connection.service';
import type { ImEvent } from '@core/realtime/im-events';
import type { ChatConnectionStatus } from '../models/chat-message.model';
import type {
  ChatOutboundIntroduction,
  ChatOutboundText,
  ChatTransport,
  ChatTransportEvent,
} from './chat.port';

@Service()
export class ChatTransportAdapter implements ChatTransport {
  private readonly im = inject(HtImConnectionService);

  readonly events: Signal<readonly ChatTransportEvent[]> = computed(() =>
    this.im.events().flatMap(toChatTransportEvent).filter((e): e is ChatTransportEvent => e !== null),
  );

  readonly status: Signal<ChatConnectionStatus> = computed(() => this.im.status());

  connect(): void {
    this.im.connect();
  }

  sendText(peerId: number, body: ChatOutboundText): string | null {
    return this.im.sendDm(
      peerId,
      { kind: 'text', text: body.text },
      body.fromNickname,
      body.fromProfileTs,
      body.msgId,
    );
  }

  sendIntroduction(peerId: number, body: ChatOutboundIntroduction): string | null {
    return this.im.sendDm(
      peerId,
      { kind: 'introduction', introduction: body.target },
      body.fromNickname,
      body.fromProfileTs,
      body.msgId,
    );
  }

  sendTyping(peerId: number, isTyping: boolean): void {
    this.im.sendTyping(peerId, isTyping);
  }

  sendReadReceipt(peerId: number, msgId: string): void {
    this.im.sendReadReceipt(peerId, msgId);
  }
}

function toChatTransportEvent(ev: ImEvent): ChatTransportEvent | null {
  switch (ev.type) {
    case 'text_message':
      return { type: 'text_message', peerUserId: ev.fromUserId, fromNickname: ev.fromNickname, fromHeadUrl: ev.fromHeadUrl ?? null, text: ev.text, ts: ev.ts };
    case 'image_message':
      return { type: 'image_message', peerUserId: ev.fromUserId, fromNickname: ev.fromNickname, fromHeadUrl: ev.fromHeadUrl ?? null, imageUrl: ev.imageUrl, ts: ev.ts };
    case 'gift_message':
      return { type: 'gift_message', peerUserId: ev.fromUserId, fromNickname: ev.fromNickname, fromHeadUrl: ev.fromHeadUrl ?? null, giftId: ev.giftId, count: ev.count, ts: Date.now() };
    case 'introduction_message':
      return {
        type: 'introduction_message',
        peerUserId: ev.fromUserId,
        fromNickname: ev.fromNickname,
        fromHeadUrl: ev.fromHeadUrl ?? null,
        ts: Date.now(),
        target: {
          userId: Number(ev.targetUserId),
          nickname: ev.targetNickname,
          headUrl: ev.targetHeadUrl ?? null,
          sex: ev.targetSex ?? null,
          age: ev.targetAge ?? null,
          nationality: ev.targetNationality ?? null,
          bio: ev.targetBio ?? null,
        },
      };
    case 'voice_room_shared':
      return { type: 'voice_room_shared', peerUserId: ev.fromUserId, fromNickname: ev.fromNickname, fromHeadUrl: ev.headUrl, cname: ev.cname, ts: Date.now(), ...(ev.count != null ? { listenerCount: ev.count } : {}) };
    case 'live_room_shared':
      return { type: 'live_room_shared', peerUserId: ev.fromUserId, fromNickname: ev.fromNickname, fromHeadUrl: ev.headUrl, cname: ev.cname, ts: Date.now() };
    case 'typing_indicator':
      return { type: 'typing_indicator', peerUserId: ev.fromUserId, isTyping: ev.isTyping };
    case 'read_receipt':
      return { type: 'read_receipt', msgId: ev.msgId };
    case 'message_ack':
      return { type: 'message_ack', msgId: ev.msgId, prefix: ev.prefix };
    default:
      return null;
  }
}