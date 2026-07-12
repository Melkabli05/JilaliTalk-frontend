import { inflate, inflateRaw, ungzip } from 'pako';
import { qqteaDecrypt } from './qqtea.util';
import { CMD_TYPING_INDICATOR, HEADER_LEN, parseHeader } from './packet-framer.util';

/**
 * Inbound frame parsing for the personal-messaging protocol: decrypt (QQ-TEA), decompress
 * (zlib/gzip), and JSON-decode pushed/offline-replayed frames. Ported from the reference
 * client's inline `onmessage` handler and `prvgmsgpacket.js`'s `decodeOfflinePacket`.
 */

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Some frames are zlib-deflated without a valid zlib header; fall back to raw inflate,
 *  mirroring the reference client's `inflate()` helper. */
function inflateFrame(payload: Uint8Array): Uint8Array {
  try {
    return inflate(payload);
  } catch {
    return inflateRaw(payload);
  }
}

function tryDecrypt(payload: Uint8Array, keyType: number, sessionKey: Uint8Array | null): Uint8Array {
  if (keyType !== 1 || !sessionKey || payload.length === 0) return payload;
  try {
    const dec = qqteaDecrypt(payload, sessionKey);
    return dec ?? payload;
  } catch {
    return payload;
  }
}

function tryInflateIfZlib(payload: Uint8Array): Uint8Array {
  if (payload.length === 0 || payload[0] !== 0x78) return payload;
  try {
    return inflateFrame(payload);
  } catch {
    return payload;
  }
}

export interface Cmd16386Result {
  readonly msgId: string;
  readonly prefix: number;
  readonly sequence: string;
  readonly isFailureAck: boolean;
}

/** Parses the MSG-ACK (cmdId 16386) body: a length-prefixed msgId UUID string followed by a
 *  64-bit sequence number. Falls back to scanning for a UUID pattern (some server variants
 *  omit the length prefix), and finally treats an unparseable buffer as an empty
 *  delivery-failure ack — all three branches ported from the reference client's
 *  `decodeCmd16386`. */
function decodeCmd16386(payload: Uint8Array): Cmd16386Result {
  if (payload.byteLength >= 2) {
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
    const lenBE = view.getUint16(0, false);
    const lenLE = view.getUint16(0, true);
    let strLen = lenBE;
    if (2 + lenBE > payload.byteLength && 2 + lenLE <= payload.byteLength) {
      strLen = lenLE;
    }

    if (2 + strLen <= payload.byteLength) {
      const prefix = payload[2] ?? 0;
      const strVal = new TextDecoder().decode(payload.subarray(3, 2 + strLen)).replace(/\0/g, '').trim();
      let nextOffset = 2 + strLen;
      if (nextOffset < payload.byteLength && payload[nextOffset] === 0) nextOffset += 1;

      let sequence = '0';
      if (nextOffset + 8 <= payload.byteLength) {
        sequence = view.getBigUint64(nextOffset, true).toString();
      } else if (nextOffset + 4 <= payload.byteLength) {
        sequence = view.getUint32(nextOffset, true).toString();
      }

      if (UUID_RE.test(strVal)) {
        return { msgId: strVal, prefix, sequence, isFailureAck: false };
      }
    }
  }

  const text = new TextDecoder().decode(payload);
  const uuidMatch = UUID_RE.exec(text);
  if (uuidMatch) {
    let sequence = '0';
    if (payload.byteLength >= 8) {
      const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
      sequence = view.getBigUint64(payload.byteLength - 8, true).toString();
    }
    return { msgId: uuidMatch[0], prefix: 0, sequence, isFailureAck: false };
  }

  return { msgId: '', prefix: 0, sequence: '0', isFailureAck: true };
}

/** MSG-ACK bodies are QQ-TEA-encrypted only when the header's keyType byte is 1 (unlike 0xF2
 *  push frames, which are always encrypted when a session key exists). */
export function decodeMsgAckPayload(
  payload: Uint8Array,
  keyType: number,
  sessionKey: Uint8Array | null,
): Cmd16386Result {
  const decrypted = tryDecrypt(payload, keyType, sessionKey);
  const decompressed = tryInflateIfZlib(decrypted);
  return decodeCmd16386(decompressed);
}

export type PushFrameResult =
  | { readonly kind: 'json'; readonly json: Record<string, unknown> }
  | { readonly kind: 'read_receipt'; readonly msgId: string }
  | { readonly kind: 'new_message_notify'; readonly msgId: string | null; readonly lastId: number | null }
  | { readonly kind: 'empty' }
  | { readonly kind: 'unrecognized'; readonly firstByte: number };

function extractNewMessageNotify(decrypted: Uint8Array): { msgId: string | null; lastId: number | null } {
  const text = new TextDecoder().decode(decrypted);
  const uuidMatch = UUID_RE.exec(text);
  let msgId: string | null = null;

  if (uuidMatch) {
    msgId = uuidMatch[0];
  } else {
    let idx = 1;
    while (idx < decrypted.length && ((decrypted[idx] ?? 0) & 0x80) !== 0) idx++;
    idx++;
    if (idx < decrypted.length && decrypted[idx] === 0x12) {
      const strLen = decrypted[idx + 1] ?? 0;
      if (idx + 2 + strLen <= decrypted.length) {
        msgId = new TextDecoder().decode(decrypted.subarray(idx + 2, idx + 2 + strLen));
      }
    }
  }

  if (!msgId) return { msgId: null, lastId: null };
  const parts = msgId.split('_');
  const lastId = parts.length >= 2 ? Number(BigInt((parts[1] ?? '0') + (parts[0] ?? '0'))) : 0;
  return { msgId, lastId };
}

/** Decodes a push-flagged (0xF2) frame body. Always QQ-TEA-decrypted when a session key is
 *  available — unlike MSG-ACK/typing frames there's no per-frame keyType gate here, matching
 *  the reference client's unconditional decrypt for 0xF2. Dispatches on the decrypted first
 *  byte: zlib JSON (0x78), raw JSON (0x7B), a read-receipt marker (0x25), or a binary
 *  "new message" notify (0x08) whose payload only carries a msgId used to trigger an
 *  offline-sync pull. */
export function decodePushFrame(encPayload: Uint8Array, sessionKey: Uint8Array | null): PushFrameResult {
  if (!sessionKey || encPayload.length === 0) return { kind: 'empty' };

  let decrypted: Uint8Array | null;
  try {
    decrypted = qqteaDecrypt(encPayload, sessionKey);
  } catch {
    decrypted = null;
  }
  if (!decrypted || decrypted.byteLength === 0) return { kind: 'empty' };

  const firstByte = decrypted[0] ?? 0;
  let finalBytes: Uint8Array;

  if (firstByte === 0x78) {
    try {
      finalBytes = inflateFrame(decrypted);
    } catch {
      return { kind: 'unrecognized', firstByte };
    }
  } else if (firstByte === 0x7b) {
    finalBytes = decrypted;
  } else if (firstByte === 0x25) {
    const msgId = new TextDecoder().decode(decrypted.subarray(2, 38)).replace(/\0/g, '').trim();
    return { kind: 'read_receipt', msgId };
  } else if (firstByte === 0x08) {
    const { msgId, lastId } = extractNewMessageNotify(decrypted);
    return { kind: 'new_message_notify', msgId, lastId };
  } else {
    return { kind: 'unrecognized', firstByte };
  }

  const jsonStr = new TextDecoder().decode(finalBytes).replace(/\0/g, '');
  try {
    return { kind: 'json', json: JSON.parse(jsonStr) as Record<string, unknown> };
  } catch {
    return { kind: 'unrecognized', firstByte };
  }
}

export function decodeTypingPayload(payload: Uint8Array, keyType: number, sessionKey: Uint8Array | null): boolean {
  const decrypted = tryDecrypt(payload, keyType, sessionKey);
  const body = tryInflateIfZlib(decrypted);

  if (body.byteLength >= 6) {
    const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
    return view.getUint16(4, true) === 1;
  }
  return true;
}

/** Decodes an 0xF1-flagged frame body after the mandatory zlib check, returning parsed JSON.
 *  Returns null for non-JSON/empty bodies (e.g. keep-alive frames with no payload). */
export function decodeLoginFrame(payload: Uint8Array): Record<string, unknown> | null {
  const body = tryInflateIfZlib(payload);
  const text = new TextDecoder().decode(body).trim();
  if (!text.startsWith('{')) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export type OfflinePacketResult =
  | { readonly kind: 'json'; readonly json: Record<string, unknown> }
  | { readonly kind: 'read_receipt'; readonly msgId: string; readonly fromId: number }
  | { readonly kind: 'typing_indicator'; readonly fromId: number }
  | { readonly kind: 'none' };

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Decodes one entry from an offline-sync `packet_list` (base64 of a full 20-byte-header
 *  packet): parses the header, decrypts/decompresses the body per its keyType/magic byte
 *  (including the keyType-0-but-actually-encrypted fallback the reference client guards
 *  against), and dispatches the same way a live frame would. */
export function decodeOfflinePacket(base64Packet: string, sessionKey: Uint8Array | null): OfflinePacketResult {
  const bytes = base64ToBytes(base64Packet);
  if (bytes.byteLength < HEADER_LEN) return { kind: 'none' };
  const header = parseHeader(bytes);
  let payload = bytes.subarray(HEADER_LEN, HEADER_LEN + header.bodyLength);
  if (payload.length === 0) return { kind: 'none' };

  if (header.keyType === 1 && sessionKey) {
    try {
      const dec = qqteaDecrypt(payload, sessionKey);
      if (dec && dec.length > 0) payload = dec;
    } catch {
      // keep original payload
    }
  } else if (header.keyType === 0 && sessionKey) {
    const fb = payload[0] ?? 0;
    const isRecognized = fb === 0x78 || fb === 0x1f || fb === 0x7b || fb === 0x25;
    if (!isRecognized) {
      try {
        const dec = qqteaDecrypt(payload, sessionKey);
        const decFb = dec?.[0] ?? -1;
        if (dec && dec.length > 0 && (decFb === 0x78 || decFb === 0x1f || decFb === 0x7b || decFb === 0x25)) {
          payload = dec;
        }
      } catch {
        // keep original payload
      }
    }
  }

  const firstByte = payload[0] ?? 0;
  let jsonStr: string;

  if (firstByte === 0x1f && payload[1] === 0x8b) {
    jsonStr = new TextDecoder().decode(ungzip(payload));
  } else if (firstByte === 0x78) {
    jsonStr = new TextDecoder().decode(inflateFrame(payload));
  } else if (firstByte === 0x7b) {
    jsonStr = new TextDecoder().decode(payload);
  } else if (firstByte === 0x25) {
    const msgId = new TextDecoder().decode(payload.subarray(2, 38)).replace(/\0/g, '').trim();
    return { kind: 'read_receipt', msgId, fromId: header.fromId };
  } else if (header.cmdId === CMD_TYPING_INDICATOR) {
    return { kind: 'typing_indicator', fromId: header.fromId };
  } else {
    jsonStr = new TextDecoder().decode(payload);
  }

  const cleaned = jsonStr.replace(/\0/g, '').trim();
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) return { kind: 'none' };
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    return { kind: 'json', json: { ...parsed, _cmdId: header.cmdId, _fromId: header.fromId, _toId: header.toId } };
  } catch {
    return { kind: 'none' };
  }
}
