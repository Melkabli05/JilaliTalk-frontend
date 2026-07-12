// src/app/core/realtime/ht-im-connection.service.ts
import { Injectable, signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
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
  CMD_HEARTBEAT,
  CMD_HEARTBEAT_ACK,
  CMD_LOGIN,
  CMD_MSG_ACK,
  CMD_OFFLINE_SYNC_RESPONSE,
  CMD_OFFLINE_SYNC_TRIGGER_FIRST,
  CMD_OFFLINE_SYNC_TRIGGER_PAGE,
  CMD_PRIVATE_MSG,
  CMD_READ_RECEIPT,
  CMD_TYPING_INDICATOR,
  FLAG_ACK,
  FLAG_CLIENT_REQUEST,
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

const CMD_NAMES: Record<number, string> = {
  [CMD_LOGIN]: 'LOGIN',
  [CMD_HEARTBEAT]: 'HEARTBEAT',
  [CMD_HEARTBEAT_ACK]: 'HEARTBEAT_ACK',
  [CMD_PRIVATE_MSG]: 'PRIVATE_MSG',
  [CMD_MSG_ACK]: 'MSG_ACK',
  [CMD_READ_RECEIPT]: 'READ_RECEIPT',
  [CMD_TYPING_INDICATOR]: 'TYPING_INDICATOR',
  [CMD_OFFLINE_SYNC_TRIGGER_FIRST]: 'OFFLINE_SYNC_TRIGGER_FIRST',
  [CMD_OFFLINE_SYNC_TRIGGER_PAGE]: 'OFFLINE_SYNC_TRIGGER_PAGE',
  [CMD_OFFLINE_SYNC_RESPONSE]: 'OFFLINE_SYNC_RESPONSE',
};

const FLAG_NAMES: Record<number, string> = {
  [FLAG_CLIENT_REQUEST]: 'CLIENT_REQUEST',
  [FLAG_PUSH]: 'PUSH',
  [FLAG_ACK]: 'ACK',
  [FLAG_TYPING]: 'TYPING',
  [FLAG_SERVER_RESPONSE]: 'SERVER_RESPONSE',
};

function describeCmd(cmdId: number): string {
  return CMD_NAMES[cmdId] ?? `cmd ${cmdId}`;
}

function describeFlag(flag: number): string {
  return FLAG_NAMES[flag] ?? `flag 0x${flag.toString(16)}`;
}

function describeImEvent(event: ImEvent): string {
  switch (event.type) {
    case 'text_message':
      return `text message from ${event.fromNickname || event.fromUserId}: "${event.text}"`;
    case 'image_message':
      return `image message from ${event.fromNickname || event.fromUserId}`;
    case 'gift_message':
      return `gift x${event.count} from ${event.fromNickname || event.fromUserId}`;
    case 'introduction_message':
      return `introduction from ${event.fromNickname || event.fromUserId}`;
    case 'voice_room_shared':
      return `voice room shared by ${event.fromNickname}: ${event.cname}`;
    case 'live_room_shared':
      return `live room shared by ${event.fromNickname}: ${event.cname}`;
    case 'group_message':
      return `group message in ${event.roomName} from ${event.senderName}: ${event.text}`;
    case 'typing_indicator':
      return `${event.fromUserId} ${event.isTyping ? 'is typing' : 'stopped typing'}`;
    case 'read_receipt':
      return `read receipt for msgId ${event.msgId}`;
    case 'message_ack':
      return `delivered msgId ${event.msgId}`;
    case 'follow':
      return `${event.nickname} followed you (status ${event.status})`;
    case 'profile_visit':
      return `profile visit from ${event.nickname ?? event.visitorUserId}`;
    case 'stage_invite':
      return `stage invite from ${event.userId} in ${event.cname}`;
    case 'mod_invite':
      return `mod invite from ${event.userId} in ${event.cname}`;
    case 'mod_accepted':
      return `${event.userId} accepted mod`;
    case 'mod_removed':
      return `${event.userId} removed as mod`;
    case 'mod_unmuted':
      return `${event.userId} unmuted`;
    case 'account_status':
      return `account status: ${event.status}`;
    case 'error':
      return `error: ${event.message}`;
    case 'connection-state':
      return `connection state: ${event.state}`;
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
    this.log('connect() requested');
    this.wantsConnection = true;
    this.reconnectAttempt = 0;
    this.open();
  }

  disconnect(): void {
    this.log('disconnect() requested');
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
    this.log('send dm', { kind: payload.kind, peerId, msgId: sentMsgId });
    this.sock.send(new Uint8Array(packet));
    return sentMsgId;
  }

  sendTyping(peerId: number, isTyping: boolean): void {
    if (!this.sock || this.sock.readyState !== WebSocket.OPEN) return;
    this.log('send typing', { peerId, isTyping });
    this.sock.send(new Uint8Array(buildTypingIndicatorPacket(this.userId, String(peerId), isTyping)));
  }

  sendReadReceipt(peerId: number, msgId: string): void {
    if (!this.sock || this.sock.readyState !== WebSocket.OPEN) return;
    this.log('send read receipt', { peerId, msgId });
    this.sock.send(new Uint8Array(buildReadReceiptPacket(this.userId, String(peerId), msgId)));
  }

  private open(): void {
    const status = this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting';
    this._status.set(status);
    this.log('status ->', status);
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
      this.log('no IM credentials available, aborting connect');
      this._status.set('disconnected');
      this.wantsConnection = false;
      return;
    }
    const userId = decodeJwtUid(creds.jwt);
    if (!userId) {
      this.log('could not decode uid from jwt, aborting connect');
      this._status.set('disconnected');
      this.wantsConnection = false;
      return;
    }
    this.userId = userId;
    const wsUrl = `${this.wsUrl}?userid=${userId}`;
    this.log('opening socket', wsUrl);

    const sock = new WebSocket(wsUrl);
    sock.binaryType = 'arraybuffer';
    this.sock = sock;

    sock.onopen = () => {
      if (this.sock !== sock) return;
      this.log('socket open, sending login packet');
      void this.performLogin(creds.jwt, creds.deviceId, creds.deviceModel);
    };
    sock.onmessage = (event: MessageEvent) => {
      if (this.sock !== sock) return;
      this.handleMessage(new Uint8Array(event.data as ArrayBuffer));
    };
    sock.onclose = () => {
      if (this.sock !== sock) return;
      this.log('socket closed');
      this.clearHeartbeat();
      this.sessionKey = null;
      this.sock = null;
      this.scheduleReconnect();
    };
    sock.onerror = () => {
      this.log('socket error');
      this.pushEvent({ type: 'error', message: 'WebSocket error' });
    };
  }

  private async performLogin(jwt: string, deviceId: string, deviceModel: string): Promise<void> {
    const sock = this.sock;
    if (!sock) return;
    const apkSignature = await generateApkSignature(deviceId);
    if (this.sock !== sock || sock.readyState !== WebSocket.OPEN) return;
    sock.send(
      new Uint8Array(
        buildLoginPacket({
          userId: this.userId,
          jwt,
          deviceId,
          deviceModel,
          apkSignature,
          mobileOperator: 'Orange',
          operatorCountry: 'ma',
        }),
      ),
    );
    this.heartbeatTimer = setInterval(() => {
      if (this.sock?.readyState === WebSocket.OPEN) {
        this.sock.send(new Uint8Array(buildHeartbeatPacket(this.userId)));
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private handleMessage(raw: Uint8Array): void {
    if (raw.byteLength < HEADER_LEN) return;
    const header = parseHeader(raw);
    this.log(`recv ${describeFlag(header.flag)} / ${describeCmd(header.cmdId)}, ${header.bodyLength} bytes`);
    const payload = raw.subarray(HEADER_LEN, HEADER_LEN + header.bodyLength);

    if (header.cmdId === CMD_MSG_ACK) {
      if (header.flag === FLAG_PUSH && this.sock) this.sock.send(new Uint8Array(buildAckPacket(raw)));
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
      if (this.sock) this.sock.send(new Uint8Array(buildAckPacket(raw)));
      const result = decodePushFrame(payload, this.sessionKey);
      if (result.kind === 'json') {
        const event = mapImJsonToEvent(result.json, header.fromId, Number(this.userId));
        if (event) this.pushEvent(event);
      } else if (result.kind === 'read_receipt') {
        this.pushEvent({ type: 'read_receipt', msgId: result.msgId });
      } else if (result.kind === 'new_message_notify' && result.lastId !== null && this.sock) {
        this.sock.send(
          new Uint8Array(
            buildOfflineSyncTriggerPacket({
              fromId: this.userId,
              lastId: result.lastId,
              cmdId: CMD_OFFLINE_SYNC_TRIGGER_FIRST,
            }),
          ),
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
        new Uint8Array(
          buildOfflineSyncTriggerPacket({ fromId: this.userId, lastId, cmdId: CMD_OFFLINE_SYNC_TRIGGER_PAGE }),
        ),
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
        this.log('status -> connected, session key captured');

        const newJwt = inner['jwt'];
        if (typeof newJwt === 'string' && newJwt.length > 0) {
          this.auth.updateImJwt(newJwt);
        }

        if (this.sock) {
          this.sock.send(
            new Uint8Array(
              buildOfflineSyncTriggerPacket({
                fromId: this.userId,
                lastId: 0,
                cmdId: CMD_OFFLINE_SYNC_TRIGGER_FIRST,
                flag: 0xf0,
                version: 4,
                keyType: 0,
                termType: 1,
              }),
            ),
          );
          this.sock.send(
            new Uint8Array(
              buildOfflineSyncTriggerPacket({
                fromId: this.userId,
                lastId: 0,
                cmdId: CMD_OFFLINE_SYNC_TRIGGER_PAGE,
                flag: 0xf2,
                version: 4,
                keyType: 0,
                termType: 1,
              }),
            ),
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
      this.log('giving up reconnecting');
      this._status.set('disconnected');
      this._events.set([]);
      this.wantsConnection = false;
      return;
    }
    this._status.set('reconnecting');
    const delay = backoffDelay(this.reconnectAttempt);
    this.log('scheduling reconnect attempt', this.reconnectAttempt + 1, 'in', delay, 'ms');
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
    this.log(describeImEvent(event), event);
    this._events.update((events) => [...events, event]);
  }

  private log(...args: unknown[]): void {
    if (environment.production) return;
    console.log('[websocket]', ...args);
  }
}
