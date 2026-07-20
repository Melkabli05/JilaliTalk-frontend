import { Service, signal, inject } from '@angular/core';
import type { WritableSignal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { WS_BASE_URL } from '@core/tokens/ws-base-url.token';
import { logRealtime } from './dev-log.util';
import { backoffDelay, MAX_RECONNECT_ATTEMPTS, type ConnectionStatus } from './reconnect-backoff.util';
import type { RoomRealtimeEvent } from './room-realtime-events';

type EventOfType<T extends RoomRealtimeEvent['type']> = Extract<RoomRealtimeEvent, { type: T }>;

/**
 * Relay connection to jilalibff's `/ws/ht/{cname}` — the BFF owns the LiveHub upstream
 * WebSocket (plain JSON action-frame protocol, per-room heartbeat loop) entirely server-side
 * and forwards decoded events here as plain JSON text frames, one `RoomRealtimeEvent` per
 * message. Push-only: room actions (raise hand, send comment, etc.) go through their own
 * REST endpoints, never through this socket.
 */
@Service()
export class HtRoomConnectionService {
  private readonly wsBaseUrl = inject(WS_BASE_URL);

  private readonly _lastEvent = signal<RoomRealtimeEvent | null>(null);
  private readonly _wsStatus = signal<ConnectionStatus>('disconnected');
  readonly lastEvent = this._lastEvent.asReadonly();
  readonly wsStatus = this._wsStatus.asReadonly();

  private readonly lastEvent$ = toObservable(this._lastEvent);

  /**
   * Typed, filtered stream for one event type — each room store subscribes only to the
   * types it actually reacts to instead of an effect() that reads lastEvent() and
   * switches on the full RoomRealtimeEvent union.
   */
  event$<T extends RoomRealtimeEvent['type']>(type: T): Observable<EventOfType<T>> {
    return this.lastEvent$.pipe(
      filter((e): e is EventOfType<T> => e?.type === type),
    );
  }

  /** Cnames whose WebSocket has permanently given up (reconnect attempts exhausted).
   *  Consumed by the room page on maximize-restore: if the snapshot's cname is in this set,
   *  skip the "is restore" shortcut and force a fresh full connect. Cleared by a successful
   *  reconnect or an explicit disconnect(). */
  private readonly _gaveUpCnames = signal<ReadonlySet<string>>(new Set());
  readonly gaveUpCnames: WritableSignal<ReadonlySet<string>> = this._gaveUpCnames;
  gaveUp(cname: string): boolean { return this._gaveUpCnames().has(cname); }

  isConnected = (): boolean => this.sock?.readyState === WebSocket.OPEN;

  private sock: WebSocket | null = null;
  private cname = '';
  private hostId = 0;
  private busiType = 2;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /** `hostId`/`busiType`/`heartbeatSeconds` are accepted for API compatibility with existing
   *  callers; `hostId`/`busiType` ride along as query params for the BFF's own logging, and
   *  `heartbeatSeconds` is unused — the upstream always announces its own heartbeat interval
   *  via the first server push. */
  connect(cname: string, hostId = 0, busiType = 2, _heartbeatSeconds: number | null = null): void {
    if (this.cname === cname && this.sock) return;
    this.teardownSocket();
    this.cname = cname;
    this.hostId = hostId;
    this.busiType = busiType;
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

    const cname = this.cname;
    const url = `${this.wsBaseUrl}/ht/${encodeURIComponent(cname)}?hostId=${this.hostId}&busiType=${this.busiType}`;
    logRealtime('opening socket', url);
    const sock = new WebSocket(url);
    this.sock = sock;

    sock.onopen = () => {
      if (this.sock !== sock) return;
      logRealtime('relay socket open', cname);
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
    let event: RoomRealtimeEvent;
    try {
      event = JSON.parse(raw) as RoomRealtimeEvent;
    } catch {
      logRealtime('failed to parse room relay message', raw);
      return;
    }
    if (event.type === 'connection-state') {
      if (event.state === 'connected') this.reconnectAttempt = 0;
      this._wsStatus.set(event.state);
    }
    this.pushEvent(event);
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
    logRealtime(event.type, event);
    this._lastEvent.set(event);
    if (this._gaveUpCnames().has(this.cname)) {
      const next = new Set(this._gaveUpCnames());
      next.delete(this.cname);
      this._gaveUpCnames.set(next);
    }
  }
}
