import { Service, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { StorageService } from '@core/services/storage.service';
import { UserInfoService } from '@core/services/user-info.service';
import { AuthStore } from '@core/auth/auth.store';
import type { IntroductionPayload } from '@core/realtime/dm-send-payload.model';
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

  sendImage(peerId: number, body: { url: string; width?: number; height?: number; size?: number; mimeType?: string }): boolean {
    const me = this.authStore.user();
    if (!me) return false;
    const msgId = crypto.randomUUID();
    const ts = Date.now();
    const sent = this.transport.sendImage(peerId, {
      msgId,
      url: body.url,
      ...(body.width != null ? { width: body.width } : {}),
      ...(body.height != null ? { height: body.height } : {}),
      ...(body.size != null ? { size: body.size } : {}),
      ...(body.mimeType != null ? { mimeType: body.mimeType } : {}),
      fromNickname: me.nickname,
      fromProfileTs: ts,
    });
    if (sent == null) return false;
    const message: ChatMessage = {
      id: msgId,
      type: 'image',
      imageUrl: body.url,
      ts,
      fromUserId: String(me.userId),
      fromNickname: me.nickname,
      fromHeadUrl: me.headUrl,
      delivery: 'sent',
    };
    this.push(peerId, message);
    return true;
  }

  sendGift(peerId: number, gift: import('@core/realtime/dm-send-payload.model').DmSendGift): boolean {
    const me = this.authStore.user();
    if (!me) return false;
    const msgId = crypto.randomUUID();
    const ts = Date.now();
    const sent = this.transport.sendGift(peerId, {
      msgId,
      gift,
      fromNickname: me.nickname,
      fromProfileTs: ts,
    });
    if (sent == null) return false;
    const message: ChatMessage = {
      id: msgId,
      type: 'gift',
      giftId: gift.id,
      count: 1,
      ts,
      fromUserId: String(me.userId),
      fromNickname: me.nickname,
      fromHeadUrl: me.headUrl,
      delivery: 'sent',
    };
    this.push(peerId, message);
    return true;
  }

  sendVoiceRoom(peerId: number, cname: string): boolean {
    const me = this.authStore.user();
    if (!me) return false;
    const msgId = crypto.randomUUID();
    const ts = Date.now();
    const sent = this.transport.sendVoiceRoom(peerId, {
      msgId,
      cname,
      fromNickname: me.nickname,
      fromProfileTs: ts,
    });
    if (sent == null) return false;
    const message: ChatMessage = {
      id: msgId,
      type: 'voice_room_shared',
      cname,
      ts,
      fromUserId: String(me.userId),
      fromNickname: me.nickname,
      fromHeadUrl: me.headUrl,
      delivery: 'sent',
    };
    this.push(peerId, message);
    return true;
  }

  sendLiveLink(peerId: number, cname: string): boolean {
    const me = this.authStore.user();
    if (!me) return false;
    const msgId = crypto.randomUUID();
    const ts = Date.now();
    const sent = this.transport.sendLiveLink(peerId, {
      msgId,
      cname,
      fromNickname: me.nickname,
      fromProfileTs: ts,
    });
    if (sent == null) return false;
    const message: ChatMessage = {
      id: msgId,
      type: 'live_room_shared',
      cname,
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
          // Use the upstream-issued msgId when present so a subsequent message_ack can
          // correlate the inbound echo with our outbound optimistic echo (the one we minted
          // via crypto.randomUUID() at sendText() time) — both must share an id for
          // dedupeAndAppend to drop the duplicate and for updateDelivery to find the row.
          // Falls back to a fresh local UUID only when the relay omitted msgId (very old
          // builds, replayed history without msgId, etc.).
          id: ev.msgId ?? crypto.randomUUID(),
          type: 'text',
          text: ev.text,
          ts: ev.ts,
          fromUserId: ev.peerUserId,
          fromNickname: ev.fromNickname,
          fromHeadUrl: ev.fromHeadUrl,
        });
        this.maybeAutoReadReceipt(ev.peerUserId);
        return;
      }
      case 'image_message': {
        this.push(ev.peerUserId, {
          id: ev.msgId ?? crypto.randomUUID(),
          type: 'image',
          imageUrl: ev.imageUrl,
          ts: ev.ts,
          fromUserId: ev.peerUserId,
          fromNickname: ev.fromNickname,
          fromHeadUrl: ev.fromHeadUrl,
        });
        this.maybeAutoReadReceipt(ev.peerUserId);
        return;
      }
      case 'gift_message': {
        this.push(ev.peerUserId, {
          id: ev.msgId ?? crypto.randomUUID(),
          type: 'gift',
          giftId: ev.giftId,
          count: ev.count,
          ts: Date.now(),
          fromUserId: ev.peerUserId,
          fromNickname: ev.fromNickname,
          fromHeadUrl: ev.fromHeadUrl,
        });
        this.maybeAutoReadReceipt(ev.peerUserId);
        return;
      }
      case 'introduction_message': {
        this.push(ev.peerUserId, {
          id: ev.msgId ?? crypto.randomUUID(),
          type: 'introduction',
          target: ev.target,
          ts: ev.ts,
          fromUserId: ev.peerUserId,
          fromNickname: ev.fromNickname,
          fromHeadUrl: ev.fromHeadUrl,
        });
        this.maybeAutoReadReceipt(ev.peerUserId);
        return;
      }
      case 'voice_room_shared': {
        const msg: ChatMessage = {
          id: ev.msgId ?? crypto.randomUUID(),
          type: 'voice_room_shared',
          cname: ev.cname,
          ts: Date.now(),
          fromUserId: ev.peerUserId,
          fromNickname: ev.fromNickname,
          fromHeadUrl: ev.fromHeadUrl,
          ...(ev.listenerCount != null ? { listenerCount: ev.listenerCount } : {}),
        };
        this.push(ev.peerUserId, msg);
        this.maybeAutoReadReceipt(ev.peerUserId);
        return;
      }
      case 'live_room_shared': {
        this.push(ev.peerUserId, {
          id: ev.msgId ?? crypto.randomUUID(),
          type: 'live_room_shared',
          cname: ev.cname,
          ts: Date.now(),
          fromUserId: ev.peerUserId,
          fromNickname: ev.fromNickname,
          fromHeadUrl: ev.fromHeadUrl,
        });
        this.maybeAutoReadReceipt(ev.peerUserId);
        return;
      }
      case 'typing_indicator': {
        this._conversations.update((m) => setConversationTyping(m, ev.peerUserId, ev.isTyping));
        return;
      }
      case 'message_ack': {
        // DecodeCmd16386 (smali) sends back the binary body
        //   [LE-u16 strLen][utf8 msgId][LE-u64 sequence][prefix byte]
        // — the prefix byte is the FIRST byte of the upstream envelope's binary response; for a
        // successful MSG-ACK it is non-zero (any non-zero prefix == "delivered" by upstream
        // convention), and a prefix of zero indicates the upstream accepted the echo but did not
        // deliver to the peer (still 'sent'). The previous code had this inverted and was
        // dropping every successful delivery update.
        this.updateDelivery(ev.msgId, ev.prefix !== 0 ? 'delivered' : null, 'sent');
        return;
      }
      case 'read_receipt': {
        this.updateDelivery(ev.msgId, 'read', 'sent', 'delivered');
        return;
      }
    }
  }

  /**
   * When a new message arrives in the conversation currently selected on screen, mark it read
   * + send a read-receipt immediately — the user is looking at it. This used to only happen on
   * conversation {@code select()}, which left a class of inbound messages "seen but un-read" for
   * the entire duration of the chat session.
   */
  private maybeAutoReadReceipt(peerUserId: string): void {
    const selected = this._selectedPeerId();
    if (selected !== peerUserId) return;
    const numeric = asNumericPeerId(peerUserId);
    if (!Number.isFinite(numeric)) return;
    const msgId = this.lastInboundMsgId(numeric);
    if (!msgId) return;
    const info = this.userInfo.getUserInfo(numeric);
    const fallbackNickname = info?.nickname?.trim() || info?.username?.trim() || peerUserId;
    const fallbackHeadUrl = info?.details?.base?.headUrl ?? null;
    this._conversations.update((m) => markConversationRead(m, peerUserId, fallbackNickname, fallbackHeadUrl));
    this.transport.sendReadReceipt(numeric, msgId);
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