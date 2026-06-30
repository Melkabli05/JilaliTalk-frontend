import { inject, signal, computed } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Dialog } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';
import { RoomApi } from '../data/room-api';
import { UserRole } from '@core/models/user-role';
import { RtcInfo, RoomLevelInfo } from '../data/room-model';
import { WATCH_LIMIT_NON_VIP_CODE, AREA_NOT_OPEN_CODE, LIVE_BANNED_CODE } from '@core/models/api-error';
import { ToastService } from '@core/services/toast.service';
import { VipLimitDialogComponent, VipLimitChoice } from '../ui/vip-limit-dialog';
import { RegionBlockDialogComponent, RegionBlockChoice } from '../ui/region-block-dialog';

export class JoinCancelledError extends Error {
  constructor(message = 'Room join was cancelled') {
    super(message);
  }
}

function hasUpstreamCode(err: unknown): err is { error: { upstreamCode?: unknown } } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'error' in err &&
    typeof (err as { error: unknown }).error === 'object'
  );
}

export abstract class BaseRoomStore {
  protected readonly api = inject(RoomApi);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(Dialog);

  private readonly _cname = signal<string | null>(null);
  private readonly _busiType = signal<number>(0);
  private readonly _myRole = signal<UserRole>(UserRole.Normal);
  private readonly _isHandRaised = signal(false);
  private readonly _isConnected = signal(false);
  private readonly _isVisible = signal(true);
  private readonly _name = signal<string>('');
  private readonly _topic = signal<string>('');

  private readonly _userId = signal<number>(0);
  private readonly _nickname = signal<string>('');
  private readonly _headUrl = signal<string>('');
  private readonly _nationality = signal<string>('');

  private readonly _rtcInfo = signal<RtcInfo | null>(null);
  private readonly _roomLevelInfo = signal<RoomLevelInfo | null>(null);

  readonly cname = this._cname.asReadonly();
  readonly busiType = this._busiType.asReadonly();
  readonly myRole = this._myRole.asReadonly();
  readonly isHandRaised = this._isHandRaised.asReadonly();
  readonly isConnected = this._isConnected.asReadonly();
  readonly isVisible = this._isVisible.asReadonly();
  readonly name = this._name.asReadonly();
  readonly topic = this._topic.asReadonly();
  readonly userId = this._userId.asReadonly();
  readonly nickname = this._nickname.asReadonly();
  readonly headUrl = this._headUrl.asReadonly();
  readonly nationality = this._nationality.asReadonly();
  readonly rtcInfo = this._rtcInfo.asReadonly();
  readonly roomLevelInfo = this._roomLevelInfo.asReadonly();

  readonly isOnStage = computed(() => {
    const role = this._myRole();
    return role === UserRole.Host || role === UserRole.Moderator;
  });

  readonly isHost = computed(() => this._myRole() === UserRole.Host);
  readonly isModerator = computed(() => this._myRole() === UserRole.Moderator);

  constructor(
    protected readonly defaultBusiType: number,
  ) {
    this._busiType.set(defaultBusiType);
  }

  protected abstract resetMediaState(): void;

  async joinRoom(cname: string, busiType: number, visible = true): Promise<void> {
    this._cname.set(cname);
    this._busiType.set(busiType);
    this._isVisible.set(visible);
    if (visible) {
      await this.joinRoster(cname, busiType);
    }
    this._myRole.set(UserRole.Normal);
    this._isConnected.set(true);
  }

  private async joinRoster(cname: string, busiType: number): Promise<void> {
    try {
      await firstValueFrom(this.api.joinRoom(cname, busiType));
    } catch (err) {
      if (!(err instanceof HttpErrorResponse)) throw err;
      const code = hasUpstreamCode(err) ? err.error.upstreamCode : undefined;

      if (code === WATCH_LIMIT_NON_VIP_CODE) {
        await this.handleWatchLimitReached(cname, busiType);
        return;
      }

      if (code === AREA_NOT_OPEN_CODE || code === LIVE_BANNED_CODE) {
        await this.handleRegionBlock(cname, busiType, code);
        return;
      }

      throw err;
    }
  }

  private async handleWatchLimitReached(cname: string, busiType: number): Promise<void> {
    const ref = this.dialog.open<VipLimitChoice>(VipLimitDialogComponent);
    const choice = (await firstValueFrom(ref.closed)) ?? 'leave';

    if (choice === 'continue') {
      this._isVisible.set(false);
      this.toast.info('Joining as Ghost Listener. You will not be visible and get no updates.');
      return;
    }

    if (choice !== 'claim') {
      throw new JoinCancelledError();
    }

    this.toast.info('Processing auto VIP claim, please wait...');
    const claimed = await firstValueFrom(this.api.claimVipTrial());
    if (!claimed) {
      this.toast.error('Failed to claim VIP automatically.');
      throw new JoinCancelledError('No VIP trial available to claim');
    }

    this.toast.success('VIP auto-claim successful! Rejoining...');
    await this.joinRoster(cname, busiType);
  }

  private async handleRegionBlock(cname: string, busiType: number, code: number): Promise<void> {
    const ref = this.dialog.open<RegionBlockChoice>(RegionBlockDialogComponent, {
      data: { code },
    });
    const choice = (await firstValueFrom(ref.closed)) ?? 'leave';

    if (choice === 'ghost') {
      this._isVisible.set(false);
      this.toast.info('Joining as Ghost Listener. You will not be visible and get no updates.');
      return;
    }

    throw new JoinCancelledError();
  }

  async leaveRoom(): Promise<void> {
    if (!this._isConnected()) return;
    const cname = this._cname();
    const busiType = this._busiType();
    if (cname && this._isVisible()) {
      firstValueFrom(this.api.leaveRoom(cname, busiType)).then(
        () => undefined,
        (_err: unknown) => console.warn('[BaseRoomStore] leaveRoom failed:', _err),
      );
    }
    this._cname.set(null);
    this._busiType.set(this.defaultBusiType);
    this._myRole.set(UserRole.Normal);
    this.resetMediaState();
    this._isHandRaised.set(false);
    this._isConnected.set(false);
    this._isVisible.set(true);
    this._name.set('');
    this._topic.set('');
    this._userId.set(0);
    this._nickname.set('');
    this._headUrl.set('');
    this._nationality.set('');
    this._rtcInfo.set(null);
    this._roomLevelInfo.set(null);
  }

  setUserId(userId: number): void { this._userId.set(userId); }
  setNickname(nickname: string): void { this._nickname.set(nickname); }
  setHeadUrl(headUrl: string): void { this._headUrl.set(headUrl); }
  setNationality(nationality: string): void { this._nationality.set(nationality); }
  setCname(cname: string): void { this._cname.set(cname); }
  setRtcInfo(info: RtcInfo | null): void { this._rtcInfo.set(info); }
  setRoomLevelInfo(info: RoomLevelInfo | null): void { this._roomLevelInfo.set(info); }
  setHandRaised(raised: boolean): void { this._isHandRaised.set(raised); }
  setRole(role: UserRole): void { this._myRole.set(role); }
  setVisibility(visible: boolean): void { this._isVisible.set(visible); }
  setRoomName(name: string): void { this._name.set(name); }
  setRoomTopic(topic: string): void { this._topic.set(topic); }
}
