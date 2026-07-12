import type { StorageService } from '@core/services/storage.service';
import type { DmConversation } from '../models/dm.model';

/**
 * Owns the conversation table's localStorage read/write — split out of `MessagesStore` so
 * that store's job stays "own conversation state," not also "know how to debounce a write or
 * shape the persisted payload." Writes are debounced (`schedule`) so a burst of rapid store
 * mutations (a peer's per-keystroke typing indicator, several messages arriving back to back)
 * collapses into one `JSON.stringify` + `localStorage.setItem` instead of re-serializing the
 * whole table synchronously on every single change — that synchronous-on-every-mutation
 * pattern was the main cause of jank while a conversation partner was typing.
 */
export class DmConversationPersistence {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: ReadonlyMap<string, DmConversation> | null = null;

  constructor(
    private readonly storage: StorageService,
    private readonly storageKey: string,
    private readonly maxConversations: number,
    private readonly debounceMs: number,
  ) {}

  /** Reads the persisted table, resetting `isTyping`/`unread` — a typing flicker or unread
   *  count from a prior session is stale the instant the app reloads (the socket reconnects
   *  and either the peer isn't mid-keystroke anymore, or the conversation gets re-selected). */
  load(): Map<string, DmConversation> {
    const saved = this.storage.get<readonly (readonly [string, DmConversation])[]>(this.storageKey);
    if (!saved) return new Map();
    return saved.reduce(
      (acc, [userId, conv]) => acc.set(userId, { ...conv, isTyping: false, unread: 0 }),
      new Map<string, DmConversation>(),
    );
  }

  schedule(map: ReadonlyMap<string, DmConversation>): void {
    this.pending = map;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, this.debounceMs);
  }

  /** Writes any pending scheduled state immediately — called on store destroy so navigating
   *  away mid-debounce-window never silently drops the last change. */
  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const map = this.pending;
    this.pending = null;
    if (!map) return;
    const entries = [...map.entries()]
      .sort(([, a], [, b]) => b.lastTs - a.lastTs)
      .slice(0, this.maxConversations);
    this.storage.set(this.storageKey, entries);
  }
}
