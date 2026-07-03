import { Service, signal, computed } from '@angular/core';

@Service()
export class ActiveCallStore {
  private readonly _cname = signal<string | null>(null);
  private readonly _busiType = signal(2);
  private readonly _roomName = signal('');
  private readonly _isMicOn = signal(false);

  readonly cname = this._cname.asReadonly();
  readonly busiType = this._busiType.asReadonly();
  readonly roomName = this._roomName.asReadonly();
  readonly isMicOn = this._isMicOn.asReadonly();
  readonly minimized = computed(() => this._cname() !== null);

  minimize(cname: string, busiType: number, roomName: string, isMicOn: boolean): void {
    this._cname.set(cname);
    this._busiType.set(busiType);
    this._roomName.set(roomName);
    this._isMicOn.set(isMicOn);
  }

  updateMicState(isMicOn: boolean): void {
    this._isMicOn.set(isMicOn);
  }

  clear(): void {
    this._cname.set(null);
  }
}
