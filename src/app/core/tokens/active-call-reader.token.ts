import { InjectionToken, Signal, signal } from '@angular/core';

export interface ActiveCallSnapshot {
  readonly cname: string;
  readonly busiType: number;
  readonly roomName: string;
  readonly isMicOn: boolean;
  readonly isInvisible: boolean;
}

export interface ActiveCallReader {
  readonly snapshot: Signal<ActiveCallSnapshot | null>;
  updateMicState(isMicOn: boolean): void;
  setInvisible(isInvisible: boolean): void;
  leave(): Promise<void>;
  clear(): void;
}

export const ACTIVE_CALL_READER = new InjectionToken<ActiveCallReader>('ACTIVE_CALL_READER', {
  factory: () => ({
    snapshot: signal<ActiveCallSnapshot | null>(null),
    updateMicState: () => {},
    setInvisible: () => {},
    leave: () => Promise.resolve(),
    clear: () => {},
  }),
});
