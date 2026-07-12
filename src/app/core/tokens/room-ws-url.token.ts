import { InjectionToken } from '@angular/core';

/**
 * Direct wss:// endpoint for the LiveHub room protocol. The frontend connects to this
 * directly instead of relaying through jilalibff's own WebSocket.
 */
export const ROOM_WS_URL = new InjectionToken<string>('ROOM_WS_URL', {
  factory: () => 'wss://uploadprocn.hellotalk8.com/livehub/ws/conn',
});
