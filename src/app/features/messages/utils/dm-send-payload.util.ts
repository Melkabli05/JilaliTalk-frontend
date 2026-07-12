import type { DmSendGift, DmSendPayload } from '@core/realtime/ht-protocol/packet-framer.util';

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
  readonly gift?: unknown;
}

/**
 * Builds the wire-format `DmSendPayload` for one of the six outbound DM kinds. Pure
 * translation from the store-facing `SendDmBody` DTO to the protocol layer's shape — kept
 * out of `MessagesStore` so the store's job stays "own conversation state," not also "know
 * the exact field layout each DM kind sends over the wire."
 */
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
      return { kind: 'introduction', roomData: fields.roomData };
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
