/**
 * QQ-TEA block cipher (Tencent's variant of TEA/XTEA used by the messaging protocol's
 * session-key encryption). Byte-for-byte port of the reference client's `QQTEA` object —
 * the constants (delta, sum starting values) and CBC-like chaining are fixed by the wire
 * protocol, not a design choice made here.
 */

function readKey(key: Uint8Array): readonly [number, number, number, number] {
  const view = new DataView(key.buffer, key.byteOffset, key.byteLength);
  return [view.getUint32(0, true), view.getUint32(4, true), view.getUint32(8, true), view.getUint32(12, true)];
}

function decryptBlock(
  v0In: number,
  v1In: number,
  k0: number,
  k1: number,
  k2: number,
  k3: number,
): readonly [number, number] {
  let v0 = v0In;
  let v1 = v1In;
  let sum = 0xe3779b90;
  const delta = 0x61c88647;
  for (let i = 0; i < 16; i++) {
    const v0Shl4 = (v0 << 4) >>> 0;
    const v0Shr5 = v0 >>> 5;
    const term1 = ((v0Shl4 + k2) ^ (v0 + sum) ^ (v0Shr5 + k3)) >>> 0;
    v1 = (v1 - term1) >>> 0;

    const v1Shl4 = (v1 << 4) >>> 0;
    const v1Shr5 = v1 >>> 5;
    const term2 = ((v1Shl4 + k0) ^ (v1 + sum) ^ (v1Shr5 + k1)) >>> 0;
    v0 = (v0 - term2) >>> 0;

    sum = (sum + delta) >>> 0;
  }
  return [v0, v1];
}

function encryptBlock(
  v0In: number,
  v1In: number,
  k0: number,
  k1: number,
  k2: number,
  k3: number,
): readonly [number, number] {
  let v0 = v0In;
  let v1 = v1In;
  let sum = 0x9e3779b9;
  const delta = 0x61c88647;
  for (let i = 0; i < 16; i++) {
    const v1Shl4 = (v1 << 4) >>> 0;
    const v1Shr5 = v1 >>> 5;
    const term2 = ((v1Shl4 + k0) ^ (v1 + sum) ^ (v1Shr5 + k1)) >>> 0;
    v0 = (v0 + term2) >>> 0;

    const v0Shl4 = (v0 << 4) >>> 0;
    const v0Shr5 = v0 >>> 5;
    const term1 = ((v0Shl4 + k2) ^ (v0 + sum) ^ (v0Shr5 + k3)) >>> 0;
    v1 = (v1 + term1) >>> 0;

    sum = (sum - delta) >>> 0;
  }
  return [v0, v1];
}

function decryptCore(buffer: Uint8Array, key: Uint8Array): Uint8Array {
  const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const [k0, k1, k2, k3] = readKey(key);

  const len = buffer.byteLength;
  const out = new Uint8Array(len);
  const outView = new DataView(out.buffer);
  if (len < 8) return out;

  const c0 = dataView.getUint32(0, true);
  const c1 = dataView.getUint32(4, true);
  const [d0, d1] = decryptBlock(c0, c1, k0, k1, k2, k3);
  outView.setUint32(0, d0, true);
  outView.setUint32(4, d1, true);

  let prevD0 = d0;
  let prevD1 = d1;
  let prevC0 = c0;
  let prevC1 = c1;

  for (let offset = 8; offset < len; offset += 8) {
    const curC0 = dataView.getUint32(offset, true);
    const curC1 = dataView.getUint32(offset + 4, true);
    const in0 = (curC0 ^ prevD0) >>> 0;
    const in1 = (curC1 ^ prevD1) >>> 0;
    const [dec0, dec1] = decryptBlock(in0, in1, k0, k1, k2, k3);
    outView.setUint32(offset, (dec0 ^ prevC0) >>> 0, true);
    outView.setUint32(offset + 4, (dec1 ^ prevC1) >>> 0, true);
    prevD0 = dec0;
    prevD1 = dec1;
    prevC0 = curC0;
    prevC1 = curC1;
  }

  const padLen = ((out[0] ?? 0) & 0x07) + 3;
  return padLen < len ? out.subarray(padLen) : out;
}

function encryptCore(buffer: Uint8Array, key: Uint8Array): Uint8Array {
  const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const [k0, k1, k2, k3] = readKey(key);

  const len = buffer.byteLength;
  const out = new Uint8Array(len);
  const outView = new DataView(out.buffer);

  const p0 = dataView.getUint32(0, true);
  const p1 = dataView.getUint32(4, true);
  const [c0, c1] = encryptBlock(p0, p1, k0, k1, k2, k3);
  outView.setUint32(0, c0, true);
  outView.setUint32(4, c1, true);

  let prevD0 = p0;
  let prevD1 = p1;
  let prevC0 = c0;
  let prevC1 = c1;

  for (let offset = 8; offset < len; offset += 8) {
    const curP0 = dataView.getUint32(offset, true);
    const curP1 = dataView.getUint32(offset + 4, true);
    const dec0 = (curP0 ^ prevC0) >>> 0;
    const dec1 = (curP1 ^ prevC1) >>> 0;
    const [enc0, enc1] = encryptBlock(dec0, dec1, k0, k1, k2, k3);
    const curC0 = (enc0 ^ prevD0) >>> 0;
    const curC1 = (enc1 ^ prevD1) >>> 0;
    outView.setUint32(offset, curC0, true);
    outView.setUint32(offset + 4, curC1, true);
    prevD0 = dec0;
    prevD1 = dec1;
    prevC0 = curC0;
    prevC1 = curC1;
  }

  return out;
}

/** Decrypts a QQ-TEA-encrypted push/offline-history payload. Returns null for buffers too
 *  short to contain a single 8-byte block (mirrors the reference client's guard). */
export function qqteaDecrypt(buffer: Uint8Array, key: Uint8Array): Uint8Array | null {
  if (buffer.byteLength < 8) return null;
  return decryptCore(buffer, key);
}

/** Encrypts a plaintext body for the QQ-TEA `keyType: 1` wire format: a random 3-10 byte
 *  header (first byte encodes header-length - 3 in its low 3 bits) plus a 7-byte trailer,
 *  padded so the total length is a multiple of 8. Not currently called by the connection
 *  service (all outbound DM/typing/read-receipt packets use keyType 0), but ported for
 *  completeness since the reference client exposes it as part of the same module. */
export function qqteaEncrypt(buffer: Uint8Array, key: Uint8Array): Uint8Array {
  const headerLen = ((8 - ((buffer.byteLength + 10) % 8)) % 8) + 3;
  const trailingLen = 7;
  const totalLen = buffer.byteLength + headerLen + trailingLen;
  const padded = new Uint8Array(totalLen);
  padded[0] = (headerLen - 3) & 0x07;
  for (let i = 1; i < headerLen; i++) padded[i] = Math.floor(Math.random() * 256);
  padded.set(buffer, headerLen);
  return encryptCore(padded, key);
}
