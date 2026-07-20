// src/app/core/realtime/ht-im-connection.service.ts
import { Service, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '@core/tokens/api-base-url.token';
import { WS_BASE_URL } from '@core/tokens/ws-base-url.token';
import { backoffDelay, MAX_RECONNECT_ATTEMPTS, type ConnectionStatus } from './reconnect-backoff.util';
import { logRealtime } from './dev-log.util';
import type { ImEvent } from './im-events';
import type { DmSendPayload } from './dm-send-payload.model';

/**
 * Relay connection to jilalibff's `/ws/im` — the BFF owns the binary HelloTalk `ht_im/sock`
 * protocol (framing, QQ-TEA, login/heartbeat/offline-sync) entirely server-side and forwards
 * decoded events here as plain JSON text frames, one `ImEvent` per message. Outbound sends
 * (DM/typing/read-receipt) go over REST (`/api/im/messages/{peerId}/...`) rather than the
 * socket, since jilalibff holds the single authenticated upstream connection and multiplexes
 * every browser tab's sends through it.
 */
@Service()
export class HtImConnectionService {
  private readonly http = inject(HttpClient);
  private readonly wsBaseUrl = inject(WS_BASE_URL);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  /** Append-only log of every event received since the last connect/reset — a plain signal
   *  would only expose the latest value, so two events coalesced into one change-detection
   *  flush would silently lose the earlier one. Consumers (im-bootstrap.service.ts,
   *  messages.store.ts) track their own read cursor into this log. */
  private readonly _events = signal<readonly ImEvent[]>([]);
  private readonly _status = signal<ConnectionStatus>('disconnected');
  readonly events = this._events.asReadonly();
  readonly status = this._status.asReadonly();

  private sock: WebSocket | null = null;
  private wantsConnection = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

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
    this._status.set('disconnected');
    this._events.set([]);
  }

  /** Sends a DM (text/image/gift/introduction/voice_room/live_link) via jilalibff's REST send
   *  endpoint. Mints (or reuses a caller-supplied) msgId synchronously so the caller can render
   *  an optimistic local echo immediately — the POST itself fires in the background and its
   *  eventual delivery confirmation arrives as a `message_ack` event on the relay, correlated
   *  by this same msgId, not by the HTTP response. */
  sendDm(
    peerId: number,
    payload: DmSendPayload,
    fromNickname: string,
    fromProfileTs: number,
    msgId?: string,
  ): string | null {
    const sentMsgId = msgId ?? crypto.randomUUID();
    logRealtime('send dm', { kind: payload.kind, peerId, msgId: sentMsgId });
    void firstValueFrom(
      this.http.post(`${this.apiBaseUrl}/im/messages/${peerId}/send`, {
        ...payloadToSendBody(payload),
        msgId: sentMsgId,
        fromNickname,
        fromProfileTs,
      }),
    ).catch((err: unknown) => logRealtime('send dm failed', err));
    return sentMsgId;
  }

  sendTyping(peerId: number, isTyping: boolean): void {
    logRealtime('send typing', { peerId, isTyping });
    void firstValueFrom(
      this.http.post(`${this.apiBaseUrl}/im/messages/${peerId}/typing`, { typing: isTyping }),
    ).catch((err: unknown) => logRealtime('send typing failed', err));
  }

  /**
   * Read-receipt body now includes {@code chatType: 1} (1:1 DM), per the real Android client's
   * {@code HasReadRequest.smali} ({@code re_output/apktool_out/smali_classes13/.../HasReadRequest.smali}):
   * the wire body is {@code [LE-u16 strLen+1][utf8 msgId][0x00 terminator][LE-u32 chatType]}.
   * The BFF {@code ImSendController.read} defaults to {@code chatType=1} if the body omits it,
   * so the field is optional — but we send it explicitly so the protocol contract is symmetric
   * with the upstream client and ready for future group/voice-room contexts where chatType would
   * differ.
   */
  sendReadReceipt(peerId: number, msgId: string): void {
    logRealtime('send read receipt', { peerId, msgId });
    void firstValueFrom(
      this.http.post(`${this.apiBaseUrl}/im/messages/${peerId}/read`, {
        msgId,
        chatType: 1,
      }),
    ).catch((err: unknown) => logRealtime('send read receipt failed', err));
  }

  private open(): void {
    const status = this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting';
    this._status.set(status);
    logRealtime('status ->', status);

    const sock = new WebSocket(`${this.wsBaseUrl}/im`);
    this.sock = sock;

    sock.onopen = () => {
      if (this.sock !== sock) return;
      logRealtime('relay socket open');
    };
    sock.onmessage = (event: MessageEvent) => {
      if (this.sock !== sock) return;
      this.handleMessage(event.data as string);
    };
    sock.onclose = (event: CloseEvent) => {
      if (this.sock !== sock) return;
      logRealtime('relay socket closed', 'code:', event.code, 'reason:', event.reason || '(none)');
      this.sock = null;
      this.scheduleReconnect();
    };
    sock.onerror = () => {
      logRealtime('relay socket error');
      this.pushEvent({ type: 'error', message: 'WebSocket error' });
    };
  }

  private handleMessage(raw: string): void {
    let event: ImEvent;
    try {
      event = JSON.parse(raw) as ImEvent;
    } catch {
      logRealtime('failed to parse relay message', raw);
      return;
    }
    if (event.type === 'connection-state' && event.state === 'connected') {
      this.reconnectAttempt = 0;
    }
    if (event.type === 'connection-state') {
      this._status.set(event.state);
    }
    this.pushEvent(event);
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

  private pushEvent(event: ImEvent): void {
    logRealtime(event.type, event);
    this._events.update((events) => [...events, event]);
  }
}

/** Flattens a `DmSendPayload` into the flat body shape jilalibff's `ImSendController.SendMessageRequest`
 *  expects — the `kind` discriminant plus whichever fields that kind carries. */
function payloadToSendBody(payload: DmSendPayload): Record<string, unknown> {
  switch (payload.kind) {
    case 'text':
      return { kind: 'text', text: payload.text };
    case 'image':
      return {
        kind: 'image',
        url: payload.url,
        localPath: payload.localPath,
        size: payload.size,
        width: payload.width,
        height: payload.height,
        mimeType: payload.mimeType,
      };
    case 'live_link':
      return { kind: 'live_link', roomData: payload.roomData };
    case 'voice_room':
      return { kind: 'voice_room', roomData: payload.roomData };
    case 'introduction':
      return { kind: 'introduction', introduction: payload.introduction };
    case 'send_gift':
      return { kind: 'send_gift', gift: payload.gift };
  }
}
