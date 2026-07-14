import { Service, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { StorageService } from '@core/services/storage.service';
import { UserInfoService } from '@core/services/user-info.service';
import { AuthStore } from '@core/auth/auth.store';
import type { IntroductionPayload } from '@core/realtime/ht-protocol/packet-framer.util';
import type {
  ChatConversation,
  ChatDelivery,
  ChatMessage,
} from '../models/chat-message.model';
import { asNumericPeerId, asPeerId } from '../utils/chat-ids';
import { sortConversationsByRecency } from '../utils/chat-sort.util';
import {
  markConversationRead,
  resolveIdentity,
  setConversationTyping,
  updateMessageDelivery,
  upsertConversation,
} from '../utils/chat-conversation.util';
import { createConversationPersistence } from '../utils/chat-persistence.util';
import type { ChatTransport, ChatTransportEvent } from '../data-access/chat.port';
import { CHAT_TRANSPORT } from './chat.tokens';

const STORAGE_KEY = 'jilali_chat_v1';
const PERSIST_DEBOUNCE_MS = 500;

@Service({ autoProvided: false })
export class ChatStore {
  private readonly transport: ChatTransport = inject(CHAT_TRANSPORT);
  private readonly userInfo: UserInfoService = inject(UserInfoService);
  private readonly authStore: AuthStore = inject(AuthStore);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  private readonly persistence = createConversationPersistence(
    inject(StorageService),
    STORAGE_KEY,
    PERSIST_DEBOUNCE_MS,
  );

  private readonly _conversations = signal<ReadonlyMap<string, ChatConversation>>(
    this.persistence.load(),
  );
  private readonly _selectedPeerId = signal<string | null>(null);
  private readonly msgIndex = new Map<string, string>();
  private processedEventCount = 0;

  readonly conversations = computed(() =>
    sortConversationsByRecency([...this._conversations().values()].map((c) => this.resolveDisplayIdentity(c))),
  );
  readonly selectedPeerId = this._selectedPeerId.asReadonly();
  readonly selectedConversation = computed(() => {
    const id = this._selectedPeerId();
    const conv = id ? this._conversations().get(id) : null;
    return conv ? this.resolveDisplayIdentity(conv) : null;
  });
  readonly connectionStatus = computed(() => this.transport.status());
  readonly totalUnread = computed(() =>
    [...this._conversations().values()].reduce((s, c) => s + c.unread, 0),
  );

  constructor() {
    effect(() => {
      const events = this.transport.events();
      const count = events.length;
      if (count < this.processedEventCount) {
        this.processedEventCount = 0;
      }
      for (const ev of events.slice(this.processedEventCount)) {
        this.dispatch(ev);
      }
      this.processedEventCount = count;
    });

    effect(() => this.persistence.schedule(this._conversations()));

    effect(() => {
      for (const c of this._conversations().values()) {
        if (c.nickname !== c.peerUserId && c.headUrl) continue;
        const numeric = asNumericPeerId(c.peerUserId);
        if (Number.isFinite(numeric)) this.userInfo.ensureFresh(numeric);
      }
    });

    this.destroyRef.onDestroy(() => this.persistence.flush());
  }

  select(peerUserId: string | number): void {
    const id = asPeerId(peerUserId);
    this._selectedPeerId.set(id);
    const numeric = asNumericPeerId(id);
    const info = Number.isFinite(numeric) ? this.userInfo.getUserInfo(numeric) : null;
    const fallbackNickname = info?.nickname?.trim() || info?.username?.trim() || id;
    const fallbackHeadUrl = info?.details?.base?.headUrl ?? null;
    this._conversations.update((m) => markConversationRead(m, id, fallbackNickname, fallbackHeadUrl));
    const msgId = this.lastInboundMsgId(numeric);
    if (msgId && Number.isFinite(numeric)) this.transport.sendReadReceipt(numeric, msgId);
  }

  deselect(): void {
    this._selectedPeerId.set(null);
  }

  sendText(peerId: number, text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) return false;
    const me = this.authStore.user();
    if (!me) return false;
    const msgId = crypto.randomUUID();
    const ts = Date.now();
    const sent = this.transport.sendText(peerId, {
      msgId,
      text: trimmed,
      fromNickname: me.nickname,
      fromProfileTs: ts,
    });
    if (sent == null) return false;
    const message: ChatMessage = {
      id: msgId,
      type: 'text',
      text: trimmed,
      ts,
      fromUserId: String(me.userId),
      fromNickname: me.nickname,
      fromHeadUrl: me.headUrl,
      delivery: 'sent',
    };
    this.push(peerId, message);
    return true;
  }

  sendIntroduction(peerId: number, target: IntroductionPayload): boolean {
    const me = this.authStore.user();
    if (!me) return false;
    const msgId = crypto.randomUUID();
    const ts = Date.now();
    const sent = this.transport.sendIntroduction(peerId, {
      msgId,
      fromNickname: me.nickname,
      fromProfileTs: ts,
      target,
    });
    if (sent == null) return false;
    const message: ChatMessage = {
      id: msgId,
      type: 'introduction',
      target,
      ts,
      fromUserId: String(me.userId),
      fromNickname: me.nickname,
      fromHeadUrl: me.headUrl,
      delivery: 'sent',
    };
    this.push(peerId, message);
    return true;
  }

  setTyping(peerId: number, isTyping: boolean): void {
    this.transport.sendTyping(peerId, isTyping);
  }

  retryConnection(): void {
    this.transport.connect();
  }

  private push(peerId: string | number, message: ChatMessage): void {
    const peerUserId = asPeerId(peerId);
    const isSelected = this._selectedPeerId() === peerUserId;
    const { map, evictedMessageIds } = upsertConversation(this._conversations(), peerUserId, message, isSelected);
    for (const id of evictedMessageIds) this.msgIndex.delete(id);
    if (message.id) this.msgIndex.set(message.id, peerUserId);
    this._conversations.set(map);
  }

  private dispatch(ev: ChatTransportEvent): void {
    switch (ev.type) {
      case 'text_message': {
        this.push(ev.peerUserId, {
          id: crypto.randomUUID(),
          type: 'text',
          text: ev.text,
          ts: ev.ts,
          fromUserId: ev.peerUserId,
          fromNickname: ev.fromNickname,
          fromHeadUrl: ev.fromHeadUrl,
        });
        return;
      }
      case 'image_message': {
        this.push(ev.peerUserId, {
          id: crypto.randomUUID(),
          type: 'image',
          imageUrl: ev.imageUrl,
          ts: ev.ts,
          fromUserId: ev.peerUserId,
          fromNickname: ev.fromNickname,
          fromHeadUrl: ev.fromHeadUrl,
        });
        return;
      }
      case 'gift_message': {
        this.push(ev.peerUserId, {
          id: crypto.randomUUID(),
          type: 'gift',
          giftId: ev.giftId,
          count: ev.count,
          ts: ev.ts,
          fromUserId: ev.peerUserId,
          fromNickname: ev.fromNickname,
          fromHeadUrl: ev.fromHeadUrl,
        });
        return;
      }
      case 'introduction_message': {
        this.push(ev.peerUserId, {
          id: crypto.randomUUID(),
          type: 'introduction',
          target: ev.target,
          ts: ev.ts,
          fromUserId: ev.peerUserId,
          fromNickname: ev.fromNickname,
          fromHeadUrl: ev.fromHeadUrl,
        });
        return;
      }
      case 'voice_room_shared': {
        const msg: ChatMessage = {
          id: crypto.randomUUID(),
          type: 'voice_room_shared',
          cname: ev.cname,
          ts: ev.ts,
          fromUserId: ev.peerUserId,
          fromNickname: ev.fromNickname,
          fromHeadUrl: ev.fromHeadUrl,
          ...(ev.listenerCount != null ? { listenerCount: ev.listenerCount } : {}),
        };
        this.push(ev.peerUserId, msg);
        return;
      }
      case 'live_room_shared': {
        this.push(ev.peerUserId, {
          id: crypto.randomUUID(),
          type: 'live_room_shared',
          cname: ev.cname,
          ts: ev.ts,
          fromUserId: ev.peerUserId,
          fromNickname: ev.fromNickname,
          fromHeadUrl: ev.fromHeadUrl,
        });
        return;
      }
      case 'typing_indicator': {
        this._conversations.update((m) => setConversationTyping(m, ev.peerUserId, ev.isTyping));
        return;
      }
      case 'message_ack': {
        this.updateDelivery(ev.msgId, ev.prefix !== 0 ? 'delivered' : null, 'sent');
        return;
      }
      case 'read_receipt': {
        this.updateDelivery(ev.msgId, 'read', 'sent', 'delivered');
        return;
      }
    }
  }

  private updateDelivery(msgId: string, to: ChatDelivery | null, ...from: readonly ChatDelivery[]): void {
    if (!to || !msgId) return;
    const peerUserId = this.msgIndex.get(msgId);
    if (!peerUserId) return;
    this._conversations.update((m) => updateMessageDelivery(m, peerUserId, msgId, to, from));
  }

  private lastInboundMsgId(peerId: number): string | null {
    const conv = this._conversations().get(asPeerId(peerId));
    if (!conv) return null;
    for (let i = conv.messages.length - 1; i >= 0; i--) {
      const m = conv.messages[i];
      if (m && !m.delivery) return m.id;
    }
    return null;
  }

  private resolveDisplayIdentity(conv: ChatConversation): ChatConversation {
    if (conv.nickname !== conv.peerUserId && conv.headUrl) return conv;
    const numeric = asNumericPeerId(conv.peerUserId);
    const info = Number.isFinite(numeric) ? this.userInfo.getUserInfo(numeric) : null;
    if (!info) return conv;
    return resolveIdentity(conv, info.nickname ?? null, info.details?.base?.headUrl ?? null);
  }
}