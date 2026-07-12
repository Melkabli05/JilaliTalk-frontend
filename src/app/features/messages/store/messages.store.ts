import { DestroyRef, Service, computed, effect, inject, signal } from '@angular/core';
import { HtImConnectionService } from '@core/realtime/ht-im-connection.service';
import type { ImEventSource, ImMessageSender } from '@core/realtime/im-connection-roles';
import { StorageService } from '@core/services/storage.service';
import { UserInfoService } from '@core/services/user-info.service';
import { AuthStore } from '@core/auth/auth.store';
import type { DmSendGift, DmSendPayload } from '@core/realtime/ht-protocol/packet-framer.util';
import type { ImEvent } from '@core/realtime/im-events';
import { uid } from '../utils/dm-formatting.util';
import type { DmConversation, DmMessage } from '../models/dm.model';

export type DmKind = 'text' | 'image' | 'voice_room' | 'live_link' | 'introduction' | 'send_gift';

export interface SendDmBody {
  readonly kind: DmKind;
  readonly msgId?: string | undefined;
  readonly fromId?: number | undefined;
  readonly fromNickname?: string | undefined;
  readonly fromProfileTs?: number | undefined;
  readonly text?: string | undefined;
  readonly url?: string | undefined;
  readonly localPath?: string | undefined;
  readonly size?: number | undefined;
  readonly width?: number | undefined;
  readonly height?: number | undefined;
  readonly mimeType?: string | undefined;
  readonly roomData?: unknown;
  readonly gift?: unknown;
}

const STORAGE_KEY = 'jilali_dm_v1';
const MAX_MESSAGES = 200;
const MAX_CONVERSATIONS = 100;
/** Coalesces bursts of rapid store mutations (a peer's per-keystroke typing indicator, a
 *  fast run of incoming messages) into one write instead of re-serializing the whole
 *  conversation table synchronously on every single signal change. */
const PERSIST_DEBOUNCE_MS = 500;

@Service({ autoProvided: false })
export class MessagesStore {
  private readonly htIm: ImEventSource & ImMessageSender = inject(HtImConnectionService);
  private readonly storage = inject(StorageService);
  private readonly userInfoService = inject(UserInfoService);
  private readonly authStore = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);

  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingPersist: ReadonlyMap<string, DmConversation> | null = null;

  private readonly _convMap = signal(
    this.storage.get<[string, DmConversation][]>(STORAGE_KEY)?.reduce(
      (acc, [k, v]) => acc.set(k, { ...v, isTyping: false, unread: 0 }),
      new Map<string, DmConversation>(),
    ) ?? new Map(),
  );
  private readonly _msgIndex = new Map<string, string>(); // msgId -> userId
  private readonly _selectedId = signal<string | null>(null);
  private processedEventCount = 0;

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

  constructor() {
    effect(() => {
      const events = this.htIm.events();
      if (events.length < this.processedEventCount) {
        // Log was reset (disconnect/reconnect) — start over from the beginning.
        this.processedEventCount = 0;
      }
      for (const event of events.slice(this.processedEventCount)) {
        this.dispatch(event);
      }
      this.processedEventCount = events.length;
    });

    effect(() => {
      this.schedulePersist(this._convMap());
    });

    this.destroyRef.onDestroy(() => {
      if (!this.persistTimer) return;
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
      this.persistNow();
    });
  }

  private schedulePersist(map: ReadonlyMap<string, DmConversation>): void {
    this.pendingPersist = map;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persistNow();
    }, PERSIST_DEBOUNCE_MS);
  }

  private persistNow(): void {
    const map = this.pendingPersist;
    this.pendingPersist = null;
    if (!map) return;
    const entries = [...map.entries()]
      .sort(([, a], [, b]) => b.lastTs - a.lastTs)
      .slice(0, MAX_CONVERSATIONS);
    this.storage.set(STORAGE_KEY, entries);
  }

  select(userId: string): void {
    this._selectedId.set(userId);
    this._convMap.update(m => {
      const existing = m.get(userId);
      if (existing) {
        if (existing.unread === 0 && existing.messages.length > 0) return m;
        return new Map(m).set(userId, { ...existing, unread: 0 });
      }
      const numeric = Number(userId);
      const info = Number.isFinite(numeric) ? this.userInfoService.getUserInfo(numeric) : null;
      const placeholder: DmConversation = {
        userId,
        nickname: info?.nickname?.trim() || info?.username?.trim() || userId,
        messages: [],
        unread: 0,
        lastTs: 0,
        isTyping: false,
      };
      return new Map(m).set(userId, placeholder);
    });

    const numeric = Number(userId);
    const msgId = Number.isFinite(numeric) ? this.lastInboundMsgId(numeric) : null;
    if (msgId != null) this.markReadForLastInbound(numeric, msgId);
  }

  back(): void {
    this._selectedId.set(null);
  }

  markReadForLastInbound(peerId: number, msgId: string): void {
    this.htIm.sendReadReceipt(peerId, msgId);
  }

  lastInboundMsgId(peerId: number): string | null {
    const c = this._convMap().get(String(peerId));
    if (!c || c.messages.length === 0) return null;
    return c.messages[c.messages.length - 1].id;
  }

  sendTyping(peerId: number, isTyping: boolean): void {
    this.htIm.sendTyping(peerId, isTyping);
  }

  sendDm(peerId: number, kind: DmKind, fields: Partial<SendDmBody>): void {
    const payload = this.toSendPayload(kind, fields);
    if (!payload) return;
    const self = this.authStore.user();
    this.htIm.sendDm(peerId, payload, self?.nickname ?? '', 0, fields.msgId);
  }

  private toSendPayload(kind: DmKind, fields: Partial<SendDmBody>): DmSendPayload | null {
    switch (kind) {
      case 'text':
        return { kind: 'text', text: fields.text ?? '' };
      case 'image':
        return {
          kind: 'image',
          url: fields.url ?? '',
          ...(fields.localPath !== undefined ? { localPath: fields.localPath } : {}),
          ...(fields.size !== undefined ? { size: fields.size } : {}),
          ...(fields.width !== undefined ? { width: fields.width } : {}),
          ...(fields.height !== undefined ? { height: fields.height } : {}),
          ...(fields.mimeType !== undefined ? { mimeType: fields.mimeType } : {}),
        };
      case 'introduction':
        return { kind: 'introduction', roomData: fields.roomData };
      case 'voice_room':
        return { kind: 'voice_room', roomData: fields.roomData };
      case 'live_link':
        return { kind: 'live_link', roomData: fields.roomData };
      case 'send_gift':
        return fields.gift ? { kind: 'send_gift', gift: fields.gift as DmSendGift } : null;
      default:
        return null;
    }
  }

  pushPublic(userId: string, nickname: string, msg: DmMessage): void {
    if (msg.id) this._msgIndex.set(msg.id, userId);
    const isSelected = this._selectedId() === userId;
    this._convMap.update(m => {
      const existing = m.get(userId) ?? {
        userId,
        nickname: userId,
        messages: [],
        unread: 0,
        lastTs: 0,
        isTyping: false,
      };
      const next: DmConversation = {
        ...existing,
        nickname: nickname || existing.nickname,
        messages: [...existing.messages, msg].slice(-MAX_MESSAGES),
        unread: isSelected ? 0 : existing.unread + 1,
        lastTs: msg.ts,
        isTyping: false,
      };
      return new Map(m).set(userId, next);
    });
  }

  private dispatch(ev: ImEvent): void {
    switch (ev.type) {
      case 'text_message':
        this.pushPublic(ev.fromUserId, ev.fromNickname || ev.fromUserId, {
          id: uid(),
          type: 'text',
          text: ev.text,
          fromNickname: ev.fromNickname,
          ts: ev.ts,
        });
        break;
      case 'image_message':
        this.pushPublic(ev.fromUserId, ev.fromNickname || ev.fromUserId, {
          id: uid(),
          type: 'image',
          imageUrl: ev.imageUrl,
          fromNickname: ev.fromNickname,
          ts: ev.ts,
        });
        break;
      case 'gift_message':
        this.pushPublic(ev.fromUserId, ev.fromNickname || ev.fromUserId, {
          id: uid(),
          type: 'gift',
          giftId: ev.giftId,
          count: ev.count,
          fromNickname: ev.fromNickname,
          ts: Date.now(),
        });
        break;
      case 'introduction_message':
        this.pushPublic(ev.fromUserId, ev.fromNickname || ev.fromUserId, {
          id: uid(),
          type: 'introduction',
          fromNickname: ev.fromNickname,
          ts: Date.now(),
        });
        break;
      case 'voice_room_shared':
        this.pushPublic(ev.fromUserId, ev.fromNickname || ev.fromUserId, {
          id: uid(),
          type: 'voice_room_shared',
          cname: ev.cname,
          voiceCount: ev.count,
          fromNickname: ev.fromNickname,
          ts: Date.now(),
        });
        break;
      case 'live_room_shared':
        this.pushPublic(ev.fromUserId, ev.fromNickname || ev.fromUserId, {
          id: uid(),
          type: 'live_room_shared',
          cname: ev.cname,
          fromNickname: ev.fromNickname,
          ts: Date.now(),
        });
        break;
      case 'typing_indicator':
        this._convMap.update(m => {
          const c = m.get(ev.fromUserId);
          if (!c) return m;
          return new Map(m).set(ev.fromUserId, { ...c, isTyping: ev.isTyping });
        });
        break;
      case 'message_ack':
        this.updateDeliveryForMsgId(ev.msgId, ev.prefix !== 0 ? 'delivered' : null, 'sent');
        break;
      case 'read_receipt':
        this.updateDeliveryForMsgId(ev.msgId, 'read', 'sent', 'delivered');
        break;
    }
  }

  /** Advances a locally-sent message's delivery state, keyed by msgId via `_msgIndex`.
   *  `from` restricts which current states are eligible to advance (so a stray/duplicate
   *  event can't move a message backwards or re-trigger an already-applied transition). */
  private updateDeliveryForMsgId(
    msgId: string,
    to: DmMessage['delivery'] | null,
    ...from: readonly NonNullable<DmMessage['delivery']>[]
  ): void {
    if (!to || !msgId) return;
    const userId = this._msgIndex.get(msgId);
    if (userId == null) return;
    this._convMap.update(m => {
      const c = m.get(userId);
      if (!c) return m;
      const idx = c.messages.findIndex((x: DmMessage) => x.id === msgId);
      if (idx === -1) return m;
      const current = c.messages[idx].delivery;
      if (current === to || !from.includes(current ?? 'sent')) return m;
      const msgs = [...c.messages];
      msgs[idx] = { ...msgs[idx], delivery: to };
      return new Map(m).set(userId, { ...c, messages: msgs });
    });
  }
}
