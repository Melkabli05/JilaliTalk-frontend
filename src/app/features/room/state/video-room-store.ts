import { Injectable, signal } from '@angular/core';
import { BaseRoomStore } from './base-room-store';

@Injectable()
export class VideoRoomStore extends BaseRoomStore {
  private readonly _isCamOn = signal(false);

  readonly isCamOn = this._isCamOn.asReadonly();

  constructor() {
    super(1);
  }

  protected override resetMediaState(): void {
    this._isCamOn.set(false);
  }

  setCamOn(on: boolean): void { this._isCamOn.set(on); }
}
