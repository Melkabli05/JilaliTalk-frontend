import { Injectable, signal } from '@angular/core';

export type ModAction = 'mute' | 'ban' | 'kick' | 'raise_hand' | 'remove_manager' | 'approve_raise_hand' | 'reject_raise_hand' | 'add_manager' | 'invite_to_stage';

@Injectable()
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