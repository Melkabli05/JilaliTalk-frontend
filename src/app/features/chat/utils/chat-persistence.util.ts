import type { ChatConversation } from '../models/chat-message.model';

const STORAGE_VERSION = 1;

interface PersistedShape {
  readonly v: typeof STORAGE_VERSION;
  readonly conversations: readonly ChatConversation[];
}

export interface ConversationPersistence {
  load(): ReadonlyMap<string, ChatConversation>;
  schedule(conv: ReadonlyMap<string, ChatConversation>): void;
  flush(): void;
}

export function createConversationPersistence(
  storage: { get<T>(key: string): T | null; set<T>(key: string, value: T): void },
  storageKey: string,
  debounceMs: number,
): ConversationPersistence {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: ReadonlyMap<string, ChatConversation> | null = null;

  function write(map: ReadonlyMap<string, ChatConversation>): void {
    const shape: PersistedShape = {
      v: STORAGE_VERSION,
      conversations: [...map.values()],
    };
    storage.set<PersistedShape>(storageKey, shape);
  }

  return {
    load(): ReadonlyMap<string, ChatConversation> {
      const data = storage.get<PersistedShape>(storageKey);
      if (!data || data.v !== STORAGE_VERSION) return new Map();
      const out = new Map<string, ChatConversation>();
      for (const c of data.conversations) out.set(c.peerUserId, c);
      return out;
    },
    schedule(conv: ReadonlyMap<string, ChatConversation>): void {
      pending = conv;
      if (timer) return;
      timer = setTimeout(() => {
        if (pending) write(pending);
        pending = null;
        timer = null;
      }, debounceMs);
    },
    flush(): void {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (pending) {
        write(pending);
        pending = null;
      }
    },
  };
}