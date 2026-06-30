import { Injectable, signal } from '@angular/core';
import { ReconnectingSocketBase } from './reconnecting-socket-base';
import type { RoomRealtimeEvent } from './room-realtime-events';

export type WsConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

@Injectable({ providedIn: 'root' })
export class BffRoomSocketService extends ReconnectingSocketBase {
  private reconnectCname = '';
  private reconnectHostId = 0;
  private reconnectBusiType = 2;
  private reconnectHeartbeatSeconds: number | null = null;

  private readonly _lastEvent = signal<RoomRealtimeEvent | null>(null);
  private readonly _wsStatus = signal<WsConnectionStatus>('disconnected');
  readonly lastEvent = this._lastEvent.asReadonly();
  readonly wsStatus = this._wsStatus.asReadonly();

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
    this.teardownSocket();
    this.sock = null;
    this._lastEvent.set(null);
  }

  override wireSocket(sock: WebSocket): void {
    sock.onmessage = (event: MessageEvent) => {
      if (this.sock !== sock) return;
      try {
        const parsed = JSON.parse(event.data as string) as RoomRealtimeEvent;
        if (parsed.type === 'connection-state') {
          this._wsStatus.set(parsed.state);
        }
        this._lastEvent.set(parsed);
      } catch {
        // malformed frame — drop it; the connection is still healthy
      }
    };

    sock.onclose = () => {
      if (this.sock !== sock) return;
      this.connecting = false;
      this.scheduleReconnect();
    };

    sock.onopen = () => {
      this.connecting = false;
    };

    sock.onerror = () => {
      this.connecting = false;
    };
  }

  protected override buildUrl(): string {
    const params = new URLSearchParams({
      hostId: String(this.reconnectHostId),
      busiType: String(this.reconnectBusiType),
    });
    if (this.reconnectHeartbeatSeconds) {
      params.set('heartbeatSeconds', String(this.reconnectHeartbeatSeconds));
    }
    return `/ws/ht/${encodeURIComponent(this.reconnectCname)}?${params}`;
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
  }

  protected override onGiveUp(): void {
    this.reconnectCname = '';
  }

  protected override onGiveUpLastEvent(): void {
    this._lastEvent.set(null);
  }
}
