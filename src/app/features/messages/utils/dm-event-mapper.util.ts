import type { ImEvent } from '@core/realtime/im-events';
import { uid } from './dm-formatting.util';
import type { DmMessage } from '../models/dm.model';

export interface MappedDmMessage {
  readonly userId: string;
  readonly nickname: string;
  readonly headUrl: string | null;
  readonly message: DmMessage;
}

/**
 * Maps the six `ImEvent` kinds that represent an inbound DM into the conversation-store's
 * `DmMessage` shape, or `null` for every other event type (typing/ack/receipt/etc., which
 * `MessagesStore.dispatch` still handles directly since they mutate existing messages rather
 * than appending a new one). Split out so the six near-identical cases this replaced don't
 * live as a block of copy-pasted `pushPublic(...)` calls inside the store.
 */
export function mapImEventToDmMessage(ev: ImEvent): MappedDmMessage | null {
  switch (ev.type) {
    case 'text_message':
      return {
        userId: ev.fromUserId,
        nickname: ev.fromNickname || ev.fromUserId,
        headUrl: ev.fromHeadUrl ?? null,
        message: { id: uid(), type: 'text', text: ev.text, fromNickname: ev.fromNickname, ts: ev.ts },
      };
    case 'image_message':
      return {
        userId: ev.fromUserId,
        nickname: ev.fromNickname || ev.fromUserId,
        headUrl: ev.fromHeadUrl ?? null,
        message: { id: uid(), type: 'image', imageUrl: ev.imageUrl, fromNickname: ev.fromNickname, ts: ev.ts },
      };
    case 'gift_message':
      return {
        userId: ev.fromUserId,
        nickname: ev.fromNickname || ev.fromUserId,
        headUrl: ev.fromHeadUrl ?? null,
        message: {
          id: uid(),
          type: 'gift',
          giftId: ev.giftId,
          count: ev.count,
          fromNickname: ev.fromNickname,
          ts: Date.now(),
        },
      };
    case 'introduction_message':
      return {
        userId: ev.fromUserId,
        nickname: ev.fromNickname || ev.fromUserId,
        headUrl: ev.fromHeadUrl ?? null,
        message: { id: uid(), type: 'introduction', fromNickname: ev.fromNickname, ts: Date.now() },
      };
    case 'voice_room_shared':
      return {
        userId: ev.fromUserId,
        nickname: ev.fromNickname || ev.fromUserId,
        headUrl: ev.headUrl,
        message: {
          id: uid(),
          type: 'voice_room_shared',
          cname: ev.cname,
          voiceCount: ev.count,
          fromNickname: ev.fromNickname,
          ts: Date.now(),
        },
      };
    case 'live_room_shared':
      return {
        userId: ev.fromUserId,
        nickname: ev.fromNickname || ev.fromUserId,
        headUrl: ev.headUrl,
        message: { id: uid(), type: 'live_room_shared', cname: ev.cname, fromNickname: ev.fromNickname, ts: Date.now() },
      };
    default:
      return null;
  }
}
