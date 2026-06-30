import { InjectionToken } from '@angular/core';

export const AGORA_APP_ID = new InjectionToken<string>('AGORA_APP_ID', {
  factory: () => '0d7f53ced63046738a30ef2491e4714c',
});
