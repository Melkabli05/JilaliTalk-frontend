import type { DmConversation, DmMessage } from '../models/dm.model';

/** Per-conversation message cap — also the number of oldest messages `upsertConversationMessage`
 *  starts evicting once a conversation grows past it. */
const MAX_MESSAGES = 200;

/**
 * Pure `Map<userId, DmConversation>` transforms — split out of `MessagesStore` so the
 * store's job stays "own conversation state," not also "know how to splice a message array
 * or diff two delivery states." Every function returns the *same* map reference when nothing
 * actually changed (e.g. `markConversationRead` on an already-read conversation) rather than
 * a shallow clone, so the store's `_convMap` signal — and every computed depending on it —
 * correctly skips a redundant update instead of re-rendering for a no-op write.
 */

function createConversationPlaceholder(userId: string, nickname: string): DmConversation {
  return { userId, nickname, messages: [], unread: 0, lastTs: 0, isTyping: false };
}

/** Case-insensitive match on nickname or raw userId, used by the sidebar search box. Kept as
 *  a plain function (no `this`) rather than inlined in `MessagesPageComponent`'s computed,
 *  per this codebase's convention of moving `this`-free logic out of components. */
export function filterConversationsByQuery(
  conversations: readonly DmConversation[],
  query: string,
): readonly DmConversation[] {
  const q = query.toLowerCase().trim();
  if (!q) return conversations;
  return conversations.filter((c) => c.nickname.toLowerCase().includes(q) || c.userId.includes(q));
}

export function markConversationRead(
  map: ReadonlyMap<string, DmConversation>,
  userId: string,
  fallbackNickname: string,
): ReadonlyMap<string, DmConversation> {
  const existing = map.get(userId);
  if (existing) {
    if (existing.unread === 0 && existing.messages.length > 0) return map;
    return new Map(map).set(userId, { ...existing, unread: 0 });
  }
  return new Map(map).set(userId, createConversationPlaceholder(userId, fallbackNickname));
}

export function setConversationTyping(
  map: ReadonlyMap<string, DmConversation>,
  userId: string,
  isTyping: boolean,
): ReadonlyMap<string, DmConversation> {
  const c = map.get(userId);
  if (!c) return map;
  return new Map(map).set(userId, { ...c, isTyping });
}

export interface ConversationMessageUpsert {
  readonly map: ReadonlyMap<string, DmConversation>;
  /** msgIds pushed out of the retained window by the `MAX_MESSAGES` cap — the caller must
   *  drop these from its msgId→userId delivery-tracking index too, or that index grows
   *  unbounded for the lifetime of the store even though the messages themselves are gone. */
  readonly evictedMessageIds: readonly string[];
}

export function upsertConversationMessage(
  map: ReadonlyMap<string, DmConversation>,
  userId: string,
  nickname: string,
  msg: DmMessage,
  isSelected: boolean,
): ConversationMessageUpsert {
  const existing = map.get(userId) ?? createConversationPlaceholder(userId, userId);
  const combined = [...existing.messages, msg];
  const evictedCount = Math.max(0, combined.length - MAX_MESSAGES);
  const evictedMessageIds = combined.slice(0, evictedCount).map((m) => m.id);

  const next: DmConversation = {
    ...existing,
    nickname: nickname || existing.nickname,
    messages: combined.slice(-MAX_MESSAGES),
    unread: isSelected ? 0 : existing.unread + 1,
    lastTs: msg.ts,
    isTyping: false,
  };
  return { map: new Map(map).set(userId, next), evictedMessageIds };
}

/** Advances a locally-sent message's delivery state. `from` restricts which current states
 *  are eligible to advance, so a stray/duplicate event can't move a message backwards or
 *  re-trigger an already-applied transition. */
export function updateMessageDelivery(
  map: ReadonlyMap<string, DmConversation>,
  userId: string,
  msgId: string,
  to: NonNullable<DmMessage['delivery']>,
  from: readonly NonNullable<DmMessage['delivery']>[],
): ReadonlyMap<string, DmConversation> {
  const c = map.get(userId);
  if (!c) return map;
  const target = c.messages.find((x) => x.id === msgId);
  if (!target) return map;
  const current = target.delivery;
  if (current === to || !from.includes(current ?? 'sent')) return map;
  const messages = c.messages.map((x) => (x.id === msgId ? { ...x, delivery: to } : x));
  return new Map(map).set(userId, { ...c, messages });
}
