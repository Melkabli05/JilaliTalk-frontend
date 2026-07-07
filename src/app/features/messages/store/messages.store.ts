import { Service, computed, effect, inject, signal } from '@angular/core';
import { ImSocketService } from '@core/realtime/im-socket.service';
import { StorageService } from '@core/services/storage.service';
import type { ImEvent } from '@core/realtime/im-events';
import type { DmConversation, DmMessage } from '../models/dm.model';
import { MessagesApi, SendDmBody, DmKind } from '../api/messages-api.service';

const STORAGE_KEY = 'jilali_dm_v1';
const MAX_MESSAGES = 200;
const MAX_CONVERSATIONS = 100;

// Page-scoped: only messages-page.ts injects this, via its own `providers: [MessagesStore]`
// (mirroring how features/room's stores are scoped — see CLAUDE.md §7, "feature stores are
// NEVER providedIn: 'root'"). autoProvided: false is @Service()'s Angular 22 equivalent of a
// bare @Injectable() with no providedIn.
@Service({ autoProvided: false })
export class MessagesStore {
  private readonly imSocket = inject(ImSocketService);
  private readonly storage = inject(StorageService);
  private readonly api = inject(MessagesApi);

  private readonly _convMap = signal(
    this.storage.get<[string, DmConversation][]>(STORAGE_KEY)?.reduce(
      (acc, [k, v]) => acc.set(k, { ...v, isTyping: false, unread: 0 }),
      new Map<string, DmConversation>(),
    ) ?? new Map(),
  );
  private readonly _selectedId = signal<string | null>(null);

  readonly conversations = computed(() =>
    [...this._convMap().values()].sort((a, b) => b.lastTs - a.lastTs),
  );
  readonly selectedId = this._selectedId.asReadonly();
  readonly selected = computed(() => {
    const id = this._selectedId();
    return id ? (this._convMap().get(id) ?? null) : null;
  });
  readonly totalUnread = computed(() =>
    [...this._convMap().values()].reduce((s, c) => s + c.unread, 0),
  );

  /** Read cursor into imSocket.events() — see that signal's doc (im-socket.service.ts) for
   *  why this drains an append-only log instead of reading a single "lastEvent" value. */
  private processedEventCount = 0;

  constructor() {
    effect(() => {
      const events = this.imSocket.events();
      if (events.length < this.processedEventCount) {
        // Log was reset (disconnect/reconnect) — start over from the beginning.
        this.processedEventCount = 0;
      }
      for (const ev of events.slice(this.processedEventCount)) {
        this.dispatch(ev);
      }
      this.processedEventCount = events.length;
    });

    effect(() => {
      const map = this._convMap();
      const entries = [...map.entries()]
        .sort(([, a], [, b]) => b.lastTs - a.lastTs)
        .slice(0, MAX_CONVERSATIONS);
      this.storage.set(STORAGE_KEY, entries);
    });
  }

  select(userId: string): void {
    // Marking read at the local-cache level is what the rest of the UI needs to render.
    // The upstream read-receipt send (so the peer can show ✓ on their side) runs through
    // MessagesStore.markLastRead — called automatically by select() whenever there is a
    // most-recent inbound message from the peer.
    this._selectedId.set(userId);
    this._convMap.update(m => {
      const c = m.get(userId);
      if (!c || c.unread === 0) return m;
      return new Map(m).set(userId, { ...c, unread: 0 });
    });

    // Fire the upstream read-receipt only when the conversation actually carries unread
    // history (otherwise we'd spam the upstream on every navigation, including re-opens).
    const numeric = Number(userId);
    if (Number.isFinite(numeric)) {
      this.markLastRead(numeric);
    }
  }

  back(): void {
    this._selectedId.set(null);
  }

  /** Convenience: fire-and-forget read-receipt for the most recently received message from
   *  this peer. No-op when the conversation is empty / never seen. */
  markLastRead(peerId: number): void {
    const msgId = this.lastInboundMsgId(peerId);
    if (msgId == null) return;
    this.api.postReadReceipt(peerId, msgId).subscribe({ error: () => {} });
  }

  // ── outbound (matches prvgmsgpacket.js's sendReadReceipt / sendTypingIndicator / sendTextMessage) ──

  /** Fire a read-receipt packet for the most recently received message in a conversation.
   *  Provided as a side-effect-free facade — callers that need a msgId they'd otherwise not
   *  have access to can chain through {@link lastInboundMsgId}. */
  markReadForLastInbound(peerId: number, msgId: string): void {
    this.api.postReadReceipt(peerId, msgId).subscribe({ error: () => {} });
  }

  /** The msgId of the most recently received DM from this peer (or null when the conversation
   *  is empty / never seen). Used by the composer/page to feed {@link markReadForLastInbound}. */
  lastInboundMsgId(peerId: number): string | null {
    const c = this._convMap().get(String(peerId));
    if (!c || c.messages.length === 0) return null;
    const last = c.messages[c.messages.length - 1];
    return last.id;
  }

  /** Fire a typing-state packet. Caller is expected to debounce this to ~1Hz while input is
   *  non-empty and emit a one-shot {@code false} on input clear or blur. */
  sendTyping(peerId: number, isTyping: boolean): void {
    this.api.postTyping(peerId, isTyping).subscribe({ error: () => {} });
  }

  /** Fire a 1:1 DM. Used by the composer for any of the six shapes the legacy client emitted. */
  sendDm(peerId: number, kind: DmKind, fields: Partial<SendDmBody>): void {
    this.api.postSendMessage(peerId, { kind, ...fields }).subscribe({ error: () => {} });
  }

  private dispatch(ev: ImEvent): void {
    switch (ev.type) {
      case 'text_message':
        this.push(ev.fromUserId, ev.fromUserId, {
          id: uid(),
          type: 'text',
          text: ev.text,
          ts: ev.ts,
        });
        break;
      case 'image_message':
        this.push(ev.fromUserId, ev.fromUserId, {
          id: uid(),
          type: 'image',
          imageUrl: ev.imageUrl,
          ts: ev.ts,
        });
        break;
      case 'gift_message':
        this.push(ev.fromUserId, ev.fromNickname, {
          id: uid(),
          type: 'gift',
          giftId: ev.giftId,
          count: ev.count,
          fromNickname: ev.fromNickname,
          ts: Date.now(),
        });
        break;
      case 'introduction_message':
        this.push(ev.fromUserId, ev.fromNickname, {
          id: uid(),
          type: 'introduction',
          fromNickname: ev.fromNickname,
          ts: Date.now(),
        });
        break;
      case 'voice_room_shared':
        this.push(ev.fromNickname, ev.fromNickname, {
          id: uid(),
          type: 'voice_room_shared',
          cname: ev.cname,
          voiceCount: ev.count,
          ts: Date.now(),
        });
        break;
      case 'live_room_shared':
        this.push(ev.fromNickname, ev.fromNickname, {
          id: uid(),
          type: 'live_room_shared',
          cname: ev.cname,
          ts: Date.now(),
        });
        break;
      case 'typing_indicator':
        this.setTyping(ev.fromUserId, ev.isTyping);
        break;
      case 'message_ack':
        // Upstream confirmed an outbound DM. prefix == 0 is the legacy "empty / failure
        // ACK" marker (≤16-byte body) — leave the bubble alone. Non-zero prefix is the
        // normal received-by-upstream state, which is what "delivered" means here.
        if (ev.prefix !== 0 && ev.msgId) {
          this.markDelivered(ev.msgId);
        }
        break;
    }
  }

  private push(userId: string, nickname: string, msg: DmMessage): void {
    this.pushPublic(userId, nickname, msg);
  }

  /**
   * Public wrapper around the same {@code push} used by inbound events. Used by the composer
   * to mirror outbound DMs into the local cache so the sender sees their own bubble appear
   * immediately without waiting for the upstream echo (which can lag the typing-state light).
   */
  pushPublic(userId: string, nickname: string, msg: DmMessage): void {
    const isSelected = this._selectedId() === userId;
    this._convMap.update(m => {
      const existing = m.get(userId);
      const next: DmConversation = existing
        ? {
            ...existing,
            nickname: nickname || existing.nickname,
            messages: [...existing.messages, msg].slice(-MAX_MESSAGES),
            unread: isSelected ? 0 : existing.unread + 1,
            lastTs: msg.ts,
            isTyping: false,
          }
        : {
            userId,
            nickname: nickname || userId,
            messages: [msg],
            unread: isSelected ? 0 : 1,
            lastTs: msg.ts,
            isTyping: false,
          };
      return new Map(m).set(userId, next);
    });
  }

  private setTyping(userId: string, isTyping: boolean): void {
    this._convMap.update(m => {
      const c = m.get(userId);
      if (!c) return m;
      return new Map(m).set(userId, { ...c, isTyping });
    });
  }

  /** Find any outbound bubble with this msgId across every conversation and flip its
   *  {@code delivery} flag to {@code 'delivered'}. The msgId is unique per send, so
   *  there is exactly one bubble to update. Conversations stay untouched when no
   *  bubble matches — happens when the composer hasn't mirrored the DM yet (server
   *  MSG-ACK arriving faster than the local echo). */
  private markDelivered(msgId: string): void {
    this._convMap.update(m => {
      let touched = false;
      const next = new Map<string, DmConversation>();
      for (const [k, c] of m) {
        const idx = c.messages.findIndex((x: DmMessage) => x.id === msgId);
        if (idx === -1 || c.messages[idx].delivery === 'delivered') {
          next.set(k, c);
          continue;
        }
        const updated: DmMessage = { ...c.messages[idx], delivery: 'delivered' };
        const msgs = [...c.messages];
        msgs[idx] = updated;
        next.set(k, { ...c, messages: msgs });
        touched = true;
      }
      return touched ? next : m;
    });
  }
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
