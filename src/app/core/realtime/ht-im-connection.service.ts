// src/app/core/realtime/ht-im-connection.service.ts
import { Injectable, signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore, type ImCredentials } from '@core/auth/auth.store';
import { AuthService } from '@core/auth/auth.service';
import { IM_WS_URL } from '@core/tokens/im-ws-url.token';
import { backoffDelay, MAX_RECONNECT_ATTEMPTS } from './reconnecting-socket-base';
import { logRealtime } from './dev-log.util';
import type { ImEvent } from './im-events';
import { generateApkSignature } from './ht-protocol/apk-signature.util';
import { describeCmd, describeFlag, describeImEvent } from './ht-protocol/im-event-description.util';
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
  type PacketHeader,
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
    logRealtime('connect() requested');
    this.wantsConnection = true;
    this.reconnectAttempt = 0;
    this.open();
  }

  disconnect(): void {
    logRealtime('disconnect() requested');
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
    logRealtime('send dm', { kind: payload.kind, peerId, msgId: sentMsgId });
    this.sock.send(new Uint8Array(packet));
    return sentMsgId;
  }

  sendTyping(peerId: number, isTyping: boolean): void {
    if (!this.sock || this.sock.readyState !== WebSocket.OPEN) return;
    logRealtime('send typing', { peerId, isTyping });
    this.sock.send(new Uint8Array(buildTypingIndicatorPacket(this.userId, String(peerId), isTyping)));
  }

  sendReadReceipt(peerId: number, msgId: string): void {
    if (!this.sock || this.sock.readyState !== WebSocket.OPEN) return;
    logRealtime('send read receipt', { peerId, msgId });
    this.sock.send(new Uint8Array(buildReadReceiptPacket(this.userId, String(peerId), msgId)));
  }

  private open(): void {
    const status = this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting';
    this._status.set(status);
    logRealtime('status ->', status);
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
      logRealtime('no IM credentials available, aborting connect');
      this._status.set('disconnected');
      this.wantsConnection = false;
      return;
    }
    const userId = decodeJwtUid(creds.jwt);
    if (!userId) {
      logRealtime('could not decode uid from jwt, aborting connect');
      this._status.set('disconnected');
      this.wantsConnection = false;
      return;
    }
    this.userId = userId;
    const wsUrl = `${this.wsUrl}?userid=${userId}`;
    logRealtime('opening socket', wsUrl);

    const sock = new WebSocket(wsUrl);
    sock.binaryType = 'arraybuffer';
    this.sock = sock;

    sock.onopen = () => {
      if (this.sock !== sock) return;
      logRealtime('socket open, sending login packet');
      void this.performLogin(creds.jwt, creds.deviceId, creds.deviceModel);
    };
    sock.onmessage = (event: MessageEvent) => {
      if (this.sock !== sock) return;
      this.handleMessage(new Uint8Array(event.data as ArrayBuffer));
    };
    sock.onclose = () => {
      if (this.sock !== sock) return;
      logRealtime('socket closed');
      this.clearHeartbeat();
      this.sessionKey = null;
      this.sock = null;
      this.scheduleReconnect();
    };
    sock.onerror = () => {
      logRealtime('socket error');
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
    logRealtime(`recv ${describeFlag(header.flag)} / ${describeCmd(header.cmdId)}, ${header.bodyLength} bytes`);
    const payload = raw.subarray(HEADER_LEN, HEADER_LEN + header.bodyLength);

    if (header.cmdId === CMD_MSG_ACK) {
      this.handleMsgAckFrame(raw, header, payload);
      return;
    }

    if (header.flag === FLAG_PUSH) {
      this.handlePushFrame(raw, header, payload);
      return;
    }

    if (header.flag === FLAG_TYPING && header.cmdId === CMD_TYPING_INDICATOR) {
      this.handleTypingFrame(header, payload);
      return;
    }

    if (header.flag === FLAG_SERVER_RESPONSE && raw.byteLength > HEADER_LEN) {
      this.handleServerResponseFrame(header, payload);
    }
  }

  private handleMsgAckFrame(raw: Uint8Array, header: PacketHeader, payload: Uint8Array): void {
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
  }

  private handlePushFrame(raw: Uint8Array, header: PacketHeader, payload: Uint8Array): void {
    if (this.sock) this.sock.send(new Uint8Array(buildAckPacket(raw)));
    const result = decodePushFrame(payload, this.sessionKey);
    if (result.kind === 'json') {
      logRealtime('[deserialize] push frame', result.json);
      const event = mapImJsonToEvent(result.json, header.fromId, Number(this.userId));
      if (event) {
        this.pushEvent(event);
      } else {
        logRealtime('[deserialize] push frame did not map to an ImEvent', result.json);
      }
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
  }

  private handleTypingFrame(header: PacketHeader, payload: Uint8Array): void {
    const isTyping = decodeTypingPayload(payload, header.keyType, this.sessionKey);
    this.pushEvent({ type: 'typing_indicator', fromUserId: String(header.fromId), isTyping });
  }

  private handleServerResponseFrame(header: PacketHeader, payload: Uint8Array): void {
    if (header.cmdId === CMD_HEARTBEAT_ACK) return;

    const data = decodeLoginFrame(payload);
    if (!data) return;

    if (header.cmdId === CMD_OFFLINE_SYNC_RESPONSE) {
      this.handleOfflineSyncResponse(data);
      return;
    }

    this.handleLoginResponse(data);
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
        logRealtime('[deserialize] offline-sync entry', decoded.json);
        const fromId = decoded.json['_fromId'];
        const event = mapImJsonToEvent(decoded.json, typeof fromId === 'number' ? fromId : 0, Number(this.userId));
        if (event) {
          this.pushEvent(event);
        } else {
          logRealtime('[deserialize] offline-sync entry did not map to an ImEvent', decoded.json);
        }
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
        logRealtime('status -> connected, session key captured');

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
      logRealtime('giving up reconnecting');
      this._status.set('disconnected');
      this._events.set([]);
      this.wantsConnection = false;
      return;
    }
    this._status.set('reconnecting');
    const delay = backoffDelay(this.reconnectAttempt);
    logRealtime('scheduling reconnect attempt', this.reconnectAttempt + 1, 'in', delay, 'ms');
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
    logRealtime(describeImEvent(event), event);
    this._events.update((events) => [...events, event]);
  }
}
