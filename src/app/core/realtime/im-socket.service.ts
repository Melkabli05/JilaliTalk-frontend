import { Injectable, signal, inject } from '@angular/core';
import { ReconnectingSocketBase } from './reconnecting-socket-base';
import type { ConnectionStatus } from './reconnecting-socket-base';
import type { ImEvent } from './im-events';
import { WS_BASE_URL } from '@core/tokens/ws-base-url.token';

export type ImConnectionStatus = ConnectionStatus;

@Injectable({ providedIn: 'root' })
export class ImSocketService extends ReconnectingSocketBase {
  private readonly wsBaseUrl = inject(WS_BASE_URL);
  /**
   * Append-only log of every event received since the last connect/reset — replaces a
   * single-slot "lastEvent" signal, which could silently drop an event whenever two WS
   * messages arrived close enough together that Angular's effect scheduler coalesced both
   * signal writes into one flush (a plain signal only ever exposes its latest value, so the
   * intermediate one was never seen by anyone). Consumers track their own read cursor (see
   * im-bootstrap.service.ts / messages.store.ts) so multiple independent subscribers can each
   * see every event exactly once without racing each other to "consume" a shared queue.
   * Not trimmed during a connection's lifetime — this is a personal IM channel (DMs, profile
   * visits, follows), not a high-frequency firehose, so unbounded growth for the life of one
   * connection is an acceptable tradeoff; disconnect/reconnect resets it to [].
   */
  private readonly _events = signal<readonly ImEvent[]>([]);
  private readonly _status = signal<ImConnectionStatus>('disconnected');
  private wantsConnection = false;

  readonly events = this._events.asReadonly();
  readonly status = this._status.asReadonly();

  isConnected = (): boolean => this.sock?.readyState === WebSocket.OPEN;

  connect(): void {
    if (this.sock || this.connecting) return;
    this.wantsConnection = true;
    this.reconnectAttempt = 0;
    this.connecting = true;
    this.open();
  }

  disconnect(): void {
    this.wantsConnection = false;
    this.reconnectAttempt = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.connecting = false;
    this._status.set('disconnected');
    this.teardownSocket();
    this.sock = null;
    this._events.set([]);
  }

  override onGiveUpLastEvent(): void {
    this._events.set([]);
  }

  protected override shouldRetry(): boolean {
    return this.wantsConnection && this.reconnectAttempt < this.maxReconnectAttempts;
  }

  protected override buildUrl(): string {
    return `${this.wsBaseUrl}/im`;
  }

  protected override onMessage(data: unknown): void {
    const parsed = data as ImEvent;
    if (parsed.type === 'connection-state') {
      this._status.set(parsed.state);
    }
    this._events.update((events) => [...events, parsed]);
  }
}
