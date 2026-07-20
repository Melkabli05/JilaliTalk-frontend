// src/app/core/realtime/ht-cc-connection.service.ts
import { Service, signal, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';
import { WS_BASE_URL } from '@core/tokens/ws-base-url.token';
import { backoffDelay, MAX_RECONNECT_ATTEMPTS, type ConnectionStatus } from './reconnect-backoff.util';
import { logRealtime } from './dev-log.util';
import type { RoomCcRealtimeEvent } from './room-realtime-events';

type EventOfType<T extends RoomCcRealtimeEvent['type']> = Extract<RoomCcRealtimeEvent, { type: T }>;

/**
 * Relay for the AI-captioning / subtitle channel. The BFF's same `/ws/ht/{cname}` WebSocket
 * carries two multiplexed streams: the room channel and the CC channel. This service opens
 * the same endpoint with {@code ?cc=1} to subscribe only to the CC stream — room events on
 * the same connection are filtered out client-side so the BFF can wire a separate
 * {@code RoomCcRealtimeEvent} per CC push.
 */
@Service()
export class HtCcConnectionService {
  private readonly wsBaseUrl = inject(WS_BASE_URL);

  private readonly _lastEvent = signal<RoomCcRealtimeEvent | null>(null);
  private readonly _wsStatus = signal<ConnectionStatus>('disconnected');
  readonly lastEvent = this._lastEvent.asReadonly();
  readonly wsStatus = this._wsStatus.asReadonly();

  private readonly lastEvent$ = toObservable(this._lastEvent);

  /** Typed, filtered stream for one event type. Mirrors the room service's event$ helper. */
  event$<T extends RoomCcRealtimeEvent['type']>(type: T): Observable<EventOfType<T>> {
    return this.lastEvent$.pipe(
      filter((e): e is EventOfType<T> => e?.type === type),
    );
  }

  private sock: WebSocket | null = null;
  private cname = '';
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /** Connects to {@code /ws/ht/{cname}?cc=1}. The BFF requires the room channel to already
   *  have at least one subscriber (the {@code ?cc=1} flag only opts in to the CC stream on
   *  an existing connection). Returns immediately if a connection for the same cname is up. */
  connect(cname: string): void {
    if (this.cname === cname && this.sock) return;
    this.teardownSocket();
    this.cname = cname;
    this.reconnectAttempt = 0;
    logRealtime('cc connect() requested', cname);
    this.open();
  }

  async disconnect(): Promise<void> {
    logRealtime('cc disconnect() requested');
    this.cname = '';
    this.reconnectAttempt = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this._wsStatus.set('disconnected');
    this.teardownSocket();
    this._lastEvent.set(null);
  }

  private open(): void {
    const status = this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting';
    this._wsStatus.set(status);
    logRealtime('cc status ->', status, this.cname);

    const cname = this.cname;
    const url = `${this.wsBaseUrl}/ht/${encodeURIComponent(cname)}?cc=1`;
    logRealtime('cc opening socket', url);
    const sock = new WebSocket(url);
    this.sock = sock;

    sock.onopen = () => {
      if (this.sock !== sock) return;
      logRealtime('cc relay socket open', cname);
    };
    sock.onmessage = (event: MessageEvent) => {
      if (this.sock !== sock) return;
      this.handleMessage(event.data as string);
    };
    sock.onclose = (event: CloseEvent) => {
      if (this.sock !== sock) return;
      logRealtime('cc relay socket closed', 'code:', event.code, 'reason:', event.reason || '(none)');
      this.sock = null;
      this.scheduleReconnect();
    };
    sock.onerror = () => {
      logRealtime('cc relay socket error');
      this.pushEvent({ type: 'error', message: 'WebSocket error' });
    };
  }

  private handleMessage(raw: string): void {
    let event: RoomCcRealtimeEvent;
    try {
      event = JSON.parse(raw) as RoomCcRealtimeEvent;
    } catch {
      logRealtime('failed to parse cc relay message', raw);
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
      logRealtime('cc giving up reconnecting', this.cname);
      this.cname = '';
      this._wsStatus.set('disconnected');
      this._lastEvent.set(null);
      return;
    }
    this._wsStatus.set('reconnecting');
    const delay = backoffDelay(this.reconnectAttempt);
    logRealtime('cc scheduling reconnect attempt', this.reconnectAttempt + 1, 'in', delay, 'ms');
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

  private pushEvent(event: RoomCcRealtimeEvent): void {
    logRealtime('cc', event.type, event);
    this._lastEvent.set(event);
  }
}
