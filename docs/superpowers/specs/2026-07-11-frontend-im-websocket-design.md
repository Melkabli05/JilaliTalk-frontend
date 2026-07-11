# Move private-messaging WebSocket protocol to the Angular frontend

## Context

Private 1:1 messaging (DMs) currently works like this: the Angular frontend opens a JSON
WebSocket to jilalibff's `/ws/im`; jilalibff internally holds one binary WebSocket connection
to the real messaging server (`api-global.hellotalk8.com`), reimplementing a reverse-engineered
protocol (20-byte packet framing, QQ-TEA encryption, HMAC-based Android APK signature spoofing,
zlib-compressed JSON bodies) and relays a simplified JSON event stream to the browser. Sending
(text/image/gift DMs, typing, read receipts) goes the other way: the frontend POSTs to jilalibff
REST endpoints, which push bytes onto its internally-held socket.

This work moves that entire protocol client into the browser, so each frontend session holds
its own direct connection to the messaging server instead of going through jilalibff as a relay.
jilalibff currently runs as a single-tenant BFF (one hardcoded JWT/deviceId for the whole app,
no real per-user login) — this migration doesn't fix that, it just relocates where the existing
hardcoded credentials are consumed from (backend config → `/auth/me` response → frontend
localStorage).

**Source of truth for protocol behavior**: the old vanilla-JS reference client, not jilalibff's
Java port —
`/home/mohammed/Desktop/JilaliTalk/old_hellotalk/project/v1/connectwebsock.js`,
`/home/mohammed/Desktop/JilaliTalk/old_hellotalk/project/v1/prvmsg/prvgmsgpacket.js`,
plus the private-messaging-relevant slices of
`/home/mohammed/Desktop/JilaliTalk/old_hellotalk/project/v1/scriptv2.js`.

**Scope**: private 1:1 messaging only (text, image, gift, introduction, voice_room-share,
live_link-share, typing, read receipts, offline history sync, message-ack delivery status).
Explicitly **out of scope**: room/LiveHub real-time (`fireRoomWebSocket`, Agora, whiteboard,
gifts UI, RTM group chat / cmdId `29968`, `buildRoomNotifyPacket`) — these stay on their
existing implementation.

## Architecture

```
core/realtime/
├── ht-protocol/                       # pure functions — no Angular DI, no `this`
│   ├── apk-signature.util.ts          # HMAC-SHA256 signature generator (ported from _APK_SIG)
│   ├── qqtea.util.ts                  # QQ-TEA encrypt/decrypt (byte-for-byte port of QQTEA)
│   ├── packet-framer.util.ts          # 20-byte header build/parse + all outbound packet builders
│   ├── frame-decoder.util.ts          # inbound frame parsing/dispatch (0xF1/0xF2/0xF5), decrypt, decompress
│   └── im-event-mapper.util.ts        # decoded HelloTalk payload → ImEvent
├── ht-im-connection.service.ts        # NEW — replaces im-socket.service.ts's role
├── im-events.ts                       # unchanged (ImEvent union already fits)
├── im-bootstrap.service.ts            # unchanged except the injected type/import
└── ...
```

`ImSocketService` is renamed to `HtImConnectionService` — it stops being "a socket to our own
BFF" and becomes "the direct connection to the messaging server," a real change in
responsibility. It keeps the exact same public shape consumers rely on
(`events`, `status`, `connect()`, `disconnect()`, `isConnected()`), so `ImBootstrapService`
only needs an import/rename touch-up, and gains send methods (`sendText`, `sendImage`,
`sendGift`, `sendIntroduction`, `sendTyping`, `sendReadReceipt`) that `MessagesStore` calls
directly in place of its current HTTP POSTs.

It does **not** extend `ReconnectingSocketBase` — that base hard-codes "text frame →
`JSON.parse`" in `wireSocket()`, which doesn't fit a binary protocol with a login handshake
gating "connected" status. It reuses the already-exported `backoffDelay`/`MAX_RECONNECT_ATTEMPTS`
helpers directly for the same jittered-backoff behavior without inheriting a mismatched contract.

## Protocol coverage (must-preserve checklist)

### Outbound (`packet-framer.util.ts`)
- `buildPacket` — generic 20-byte header + payload
- Login packet, cmdId `0x1025` — full payload: `jwt, mobile_operator, operator_country,
  android_apk_signature, app_version, background_reconnect, channel, client_lang,
  current_version, device_detail, device_id, is_version_update, net_type, os_lang, os_version,
  terminal_type`
- Heartbeat, cmdId `0x9001`, every 30s — 12-byte body (uid + timestamp)
- `SendAck`, flag `0xF3` — mirrors seq/from/to from the incoming packet, `forceCmdId` support
- `sendReadReceipt`, cmdId `0x4015`
- `sendTypingIndicator`, cmdId `16407`
- `sendOfflineMessageTrigger` — paged sync via `last_id`, cmdId `16453`/`29967` triggers
- `packetPRIVATEMSG`-equivalent, cmdId `16385`, zlib-compressed JSON body, for message kinds
  `text`, `image`, `live_link`, `voice_room`, `introduction`, `send_gift` (matches
  `DmMessageType`). `sendGift(fromId, toId, gift)` takes real gift data as parameters —
  the old code hardcoded one specific test gift inline; that hardcoding is not preserved.
- `buildRoomNotifyPacket` excluded (room-channel signaling, out of scope).

### Inbound (`frame-decoder.util.ts`)
- Header parse: packetType (byte 0), cmdId (u16 @4), payloadLen (u32 @16)
- cmdId `16386` (MSG ACK): ACK-if-`0xF2`, QQTEA-decrypt if keyType set, inflate if zlib magic,
  `decodeCmd16386` incl. its UUID-regex fallback and short-buffer "failure ack" fallback →
  `message_ack` event
- packetType `0xF2` (push): always ACK first, QQTEA-decrypt, dispatch on first byte —
  `0x78` zlib, `0x7B` raw JSON, `0x25` read receipt (bytes 2–38 = msgId) → `read_receipt`,
  `0x08` binary "new message" notify (UUID-regex or manual varint field-1 parse to extract
  msgId, split on `_` to derive `last_id`, trigger offline sync cmdId `29967`) — then route
  parsed JSON by `msg_type`/`notify_type` into the matching `ImEvent`
- packetType `0xF5` + cmdId `16407`: typing indicator — decrypt/inflate, parse status u16 @
  offset 4, plus the "weird short length" heuristic fallback from the old code
- packetType `0xF1`: cmdId `0x9002` = pong (log only); cmdId `16454` = offline sync response —
  page through remaining history via `last_id` until exhausted, decode each base64
  `packet_list` entry (`decodeOfflinePacket`, incl. its gzip/zlib/raw-JSON/read-receipt/typing
  sub-cases), route each the same as a live event; anything else = login response — capture
  `session_key`, emit session-ready, handle `status === 2` (banned) / `status === 105`
  (session mismatch) by closing and emitting `account_status`
- cmdId `29968` (group sync) intentionally excluded (RTM group chat, out of scope).

### Event field sourcing (`im-event-mapper.util.ts`)
`fromNickname` comes straight from the payload's `from_nickname` field — the sender
self-reports it in every message body (`sendTextMessage`'s `bodyjson.msg.from_nickname`), so
no lookup is needed. `fromHeadUrl` is **not** present in the payload; it's left `undefined` on
the mapped event, and `ImBootstrapService`'s existing `EnrichBatchQueue`/`UserInfoService`
pattern (already wired for `profile_visit`/`follow`/`gift_message`) resolves it the same way
it does today — no new enrichment path needed.

### Crypto/encoding
- `qqtea.util.ts` — full TEA cipher, encrypt + decrypt, byte-for-byte port of `QQTEA`
- `apk-signature.util.ts` — HMAC-SHA256 via native `crypto.subtle` (no CryptoJS fallback needed)
- `pako` (new dependency) for inflate/deflate, matching the browser branch of the old code

### Connection lifecycle (`ht-im-connection.service.ts`)
Owns `activeSessionKey`, `heartbeatInterval`, and reconnect state; same
connect → login → heartbeat → message-loop lifecycle as the old `connect()`, as class methods
emitting into `events`/`status` signals instead of `window.*` globals and callbacks.
`wss://` scheme (fixed from the old code's `https://`, which native `WebSocket` rejects).

## Auth/session sourcing

`jilalibff`'s `/auth/me` (and `/auth/login`, `/auth/register`) response gains `imJwt`,
`imDeviceId`, `imDeviceModel`, sourced from the existing hardcoded `JilaliProperties` config
(`default-auth-token`, `LIVEHUB_DEVICE_ID`, `LIVEHUB_DEVICE_MODEL` — no new secret material,
just exposing what's already configured). Frontend `AuthUser` gains the same optional fields;
`AuthService` persists them to `StorageService` (localStorage) whenever a response includes
them. `HtImConnectionService.connect()` reads from storage first; if absent, it triggers an
`AuthService.me()` refetch automatically before connecting.

## Config

- New `imWsUrl` field in `environment.ts` / `environment.production.ts` (the messaging
  server's `wss://` endpoint), with an `IM_WS_URL` injection token alongside `WS_BASE_URL`.
- Protocol constants (`app_version`, `channel`, `client_lang`, `os_lang`, `os_version`,
  `current_version`, HMAC key, APK signature cert) live as constants in `ht-protocol/` —
  these are fixed to the spoofed client version, not deploy-target config, so they don't
  belong in `environment.ts`.
- `mobile_operator`/`operator_country` default to `'Orange'`/`'ma'` exactly as today — no
  IP-geo lookup added.

## Security note

The HMAC key and APK signature cert are already committed in plaintext in jilalibff's Java
source (`ApkSignatureGenerator.java`), so shipping them in the frontend bundle relocates an
already-public constant rather than creating a new exposure.

## Explicitly out of scope

- Room/LiveHub real-time, Agora voice/video, whiteboard, gifts UI, RTM group chat
  (`fireRoomWebSocket`, `connectAgora`, cmdId `29968`, `buildRoomNotifyPacket`) — unchanged.
- Per-user HelloTalk-account login flow (`htDoLogin`/`initAuth` family) — out of scope; the
  single hardcoded account credential continues to be used, just relocated per "Auth/session
  sourcing" above.
- IP-geo lookup for `mobile_operator`/`operator_country`.
