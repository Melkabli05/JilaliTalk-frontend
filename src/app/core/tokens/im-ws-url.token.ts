import { InjectionToken } from '@angular/core';

/**
 * Direct wss:// endpoint for the personal-messaging protocol (ht_im/sock). The frontend
 * connects to this directly instead of relaying through jilalibff's own WebSocket.
 */
export const IM_WS_URL = new InjectionToken<string>('IM_WS_URL', {
  factory: () => 'wss://api-global.hellotalk8.com/ht_im/sock',
});
