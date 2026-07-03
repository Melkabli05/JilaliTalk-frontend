import { InjectionToken, Signal, signal } from '@angular/core';

export interface ActiveCallSnapshot {
  readonly cname: string;
  readonly busiType: number;
  readonly roomName: string;
  readonly isMicOn: boolean;
}

export interface ActiveCallReader {
  readonly snapshot: Signal<ActiveCallSnapshot | null>;
  updateMicState(isMicOn: boolean): void;
  clear(): void;
}

export const ACTIVE_CALL_READER = new InjectionToken<ActiveCallReader>('ACTIVE_CALL_READER', {
  factory: () => ({
    snapshot: signal<ActiveCallSnapshot | null>(null),
    updateMicState: () => {},
    clear: () => {},
  }),
});
