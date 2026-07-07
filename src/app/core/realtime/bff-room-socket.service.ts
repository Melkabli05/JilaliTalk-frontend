import { Injectable, signal, inject } from '@angular/core';
import type { WritableSignal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { ReconnectingSocketBase } from './reconnecting-socket-base';
import type { RoomRealtimeEvent } from './room-realtime-events';
import { WS_BASE_URL } from '@core/tokens/ws-base-url.token';

type EventOfType<T extends RoomRealtimeEvent['type']> = Extract<RoomRealtimeEvent, { type: T }>;

export type WsConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

@Injectable({ providedIn: 'root' })
export class BffRoomSocketService extends ReconnectingSocketBase {
  private readonly wsBaseUrl = inject(WS_BASE_URL);
  private reconnectCname = '';
  private reconnectHostId = 0;
  private reconnectBusiType = 2;
  private reconnectHeartbeatSeconds: number | null = null;

  private readonly _lastEvent = signal<RoomRealtimeEvent | null>(null);
  private readonly _wsStatus = signal<WsConnectionStatus>('disconnected');
  readonly lastEvent = this._lastEvent.asReadonly();
  readonly wsStatus = this._wsStatus.asReadonly();

  private readonly lastEvent$ = toObservable(this._lastEvent);

  /**
   * Typed, filtered stream for one event type — each room store subscribes only to the
   * types it actually reacts to instead of an effect() that reads lastEvent() and
   * switches on the full RoomRealtimeEvent union (the switch approach meant every
   * consumer's switch ran on every event regardless of relevance, and made the union
   * type available to every consumer instead of narrowing per-subscription).
   */
  event$<T extends RoomRealtimeEvent['type']>(type: T): Observable<EventOfType<T>> {
    return this.lastEvent$.pipe(
      filter((e): e is EventOfType<T> => e?.type === type),
    );
  }

  /** Cnames whose WebSocket has permanently given up (5 reconnect attempts
   *  exhausted). Consumed by the room page on maximize-restore: if the
   *  snapshot's cname is in this set, skip the "is restore" shortcut
   *  and force a fresh full connect. Cleared by a successful
   *  reconnect (in onMessage) or an explicit disconnect(). */
  private readonly _gaveUpCnames = signal<ReadonlySet<string>>(new Set());
  readonly gaveUpCnames: WritableSignal<ReadonlySet<string>> = this._gaveUpCnames;
  gaveUp(cname: string): boolean { return this._gaveUpCnames().has(cname); }

  isConnected = (): boolean => this.sock?.readyState === WebSocket.OPEN;

  connect(cname: string, hostId = 0, busiType = 2, heartbeatSeconds: number | null = null): void {
    if (this.reconnectCname === cname && (this.sock || this.connecting)) return;
    this.teardownSocket();
    this.reconnectCname = cname;
    this.reconnectHostId = hostId;
    this.reconnectBusiType = busiType;
    this.reconnectHeartbeatSeconds = heartbeatSeconds;
    this.reconnectAttempt = 0;
    this.connecting = true;
    this.open();
  }

  async disconnect(): Promise<void> {
    this.reconnectCname = '';
    this.reconnectHostId = 0;
    this.reconnectBusiType = 2;
    this.reconnectHeartbeatSeconds = null;
    this.reconnectAttempt = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.connecting = false;
    this._wsStatus.set('disconnected');
    this._gaveUpCnames.set(new Set());
    this.teardownSocket();
    this.sock = null;
    this._lastEvent.set(null);
  }

  protected override buildUrl(): string {
    const params = new URLSearchParams({
      hostId: String(this.reconnectHostId),
      busiType: String(this.reconnectBusiType),
    });
    if (this.reconnectHeartbeatSeconds) {
      params.set('heartbeatSeconds', String(this.reconnectHeartbeatSeconds));
    }
    return `${this.wsBaseUrl}/ht/${encodeURIComponent(this.reconnectCname)}?${params}`;
  }

  protected override shouldRetry(): boolean {
    return !!this.reconnectCname && this.reconnectAttempt < this.maxReconnectAttempts;
  }

  protected override onMessage(data: unknown): void {
    const parsed = data as RoomRealtimeEvent;
    if (parsed.type === 'connection-state') {
      this._wsStatus.set(parsed.state);
    }
    this._lastEvent.set(parsed);
    if (this._gaveUpCnames().has(this.reconnectCname)) {
      const next = new Set(this._gaveUpCnames());
      next.delete(this.reconnectCname);
      this._gaveUpCnames.set(next);
    }
  }

  protected override onGiveUp(): void {
    const cname = this.reconnectCname;
    this.reconnectCname = '';
    if (cname) {
      this._gaveUpCnames.set(new Set(this._gaveUpCnames()).add(cname));
    }
  }

  protected override onGiveUpLastEvent(): void {
    this._lastEvent.set(null);
  }
}
