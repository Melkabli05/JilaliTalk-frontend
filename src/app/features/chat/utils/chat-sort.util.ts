import type { ChatConversation } from '../models/chat-message.model';

export function sortConversationsByRecency(conv: readonly ChatConversation[]): readonly ChatConversation[] {
  return [...conv].sort((a, b) => b.lastTs - a.lastTs);
}

export function filterConversationsByQuery(conv: readonly ChatConversation[], query: string): readonly ChatConversation[] {
  const q = query.trim().toLowerCase();
  if (!q) return conv;
  return conv.filter((c) => c.nickname.toLowerCase().includes(q));
}