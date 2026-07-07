import { InjectionToken } from '@angular/core';

/**
 * Per-room-kind Agora App IDs, bound to environment.agoraAppIdVoice/agoraAppIdVideo in
 * app.config.ts. Mirrors API_BASE_URL/WS_BASE_URL — pages inject these tokens instead of
 * reading the environment file directly (see CLAUDE.md's environments section).
 */
export const AGORA_APP_ID_VOICE = new InjectionToken<string>('AGORA_APP_ID_VOICE', {
  factory: () => '0d7f53ced63046738a30ef2491e4714c',
});

export const AGORA_APP_ID_VIDEO = new InjectionToken<string>('AGORA_APP_ID_VIDEO', {
  factory: () => 'f1b7a6ae12fd4443b0968681d4f37bc1',
});
