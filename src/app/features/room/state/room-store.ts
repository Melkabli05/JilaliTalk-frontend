import { Injectable, signal } from '@angular/core';
import { BaseRoomStore } from './base-room-store';

@Injectable()
export class RoomStore extends BaseRoomStore {
  private readonly _isMicOn = signal(false);

  readonly isMicOn = this._isMicOn.asReadonly();

  constructor() {
    super(2);
  }

  protected override resetMediaState(): void {
    this._isMicOn.set(false);
  }

  setMicOn(on: boolean): void { this._isMicOn.set(on); }
}
