import { Service, InjectionToken, Signal, signal } from '@angular/core';

export type ModAction = 'mute' | 'ban' | 'kick' | 'raise_hand' | 'remove_manager' | 'approve_raise_hand' | 'reject_raise_hand' | 'add_manager' | 'invite_to_stage';

/** No narrower consumer currently injects ModStore than room-page-base.ts —
 *  see the note on StageReader/StageWriter above; same rationale applies here. */
export interface ModReader {
  readonly selectedUserId: Signal<number | null>;
}

export interface ModWriter {
  selectUser(uid: number): void;
  clearSelection(): void;
  reset(): void;
}

export const MOD_READER = new InjectionToken<ModReader>('MOD_READER');
export const MOD_WRITER = new InjectionToken<ModWriter>('MOD_WRITER');

@Service({ autoProvided: false })
export class ModStore {
  private readonly _selectedUserId = signal<number | null>(null);

  readonly selectedUserId = this._selectedUserId.asReadonly();

  selectUser(uid: number): void {
    this._selectedUserId.set(uid);
  }

  clearSelection(): void {
    this._selectedUserId.set(null);
  }

  reset(): void {
    this._selectedUserId.set(null);
  }
}