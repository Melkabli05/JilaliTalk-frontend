import type {
  DmSendGift,
  DmSendPayload,
  IntroductionPayload,
} from '@core/realtime/ht-protocol/packet-framer.util';

export type DmKind = 'text' | 'image' | 'voice_room' | 'live_link' | 'introduction' | 'send_gift';

export interface SendDmBody {
  readonly kind: DmKind;
  readonly msgId?: string | undefined;
  readonly fromId?: number | undefined;
  readonly fromNickname?: string | undefined;
  readonly fromProfileTs?: number | undefined;
  readonly text?: string | undefined;
  readonly url?: string | undefined;
  readonly localPath?: string | undefined;
  readonly size?: number | undefined;
  readonly width?: number | undefined;
  readonly height?: number | undefined;
  readonly mimeType?: string | undefined;
  readonly roomData?: unknown;
  readonly introduction?: IntroductionPayload | undefined;
  readonly gift?: unknown;
}

export function buildDmSendPayload(kind: DmKind, fields: Partial<SendDmBody>): DmSendPayload | null {
  switch (kind) {
    case 'text':
      return { kind: 'text', text: fields.text ?? '' };
    case 'image':
      return {
        kind: 'image',
        url: fields.url ?? '',
        ...(fields.localPath !== undefined ? { localPath: fields.localPath } : {}),
        ...(fields.size !== undefined ? { size: fields.size } : {}),
        ...(fields.width !== undefined ? { width: fields.width } : {}),
        ...(fields.height !== undefined ? { height: fields.height } : {}),
        ...(fields.mimeType !== undefined ? { mimeType: fields.mimeType } : {}),
      };
    case 'introduction':
      return fields.introduction
        ? { kind: 'introduction', introduction: fields.introduction }
        : null;
    case 'voice_room':
      return { kind: 'voice_room', roomData: fields.roomData };
    case 'live_link':
      return { kind: 'live_link', roomData: fields.roomData };
    case 'send_gift':
      return fields.gift ? { kind: 'send_gift', gift: fields.gift as DmSendGift } : null;
    default:
      return null;
  }
}
