import { Service, signal } from '@angular/core';

@Service()
export class ActiveCallStore {
  private readonly _cname = signal<string | null>(null);
  private readonly _busiType = signal(2);
  private readonly _roomName = signal('');
  private readonly _isMicOn = signal(false);
  private readonly _isInvisible = signal(false);
  // _minimized is independent of _cname so the snapshot can stay populated
  // (for "already in this room" detection in user-info-modal) while the
  // room is fully active. Previously _cname !== null implied "minimized",
  // which kept the bar rendered after the user tapped maximize and the
  // room page re-mounted.
  private readonly _minimized = signal(false);

  readonly cname = this._cname.asReadonly();
  readonly busiType = this._busiType.asReadonly();
  readonly roomName = this._roomName.asReadonly();
  readonly isMicOn = this._isMicOn.asReadonly();
  readonly isInvisible = this._isInvisible.asReadonly();
  readonly minimized = this._minimized.asReadonly();

  minimize(cname: string, busiType: number, roomName: string, isMicOn: boolean, isInvisible: boolean): void {
    this._cname.set(cname);
    this._busiType.set(busiType);
    this._roomName.set(roomName);
    this._isMicOn.set(isMicOn);
    this._isInvisible.set(isInvisible);
    this._minimized.set(true);
  }

  /** Transitions out of the minimized state while keeping the cname
   *  populated (so other consumers can still ask "what room am I in?").
   *  Called when the user taps maximize and the room page re-mounts. */
  restore(): void {
    this._minimized.set(false);
  }

  updateMicState(isMicOn: boolean): void {
    this._isMicOn.set(isMicOn);
  }

  setInvisible(isInvisible: boolean): void {
    this._isInvisible.set(isInvisible);
  }

  clear(): void {
    this._cname.set(null);
    this._isInvisible.set(false);
    this._minimized.set(false);
  }
}
