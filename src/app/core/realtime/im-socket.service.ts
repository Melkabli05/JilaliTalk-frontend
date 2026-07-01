import { Injectable, signal, inject } from '@angular/core';
import { ReconnectingSocketBase } from './reconnecting-socket-base';
import type { ConnectionStatus } from './reconnecting-socket-base';
import type { ImEvent } from './im-events';
import { WS_BASE_URL } from '@core/tokens/ws-base-url.token';

export type ImConnectionStatus = ConnectionStatus;

@Injectable({ providedIn: 'root' })
export class ImSocketService extends ReconnectingSocketBase {
  private readonly wsBaseUrl = inject(WS_BASE_URL);
  private readonly _lastEvent = signal<ImEvent | null>(null);
  private readonly _status = signal<ImConnectionStatus>('disconnected');
  private wantsConnection = false;

  readonly lastEvent = this._lastEvent.asReadonly();
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
    this._lastEvent.set(null);
  }

  override onGiveUpLastEvent(): void {
    this._lastEvent.set(null);
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
    this._lastEvent.set(parsed);
  }
}
