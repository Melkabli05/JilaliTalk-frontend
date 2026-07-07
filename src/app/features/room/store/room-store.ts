import { Service, signal } from '@angular/core';
import { BaseRoomStore } from './base-room-store';

/**
 * Single store for both voice and video rooms — the two room types differ
 * only in which media toggle they expose (mic vs. mic+cam) and their busiType,
 * which is set by enterRoom() long before anything reads it, so one store
 * covers both instead of near-duplicate RoomStore/VideoRoomStore classes.
 */
@Service({ autoProvided: false })
export class RoomStore extends BaseRoomStore {
  private readonly _isMicOn = signal(false);
  private readonly _isCamOn = signal(false);

  readonly isMicOn = this._isMicOn.asReadonly();
  readonly isCamOn = this._isCamOn.asReadonly();

  constructor() {
    // The default busiType is inert: enterRoom() overwrites it before any
    // page reads roomStore.busiType(), for both voice (2) and video (1) rooms.
    super(0);
  }

  protected override resetMediaState(): void {
    this._isMicOn.set(false);
    this._isCamOn.set(false);
  }

  setMicOn(on: boolean): void { this._isMicOn.set(on); }
  setCamOn(on: boolean): void { this._isCamOn.set(on); }
}
