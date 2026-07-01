import { InjectionToken } from '@angular/core';

/**
 * WebSocket base URL derived from the environment's wsUrl.
 * Mirrors API_BASE_URL but for WebSocket connections.
 */
export const WS_BASE_URL = new InjectionToken<string>('WS_BASE_URL', {
  factory: () => 'ws://localhost:8080/ws',
});
