import { environment } from '@env/environment';

/** Dev-only console logger shared by every realtime connection service, all under the same
 *  `[websocket mic-test]` prefix so they can be filtered together in the browser console.
 *  No-ops in production builds. The `mic-test` tag groups every mic-flow trace from
 *  `AgoraRtcService` and `speak-from-audience.command.ts` for easy filtering during the
 *  speak-from-understage / ghost-mic debugging sessions. */
export function logRealtime(...args: unknown[]): void {
  if (environment.production) return;
  console.log('[websocket mic-test]', ...args);
}
