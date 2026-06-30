import { Injectable, signal } from '@angular/core';
import { BaseRoomStore } from './base-room-store';

@Injectable()
export class VideoRoomStore extends BaseRoomStore {
  private readonly _isCamOn = signal(false);
  private readonly _isMicOn = signal(false);

  readonly isCamOn = this._isCamOn.asReadonly();
  readonly isMicOn = this._isMicOn.asReadonly();

  constructor() {
    super(1);
  }

  protected override resetMediaState(): void {
    this._isCamOn.set(false);
    this._isMicOn.set(false);
  }

  setCamOn(on: boolean): void { this._isCamOn.set(on); }
  setMicOn(on: boolean): void { this._isMicOn.set(on); }
}
