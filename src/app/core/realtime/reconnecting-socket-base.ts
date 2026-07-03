export const MAX_RECONNECT_ATTEMPTS = 5;

const BACKOFF_BASE_MS = 1000;
const BACKOFF_CAP_MS = 30_000;

/** Upper bound of the jitter window for a given attempt count, before randomization. */
function backoffBound(attempt: number): number {
  let shifted = BACKOFF_BASE_MS;
  for (let i = 0; i < attempt && shifted < BACKOFF_CAP_MS; i++) {
    shifted = Math.min(BACKOFF_CAP_MS, shifted * 2);
  }
  return Math.min(BACKOFF_CAP_MS, shifted);
}

/**
 * Capped exponential backoff with full jitter: `delay = random(0, min(cap, base * 2^attempt))`.
 * Mirrors jilalibff's `ExponentialBackoff.java` — full jitter is the standard defense against
 * reconnect storms against a recovering upstream/BFF after a shared outage.
 */
export function backoffDelay(attempt: number): number {
  return Math.floor(Math.random() * (backoffBound(attempt) + 1));
}

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export abstract class ReconnectingSocketBase {
  protected readonly maxReconnectAttempts = MAX_RECONNECT_ATTEMPTS;

  protected sock: WebSocket | null = null;
  protected reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  protected reconnectAttempt = 0;
  protected connecting = false;

  protected open(): void {
    const sock = new WebSocket(this.buildUrl());
    this.sock = sock;
    this.wireSocket(sock);
  }

  protected wireSocket(sock: WebSocket): void {
    sock.onmessage = (event: MessageEvent) => {
      if (this.sock !== sock) return;
      try {
        this.onMessage(JSON.parse(event.data as string));
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
      if (this.sock !== sock) return;
      this.reconnectAttempt = 0;
      this.connecting = false;
    };

    sock.onerror = () => {
      // onclose fires immediately after onerror; reconnect is scheduled there.
      this.connecting = false;
    };
  }

  protected onGiveUp(): void {}

  protected onGiveUpLastEvent(): void {}

  protected giveUp(): void {
    this.teardownSocket();
    this.sock = null;
    this.onGiveUpLastEvent();
    this.onGiveUp();
  }

  protected scheduleReconnect(): void {
    if (!this.shouldRetry()) {
      this.giveUp();
      return;
    }
    const delay = backoffDelay(this.reconnectAttempt);
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  protected teardownSocket(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.sock) {
      const sock = this.sock;
      this.sock = null;
      sock.close();
      sock.onmessage = null;
      sock.onclose = null;
      sock.onerror = null;
    }
    this.connecting = false;
  }

  protected abstract shouldRetry(): boolean;

  protected abstract buildUrl(): string;

  protected abstract onMessage(data: unknown): void;
}
