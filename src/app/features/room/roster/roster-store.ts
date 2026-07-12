import { Service, InjectionToken, Signal, computed, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { StageUser, AudienceUser } from '../models/room-model';
import { EnrichBatchQueue } from '@shared/utils';
import { HtRoomConnectionService } from '@core/realtime/ht-room-connection.service';
import { UserInfoService } from '@core/services/user-info.service';
import { RoomApi } from '../api/room-api';

const AUDIENCE_RECONCILE_MS = 30_000;

/**
 * Owns both rosters — stage and audience — as one aggregate, because "on stage XOR in
 * audience" is a real invariant that used to be enforced *bilaterally*: StageStore and
 * AudienceStore each independently reacted to the same stage_join event (one added to
 * stage, the other removed from audience), and nothing enforced the reverse direction —
 * stage_quit only ever removed the user from the stage list, with no corresponding "add
 * back to audience" anywhere. A user who stepped down from stage was invisible in *both*
 * rosters until the next scheduled 30s audience-reconcile poll happened to notice them.
 * Merging into one store makes "move a user between rosters" a single atomic operation
 * (moveToStage / moveToAudience) instead of two stores trusting each other to stay in
 * sync, and fixes the stage_quit gap by triggering an immediate reconcile instead of
 * waiting on the next scheduled tick.
 */
export interface RosterReader {
  readonly stageUsers: Signal<readonly StageUser[]>;
  readonly audienceUsers: Signal<readonly AudienceUser[]>;
  readonly stageCount: Signal<number>;
  readonly audienceCount: Signal<number>;
  readonly cname: Signal<string | null>;
  isOnStage(uid: number): boolean;
  isInAudience(uid: number): boolean;
  getStageUser(uid: number): StageUser | undefined;
}

export interface RosterWriter {
  setRoomContext(cname: string, busiType: number): void;
  setCname(cname: string): void;
  updateStageUsers(users: StageUser[]): void;
  updateAudienceUsers(users: AudienceUser[]): void;
  updateUserMicStatus(uid: number, isTurnOnMic: boolean): void;
  updateUserCamStatus(uid: number, isTurnOnCam: boolean): void;
  removeStageUser(uid: number): void;
  revertRemoveStageUser(user: StageUser): void;
  addStageUser(user: StageUser): void;
  addAudienceUser(user: AudienceUser): void;
  removeAudienceUser(uid: number): void;
  setUserHandRaised(uid: number, raised: boolean): void;
  reset(): void;
}

export const ROSTER_READER = new InjectionToken<RosterReader>('ROSTER_READER');
export const ROSTER_WRITER = new InjectionToken<RosterWriter>('ROSTER_WRITER');

@Service({ autoProvided: false })
export class RoomRosterStore {
  private readonly bffWs = inject(HtRoomConnectionService);
  private readonly userInfoService = inject(UserInfoService);
  private readonly api = inject(RoomApi);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _stageUsers = signal<readonly StageUser[]>([]);
  private readonly _audienceUsers = signal<readonly AudienceUser[]>([]);

  readonly stageUsers = this._stageUsers.asReadonly();
  readonly audienceUsers = this._audienceUsers.asReadonly();
  readonly stageCount = computed(() => this._stageUsers().length);
  readonly audienceCount = computed(() => this._audienceUsers().length);

  private readonly _cname = signal<string | null>(null);
  private readonly _busiType = signal<number>(2);
  readonly cname = this._cname.asReadonly();

  /** Last audience revision seen — initialised to -1 so the first poll always refetches. */
  private lastAudienceRevision = -1;

  private readonly stageEnrichQueue = new EnrichBatchQueue((uids) => this.flushStageEnrichBatch(uids));
  private readonly audienceEnrichQueue = new EnrichBatchQueue((uids) => this.flushAudienceEnrichBatch(uids));

  setRoomContext(cname: string, busiType: number): void {
    this._cname.set(cname);
    this._busiType.set(busiType);
  }

  setCname(cname: string): void {
    // Reset revision only on a real cname change — calling setCname() with the same value
    // repeatedly (e.g. on every room-page entry) used to force a full audience refetch on
    // the next 30s reconcile, wasting a round-trip per page mount.
    if (this._cname() !== cname) {
      this.lastAudienceRevision = -1;
      this._cname.set(cname);
    }
  }

  private async flushStageEnrichBatch(uids: number[]): Promise<void> {
    const profiles = await this.userInfoService.enrichBatchAndCache(uids);
    this._stageUsers.update((list) =>
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

  private async flushAudienceEnrichBatch(uids: number[]): Promise<void> {
    const profiles = await this.userInfoService.enrichBatchAndCache(uids);
    this._audienceUsers.update((list) =>
      list.map((u) => {
        if (!uids.includes(u.userId)) return u;
        const info = profiles.find((p) => p.userId === u.userId);
        if (!info) return u;
        return {
          ...u,
          vipType: u.vipType || info.details?.base?.vipType || 0,
          giftLevel: u.giftLevel || info.details?.giftLevel || 0,
          base: {
            nickname: u.base?.nickname || info.nickname || null,
            signature: u.base?.signature ?? null,
            headUrl: info.details?.base?.headUrl ?? null,
            nationality: u.base?.nationality || info.nationality || null,
            nativeLang: u.base?.nativeLang ?? -1,
            timeZone: u.base?.timeZone ?? 0,
          },
        };
      }),
    );
  }

  /**
   * stage_join's WS payload (StageUserEvent) carries only userId/nickname/headUrl — no
   * role — so moving a user to stage below has to insert them with a role:3 placeholder.
   * Harmless for the optimistic self-join case (the caller's own addStageUser() call
   * already holds the correct role, and dedup-by-userId means this event's placeholder
   * is silently dropped when it echoes back). Not harmless for a stage_join broadcast
   * about a *different* user this client doesn't otherwise know the role of — refetching
   * the authoritative stage list (which does carry real roles) after a genuinely new
   * joiner corrects that within one round-trip instead of waiting on a manual refresh.
   */
  private async reconcileStageRoster(): Promise<void> {
    const cname = this._cname();
    if (!cname) return;
    try {
      const result = await firstValueFrom(this.api.fetchStageUsers(cname, this._busiType()));
      this.updateStageUsers([...(result.list ?? [])]);
    } catch {
    }
  }

  private reconcileTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  /**
   * Self-rescheduling timeout, not a fixed-cadence interval() — the next poll is armed
   * only after the current one completes (success or failure), so a slow or hung request
   * can't pile up overlapping polls, and it only runs while a cname is set.
   */
  private startReconciliation(): void {
    if (this.destroyed || this.reconcileTimer) return;
    this.reconcileTimer = setTimeout(() => {
      this.reconcileTimer = null;
      void this.reconcileAudience().finally(() => this.startReconciliation());
    }, AUDIENCE_RECONCILE_MS);
  }

  /** Brings the next scheduled audience poll forward to now, instead of adding a second
   *  concurrent one — used right after a stage_quit so a user returning to the audience
   *  doesn't stay invisible in both rosters for up to 30s waiting on the regular tick. */
  private reconcileAudienceSoon(): void {
    if (this.reconcileTimer) {
      clearTimeout(this.reconcileTimer);
      this.reconcileTimer = null;
    }
    void this.reconcileAudience().finally(() => this.startReconciliation());
  }

  private async reconcileAudience(): Promise<void> {
    const cname = this._cname();
    const busiType = this._busiType();
    if (!cname) return;
    try {
      const result = await firstValueFrom(this.api.fetchAudienceReconcile(cname, busiType, this.lastAudienceRevision));
      this.lastAudienceRevision = result.revision;
      if (result.changed) this.updateAudienceUsers([...(result.list ?? [])]);
    } catch {
    }
  }

  constructor() {
    this.startReconciliation();
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      if (this.reconcileTimer) {
        clearTimeout(this.reconcileTimer);
        this.reconcileTimer = null;
      }
    });

    this.bffWs.event$('user_quit').pipe(takeUntilDestroyed()).subscribe((event) => {
      // Stage: a performer disconnecting briefly keeps their seat (marked away), since
      // stage membership is a held slot, not just presence.
      const uid = Number(event.userId);
      if (this.isOnStage(uid)) {
        this._stageUsers.update((list) =>
          list.map((u) => u.userId === uid ? { ...u, isAway: true } : u),
        );
      }
      // Audience: no seat to hold, so they simply disappear from the list.
      this.removeAudienceUser(uid);
    });

    this.bffWs.event$('user_join').pipe(takeUntilDestroyed()).subscribe((event) => {
      const uid = Number(event.userId);
      if (this.isOnStage(uid)) {
        this._stageUsers.update((list) =>
          list.map((u) => u.userId === uid ? { ...u, isAway: false } : u),
        );
        return;
      }
      if (event.isBannedComment) return;
      this.addAudienceUser({
        userId: uid,
        isOnMic: false,
        isRaiseHand: false,
        isTurnOnMic: false,
        isTurnOnCam: false,
        role: 3,
        busiType: this._busiType(),
        isBannedComment: false,
        isBannedMic: false,
        dailyCostCoins: 0,
        giftLevel: 0,
        vipType: 0,
        fgLevel: 0,
        fgName: '',
        fgIsActive: false,
        base: {
          nickname: event.nickname,
          signature: null,
          headUrl: event.headUrl,
          nationality: event.nationality,
          nativeLang: -1,
          timeZone: 0,
        },
      });
      // Queue for batch enrichment — flushed after a quiet-time window (see EnrichBatchQueue).
      if (!event.headUrl || !event.nationality) this.audienceEnrichQueue.queue(uid);
    });

    // The one place a user moves audience -> stage: atomic, so the two rosters can't drift.
    this.bffWs.event$('stage_join').pipe(takeUntilDestroyed()).subscribe((event) => {
      const uid = Number(event.stageUser.userId);
      const isNewJoiner = !this.isOnStage(uid);
      this.removeAudienceUser(uid);
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
        this.stageEnrichQueue.queue(uid);
      }
      // Only for a genuinely new joiner — the optimistic self-join case is already
      // correct (see reconcileStageRoster's doc comment) and isOnStage(uid) is already
      // true by the time that echo arrives, so this doesn't double-fetch for it.
      if (isNewJoiner) void this.reconcileStageRoster();
    });

    // The reverse move, stage -> audience: previously only removed the user from stage,
    // with nothing adding them back to audience (see this class's doc comment). stage_quit
    // carries only a userId — not enough to reconstruct a real AudienceUser — so instead
    // of fabricating a placeholder, pull the next audience-reconcile poll forward to now.
    this.bffWs.event$('stage_quit').pipe(takeUntilDestroyed()).subscribe((event) => {
      this.removeStageUser(Number(event.userId));
      this.reconcileAudienceSoon();
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

    this.bffWs.event$('stage_raisehand').pipe(takeUntilDestroyed()).subscribe((event) => {
      this.setUserHandRaised(Number(event.userId), event.raisehandType === 1);
    });

    this.bffWs.event$('room_kick').pipe(takeUntilDestroyed()).subscribe((event) => {
      this.removeAudienceUser(Number(event.userId));
    });

    this.bffWs.event$('mod_accepted').pipe(takeUntilDestroyed()).subscribe((event) => {
      const uid = Number(event.userId);
      this._stageUsers.update((list) => list.map((u) => u.userId === uid ? { ...u, role: 2 } : u));
      this._audienceUsers.update((list) => list.map((u) => u.userId === uid ? { ...u, role: 2 } : u));
    });

    this.bffWs.event$('mod_removed').pipe(takeUntilDestroyed()).subscribe((event) => {
      const uid = Number(event.userId);
      this._stageUsers.update((list) => list.map((u) => u.userId === uid ? { ...u, role: 3 } : u));
      this._audienceUsers.update((list) => list.map((u) => u.userId === uid ? { ...u, role: 3 } : u));
    });
  }

  updateStageUsers(users: StageUser[]): void {
    this._stageUsers.set(users);
  }

  updateAudienceUsers(users: AudienceUser[]): void {
    this._audienceUsers.set(users);
  }

  updateUserMicStatus(uid: number, isTurnOnMic: boolean): void {
    this._stageUsers.update((list) => list.map((u) => (u.userId === uid ? { ...u, isTurnOnMic } : u)));
  }

  updateUserCamStatus(uid: number, isTurnOnCam: boolean): void {
    this._stageUsers.update((list) => list.map((u) => (u.userId === uid ? { ...u, isTurnOnCam } : u)));
  }

  removeStageUser(uid: number): void {
    this._stageUsers.update((list) => list.filter((u) => u.userId !== uid));
  }

  revertRemoveStageUser(user: StageUser): void {
    this._stageUsers.update((list) => {
      if (list.some((u) => u.userId === user.userId)) return list;
      return [...list, user];
    });
  }

  addStageUser(user: StageUser): void {
    this._stageUsers.update((list) => {
      if (list.some((u) => u.userId === user.userId)) return list;
      return [...list, user];
    });
  }

  addAudienceUser(user: AudienceUser): void {
    this._audienceUsers.update((list) => {
      if (list.some((u) => u.userId === user.userId)) return list;
      return [...list, user];
    });
  }

  removeAudienceUser(uid: number): void {
    this._audienceUsers.update((list) => list.filter((u) => u.userId !== uid));
  }

  setUserHandRaised(uid: number, raised: boolean): void {
    this._audienceUsers.update((list) =>
      list.map((u) => u.userId === uid ? { ...u, isRaiseHand: raised } : u),
    );
  }

  isOnStage(uid: number): boolean {
    return this._stageUsers().some((u) => u.userId === uid);
  }

  isInAudience(uid: number): boolean {
    return this._audienceUsers().some((u) => u.userId === uid);
  }

  getStageUser(uid: number): StageUser | undefined {
    return this._stageUsers().find((u) => u.userId === uid);
  }

  reset(): void {
    this._stageUsers.set([]);
    this._audienceUsers.set([]);
    this._cname.set(null);
    this.lastAudienceRevision = -1;
    this.stageEnrichQueue.dispose();
    this.audienceEnrichQueue.dispose();
  }
}
