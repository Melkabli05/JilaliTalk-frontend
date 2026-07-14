import type { ChatConversation, ChatMessage } from '../models/chat-message.model';

export function lastMessagePreview(conv: ChatConversation): string {
  const last = conv.messages.at(-1);
  if (!last) return 'No messages yet';
  return messagePreviewText(last);
}

export function messagePreviewText(msg: ChatMessage): string {
  switch (msg.type) {
    case 'text':
      return msg.text;
    case 'image':
      return 'Photo';
    case 'gift':
      return `Sent a gift ×${msg.count}`;
    case 'introduction':
      return `Shared ${msg.target.nickname}`;
    case 'voice_room_shared':
      return 'Shared a voice room';
    case 'live_room_shared':
      return 'Shared a live room';
  }
}