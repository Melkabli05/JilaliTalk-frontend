import { Injectable, InjectionToken, Signal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { StageUser } from '../data/room-model';
import { CollectionStore, EnrichBatchQueue } from '@shared/utils';
import { BffRoomSocketService } from '@core/realtime/bff-room-socket.service';
import { UserInfoService } from '@core/services/user-info.service';
import { RoomApi } from '../data/room-api';

/** No narrower consumer currently injects StageStore than room-page-base.ts (which
 *  needs full read+write access to orchestrate the room), so this split has no
 *  enforcement effect yet — provided for consistency with the other room stores and
 *  in case a future stage-only UI component needs read-only access. */
export interface StageReader {
  readonly stageUsers: Signal<readonly StageUser[]>;
  readonly stageCount: Signal<number>;
  isOnStage(uid: number): boolean;
  getStageUser(uid: number): StageUser | undefined;
}

export interface StageWriter {
  setRoomContext(cname: string, busiType: number): void;
  updateStageUsers(users: StageUser[]): void;
  updateUserMicStatus(uid: number, isTurnOnMic: boolean): void;
  updateUserCamStatus(uid: number, isTurnOnCam: boolean): void;
  removeStageUser(uid: number): void;
  revertRemoveStageUser(user: StageUser): void;
  addStageUser(user: StageUser): void;
  reset(): void;
}

export const STAGE_READER = new InjectionToken<StageReader>('STAGE_READER');
export const STAGE_WRITER = new InjectionToken<StageWriter>('STAGE_WRITER');

@Injectable()
export class StageStore extends CollectionStore<StageUser> {
  private readonly bffWs = inject(BffRoomSocketService);
  private readonly userInfoService = inject(UserInfoService);
  private readonly api = inject(RoomApi);

  readonly stageUsers = this.items;
  readonly stageCount = computed(() => this.items().length);

  private readonly _cname = signal<string | null>(null);
  private readonly _busiType = signal<number>(2);

  setRoomContext(cname: string, busiType: number): void {
    this._cname.set(cname);
    this._busiType.set(busiType);
  }

  /**
   * stage_join's WS payload (StageUserEvent) carries only userId/nickname/headUrl —
   * no role — so addStageUser() below has to insert new joiners with a role:3
   * placeholder. That's harmless for the optimistic self-join case (the caller's own
   * addStageUser() call already holds the correct role, and the dedup-by-userId in
   * addStageUser() means this event's placeholder is silently dropped when it echoes
   * back). It's not harmless for a stage_join broadcast about a *different* user this
   * client doesn't otherwise know the role of — e.g. a moderator joining stage from
   * another device would show as a regular participant until the next manual refresh.
   * Refetching the authoritative stage list (which does carry real roles) after a
   * genuinely new joiner corrects that within one round-trip instead of waiting on
   * the user to notice and hit refresh.
   */
  private async reconcileRoster(): Promise<void> {
    const cname = this._cname();
    if (!cname) return;
    try {
      const result = await firstValueFrom(this.api.fetchStageUsers(cname, this._busiType()));
      this.updateStageUsers([...(result.list ?? [])]);
    } catch {
    }
  }

  private readonly enrichQueue = new EnrichBatchQueue((uids) => this.flushEnrichBatch(uids));

  private async flushEnrichBatch(uids: number[]): Promise<void> {
    const profiles = await this.userInfoService.enrichBatchAndCache(uids);
    this.collection.update((list) =>
      list.map((u) => {
        if (!uids.includes(u.userId)) return u;
        const info = profiles.find((p) => p.userId === u.userId);
        if (!info) return u;
        return {
          ...u,
          nickname: u.nickname && u.nickname !== 'Anonymous' ? u.nickname : (info.nickname || u.nickname),
          headUrl: info.details?.base?.headUrl ?? null,
          nationality: u.nationality || info.nationality || null,
        };
      }),
    );
  }

  constructor() {
    super();

    this.bffWs.event$('user_quit').pipe(takeUntilDestroyed()).subscribe((event) => {
      if (this.isOnStage(Number(event.userId))) {
        this.collection.update((list) =>
          list.map((u) => u.userId === Number(event.userId) ? { ...u, isAway: true } : u),
        );
      }
    });

    this.bffWs.event$('user_join').pipe(takeUntilDestroyed()).subscribe((event) => {
      if (this.isOnStage(Number(event.userId))) {
        this.collection.update((list) =>
          list.map((u) => u.userId === Number(event.userId) ? { ...u, isAway: false } : u),
        );
      }
    });

    this.bffWs.event$('stage_join').pipe(takeUntilDestroyed()).subscribe((event) => {
      const uid = Number(event.stageUser.userId);
      const isNewJoiner = !this.isOnStage(uid);
      this.addStageUser({
        userId: uid,
        nickname: event.stageUser.nickname ?? 'Anonymous',
        headUrl: event.stageUser.headUrl ?? null,
        nationality: null,
        role: 3,
        isTurnOnMic: false,
        isTurnOnCam: false,
        isBannedComment: false,
        rippleId: -1,
        rippleUrl: null,
        rippleAnimalType: 0,
        rippleAnimalUrl: null,
        isAiUser: false,
      });
      // StageUserEvent carries userId/nickname/headUrl only — no nationality — so the
      // gate reduces to "missing avatar". Backend batch endpoint will fill the rest.
      if (!event.stageUser.headUrl) {
        this.enrichQueue.queue(uid);
      }
      // Only for a genuinely new joiner — the optimistic self-join case is already
      // correct (see reconcileRoster's doc comment) and isOnStage(uid) is already
      // true by the time that echo arrives, so this doesn't double-fetch for it.
      if (isNewJoiner) void this.reconcileRoster();
    });

    this.bffWs.event$('stage_quit').pipe(takeUntilDestroyed()).subscribe((event) => {
      this.removeStageUser(Number(event.userId));
    });

    this.bffWs.event$('stage_device_control').pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event.deviceType === 1) {
        const muted = event.switchType === 1;
        this.updateUserMicStatus(Number(event.userId), !muted);
      }
    });

    this.bffWs.event$('mic_opened').pipe(takeUntilDestroyed()).subscribe((event) => {
      this.updateUserMicStatus(Number(event.userId), true);
    });

    this.bffWs.event$('mic_closed').pipe(takeUntilDestroyed()).subscribe((event) => {
      this.updateUserMicStatus(Number(event.userId), false);
    });

    this.bffWs.event$('stage_kick').pipe(takeUntilDestroyed()).subscribe((event) => {
      this.removeStageUser(Number(event.userId));
    });

    this.bffWs.event$('mod_accepted').pipe(takeUntilDestroyed()).subscribe((event) => {
      this.collection.update((list) =>
        list.map((u) => u.userId === Number(event.userId) ? { ...u, role: 2 } : u),
      );
    });

    this.bffWs.event$('mod_removed').pipe(takeUntilDestroyed()).subscribe((event) => {
      this.collection.update((list) =>
        list.map((u) => u.userId === Number(event.userId) ? { ...u, role: 3 } : u),
      );
    });
  }

  updateStageUsers(users: StageUser[]): void {
    this.setCollection(users);
  }

  updateUserMicStatus(uid: number, isTurnOnMic: boolean): void {
    this.collection.update((list) =>
      list.map((u) => (u.userId === uid ? { ...u, isTurnOnMic } : u)),
    );
  }

  updateUserCamStatus(uid: number, isTurnOnCam: boolean): void {
    this.collection.update((list) =>
      list.map((u) => (u.userId === uid ? { ...u, isTurnOnCam } : u)),
    );
  }

  removeStageUser(uid: number): void {
    this.collection.update((list) => list.filter((u) => u.userId !== uid));
  }

  revertRemoveStageUser(user: StageUser): void {
    this.collection.update((list) => {
      if (list.some((u) => u.userId === user.userId)) return list;
      return [...list, user];
    });
  }

  addStageUser(user: StageUser): void {
    this.collection.update((list) => {
      if (list.some((u) => u.userId === user.userId)) return list;
      return [...list, user];
    });
  }

  isOnStage(uid: number): boolean {
    return this.items().some((u) => u.userId === uid);
  }

  getStageUser(uid: number): StageUser | undefined {
    return this.items().find((u) => u.userId === uid);
  }

  override reset(): void {
    super.reset();
    this._cname.set(null);
  }
}
