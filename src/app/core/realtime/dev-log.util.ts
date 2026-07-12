import { environment } from '@env/environment';

/** Dev-only console logger shared by every realtime connection service, all under the same
 *  `[websocket]` prefix so they can be filtered together in the browser console. No-ops in
 *  production builds. */
export function logRealtime(...args: unknown[]): void {
  if (environment.production) return;
  console.log('[websocket]', ...args);
}
