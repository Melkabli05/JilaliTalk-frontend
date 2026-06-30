import { Injectable, signal } from '@angular/core';
import { ReconnectingSocketBase } from './reconnecting-socket-base';
import type { ConnectionStatus } from './reconnecting-socket-base';
import type { ImEvent } from './im-events';

export type ImConnectionStatus = ConnectionStatus;

@Injectable({ providedIn: 'root' })
export class ImSocketService extends ReconnectingSocketBase {
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

  override wireSocket(sock: WebSocket): void {
    sock.onmessage = (event: MessageEvent) => {
      if (this.sock !== sock) return;
      try {
        const parsed = JSON.parse(event.data as string) as ImEvent;
        if (parsed.type === 'connection-state') {
          this._status.set(parsed.state);
        }
        this._lastEvent.set(parsed);
      } catch {
        // malformed frame — drop it; the connection is still healthy
      }
    };

    sock.onclose = () => {
      if (this.sock !== sock) return;
      this.connecting = false;
      if (this.wantsConnection) this.scheduleReconnect();
    };

    sock.onopen = () => {
      this.connecting = false;
    };

    sock.onerror = () => {
      this.connecting = false;
    };
  }

  protected override shouldRetry(): boolean {
    return this.wantsConnection && this.reconnectAttempt < this.maxReconnectAttempts;
  }

  protected override buildUrl(): string {
    return '/ws/im';
  }

  protected override onMessage(data: unknown): void {
    const parsed = data as ImEvent;
    if (parsed.type === 'connection-state') {
      this._status.set(parsed.state);
    }
    this._lastEvent.set(parsed);
  }
}
