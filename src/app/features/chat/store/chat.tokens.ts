import { InjectionToken, inject } from '@angular/core';
import { ChatTransportAdapter } from '../data-access/chat-transport.adapter';
import { ChatProfileDirectoryAdapter } from '../data-access/chat-profile-directory.adapter';
import type { ChatProfileDirectory, ChatTransport } from '../data-access/chat.port';

export const CHAT_TRANSPORT = new InjectionToken<ChatTransport>('CHAT_TRANSPORT', {
  providedIn: 'root',
  factory: () => inject(ChatTransportAdapter),
});

export const CHAT_PROFILE_DIRECTORY = new InjectionToken<ChatProfileDirectory>('CHAT_PROFILE_DIRECTORY', {
  providedIn: 'root',
  factory: () => inject(ChatProfileDirectoryAdapter),
});