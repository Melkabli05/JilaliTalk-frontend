import type { ChatConversation, ChatDelivery, ChatMessage } from '../models/chat-message.model';

const MAX_MESSAGES_PER_CONVERSATION = 500;

export interface UpsertResult {
  readonly map: ReadonlyMap<string, ChatConversation>;
  readonly evictedMessageIds: readonly string[];
}

export function upsertConversation(
  map: ReadonlyMap<string, ChatConversation>,
  peerUserId: string,
  message: ChatMessage,
  isSelected: boolean,
): UpsertResult {
  const existing = map.get(peerUserId);
  const messages = existing?.messages ?? [];
  const last = messages.at(-1);
  if (last && last.id === message.id) {
    return { map, evictedMessageIds: [] };
  }
  const nextMessages = dedupeAndAppend(messages, message);
  const evicted = evictedIds(messages, nextMessages);
  const unread = isSelected ? 0 : (existing?.unread ?? 0) + (message.delivery ? 0 : 1);
  const next: ChatConversation = {
    peerUserId,
    nickname: existing?.nickname ?? message.fromNickname,
    headUrl: existing?.headUrl ?? message.fromHeadUrl,
    messages: nextMessages,
    unread,
    lastTs: message.ts,
    isTyping: false,
  };
  const result = new Map(map);
  result.set(peerUserId, next);
  return { map: result, evictedMessageIds: evicted };
}

export function markConversationRead(
  map: ReadonlyMap<string, ChatConversation>,
  peerUserId: string,
  fallbackNickname: string,
  fallbackHeadUrl: string | null,
): ReadonlyMap<string, ChatConversation> {
  const existing = map.get(peerUserId);
  if (!existing) {
    const created: ChatConversation = {
      peerUserId,
      nickname: fallbackNickname,
      headUrl: fallbackHeadUrl,
      messages: [],
      unread: 0,
      lastTs: Date.now(),
      isTyping: false,
    };
    const result = new Map(map);
    result.set(peerUserId, created);
    return result;
  }
  if (existing.unread === 0) return map;
  const result = new Map(map);
  result.set(peerUserId, { ...existing, unread: 0 });
  return result;
}

export function setConversationTyping(
  map: ReadonlyMap<string, ChatConversation>,
  peerUserId: string,
  isTyping: boolean,
): ReadonlyMap<string, ChatConversation> {
  const existing = map.get(peerUserId);
  if (!existing || existing.isTyping === isTyping) return map;
  const result = new Map(map);
  result.set(peerUserId, { ...existing, isTyping });
  return result;
}

export function updateMessageDelivery(
  map: ReadonlyMap<string, ChatConversation>,
  peerUserId: string,
  msgId: string,
  to: ChatDelivery,
  from: readonly ChatDelivery[] = [],
): ReadonlyMap<string, ChatConversation> {
  const existing = map.get(peerUserId);
  if (!existing) return map;
  const idx = existing.messages.findIndex((m) => m.id === msgId);
  if (idx < 0) return map;
  const msg = existing.messages[idx];
  if (!msg || !msg.delivery) return map;
  if (from.length > 0 && !from.includes(msg.delivery)) return map;
  if (msg.delivery === to) return map;
  const updated: ChatMessage = { ...msg, delivery: to } as ChatMessage;
  const nextMessages = [...existing.messages];
  nextMessages[idx] = updated;
  const result = new Map(map);
  result.set(peerUserId, { ...existing, messages: nextMessages });
  return result;
}

export function resolveIdentity(
  conv: ChatConversation,
  cachedNickname: string | null,
  cachedHeadUrl: string | null,
): ChatConversation {
  const needsNickname = conv.nickname === conv.peerUserId && cachedNickname && cachedNickname.trim().length > 0;
  const needsHeadUrl = conv.headUrl == null && cachedHeadUrl;
  if (!needsNickname && !needsHeadUrl) return conv;
  return {
    ...conv,
    ...(needsNickname ? { nickname: cachedNickname!.trim() } : {}),
    ...(needsHeadUrl ? { headUrl: cachedHeadUrl } : {}),
  };
}

function dedupeAndAppend(messages: readonly ChatMessage[], next: ChatMessage): readonly ChatMessage[] {
  if (messages.some((m) => m.id === next.id)) return messages;
  const out = [...messages, next];
  if (out.length <= MAX_MESSAGES_PER_CONVERSATION) return out;
  const dropped = out.length - MAX_MESSAGES_PER_CONVERSATION;
  return out.slice(dropped);
}

function evictedIds(prev: readonly ChatMessage[], next: readonly ChatMessage[]): readonly string[] {
  if (prev.length === next.length) return [];
  const evictedCount = prev.length - next.length;
  return prev.slice(0, evictedCount).map((m) => m.id);
}