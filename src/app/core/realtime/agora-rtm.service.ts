import { Injectable, signal } from '@angular/core';
import AgoraRTM, { type RTMClient, type RTMEvents } from 'agora-rtm-sdk';
import type { RealtimeLifecycle, RtmInboundMessage, RtmOutboundMessage } from './realtime-events';

interface RtmTypingSignal {
  channel: string;
  fromUid: string;
  sender: string;
  ts: number;
}

@Injectable({ providedIn: 'root' })
export class AgoraRtmService implements RealtimeLifecycle {
  private client: RTMClient | null = null;
  private subscribed = new Set<string>();

  private readonly _loggedIn = signal(false);
  private readonly _lastMessage = signal<RtmInboundMessage | null>(null);
  private readonly _lastTyping = signal<RtmTypingSignal | null>(null);

  readonly loggedIn = this._loggedIn.asReadonly();
  readonly lastMessage = this._lastMessage.asReadonly();
  readonly lastTyping = this._lastTyping.asReadonly();

  isConnected = () => this._loggedIn();

  async login(appId: string, userId: string, token?: string): Promise<void> {
    if (this.client) return;
    const client = new AgoraRTM.RTM(appId, userId) as RTMClient;
    this.client = client;

    client.addEventListener('message', (e: RTMEvents.MessageEvent) => {
      const raw =
        typeof e.message === 'string'
          ? e.message
          : e.message instanceof ArrayBuffer
            ? new TextDecoder().decode(e.message)
            : String(e.message);

      let parsed: RtmOutboundMessage | null = null;
      try { parsed = JSON.parse(raw) as RtmOutboundMessage; } catch { /* not JSON */ }

      const fromUid = String(e.publisher);
      if (parsed?.kind === 'typing') {
        this._lastTyping.set({ channel: e.channelName, fromUid, sender: parsed.sender, ts: Date.now() });
        return;
      }

      this._lastMessage.set({
        channel: e.channelName,
        fromUid,
        text: parsed?.kind === 'chat' ? parsed.text : raw,
        ts: Date.now(),
        payload: parsed,
      });
    });

    await client.login(token ? { token } : undefined);
    this._loggedIn.set(true);
  }

  async subscribe(channelName: string): Promise<void> {
    if (!this.client) throw new Error('subscribe before login');
    if (this.subscribed.has(channelName)) return;
    await this.client.subscribe(channelName, { withMessage: true });
    this.subscribed.add(channelName);
  }

  async publish(channelName: string, text: string): Promise<void> {
    await this.client?.publish(channelName, text);
  }

  publishTyping(channelName: string, uid: string, sender: string): void {
    const payload: RtmOutboundMessage = { kind: 'typing', uid, sender, ts: Date.now() };
    this.client?.publish(channelName, JSON.stringify(payload)).catch(() => {});
  }

  async unsubscribe(channelName: string): Promise<void> {
    if (!this.client || !this.subscribed.has(channelName)) return;
    await this.client.unsubscribe(channelName).catch(() => {});
    this.subscribed.delete(channelName);
  }

  async disconnect(): Promise<void> {
    try {
      for (const ch of [...this.subscribed]) await this.unsubscribe(ch);
      await this.client?.logout().catch(() => {});
    } finally {
      this.subscribed.clear();
      this.client = null;
      this._lastMessage.set(null);
      this._loggedIn.set(false);
    }
  }
}
