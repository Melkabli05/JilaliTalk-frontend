import { Service, computed, effect, inject, signal } from '@angular/core';
import { ImSocketService } from '@core/realtime/im-socket.service';
import { StorageService } from '@core/services/storage.service';
import type { ImEvent } from '@core/realtime/im-events';
import type { DmConversation, DmMessage } from '../models/dm.model';

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
    this._selectedId.set(userId);
    this._convMap.update(m => {
      const c = m.get(userId);
      if (!c || c.unread === 0) return m;
      return new Map(m).set(userId, { ...c, unread: 0 });
    });
  }

  back(): void {
    this._selectedId.set(null);
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
      case 'typing_indicator':
        this.setTyping(ev.fromUserId, ev.isTyping);
        break;
    }
  }

  private push(userId: string, nickname: string, msg: DmMessage): void {
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
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
