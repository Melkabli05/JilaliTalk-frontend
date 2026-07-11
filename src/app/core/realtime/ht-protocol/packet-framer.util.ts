import { deflate } from 'pako';
import { APP_VERSION, CHANNEL, CURRENT_VERSION } from './apk-signature.util';

/**
 * 20-byte packet header + outbound packet builders for the personal-messaging protocol.
 * Header layout (all multi-byte fields little-endian):
 *   byte 0: flag · byte 1: version · byte 2: keyType · byte 3: termType ·
 *   bytes 4-5: cmdId (u16) · bytes 6-7: seq (u16) ·
 *   bytes 8-11: fromId (u32) · bytes 12-15: toId (u32) · bytes 16-19: bodyLength (u32)
 * Ported from the reference client's `connectwebsock.js`/`prvgmsgpacket.js`.
 */

export const HEADER_LEN = 20;

export const CMD_LOGIN = 0x1025;
export const CMD_HEARTBEAT = 0x9001;
export const CMD_HEARTBEAT_ACK = 0x9002;
export const CMD_PRIVATE_MSG = 16385;
export const CMD_MSG_ACK = 16386;
export const CMD_READ_RECEIPT = 0x4015;
export const CMD_TYPING_INDICATOR = 16407;
export const CMD_OFFLINE_SYNC_TRIGGER_FIRST = 29967;
export const CMD_OFFLINE_SYNC_TRIGGER_PAGE = 16453;
export const CMD_OFFLINE_SYNC_RESPONSE = 16454;

export const FLAG_CLIENT_REQUEST = 0xf0;
export const FLAG_PUSH = 0xf2;
export const FLAG_ACK = 0xf3;
export const FLAG_TYPING = 0xf5;
export const FLAG_SERVER_RESPONSE = 0xf1;

let seqCounter = 16000 + Math.floor(Math.random() * 83000);

/** Wraps at 99000 back to 16000, matching the reference client's sequence-id range. */
function nextSeq(): number {
  seqCounter++;
  if (seqCounter > 99000) seqCounter = 16000;
  return seqCounter;
}

export interface PacketHeader {
  readonly flag: number;
  readonly version: number;
  readonly keyType: number;
  readonly termType: number;
  readonly cmdId: number;
  readonly seq: number;
  readonly fromId: number;
  readonly toId: number;
  readonly bodyLength: number;
}

export function parseHeader(raw: Uint8Array): PacketHeader {
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  return {
    flag: raw[0] ?? 0,
    version: raw[1] ?? 0,
    keyType: raw[2] ?? 0,
    termType: raw[3] ?? 0,
    cmdId: view.getUint16(4, true),
    seq: view.getUint16(6, true),
    fromId: view.getUint32(8, true),
    toId: view.getUint32(12, true),
    bodyLength: view.getUint32(16, true),
  };
}

export function buildPacket(params: {
  readonly flag: number;
  readonly version: number;
  readonly keyType: number;
  readonly termType: number;
  readonly cmdId: number;
  readonly fromId: number;
  readonly toId: number;
  readonly body: Uint8Array;
  readonly seq?: number;
}): Uint8Array {
  const header = new Uint8Array(HEADER_LEN);
  const view = new DataView(header.buffer);
  header[0] = params.flag & 0xff;
  header[1] = params.version & 0xff;
  header[2] = params.keyType & 0xff;
  header[3] = params.termType & 0xff;
  view.setUint16(4, params.cmdId & 0xffff, true);
  view.setUint16(6, params.seq ?? nextSeq(), true);
  view.setUint32(8, params.fromId >>> 0, true);
  view.setUint32(12, params.toId >>> 0, true);
  view.setUint32(16, params.body.byteLength, true);

  const packet = new Uint8Array(HEADER_LEN + params.body.byteLength);
  packet.set(header);
  packet.set(params.body, HEADER_LEN);
  return packet;
}

/** Login packet (cmdId 0x1025) — authenticates this connection as the official Android app
 *  using the spoofed APK signature. Field set and order matches the reference client's
 *  `sendRefreshToken` payload exactly. */
export function buildLoginPacket(params: {
  readonly userId: string;
  readonly jwt: string;
  readonly deviceId: string;
  readonly deviceModel: string;
  readonly apkSignature: string;
  readonly mobileOperator: string;
  readonly operatorCountry: string;
}): Uint8Array {
  const payload = {
    jwt: params.jwt,
    mobile_operator: params.mobileOperator,
    operator_country: params.operatorCountry,
    android_apk_signature: params.apkSignature,
    app_version: APP_VERSION,
    background_reconnect: 0,
    channel: CHANNEL,
    client_lang: 'English',
    current_version: CURRENT_VERSION,
    device_detail: params.deviceModel,
    device_id: params.deviceId,
    is_version_update: 0,
    net_type: 1,
    os_lang: 'en',
    os_version: '11',
    terminal_type: 1,
  };
  const body = new TextEncoder().encode(JSON.stringify(payload));
  return buildPacket({
    flag: FLAG_CLIENT_REQUEST,
    version: 4,
    keyType: 0,
    termType: 1,
    cmdId: CMD_LOGIN,
    fromId: Number(params.userId),
    toId: 0,
    body,
  });
}

export function buildHeartbeatPacket(userId: string): Uint8Array {
  const body = new Uint8Array(12);
  const view = new DataView(body.buffer);
  view.setUint32(0, Number(userId) >>> 0, true);
  view.setBigUint64(4, BigInt(Date.now()), true);
  return buildPacket({
    flag: FLAG_CLIENT_REQUEST,
    version: 4,
    keyType: 0,
    termType: 1,
    cmdId: CMD_HEARTBEAT,
    fromId: Number(userId),
    toId: 0,
    body,
  });
}

/** Acknowledges an incoming push-flagged frame, mirroring its seq/from/to ids back to the
 *  server (required or the server eventually stops delivering pushes on this connection). */
export function buildAckPacket(incoming: Uint8Array, forceCmdId?: number): Uint8Array {
  const view = new DataView(incoming.buffer, incoming.byteOffset, incoming.byteLength);
  const rawCmdId = view.getUint16(4, true);
  const seq = view.getUint16(6, true);
  const fromId = view.getUint32(8, true);
  const toId = view.getUint32(12, true);

  const buf = new Uint8Array(HEADER_LEN);
  const bv = new DataView(buf.buffer);
  buf[0] = FLAG_ACK;
  buf[1] = 0x04;
  buf[2] = 0x00;
  buf[3] = 0x01;
  bv.setUint16(4, forceCmdId ?? rawCmdId + 1, true);
  bv.setUint16(6, seq, true);
  bv.setUint32(8, fromId, true);
  bv.setUint32(12, toId, true);
  bv.setUint32(16, 0, true);
  return buf;
}

export function buildReadReceiptPacket(fromId: string, toId: string, msgId: string): Uint8Array {
  const msgIdBytes = new TextEncoder().encode(msgId);
  const body = new Uint8Array(2 + msgIdBytes.length + 2);
  body[0] = 0x25;
  body[1] = 0x00;
  body.set(msgIdBytes, 2);
  return buildPacket({
    flag: FLAG_CLIENT_REQUEST,
    version: 4,
    keyType: 0,
    termType: 1,
    cmdId: CMD_READ_RECEIPT,
    fromId: Number(fromId),
    toId: Number(toId),
    body,
  });
}

export function buildTypingIndicatorPacket(fromId: string, toId: string, isTyping: boolean): Uint8Array {
  const body = new Uint8Array(6);
  const view = new DataView(body.buffer);
  view.setUint32(0, Number(fromId) >>> 0, true);
  view.setUint16(4, isTyping ? 1 : 0, true);
  return buildPacket({
    flag: FLAG_CLIENT_REQUEST,
    version: 4,
    keyType: 0,
    termType: 1,
    cmdId: CMD_TYPING_INDICATOR,
    fromId: Number(fromId),
    toId: Number(toId),
    body,
  });
}

/**
 * Requests offline/history messages starting after `lastId`. The reference client calls this
 * with two different header shapes depending on when it fires: right after login it sends an
 * explicit `flag`/`version`/`termType` (see scriptv2.js `onSessionReady`), but when re-triggered
 * reactively (a push notify, or paging through more history) it's called with those omitted,
 * which — because the original JS function signature had no defaults for them — resulted in
 * 0x00 header bytes at runtime. Both call shapes are preserved via the optional params here.
 */
export function buildOfflineSyncTriggerPacket(params: {
  readonly fromId: string;
  readonly lastId: number;
  readonly cmdId: number;
  readonly flag?: number;
  readonly version?: number;
  readonly keyType?: number;
  readonly termType?: number;
}): Uint8Array {
  const body = deflate(new TextEncoder().encode(JSON.stringify({ last_id: params.lastId })));
  return buildPacket({
    flag: params.flag ?? 0,
    version: params.version ?? 0,
    keyType: params.keyType ?? 0,
    termType: params.termType ?? 0,
    cmdId: params.cmdId,
    fromId: Number(params.fromId),
    toId: 0,
    body,
  });
}

export interface DmSendGift {
  readonly id: number;
  readonly name: string;
  readonly multiName: Record<string, string>;
  readonly smallPic: string;
  readonly bigPic?: string;
  readonly animUrl: string;
  readonly diamondVal: number;
  readonly giftType: number;
}

export type DmSendPayload =
  | { readonly kind: 'text'; readonly text: string }
  | {
      readonly kind: 'image';
      readonly url: string;
      readonly localPath?: string;
      readonly size?: number;
      readonly width?: number;
      readonly height?: number;
      readonly mimeType?: string;
    }
  | { readonly kind: 'live_link'; readonly roomData: unknown }
  | { readonly kind: 'voice_room'; readonly roomData: unknown }
  | { readonly kind: 'introduction'; readonly roomData: unknown }
  | { readonly kind: 'send_gift'; readonly gift: DmSendGift };

function buildDmMessageBody(params: {
  readonly payload: DmSendPayload;
  readonly msgId: string;
  readonly fromId: string;
  readonly toId: string;
  readonly fromNickname: string;
  readonly fromProfileTs: number;
}): Record<string, unknown> {
  const { payload, msgId, fromId, toId, fromNickname, fromProfileTs } = params;
  const common = {
    msg_id: msgId,
    send_ts: Date.now(),
    chat_follow_notify: 0,
    correction_gift_notify: 0,
    cost_diamonds: 0,
    pay_chat_cost_virtual_val: 0,
    pay_chat_switch: 0,
    recv_diamonds: 0,
    source: 'Chat List',
    to_payer: false,
    valid_time: 0,
    from_nickname: fromNickname,
    from_profile_ts: fromProfileTs,
  };

  switch (payload.kind) {
    case 'text':
      return {
        msg: { ...common, msg_type: 'text', text: { reportIndex: 0, reportText: '', text: payload.text } },
        version: CURRENT_VERSION,
        client_lang: 'English',
      };
    case 'image':
      return {
        msg: {
          ...common,
          msg_type: 'image',
          image: {
            compressed_url: '',
            height: payload.height ?? 0,
            name: payload.localPath ?? '',
            size: payload.size ?? 0,
            type: payload.mimeType ?? 'image/png',
            url: payload.url,
            width: payload.width ?? 0,
          },
        },
        version: CURRENT_VERSION,
        client_lang: 'English',
      };
    case 'live_link':
      return {
        msg: { ...common, msg_type: 'live_link', live_link: payload.roomData },
        version: CURRENT_VERSION,
        client_lang: 'English',
      };
    case 'voice_room':
      return {
        msg: { ...common, msg_type: 'voice_room', voice_room: payload.roomData },
        version: CURRENT_VERSION,
        client_lang: 'English',
      };
    case 'introduction':
      return {
        msg: { ...common, msg_type: 'introduction', introduction: payload.roomData, bubble: { id: 0 } },
        version: CURRENT_VERSION,
        client_lang: 'English',
      };
    case 'send_gift':
      return {
        send_gift: {
          anim_url: payload.gift.animUrl,
          big_pic: payload.gift.bigPic ?? '',
          gift_type: payload.gift.giftType,
          id: payload.gift.id,
          multi_name: payload.gift.multiName,
          name: payload.gift.name,
          small_pic: payload.gift.smallPic,
          users: [{ user_id: Number(toId), user_name: '' }],
          user_size: 1,
          is_select_all: 0,
          view_size: 1,
          diamond_val: payload.gift.diamondVal,
          finish_wish: false,
          is_birthday_gift: false,
          have_birthday_user: true,
        },
        from_id: fromId,
        to_id: Number(toId),
        from_nickname: fromNickname,
        msg_id: msgId,
        msg_type: 'send_gift',
        source: 'Chat List',
        bubble: {},
      };
  }
}

/** Builds a private-message packet (cmdId 16385, zlib-compressed JSON body) for any of the
 *  six DM kinds. Generates a UUID msgId unless one is supplied (e.g. to reuse an optimistic
 *  local id), and returns it alongside the packet so the caller can track delivery via the
 *  matching MSG-ACK (cmdId 16386). */
export function buildDmMessagePacket(params: {
  readonly payload: DmSendPayload;
  readonly fromId: string;
  readonly toId: string;
  readonly fromNickname: string;
  readonly fromProfileTs: number;
  readonly msgId?: string;
}): { readonly packet: Uint8Array; readonly msgId: string } {
  const msgId = params.msgId ?? crypto.randomUUID();
  const bodyJson = buildDmMessageBody({ ...params, msgId });
  const compressed = deflate(new TextEncoder().encode(JSON.stringify(bodyJson)));
  const packet = buildPacket({
    flag: FLAG_CLIENT_REQUEST,
    version: 4,
    keyType: 0,
    termType: 1,
    cmdId: CMD_PRIVATE_MSG,
    fromId: Number(params.fromId),
    toId: Number(params.toId),
    body: compressed,
  });
  return { packet, msgId };
}
