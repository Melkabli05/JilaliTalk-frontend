import { Injectable, signal, inject } from '@angular/core';
import type { WritableSignal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthStore } from '@core/auth/auth.store';
import { ROOM_WS_URL } from '@core/tokens/room-ws-url.token';
import { logRealtime } from './dev-log.util';
import { backoffDelay, MAX_RECONNECT_ATTEMPTS, type ConnectionStatus } from './reconnect-backoff.util';
import type { RoomRealtimeEvent } from './room-realtime-events';
import {
  buildAckFrame,
  buildHeartbeatFrame,
  buildInitFrame,
  parseRoomFrame,
  type RoomFrame,
} from './room-protocol/room-frame.util';
import { describeRoomEvent } from './room-protocol/room-event-description.util';
import { mapRoomNotifyToEvent } from './room-protocol/room-event-mapper.util';

type EventOfType<T extends RoomRealtimeEvent['type']> = Extract<RoomRealtimeEvent, { type: T }>;

/**
 * Direct connection to the LiveHub room WebSocket (replaces `BffRoomSocketService`, which
 * relayed a JSON event stream from jilalibff's own WebSocket). Ported from the reference
 * client's `fireRoomWebSocket()` in scriptv2.js: plain JSON frames, connect via
 * `user_id`/`cname`/`is_visitor` query params (no login handshake), a server-driven
 * request→ack→reschedule heartbeat loop, and per-message ACKs. Keeps the same public shape
 * `BffRoomSocketService` had so none of its consumers need to change.
 */
@Injectable({ providedIn: 'root' })
export class HtRoomConnectionService {
  private readonly auth = inject(AuthStore);
  private readonly wsUrl = inject(ROOM_WS_URL);

  private readonly _lastEvent = signal<RoomRealtimeEvent | null>(null);
  private readonly _wsStatus = signal<ConnectionStatus>('disconnected');
  readonly lastEvent = this._lastEvent.asReadonly();
  readonly wsStatus = this._wsStatus.asReadonly();

  private readonly lastEvent$ = toObservable(this._lastEvent);

  event$<T extends RoomRealtimeEvent['type']>(type: T): Observable<EventOfType<T>> {
    return this.lastEvent$.pipe(
      filter((e): e is EventOfType<T> => e?.type === type),
    );
  }

  private readonly _gaveUpCnames = signal<ReadonlySet<string>>(new Set());
  readonly gaveUpCnames: WritableSignal<ReadonlySet<string>> = this._gaveUpCnames;
  gaveUp(cname: string): boolean { return this._gaveUpCnames().has(cname); }

  isConnected = (): boolean => this.sock?.readyState === WebSocket.OPEN;

  private sock: WebSocket | null = null;
  private cname = '';
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatIntervalSec = 60;

  /** `hostId`/`busiType`/`heartbeatSeconds` are accepted for API compatibility with existing
   *  callers but unused internally — the real LiveHub upstream connection takes only
   *  `user_id`/`cname`/`is_visitor` (confirmed against both the reference client and
   *  jilalibff's own upstream connector signature) and always announces its own heartbeat
   *  interval via the first server push, so none of the other three ever reach the wire. */
  connect(cname: string, _hostId = 0, _busiType = 2, _heartbeatSeconds: number | null = null): void {
    if (this.cname === cname && this.sock) return;
    this.teardownSocket();
    this.cname = cname;
    this.reconnectAttempt = 0;
    logRealtime('connect() requested', cname);
    this.open();
  }

  async disconnect(): Promise<void> {
    logRealtime('disconnect() requested');
    this.cname = '';
    this.reconnectAttempt = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this._wsStatus.set('disconnected');
    this._gaveUpCnames.set(new Set());
    this.teardownSocket();
    this._lastEvent.set(null);
  }

  private open(): void {
    const status = this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting';
    this._wsStatus.set(status);
    logRealtime('status ->', status, this.cname);

    const userId = this.auth.user()?.userId;
    const cname = this.cname;
    if (userId == null || !cname) {
      logRealtime('no authenticated user or cname, aborting connect');
      this._wsStatus.set('disconnected');
      this.cname = '';
      return;
    }

    const url = `${this.wsUrl}?user_id=${userId}&cname=${encodeURIComponent(cname)}&is_visitor=true`;
    logRealtime('opening socket', url);
    const sock = new WebSocket(url);
    this.sock = sock;

    sock.onopen = () => {
      if (this.sock !== sock) return;
      logRealtime('socket open, sending init frame');
      sock.send(buildInitFrame(userId, cname));
    };
    sock.onmessage = (event: MessageEvent) => {
      if (this.sock !== sock) return;
      this.handleMessage(event.data as string, userId, cname);
    };
    sock.onclose = () => {
      if (this.sock !== sock) return;
      logRealtime('socket closed');
      this.clearHeartbeat();
      this.sock = null;
      this.scheduleReconnect();
    };
    sock.onerror = () => {
      logRealtime('socket error');
      this.pushEvent({ type: 'error', message: 'WebSocket error' });
    };
  }

  private handleMessage(text: string, userId: number, cname: string): void {
    const frame = parseRoomFrame(text);
    if (!frame) return;

    switch (frame.kind) {
      case 'heartbeat_interval':
        this.handleHeartbeatIntervalFrame(frame.heartbeatSec, userId, cname);
        return;
      case 'heartbeat_ack':
        this.handleHeartbeatAckFrame(userId, cname);
        return;
      case 'notify':
        this.handleNotifyFrame(frame, userId, cname);
        return;
      case 'unrecognized':
        return;
    }
  }

  /** The room protocol has no login handshake/response the way the IM protocol does — this
   *  first server-initiated push is the earliest point we know the server is actually
   *  talking back to us (`sock.onopen` only confirms the TCP/WS handshake, not that the
   *  server accepted the connection), so it's the equivalent "really connected" signal.
   *  Resetting `reconnectAttempt` here too mirrors HtImConnectionService.handleLoginResponse
   *  — otherwise a successful reconnect after N failed attempts would leave the backoff
   *  counter still at N for the *next* drop instead of starting a fresh sequence. */
  private handleHeartbeatIntervalFrame(heartbeatSec: number, userId: number, cname: string): void {
    this.heartbeatIntervalSec = heartbeatSec;
    this.reconnectAttempt = 0;
    this._wsStatus.set('connected');
    logRealtime('status -> connected, heartbeat interval', heartbeatSec, 's');
    this.sendHeartbeat(userId, cname);
    this.scheduleHeartbeat(userId, cname);
  }

  private handleHeartbeatAckFrame(userId: number, cname: string): void {
    logRealtime('heartbeat ack');
    this.scheduleHeartbeat(userId, cname);
  }

  private handleNotifyFrame(frame: Extract<RoomFrame, { kind: 'notify' }>, userId: number, cname: string): void {
    if (frame.msgId && this.sock) {
      this.sock.send(buildAckFrame(userId, cname, true, frame.msgId));
    }
    if (frame.envelope.notifyType) {
      const event = mapRoomNotifyToEvent(frame.envelope.notifyType, frame.envelope.info, frame.envelope.root);
      if (event) this.pushEvent(event);
    }
  }

  private sendHeartbeat(userId: number, cname: string): void {
    if (!this.sock) return;
    logRealtime('send heartbeat');
    this.sock.send(buildHeartbeatFrame(userId, cname, true));
  }

  /** Reschedules the NEXT heartbeat 5s before the server-announced interval elapses, and only
   *  in response to a heartbeat frame (the initial `heartbeat_sec` push, or the server's
   *  `heartbeat_time` ack of our last one) — a request→ack→reschedule loop, not a
   *  self-perpetuating interval blind to acks, matching the reference client's
   *  `scheduleHeartbeat()`/`sendHeartbeat()` pair exactly. */
  private scheduleHeartbeat(userId: number, cname: string): void {
    this.clearHeartbeat();
    const delayMs = Math.max(0, this.heartbeatIntervalSec * 1000 - 5000);
    this.heartbeatTimer = setTimeout(() => this.sendHeartbeat(userId, cname), delayMs);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (!this.cname || this.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      logRealtime('giving up reconnecting', this.cname);
      this._lastEvent.set(null);
      const cname = this.cname;
      this.cname = '';
      this._wsStatus.set('disconnected');
      if (cname) this._gaveUpCnames.set(new Set(this._gaveUpCnames()).add(cname));
      return;
    }
    this._wsStatus.set('reconnecting');
    const delay = backoffDelay(this.reconnectAttempt);
    logRealtime('scheduling reconnect attempt', this.reconnectAttempt + 1, 'in', delay, 'ms');
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  private teardownSocket(): void {
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
  }

  private pushEvent(event: RoomRealtimeEvent): void {
    logRealtime(describeRoomEvent(event), event);
    this._lastEvent.set(event);
    if (this._gaveUpCnames().has(this.cname)) {
      const next = new Set(this._gaveUpCnames());
      next.delete(this.cname);
      this._gaveUpCnames.set(next);
    }
  }
}
