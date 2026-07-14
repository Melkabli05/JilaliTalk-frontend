import type { ChatConnectionStatus } from '../models/chat-message.model';

export function connectionStatusLabel(status: ChatConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'Live — messages connected';
    case 'reconnecting':
      return 'Reconnecting…';
    case 'connecting':
      return 'Connecting…';
    case 'disconnected':
      return 'Disconnected — tap to retry';
  }
}