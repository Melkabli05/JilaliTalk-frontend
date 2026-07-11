# Frontend IM WebSocket Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the private-messaging WebSocket protocol (binary framing, QQ-TEA encryption, APK-signature login, heartbeat, offline sync) from jilalibff into the Angular frontend, so the browser holds its own direct connection to the messaging server instead of relaying through the backend.

**Architecture:** A new `core/realtime/ht-protocol/` module holds pure protocol codec functions (no Angular DI). A new `HtImConnectionService` (replacing `ImSocketService`) owns the connection lifecycle (connect/login/heartbeat/reconnect/session-key) and exposes the same `events`/`status` signal contract plus new `sendDm`/`sendTyping`/`sendReadReceipt` methods. `MessagesStore` calls those directly instead of HTTP-POSTing to jilalibff. jilalibff's `/auth/me` gains `imJwt`/`imDeviceId`/`imDeviceModel` fields (from its existing hardcoded config) so the frontend can authenticate to the messaging server itself.

**Tech Stack:** Angular 22 (signals, zoneless), TypeScript 6.0 strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), `pako` (new dependency, zlib in the browser), native `crypto.subtle` (HMAC), Micronaut/Java (jilalibff).

## Global Constraints

- No `standalone: true` (implicit default). All components `ChangeDetectionStrategy.OnPush` (not applicable here — no components in this plan).
- No manual `.subscribe()` without `takeUntilDestroyed` — not applicable here; `HtImConnectionService` uses raw `WebSocket` events (no RxJS subscriptions to leak) and the one `firstValueFrom(...)` call is a one-shot promise, not a subscription.
- Cross-boundary imports use path aliases (`@core/*`, `@shared/*`), never `../../../` chains.
- Prefer `satisfies` over `as`; annotate exported function return types; use `unknown` + narrowing, never `any`.
- `exactOptionalPropertyTypes` is on — optional fields (`field?: T`) must be *omitted*, never explicitly set to `undefined`; use conditional object spread (`...(x !== undefined ? { field: x } : {})`) to add them.
- Per user instruction (this project), do not write new unit test (`.spec.ts`) files as part of this work. Existing specs that reference a renamed symbol must still be fixed so the suite stays green — that's maintenance of existing tests, not new test-writing. Verification is via TypeScript compilation (`npx tsc -p tsconfig.app.json --noEmit`), `ng build`, and (final task) manually running the app.
- Source of truth for protocol *behavior* (framing, crypto, message shapes) is the reference client at `/home/mohammed/Desktop/JilaliTalk/old_hellotalk/project/v1/connectwebsock.js`, `prvmsg/prvgmsgpacket.js`, and the private-messaging-relevant parts of `scriptv2.js` — not jilalibff's Java port. The one exception is `HtImNotifyMapper.java`'s JSON→event field-mapping rules, which were refined against live traffic captures (documented inline) and are ported as-is (see Task 6).
- Scope is private 1:1 messaging only. Room/LiveHub real-time, Agora, whiteboard, gifts UI, and RTM group chat (cmdId `29968`, `buildRoomNotifyPacket`, room audience hand-raise notify types `10`/`11`) are explicitly out of scope and must not be touched.

---

## File Structure

```
JilaliTalk-angular-frontend/
├── package.json                                          [MODIFY] add pako, @types/pako
├── src/environments/environment.ts                       [MODIFY] add imWsUrl
├── src/environments/environment.production.ts             [MODIFY] add imWsUrl
├── src/app/app.config.ts                                  [MODIFY] provide IM_WS_URL
├── src/app/core/tokens/im-ws-url.token.ts                 [CREATE]
├── src/app/core/auth/auth.store.ts                        [MODIFY] imJwt/imDeviceId/imDeviceModel + persistence
├── src/app/core/realtime/ht-protocol/
│   ├── qqtea.util.ts                                       [CREATE]
│   ├── apk-signature.util.ts                               [CREATE]
│   ├── packet-framer.util.ts                               [CREATE]
│   ├── frame-decoder.util.ts                                [CREATE]
│   └── im-event-mapper.util.ts                              [CREATE]
├── src/app/core/realtime/ht-im-connection.service.ts       [CREATE]
├── src/app/core/realtime/im-socket.service.ts               [DELETE]
├── src/app/core/realtime/im-bootstrap.service.ts             [MODIFY] rename import
├── src/app/core/realtime/im-bootstrap.service.spec.ts        [MODIFY] rename import
├── src/app/core/realtime/index.ts                            [MODIFY] export rename
└── src/app/features/messages/store/messages.store.ts         [MODIFY] direct send calls

jilalibff/
└── src/main/java/com/jilali/auth/
    ├── dto/AuthResponse.java                               [MODIFY] add imJwt/imDeviceId/imDeviceModel
    └── AuthController.java                                 [MODIFY] populate new fields
```

---

### Task 1: Add `pako` dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install pako and its types**

Run: `npm install pako && npm install --save-dev @types/pako`

Expected: both added to `package.json` (`pako` under `dependencies`, `@types/pako` under `devDependencies`), `package-lock.json` updated, no errors.

- [ ] **Step 2: Verify the import resolves**

Run: `node -e "require('pako'); console.log('ok')"`

Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add pako for browser-side zlib inflate/deflate"
```

---

### Task 2: QQ-TEA cipher util

**Files:**
- Create: `src/app/core/realtime/ht-protocol/qqtea.util.ts`

**Interfaces:**
- Produces: `qqteaDecrypt(buffer: Uint8Array, key: Uint8Array): Uint8Array | null`, `qqteaEncrypt(buffer: Uint8Array, key: Uint8Array): Uint8Array`

- [ ] **Step 1: Write the cipher**

```typescript
// src/app/core/realtime/ht-protocol/qqtea.util.ts

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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`

Expected: no errors referencing `qqtea.util.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/app/core/realtime/ht-protocol/qqtea.util.ts
git commit -m "feat(realtime): port QQ-TEA cipher for the IM protocol"
```

---

### Task 3: APK signature util

**Files:**
- Create: `src/app/core/realtime/ht-protocol/apk-signature.util.ts`

**Interfaces:**
- Produces: `generateApkSignature(deviceId: string, timestampMs?: number): Promise<string>`, `APP_VERSION: string`, `CURRENT_VERSION: number`, `CHANNEL: string`

- [ ] **Step 1: Write the signature generator**

```typescript
// src/app/core/realtime/ht-protocol/apk-signature.util.ts

/**
 * Generates the `android_apk_signature` login-packet field by reproducing the HMAC the
 * official Android app computes to prove its identity to the messaging server. Ported
 * byte-for-byte from the reference client's `_APK_SIG` object. The HMAC key and APK
 * certificate blob below are not new secrets introduced by this file — they're already
 * committed in plaintext in jilalibff's `ApkSignatureGenerator.java`; this relocates an
 * already-public constant into the browser bundle rather than exposing something new.
 */

const HMAC_KEY_HEX =
  'fe0629ad30d48b5bf1e82865404694fe8525200575f5c4339debf5e8ff571c6e';

const APK_SIG_HEX =
  '3082035930820241a003020102020461e4cac1300d06092a864886f70d01010b0500305c310b30' +
  '0906035504061302434e31123010060355040813096775616e67646f6e673111300f060355040713087368656e7a68656e' +
  '310b3009060355040a13026a79310b3009060355040b13026a79310c300a06035504031303776c683020170d3132313031' +
  '363032303033365a180f32303637303732303032303033365a305c310b300906035504061302434e31123010060355040813' +
  '096775616e67646f6e673111300f060355040713087368656e7a68656e310b3009060355040a13026a79310b30090603550' +
  '40b13026a79310c300a06035504031303776c6830820122300d06092a864886f70d01010105000382010f003082010a0282' +
  '010100947e44daa5fe6b440513b2f206196f9a535da8a2a83841bfb430218322e95b513a5ae62bcea16330027e78557b701c' +
  'c51ca6a02de45820592444244f456182fe6f7acf2283a085fb2258a445c9a3080ce236112bcbaeef77d4cf7fd4fa0e788799c' +
  '2a372ed71b8805c20ed313333599f4db298ea10992e976d96157b642686b357b57dbca4d5ffcae60e8c5e3a77ba6b441e2f04' +
  '194b6209275153199dca2b24845787f6bf777fc274c0b6cfaec2ba73ed84b910334d046234cb31bb094245d6bd00b6371025b' +
  '216b26aef2348dce9c4f90bd8830748f8a82359beb15a9364062c7f1240a340d7d2212bfe77eded19885adb0fe0ac342cb78e' +
  '594927be381aed0203010001a321301f301d0603551d0e04160414a526c8345e98a551da247300ad1feb87a389a106300d06' +
  '092a864886f70d01010b0500038201010037b9a2297d4b21ec2e020306755b12d46e2ef3ac655787f81e1ebe7ed110e24b207' +
  '667462feea52baf8dd115e58a816336ada3a866014afb07459f82ae789300148f291dd361b2be448e0bbe6039811de92b44b6' +
  'cf7c9864bf4d4cc0ab5bb953f401970aecaff8f83012eb5b744fa43af618f79ed0914433aaea1619bad1fc0e1d41a68d072d7' +
  'd7e5961a950b496df5c8a3881e33f7ac2b09cb5613a91f98e0aab8d896be91c80b565ec5d94a44ef17c2dbe109a3204cdaa4c' +
  '9c2e8806e71520af48b9511601c8b7b76da0ec802f896c5c6f8c9c6194da3a3f33a5257365900c6cbf36b64c879b20011e770' +
  'c2c2534d482789c86c0d008287292ffd40de22c41';

const VI_VALUE = '6.3.40(11126,google)';

export const APP_VERSION = VI_VALUE;
export const CURRENT_VERSION = 394024;
export const CHANNEL = 'com.hellotalk.core.app.NihaotalkApplication';

async function hmacHex(keyHex: string, dataStr: string): Promise<string> {
  const keyBytes = new TextEncoder().encode(keyHex);
  const dataBytes = new TextEncoder().encode(dataStr);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, dataBytes);
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Builds `android_apk_signature` = HMAC-SHA256(sig1 + tsSec + VI_VALUE + sig2 + deviceId) + tsSec,
 *  where sig1/sig2 are the first 499 / next 499 hex chars of the APK cert blob. */
export async function generateApkSignature(deviceId: string, timestampMs: number = Date.now()): Promise<string> {
  const tsSec = String(Math.floor(timestampMs / 1000));
  const sig1 = APK_SIG_HEX.substring(0, 499);
  const sig2 = APK_SIG_HEX.length > 499 ? APK_SIG_HEX.substring(499, 998) : '';
  const data = sig1 + tsSec + VI_VALUE + sig2 + deviceId;
  const hmac = await hmacHex(HMAC_KEY_HEX, data);
  return hmac + tsSec;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`

Expected: no errors referencing `apk-signature.util.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/app/core/realtime/ht-protocol/apk-signature.util.ts
git commit -m "feat(realtime): port APK-signature HMAC generator for IM login"
```

---

### Task 4: Packet framer util (outbound packet builders)

**Files:**
- Create: `src/app/core/realtime/ht-protocol/packet-framer.util.ts`

**Interfaces:**
- Consumes: `APP_VERSION`, `CURRENT_VERSION`, `CHANNEL` from `./apk-signature.util` (Task 3)
- Produces: `HEADER_LEN`, `CMD_LOGIN`, `CMD_HEARTBEAT`, `CMD_HEARTBEAT_ACK`, `CMD_PRIVATE_MSG`, `CMD_MSG_ACK`, `CMD_READ_RECEIPT`, `CMD_TYPING_INDICATOR`, `CMD_OFFLINE_SYNC_TRIGGER_FIRST`, `CMD_OFFLINE_SYNC_TRIGGER_PAGE`, `CMD_OFFLINE_SYNC_RESPONSE` (all `number`); `FLAG_CLIENT_REQUEST`, `FLAG_PUSH`, `FLAG_ACK`, `FLAG_TYPING`, `FLAG_SERVER_RESPONSE` (all `number`); `PacketHeader` interface; `parseHeader(raw: Uint8Array): PacketHeader`; `buildPacket(params): Uint8Array`; `buildLoginPacket(params): Uint8Array`; `buildHeartbeatPacket(userId: string): Uint8Array`; `buildAckPacket(incoming: Uint8Array, forceCmdId?: number): Uint8Array`; `buildReadReceiptPacket(fromId: string, toId: string, msgId: string): Uint8Array`; `buildTypingIndicatorPacket(fromId: string, toId: string, isTyping: boolean): Uint8Array`; `buildOfflineSyncTriggerPacket(params): Uint8Array`; `DmSendGift` interface; `DmSendPayload` union; `buildDmMessagePacket(params): { readonly packet: Uint8Array; readonly msgId: string }`

- [ ] **Step 1: Write the framer**

```typescript
// src/app/core/realtime/ht-protocol/packet-framer.util.ts
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`

Expected: no errors referencing `packet-framer.util.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/app/core/realtime/ht-protocol/packet-framer.util.ts
git commit -m "feat(realtime): port IM packet framer and outbound packet builders"
```

---

### Task 5: Frame decoder util (inbound frame parsing)

**Files:**
- Create: `src/app/core/realtime/ht-protocol/frame-decoder.util.ts`

**Interfaces:**
- Consumes: `qqteaDecrypt` from `./qqtea.util` (Task 2); `parseHeader`, `HEADER_LEN`, `CMD_TYPING_INDICATOR` from `./packet-framer.util` (Task 4)
- Produces: `Cmd16386Result` interface; `decodeCmd16386(payload: Uint8Array): Cmd16386Result`; `decodeMsgAckPayload(payload: Uint8Array, keyType: number, sessionKey: Uint8Array | null): Cmd16386Result`; `PushFrameResult` type; `decodePushFrame(encPayload: Uint8Array, sessionKey: Uint8Array | null): PushFrameResult`; `decodeTypingPayload(payload: Uint8Array, keyType: number, sessionKey: Uint8Array | null): boolean`; `decodeLoginFrame(payload: Uint8Array): Record<string, unknown> | null`; `OfflinePacketResult` type; `decodeOfflinePacket(base64Packet: string, sessionKey: Uint8Array | null): OfflinePacketResult`

- [ ] **Step 1: Write the decoder**

```typescript
// src/app/core/realtime/ht-protocol/frame-decoder.util.ts
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
export function decodeCmd16386(payload: Uint8Array): Cmd16386Result {
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

/** Typing-indicator payload (packetType 0xF5, cmdId 16407): UID (4 bytes) + status (u16)
 *  after optional decrypt/decompress. Falls back to "any byte equals 1 means typing" for the
 *  odd short-length variants the reference client observed in the wild. */
export function decodeTypingPayload(payload: Uint8Array, keyType: number, sessionKey: Uint8Array | null): boolean {
  const decrypted = tryDecrypt(payload, keyType, sessionKey);
  const body = tryInflateIfZlib(decrypted);

  if (body.byteLength >= 6) {
    const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
    return view.getUint16(4, true) === 1;
  }
  if (body.byteLength > 0) {
    return Array.from(body).some((b) => b === 1);
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`

Expected: no errors referencing `frame-decoder.util.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/app/core/realtime/ht-protocol/frame-decoder.util.ts
git commit -m "feat(realtime): port inbound IM frame decoder"
```

---

### Task 6: IM event mapper util

**Files:**
- Create: `src/app/core/realtime/ht-protocol/im-event-mapper.util.ts`

**Interfaces:**
- Consumes: `ImEvent` type from `../im-events` (pre-existing, unchanged)
- Produces: `mapImJsonToEvent(json: Record<string, unknown>, headerFromId: number, selfUserId: number): ImEvent | null`

- [ ] **Step 1: Write the mapper**

```typescript
// src/app/core/realtime/ht-protocol/im-event-mapper.util.ts
import type { ImEvent } from '../im-events';

/**
 * Maps a decoded JSON push payload from the personal ht_im/sock channel (msg_type-tagged DMs
 * and notify_type-tagged account notifications) to the frontend's ImEvent union.
 *
 * Field-mapping rules are ported from jilalibff's `HtImNotifyMapper.java`, which was built
 * and refined against live traffic captures (see that file's inline comments for the exact
 * captured payload shapes each rule handles — e.g. the `new_voice_visitor` self-echo drop).
 * That's a different kind of "source of truth" than the framing/crypto layer above this file:
 * this is the JSON semantic layer, independently reverse-engineered from real traffic and
 * worth preserving as-is rather than re-deriving with less information.
 *
 * Out of scope (return null / unreached): msg_type "send_gift" has no inbound mapping (it's
 * outbound-only — inbound gifts arrive as msg_type "gift"); notify_type "10"/"11" (room
 * audience raise/cancel-hand) and cmdId 29968 (RTM group sync) are room-feature concerns,
 * excluded per the private-messaging-only scope.
 */

function textOr(obj: Record<string, unknown>, field: string, fallback: string): string {
  const v = obj[field];
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}

function textOrNull(obj: Record<string, unknown>, field: string): string | null {
  const v = obj[field];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function numOr(obj: Record<string, unknown>, field: string, fallback: number): number {
  const v = obj[field];
  return typeof v === 'number' ? v : fallback;
}

export function mapImJsonToEvent(
  json: Record<string, unknown>,
  headerFromId: number,
  selfUserId: number,
): ImEvent | null {
  const msgType = json['msg_type'];
  if (typeof msgType === 'string') {
    switch (msgType) {
      case 'text':
        return mapText(json, headerFromId);
      case 'image':
        return mapImage(json, headerFromId);
      case 'gift':
        return mapGift(json, headerFromId);
      case 'introduction':
        return mapIntroduction(json, headerFromId);
      case 'new_voice_visitor':
        return mapProfileVisit(json, headerFromId, selfUserId);
      default:
        return null;
    }
  }
  if (json['notify_type'] !== undefined) return mapNotify(json, selfUserId);
  return null;
}

function mapText(json: Record<string, unknown>, headerFromId: number): ImEvent {
  const fromUserId = textOr(json, 'from_id', String(headerFromId));
  const fromNickname = textOr(json, 'from_nickname', textOr(json, 'nickname', ''));
  const fromHeadUrl = textOrNull(json, 'from_head_url');
  const t = json['text'];
  const text =
    typeof t === 'object' && t !== null
      ? textOr(t as Record<string, unknown>, 'text', '')
      : typeof t === 'string'
        ? t
        : '';
  const ts = numOr(json, 'ts', Date.now());
  return {
    type: 'text_message',
    fromUserId,
    fromNickname,
    text,
    ts,
    ...(fromHeadUrl !== null ? { fromHeadUrl } : {}),
  };
}

function mapImage(json: Record<string, unknown>, headerFromId: number): ImEvent {
  const fromUserId = textOr(json, 'from_id', String(headerFromId));
  const fromNickname = textOr(json, 'from_nickname', textOr(json, 'nickname', ''));
  const fromHeadUrl = textOrNull(json, 'from_head_url');
  const image = json['image'];
  let imageUrl = typeof image === 'object' && image !== null ? textOr(image as Record<string, unknown>, 'url', '') : '';
  if (!imageUrl) imageUrl = textOr(json, 'image_url', '');
  const ts = numOr(json, 'ts', Date.now());
  return {
    type: 'image_message',
    fromUserId,
    fromNickname,
    imageUrl,
    ts,
    ...(fromHeadUrl !== null ? { fromHeadUrl } : {}),
  };
}

function mapGift(json: Record<string, unknown>, headerFromId: number): ImEvent {
  const fromUserId = textOr(json, 'from_id', String(headerFromId));
  const fromNickname = textOr(json, 'from_nickname', textOr(json, 'nickname', ''));
  const fromHeadUrl = textOrNull(json, 'from_head_url') ?? textOrNull(json, 'head_url');
  const giftId = numOr(json, 'gift_id', 0);
  const count = numOr(json, 'gift_number', 1);
  return {
    type: 'gift_message',
    fromUserId,
    fromNickname,
    giftId,
    count,
    ...(fromHeadUrl !== null ? { fromHeadUrl } : {}),
  };
}

function mapIntroduction(json: Record<string, unknown>, headerFromId: number): ImEvent {
  const fromUserId = textOr(json, 'from_id', String(headerFromId));
  const fromNickname = textOr(json, 'from_nickname', textOr(json, 'nickname', ''));
  const fromHeadUrl = textOrNull(json, 'from_head_url') ?? textOrNull(json, 'head_url');
  return {
    type: 'introduction_message',
    fromUserId,
    fromNickname,
    ...(fromHeadUrl !== null ? { fromHeadUrl } : {}),
  };
}

function mapNotify(json: Record<string, unknown>, selfUserId: number): ImEvent | null {
  if (typeof json['cname'] === 'string') {
    const cname = json['cname'];
    const fromNickname = textOr(json, 'from_nickname', textOr(json, 'nickname', ''));
    const headUrl = textOrNull(json, 'head_url');
    if ('count' in json || 'voice_count' in json) {
      const count = 'count' in json ? numOr(json, 'count', 0) : numOr(json, 'voice_count', 0);
      return { type: 'voice_room_shared', fromNickname, cname, headUrl, count };
    }
    return { type: 'live_room_shared', fromNickname, cname, headUrl };
  }

  const info = (json['notify_info'] as Record<string, unknown> | undefined) ?? {};
  const selfId = String(selfUserId);
  const notifyType = String(json['notify_type'] ?? '');

  switch (notifyType) {
    case '18':
      return { type: 'stage_invite', userId: textOr(info, 'user_id', selfId), cname: textOr(info, 'cname', '') };
    case '48':
      return { type: 'mod_invite', userId: textOr(info, 'user_id', selfId), cname: textOr(info, 'cname', '') };
    case '34':
      return { type: 'mod_accepted', userId: textOr(info, 'user_id', selfId) };
    case '35':
      return { type: 'mod_removed', userId: textOr(info, 'user_id', selfId) };
    case '40':
      return { type: 'mod_unmuted', userId: textOr(info, 'user_id', selfId) };
    case '53': {
      const headUrl = textOrNull(info, 'head_url');
      return {
        type: 'follow',
        userId: textOr(info, 'user_id', ''),
        nickname: textOr(info, 'nickname', ''),
        status: numOr(info, 'status', 0),
        ...(headUrl !== null ? { headUrl } : {}),
      };
    }
    default:
      break;
  }

  for (const field of ['visitor_uid', 'visitor_user_id', 'visitor_id']) {
    const visitorId = textOrNull(json, field);
    if (!visitorId || visitorId === selfId) continue;
    const nickname = textOr(json, 'nickname', textOr(json, 'from_nickname', ''));
    const headUrl = textOrNull(json, 'head_url') ?? textOrNull(json, 'headUrl');
    return {
      type: 'profile_visit',
      visitorUserId: visitorId,
      nickname,
      ...(headUrl !== null ? { headUrl } : {}),
    };
  }
  return null;
}

/**
 * Live capture (see HtImNotifyMapper.java) revealed that `userId` names whose profile the
 * event is about while `visitor_id` names who actually did the visiting — an account viewing
 * its own room echoes this push back with `visitor_id` resolving to self, which must be
 * dropped rather than surfaced as "you visited your own profile."
 */
function mapProfileVisit(json: Record<string, unknown>, headerFromId: number, selfUserId: number): ImEvent | null {
  let visitorId = textOrNull(json, 'visitor_id') ?? textOrNull(json, 'visitor_uid');
  if (!visitorId) {
    visitorId =
      headerFromId > 0 && headerFromId !== selfUserId
        ? String(headerFromId)
        : textOrNull(json, 'userId') ?? textOrNull(json, 'user_id');
  }
  if (!visitorId || visitorId === String(selfUserId)) return null;
  const nickname = textOr(json, 'nickname', textOr(json, 'from_nickname', ''));
  const headUrl = textOrNull(json, 'head_url') ?? textOrNull(json, 'headUrl');
  return {
    type: 'profile_visit',
    visitorUserId: visitorId,
    nickname,
    ...(headUrl !== null ? { headUrl } : {}),
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`

Expected: no errors referencing `im-event-mapper.util.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/app/core/realtime/ht-protocol/im-event-mapper.util.ts
git commit -m "feat(realtime): port IM notify JSON to ImEvent mapper"
```

---

### Task 7: IM WebSocket URL config

**Files:**
- Create: `src/app/core/tokens/im-ws-url.token.ts`
- Modify: `src/environments/environment.ts`
- Modify: `src/environments/environment.production.ts`
- Modify: `src/app/app.config.ts`

**Interfaces:**
- Produces: `IM_WS_URL: InjectionToken<string>`

- [ ] **Step 1: Create the token**

```typescript
// src/app/core/tokens/im-ws-url.token.ts
import { InjectionToken } from '@angular/core';

/**
 * Direct wss:// endpoint for the personal-messaging protocol (ht_im/sock). The frontend
 * connects to this directly instead of relaying through jilalibff's own WebSocket.
 */
export const IM_WS_URL = new InjectionToken<string>('IM_WS_URL', {
  factory: () => 'wss://api-global.hellotalk8.com/ht_im/sock',
});
```

- [ ] **Step 2: Add `imWsUrl` to both environment files**

In `src/environments/environment.ts`, add the field:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api',
  wsUrl: 'ws://localhost:8080/ws',
  imWsUrl: 'wss://api-global.hellotalk8.com/ht_im/sock',
  agoraAppIdVoice: '0d7f53ced63046738a30ef2491e4714c',
  agoraAppIdVideo: 'f1b7a6ae12fd4443b0968681d4f37bc1',
  agoraAppIdRtm: '3daa84b8c7c843fb9bb6defdb2d3672f',
  };
```

In `src/environments/environment.production.ts`, add the same field (same value — this is a fixed third-party endpoint, not deploy-target-specific):

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://jilalitalk-backend.onrender.com/api',
  wsUrl: 'wss://jilalitalk-backend.onrender.com/ws',
  imWsUrl: 'wss://api-global.hellotalk8.com/ht_im/sock',
  agoraAppIdVoice: '0d7f53ced63046738a30ef2491e4714c',
  agoraAppIdVideo: 'f1b7a6ae12fd4443b0968681d4f37bc1',
  agoraAppIdRtm: '3daa84b8c7c843fb9bb6defdb2d3672f',
  };
```

- [ ] **Step 3: Provide the token in `app.config.ts`**

In `src/app/app.config.ts`, add the import:

```typescript
import { IM_WS_URL } from '@core/tokens/im-ws-url.token';
```

And add a provider line right after the existing `WS_BASE_URL` provider:

```typescript
    { provide: API_BASE_URL, useValue: environment.apiUrl },
    { provide: WS_BASE_URL, useValue: environment.wsUrl },
    { provide: IM_WS_URL, useValue: environment.imWsUrl },
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/core/tokens/im-ws-url.token.ts src/environments/environment.ts src/environments/environment.production.ts src/app/app.config.ts
git commit -m "feat(realtime): add IM_WS_URL token and environment wiring"
```

---

### Task 8: AuthStore/AuthService IM credential plumbing

**Files:**
- Modify: `src/app/core/auth/auth.store.ts`

**Interfaces:**
- Consumes: `StorageService` from `@core/services/storage.service` (pre-existing)
- Produces: `AuthUser` gains optional `imJwt?: string`, `imDeviceId?: string`, `imDeviceModel?: string`; `ImCredentials` interface `{ jwt: string; deviceId: string; deviceModel: string }`; `AuthStore.updateImJwt(jwt: string): void`; `AuthStore.getImCredentials(): ImCredentials | null`

- [ ] **Step 1: Rewrite `auth.store.ts`**

```typescript
// src/app/core/auth/auth.store.ts
import { Injectable, signal, computed, inject } from '@angular/core';
import { StorageService } from '@core/services/storage.service';

export interface AuthUser {
  readonly userId: number;
  readonly nickname: string;
  readonly email: string;
  readonly headUrl: string | null;
  readonly imJwt?: string;
  readonly imDeviceId?: string;
  readonly imDeviceModel?: string;
}

export interface ImCredentials {
  readonly jwt: string;
  readonly deviceId: string;
  readonly deviceModel: string;
}

export const IM_CREDENTIALS_STORAGE_KEY = 'jilali_im_credentials';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly storage = inject(StorageService);
  private readonly _user = signal<AuthUser | null>(null);

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  login(user: AuthUser): void {
    this._user.set(user);
    this.persistImCredentials(user);
  }

  logout(): void {
    this._user.set(null);
  }

  /** Patches the in-memory + persisted IM credentials without touching the rest of the
   *  profile — used when the messaging server rotates the JWT on login (see the reference
   *  client's `onSessionReady` `newJwt`), so this browser's next reconnect uses the fresh
   *  token instead of the one originally issued by `/auth/me`. */
  updateImJwt(jwt: string): void {
    const current = this._user();
    if (!current) return;
    const updated: AuthUser = { ...current, imJwt: jwt };
    this._user.set(updated);
    this.persistImCredentials(updated);
  }

  /** Reads IM credentials from the current user signal, falling back to the last-persisted
   *  copy in localStorage (e.g. if the in-memory signal was reset by a logout/login cycle
   *  that didn't carry them, but a prior session did). */
  getImCredentials(): ImCredentials | null {
    const user = this._user();
    if (user?.imJwt && user.imDeviceId && user.imDeviceModel) {
      return { jwt: user.imJwt, deviceId: user.imDeviceId, deviceModel: user.imDeviceModel };
    }
    return this.storage.get<ImCredentials>(IM_CREDENTIALS_STORAGE_KEY);
  }

  private persistImCredentials(user: AuthUser): void {
    if (user.imJwt && user.imDeviceId && user.imDeviceModel) {
      this.storage.set(IM_CREDENTIALS_STORAGE_KEY, {
        jwt: user.imJwt,
        deviceId: user.imDeviceId,
        deviceModel: user.imDeviceModel,
      } satisfies ImCredentials);
    }
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`

Expected: no errors in `auth.store.ts`. (Other files reading `AuthUser` still compile since the new fields are optional and additive.)

- [ ] **Step 3: Commit**

```bash
git add src/app/core/auth/auth.store.ts
git commit -m "feat(auth): store IM credentials (jwt/deviceId/deviceModel) from /auth/me"
```

---

### Task 9: Backend — expose IM credentials via `/auth/me`

**Files:**
- Modify: `/home/mohammed/Desktop/JilaliTalk/jilalibff/src/main/java/com/jilali/auth/dto/AuthResponse.java`
- Modify: `/home/mohammed/Desktop/JilaliTalk/jilalibff/src/main/java/com/jilali/auth/AuthController.java`

**Interfaces:**
- Consumes: `JilaliProperties.defaultAuthToken()`, `JilaliProperties.deviceId()`, `JilaliProperties.deviceModel()` (pre-existing, non-null after the record's compact constructor defaults)
- Produces: `AuthResponse.AuthUser` record gains `imJwt`, `imDeviceId`, `imDeviceModel` fields (JSON: `imJwt`/`imDeviceId`/`imDeviceModel`), matching `AuthUser.imJwt/imDeviceId/imDeviceModel` on the frontend (Task 8)

- [ ] **Step 1: Add the fields to `AuthResponse.AuthUser`**

```java
// src/main/java/com/jilali/auth/dto/AuthResponse.java
package com.jilali.auth.dto;

import io.micronaut.core.annotation.Nullable;
import io.micronaut.serde.annotation.Serdeable;

@Serdeable
public record AuthResponse(AuthUser user) {

    @Serdeable
    public record AuthUser(
        long userId,
        String nickname,
        String email,
        @Nullable String headUrl,
        String imJwt,
        String imDeviceId,
        String imDeviceModel
    ) {}
}
```

- [ ] **Step 2: Populate the fields from `JilaliProperties` in `AuthController`**

```java
// src/main/java/com/jilali/auth/AuthController.java
package com.jilali.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jilali.auth.dto.AuthResponse;
import com.jilali.core.JilaliProperties;
import com.jilali.core.UidExtractor;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import io.micronaut.http.annotation.Post;
import jakarta.inject.Singleton;

/**
 * Stub auth controller — login is not implemented yet.
 * {@code GET /api/auth/me} returns the hardcoded BFF identity derived from
 * {@code jilali.default-auth-token} so that the Angular frontend becomes "authenticated"
 * and can connect directly to the IM messaging server using the same credentials.
 *
 * Replace this with real session/cookie auth when the login feature is built.
 */
@Singleton
@Controller("/api/auth")
public class AuthController {

    private final AuthResponse.AuthUser hardcodedUser;

    public AuthController(JilaliProperties properties, ObjectMapper om) {
        long uid = UidExtractor.uidAsLong(properties.defaultAuthToken(), om);
        this.hardcodedUser = new AuthResponse.AuthUser(
            uid, "Jilali Light", "", null,
            properties.defaultAuthToken(), properties.deviceId(), properties.deviceModel()
        );
    }

    /** Returns the currently "logged-in" user from the hardcoded JWT. */
    @Get("/me")
    public AuthResponse me() {
        return new AuthResponse(hardcodedUser);
    }

    /** Stub — real login not implemented yet. */
    @Post("/login")
    public AuthResponse login() {
        return new AuthResponse(hardcodedUser);
    }

    /** Stub — real logout not implemented yet. */
    @Post("/logout")
    public void logout() {}
}
```

- [ ] **Step 3: Compile the backend**

Run: `cd /home/mohammed/Desktop/JilaliTalk/jilalibff && ./gradlew compileJava`

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 4: Commit**

```bash
cd /home/mohammed/Desktop/JilaliTalk/jilalibff
git add src/main/java/com/jilali/auth/dto/AuthResponse.java src/main/java/com/jilali/auth/AuthController.java
git commit -m "feat(auth): expose IM jwt/deviceId/deviceModel via /auth/me

The Angular frontend now connects directly to the messaging server
instead of relaying through this backend's WebSocket; it needs these
already-configured credentials to authenticate that connection itself."
```

---

### Task 10: `HtImConnectionService` — connection lifecycle, login, heartbeat, reconnect, sending

**Files:**
- Create: `src/app/core/realtime/ht-im-connection.service.ts`
- Delete: `src/app/core/realtime/im-socket.service.ts`

**Interfaces:**
- Consumes: `AuthStore`, `ImCredentials` (Task 8); `AuthService` (`@core/auth/auth.service`, pre-existing); `IM_WS_URL` (Task 7); `backoffDelay`, `MAX_RECONNECT_ATTEMPTS` from `./reconnecting-socket-base` (pre-existing, unchanged); everything from Tasks 2–6 (`generateApkSignature`; `buildLoginPacket`, `buildHeartbeatPacket`, `buildAckPacket`, `buildReadReceiptPacket`, `buildTypingIndicatorPacket`, `buildOfflineSyncTriggerPacket`, `buildDmMessagePacket`, `parseHeader`, `HEADER_LEN`, `FLAG_PUSH`, `FLAG_TYPING`, `FLAG_SERVER_RESPONSE`, `CMD_MSG_ACK`, `CMD_HEARTBEAT_ACK`, `CMD_TYPING_INDICATOR`, `CMD_OFFLINE_SYNC_RESPONSE`, `CMD_OFFLINE_SYNC_TRIGGER_FIRST`, `CMD_OFFLINE_SYNC_TRIGGER_PAGE`, `DmSendPayload`; `decodeMsgAckPayload`, `decodePushFrame`, `decodeTypingPayload`, `decodeLoginFrame`, `decodeOfflinePacket`; `mapImJsonToEvent`); `ImEvent` from `./im-events` (pre-existing)
- Produces: `ImConnectionStatus` type; `HtImConnectionService` class with `events: Signal<readonly ImEvent[]>`, `status: Signal<ImConnectionStatus>`, `isConnected(): boolean`, `connect(): void`, `disconnect(): void`, `sendDm(peerId: number, payload: DmSendPayload, fromNickname: string, fromProfileTs: number, msgId?: string): string | null`, `sendTyping(peerId: number, isTyping: boolean): void`, `sendReadReceipt(peerId: number, msgId: string): void`

- [ ] **Step 1: Delete the old relay-based service**

Run: `git rm src/app/core/realtime/im-socket.service.ts`

Expected: file removed from the working tree and staged.

- [ ] **Step 2: Write `ht-im-connection.service.ts`**

```typescript
// src/app/core/realtime/ht-im-connection.service.ts
import { Injectable, signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore, type ImCredentials } from '@core/auth/auth.store';
import { AuthService } from '@core/auth/auth.service';
import { IM_WS_URL } from '@core/tokens/im-ws-url.token';
import { backoffDelay, MAX_RECONNECT_ATTEMPTS } from './reconnecting-socket-base';
import type { ImEvent } from './im-events';
import { generateApkSignature } from './ht-protocol/apk-signature.util';
import {
  buildAckPacket,
  buildDmMessagePacket,
  buildHeartbeatPacket,
  buildLoginPacket,
  buildOfflineSyncTriggerPacket,
  buildReadReceiptPacket,
  buildTypingIndicatorPacket,
  CMD_HEARTBEAT_ACK,
  CMD_MSG_ACK,
  CMD_OFFLINE_SYNC_RESPONSE,
  CMD_OFFLINE_SYNC_TRIGGER_FIRST,
  CMD_OFFLINE_SYNC_TRIGGER_PAGE,
  CMD_TYPING_INDICATOR,
  FLAG_PUSH,
  FLAG_SERVER_RESPONSE,
  FLAG_TYPING,
  HEADER_LEN,
  parseHeader,
  type DmSendPayload,
} from './ht-protocol/packet-framer.util';
import {
  decodeLoginFrame,
  decodeMsgAckPayload,
  decodeOfflinePacket,
  decodePushFrame,
  decodeTypingPayload,
} from './ht-protocol/frame-decoder.util';
import { mapImJsonToEvent } from './ht-protocol/im-event-mapper.util';

export type ImConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

const HEARTBEAT_INTERVAL_MS = 30_000;

function decodeJwtUid(jwt: string): string | null {
  try {
    const base64 = jwt.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    if (!base64) return null;
    const decoded = JSON.parse(atob(base64)) as { uid?: number | string };
    return decoded.uid !== undefined ? String(decoded.uid) : null;
  } catch {
    return null;
  }
}

/**
 * Direct connection to the personal-messaging server (replaces the old `ImSocketService`,
 * which relayed a JSON event stream from jilalibff's own WebSocket). Owns the full
 * connect → login → heartbeat → message-loop lifecycle, session key, and reconnect state.
 * Ported from the reference client's `connect()` in connectwebsock.js and the
 * `onSessionReady`/offline-sync-trigger orchestration in scriptv2.js's `startwebsock()`.
 */
@Injectable({ providedIn: 'root' })
export class HtImConnectionService {
  private readonly auth = inject(AuthStore);
  private readonly authService = inject(AuthService);
  private readonly wsUrl = inject(IM_WS_URL);

  private readonly _events = signal<readonly ImEvent[]>([]);
  private readonly _status = signal<ImConnectionStatus>('disconnected');
  readonly events = this._events.asReadonly();
  readonly status = this._status.asReadonly();

  private sock: WebSocket | null = null;
  private wantsConnection = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private sessionKey: Uint8Array | null = null;
  private userId = '';

  isConnected = (): boolean => this.sock?.readyState === WebSocket.OPEN;

  connect(): void {
    if (this.sock || this.wantsConnection) return;
    this.wantsConnection = true;
    this.reconnectAttempt = 0;
    this.open();
  }

  disconnect(): void {
    this.wantsConnection = false;
    this.clearHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.sock) {
      const sock = this.sock;
      this.sock = null;
      sock.onopen = null;
      sock.onmessage = null;
      sock.onclose = null;
      sock.onerror = null;
      sock.close();
    }
    this.sessionKey = null;
    this._status.set('disconnected');
    this._events.set([]);
  }

  /** Sends a DM (text/image/gift/introduction/voice_room/live_link). Returns the packet's
   *  msgId (for delivery tracking via the matching message_ack event) or null if not
   *  connected. Pass `msgId` when the caller already minted one for an optimistic local
   *  echo (see MessagesStore.sendDm) so the eventual MSG-ACK correlates back to it instead
   *  of a freshly-generated id the caller never saw. */
  sendDm(
    peerId: number,
    payload: DmSendPayload,
    fromNickname: string,
    fromProfileTs: number,
    msgId?: string,
  ): string | null {
    if (!this.sock || this.sock.readyState !== WebSocket.OPEN) return null;
    const { packet, msgId: sentMsgId } = buildDmMessagePacket({
      payload,
      fromId: this.userId,
      toId: String(peerId),
      fromNickname,
      fromProfileTs,
      ...(msgId !== undefined ? { msgId } : {}),
    });
    this.sock.send(packet);
    return sentMsgId;
  }

  sendTyping(peerId: number, isTyping: boolean): void {
    if (!this.sock || this.sock.readyState !== WebSocket.OPEN) return;
    this.sock.send(buildTypingIndicatorPacket(this.userId, String(peerId), isTyping));
  }

  sendReadReceipt(peerId: number, msgId: string): void {
    if (!this.sock || this.sock.readyState !== WebSocket.OPEN) return;
    this.sock.send(buildReadReceiptPacket(this.userId, String(peerId), msgId));
  }

  private open(): void {
    this._status.set(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting');
    void this.connectInternal();
  }

  private async resolveImCredentials(): Promise<ImCredentials | null> {
    const cached = this.auth.getImCredentials();
    if (cached) return cached;
    try {
      const res = await firstValueFrom(this.authService.me());
      this.auth.login(res.user);
      return this.auth.getImCredentials();
    } catch {
      return null;
    }
  }

  private async connectInternal(): Promise<void> {
    const creds = await this.resolveImCredentials();
    if (!this.wantsConnection) return;
    if (!creds) {
      this._status.set('disconnected');
      this.wantsConnection = false;
      return;
    }
    const userId = decodeJwtUid(creds.jwt);
    if (!userId) {
      this._status.set('disconnected');
      this.wantsConnection = false;
      return;
    }
    this.userId = userId;

    const sock = new WebSocket(this.wsUrl);
    sock.binaryType = 'arraybuffer';
    this.sock = sock;

    sock.onopen = () => {
      if (this.sock !== sock) return;
      void this.performLogin(creds.jwt, creds.deviceId, creds.deviceModel);
    };
    sock.onmessage = (event: MessageEvent) => {
      if (this.sock !== sock) return;
      this.handleMessage(new Uint8Array(event.data as ArrayBuffer));
    };
    sock.onclose = () => {
      if (this.sock !== sock) return;
      this.clearHeartbeat();
      this.sessionKey = null;
      this.sock = null;
      this.scheduleReconnect();
    };
    sock.onerror = () => {
      this.pushEvent({ type: 'error', message: 'WebSocket error' });
    };
  }

  private async performLogin(jwt: string, deviceId: string, deviceModel: string): Promise<void> {
    const sock = this.sock;
    if (!sock) return;
    const apkSignature = await generateApkSignature(deviceId);
    if (this.sock !== sock || sock.readyState !== WebSocket.OPEN) return;
    sock.send(
      buildLoginPacket({
        userId: this.userId,
        jwt,
        deviceId,
        deviceModel,
        apkSignature,
        mobileOperator: 'Orange',
        operatorCountry: 'ma',
      }),
    );
    this.heartbeatTimer = setInterval(() => {
      if (this.sock?.readyState === WebSocket.OPEN) {
        this.sock.send(buildHeartbeatPacket(this.userId));
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private handleMessage(raw: Uint8Array): void {
    if (raw.byteLength < HEADER_LEN) return;
    const header = parseHeader(raw);
    const payload = raw.subarray(HEADER_LEN, HEADER_LEN + header.bodyLength);

    if (header.cmdId === CMD_MSG_ACK) {
      if (header.flag === FLAG_PUSH && this.sock) this.sock.send(buildAckPacket(raw));
      const decoded = decodeMsgAckPayload(payload, header.keyType, this.sessionKey);
      if (!decoded.isFailureAck) {
        this.pushEvent({
          type: 'message_ack',
          msgId: decoded.msgId,
          sequence: Number(decoded.sequence),
          prefix: decoded.prefix,
        });
      }
      return;
    }

    if (header.flag === FLAG_PUSH) {
      if (this.sock) this.sock.send(buildAckPacket(raw));
      const result = decodePushFrame(payload, this.sessionKey);
      if (result.kind === 'json') {
        const event = mapImJsonToEvent(result.json, header.fromId, Number(this.userId));
        if (event) this.pushEvent(event);
      } else if (result.kind === 'read_receipt') {
        this.pushEvent({ type: 'read_receipt', msgId: result.msgId });
      } else if (result.kind === 'new_message_notify' && result.lastId !== null && this.sock) {
        this.sock.send(
          buildOfflineSyncTriggerPacket({
            fromId: this.userId,
            lastId: result.lastId,
            cmdId: CMD_OFFLINE_SYNC_TRIGGER_FIRST,
          }),
        );
      }
      return;
    }

    if (header.flag === FLAG_TYPING && header.cmdId === CMD_TYPING_INDICATOR) {
      const isTyping = decodeTypingPayload(payload, header.keyType, this.sessionKey);
      this.pushEvent({ type: 'typing_indicator', fromUserId: String(header.fromId), isTyping });
      return;
    }

    if (header.flag === FLAG_SERVER_RESPONSE && raw.byteLength > HEADER_LEN) {
      if (header.cmdId === CMD_HEARTBEAT_ACK) return;

      const data = decodeLoginFrame(payload);
      if (!data) return;

      if (header.cmdId === CMD_OFFLINE_SYNC_RESPONSE) {
        this.handleOfflineSyncResponse(data);
        return;
      }

      this.handleLoginResponse(data);
    }
  }

  private handleOfflineSyncResponse(data: Record<string, unknown>): void {
    const inner = data['data'] as Record<string, unknown> | undefined;
    if (!inner) return;

    const lastId = inner['last_id'];
    const packetList = inner['packet_list'];
    if (typeof lastId === 'number' && Array.isArray(packetList) && packetList.length > 0 && this.sock) {
      this.sock.send(
        buildOfflineSyncTriggerPacket({ fromId: this.userId, lastId, cmdId: CMD_OFFLINE_SYNC_TRIGGER_PAGE }),
      );
    }

    if (!Array.isArray(packetList)) return;
    for (const entry of packetList) {
      if (typeof entry !== 'string') continue;
      const decoded = decodeOfflinePacket(entry, this.sessionKey);
      if (decoded.kind === 'json') {
        const fromId = decoded.json['_fromId'];
        const event = mapImJsonToEvent(decoded.json, typeof fromId === 'number' ? fromId : 0, Number(this.userId));
        if (event) this.pushEvent(event);
      } else if (decoded.kind === 'read_receipt') {
        this.pushEvent({ type: 'read_receipt', msgId: decoded.msgId });
      } else if (decoded.kind === 'typing_indicator') {
        this.pushEvent({ type: 'typing_indicator', fromUserId: String(decoded.fromId), isTyping: true });
      }
    }
  }

  /** Handles a plain login-response frame: captures the session key, kicks off the two
   *  post-login offline-sync trigger packets (mirroring scriptv2.js's `onSessionReady`,
   *  which always starts from last_id 0 with two specific header shapes — not from a
   *  last_id embedded in the login response itself, which doesn't carry one), persists a
   *  rotated JWT if the server issued one, and handles banned/session-mismatch statuses. */
  private handleLoginResponse(data: Record<string, unknown>): void {
    const inner = data['data'] as Record<string, unknown> | undefined;
    const status = data['status'];

    if (inner) {
      const sessionKeyStr = inner['session_key'];
      if (typeof sessionKeyStr === 'string') {
        this.sessionKey = new TextEncoder().encode(sessionKeyStr);
        this.reconnectAttempt = 0;
        this._status.set('connected');

        const newJwt = inner['jwt'];
        if (typeof newJwt === 'string' && newJwt.length > 0) {
          this.auth.updateImJwt(newJwt);
        }

        if (this.sock) {
          this.sock.send(
            buildOfflineSyncTriggerPacket({
              fromId: this.userId,
              lastId: 0,
              cmdId: CMD_OFFLINE_SYNC_TRIGGER_FIRST,
              flag: 0xf0,
              version: 4,
              keyType: 0,
              termType: 1,
            }),
          );
          this.sock.send(
            buildOfflineSyncTriggerPacket({
              fromId: this.userId,
              lastId: 0,
              cmdId: CMD_OFFLINE_SYNC_TRIGGER_PAGE,
              flag: 0xf2,
              version: 4,
              keyType: 0,
              termType: 1,
            }),
          );
        }
      }
    }

    if (status === 2) {
      this.pushEvent({ type: 'account_status', status: 'banned' });
      this.disconnect();
    } else if (status === 105) {
      this.pushEvent({ type: 'account_status', status: 'session_mismatch' });
      this.disconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.wantsConnection || this.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      this._status.set('disconnected');
      this._events.set([]);
      this.wantsConnection = false;
      return;
    }
    this._status.set('reconnecting');
    const delay = backoffDelay(this.reconnectAttempt);
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private pushEvent(event: ImEvent): void {
    this._events.update((events) => [...events, event]);
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`

Expected: errors only in files that still import the deleted `im-socket.service.ts` (fixed in Task 11) — no errors within `ht-im-connection.service.ts` itself.

- [ ] **Step 4: Commit**

```bash
git add src/app/core/realtime/ht-im-connection.service.ts src/app/core/realtime/im-socket.service.ts
git commit -m "feat(realtime): add HtImConnectionService, direct IM connection replacing the JSON relay"
```

---

### Task 11: Wire `HtImConnectionService` into `ImBootstrapService` and the module index

**Files:**
- Modify: `src/app/core/realtime/im-bootstrap.service.ts`
- Modify: `src/app/core/realtime/im-bootstrap.service.spec.ts`
- Modify: `src/app/core/realtime/index.ts`

**Interfaces:**
- Consumes: `HtImConnectionService` (Task 10)

- [ ] **Step 1: Update the import and injection in `im-bootstrap.service.ts`**

Change:

```typescript
import { ImSocketService } from './im-socket.service';
```

to:

```typescript
import { HtImConnectionService } from './ht-im-connection.service';
```

Change:

```typescript
  private readonly imSocket = inject(ImSocketService);
```

to:

```typescript
  private readonly imSocket = inject(HtImConnectionService);
```

No other lines in `im-bootstrap.service.ts` change — the rest of the file only calls `this.imSocket.connect()`, `.disconnect()`, and `.events()`, all of which `HtImConnectionService` implements identically.

- [ ] **Step 2: Update the existing spec's import**

In `im-bootstrap.service.spec.ts`, change:

```typescript
import { ImSocketService } from './im-socket.service';
```

to:

```typescript
import { HtImConnectionService } from './ht-im-connection.service';
```

And change both:

```typescript
  let imSocket: ImSocketService;
```

and:

```typescript
    imSocket = TestBed.inject(ImSocketService);
```

to use `HtImConnectionService` in place of `ImSocketService` in both lines.

- [ ] **Step 3: Update `index.ts` exports**

In `src/app/core/realtime/index.ts`, change:

```typescript
export { ImSocketService } from './im-socket.service';
```

to:

```typescript
export { HtImConnectionService } from './ht-im-connection.service';
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`

Expected: no errors.

- [ ] **Step 5: Run the existing test suite**

Run: `npx ng test --watch=false`

Expected: `im-bootstrap.service.spec.ts` passes (it was already testing `ImBootstrapService`'s event-handling behavior against a mocked socket service — that behavior is unchanged, only the mocked class name changed).

- [ ] **Step 6: Commit**

```bash
git add src/app/core/realtime/im-bootstrap.service.ts src/app/core/realtime/im-bootstrap.service.spec.ts src/app/core/realtime/index.ts
git commit -m "refactor(realtime): wire ImBootstrapService to HtImConnectionService"
```

---

### Task 12: `MessagesStore` — send directly through `HtImConnectionService`

**Files:**
- Modify: `src/app/features/messages/store/messages.store.ts`

**Interfaces:**
- Consumes: `HtImConnectionService.sendDm/sendTyping/sendReadReceipt` (Task 10); `DmSendPayload`, `DmSendGift` from `@core/realtime/ht-protocol/packet-framer.util` (Task 4); `AuthStore` (Task 8)

- [ ] **Step 1: Replace the HTTP-POST send path with direct calls**

Remove these imports:

```typescript
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '@core/tokens/api-base-url.token';
```

and the `takeUntilDestroyed` import if `destroyRef` becomes otherwise unused (it is — verify no other use in the file before removing).

Add:

```typescript
import { AuthStore } from '@core/auth/auth.store';
import { HtImConnectionService } from '@core/realtime/ht-im-connection.service';
import type { DmSendGift, DmSendPayload } from '@core/realtime/ht-protocol/packet-framer.util';
```

Replace the field declarations:

```typescript
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/im/messages`;
  private readonly destroyRef = inject(DestroyRef);
```

with:

```typescript
  private readonly htIm = inject(HtImConnectionService);
  private readonly authStore = inject(AuthStore);
```

(`DestroyRef` import at the top of the file becomes unused too — remove it from the `@angular/core` import list, keeping `computed, effect, inject, signal, Service`.)

Replace `sendTyping`, `sendDm`, `markReadForLastInbound`, and `private post(...)`:

```typescript
  sendTyping(peerId: number, isTyping: boolean): void {
    this.htIm.sendTyping(peerId, isTyping);
  }

  sendDm(peerId: number, kind: DmKind, fields: Partial<SendDmBody>): void {
    const payload = this.toSendPayload(kind, fields);
    if (!payload) return;
    const self = this.authStore.user();
    // fields.msgId is the id the caller already minted for its optimistic local echo
    // (see dm.model.ts's `delivery` doc) — must be threaded through so the MSG-ACK this
    // send eventually receives correlates back to that same local message.
    this.htIm.sendDm(peerId, payload, self?.nickname ?? '', 0, fields.msgId);
  }

  markReadForLastInbound(peerId: number, msgId: string): void {
    this.htIm.sendReadReceipt(peerId, msgId);
  }

  private toSendPayload(kind: DmKind, fields: Partial<SendDmBody>): DmSendPayload | null {
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`

Expected: no errors in `messages.store.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/messages/store/messages.store.ts
git commit -m "refactor(messages): send DMs/typing/read-receipts directly via HtImConnectionService"
```

---

### Task 13: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full frontend typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`

Expected: no errors anywhere in the project.

- [ ] **Step 2: Frontend production build**

Run: `npm run build`

Expected: build succeeds with no errors (warnings about bundle size from adding `pako` are acceptable).

- [ ] **Step 3: Backend build**

Run: `cd /home/mohammed/Desktop/JilaliTalk/jilalibff && ./gradlew build -x test`

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 4: Manual smoke test**

Run the frontend dev server (`npm start`) against the backend (`./gradlew run` in jilalibff, or however it's normally started), log in, open the Messages feature, and confirm: the connection reaches `status() === 'connected'` (no more relay through jilalibff's old `/ws/im`), an existing conversation's history appears (offline sync), sending a text message shows the ✓ delivered mark after the MSG-ACK arrives, and typing indicators/read receipts round-trip with a second test account if available.

- [ ] **Step 5: Report results**

If Step 4 surfaces a protocol mismatch (e.g. a field name or cmdId that doesn't match the live server), fix it in the relevant `ht-protocol/*.util.ts` file from Tasks 2–6 and re-run Steps 1–4 — do not patch around it in `ht-im-connection.service.ts`, since the codec layer is meant to be the single place that encodes wire-format knowledge.
