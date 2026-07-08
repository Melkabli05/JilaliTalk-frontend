import { Service, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ImSocketService } from '@core/realtime/im-socket.service';
import { StorageService } from '@core/services/storage.service';
import { UserInfoService } from '@core/services/user-info.service';
import { API_BASE_URL } from '@core/tokens/api-base-url.token';
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

@Service({ autoProvided: false })
export class MessagesStore {
  private readonly imSocket = inject(ImSocketService);
  private readonly storage = inject(StorageService);
  private readonly userInfoService = inject(UserInfoService);

  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/im/messages`;

  private readonly _convMap = signal(
    this.storage.get<[string, DmConversation][]>(STORAGE_KEY)?.reduce(
      (acc, [k, v]) => acc.set(k, { ...v, isTyping: false, unread: 0 }),
      new Map<string, DmConversation>(),
    ) ?? new Map(),
  );
  private readonly _msgIndex = new Map<string, string>(); // msgId -> userId
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

  constructor() {
    effect(() => {
      for (const ev of this.imSocket.events()) this.dispatch(ev);
    });

    effect(() => {
      const entries = [...this._convMap().entries()]
        .sort(([, a], [, b]) => b.lastTs - a.lastTs)
        .slice(0, MAX_CONVERSATIONS);
      this.storage.set(STORAGE_KEY, entries);
    });
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
    if (Number.isFinite(numeric)) {
      const msgId = this.lastInboundMsgId(numeric);
      if (msgId != null) {
        this.http.post(`${this.baseUrl}/${numeric}/read`, { msgId }).subscribe({ error: () => {} });
      }
    }
  }

  back(): void {
    this._selectedId.set(null);
  }

  markReadForLastInbound(peerId: number, msgId: string): void {
    this.http.post(`${this.baseUrl}/${peerId}/read`, { msgId }).subscribe({ error: () => {} });
  }

  lastInboundMsgId(peerId: number): string | null {
    const c = this._convMap().get(String(peerId));
    if (!c || c.messages.length === 0) return null;
    return c.messages[c.messages.length - 1].id;
  }

  sendTyping(peerId: number, isTyping: boolean): void {
    this.http.post(`${this.baseUrl}/${peerId}/typing`, { typing: isTyping }).subscribe({ error: () => {} });
  }

  sendDm(peerId: number, kind: DmKind, fields: Partial<SendDmBody>): void {
    this.http.post(`${this.baseUrl}/${peerId}/send`, { kind, ...fields }).subscribe({ error: () => {} });
  }

  pushPublic(userId: string, nickname: string, msg: DmMessage): void {
    if (msg.id) this._msgIndex.set(msg.id, userId);
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

  private dispatch(ev: ImEvent): void {
    switch (ev.type) {
      case 'text_message':
        this.pushPublic(ev.fromUserId, ev.fromUserId, {
          id: uid(),
          type: 'text',
          text: ev.text,
          ts: ev.ts,
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
        if (ev.prefix !== 0 && ev.msgId) {
          const userId = this._msgIndex.get(ev.msgId);
          if (userId == null) break;
          this._convMap.update(m => {
            const c = m.get(userId);
            if (!c) return m;
            const idx = c.messages.findIndex((x: DmMessage) => x.id === ev.msgId);
            if (idx === -1 || c.messages[idx].delivery === 'delivered') return m;
            const msgs = [...c.messages];
            msgs[idx] = { ...msgs[idx], delivery: 'delivered' };
            return new Map(m).set(userId, { ...c, messages: msgs });
          });
        }
        break;
    }
  }
}
