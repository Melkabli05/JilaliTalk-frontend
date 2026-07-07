import { Service, InjectionToken, Signal, computed, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { AudienceUser } from '../data/room-model';
import { CollectionStore, EnrichBatchQueue } from '@shared/utils';
import { BffRoomSocketService } from '@core/realtime/bff-room-socket.service';
import { UserInfoService } from '@core/services/user-info.service';
import { RoomApi } from '../data/room-api';
import { StageStore } from './stage-store';

const AUDIENCE_RECONCILE_MS = 30_000;

/** No narrower consumer currently injects AudienceStore than room-page-base.ts —
 *  see the note on StageReader/StageWriter above; same rationale applies here. */
export interface AudienceReader {
  readonly cname: Signal<string | null>;
  readonly audienceUsers: Signal<readonly AudienceUser[]>;
  readonly audienceCount: Signal<number>;
}

export interface AudienceWriter {
  setBusiType(busiType: number): void;
  setCname(cname: string): void;
  updateAudienceUsers(users: AudienceUser[]): void;
  addAudienceUser(user: AudienceUser): void;
  removeAudienceUser(uid: number): void;
  setUserHandRaised(uid: number, raised: boolean): void;
  reset(): void;
}

export const AUDIENCE_READER = new InjectionToken<AudienceReader>('AUDIENCE_READER');
export const AUDIENCE_WRITER = new InjectionToken<AudienceWriter>('AUDIENCE_WRITER');

@Service({ autoProvided: false })
export class AudienceStore extends CollectionStore<AudienceUser> {
  private readonly bffWs = inject(BffRoomSocketService);
  private readonly userInfoService = inject(UserInfoService);
  private readonly api = inject(RoomApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly stageStore = inject(StageStore);

  private readonly busiType = signal(2);
  private readonly _cname = signal<string | null>(null);
  /** Last audience revision seen — initialised to -1 so the first poll always refetches. */
  private lastAudienceRevision = -1;
  private readonly enrichQueue = new EnrichBatchQueue((uids) => this.flushEnrichBatch(uids));

  readonly cname = this._cname.asReadonly();
  readonly audienceUsers = this.items;
  readonly audienceCount = computed(() => this.items().length);

  private async flushEnrichBatch(uids: number[]): Promise<void> {
    const profiles = await this.userInfoService.enrichBatchAndCache(uids);
    this.collection.update((list) =>
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

  setBusiType(busiType: number): void {
    this.busiType.set(busiType);
  }

  setCname(cname: string): void {
    // Reset revision only on a real cname change — calling setCname() with
    // the same value repeatedly (e.g. on every room-page entry) used to
    // force a full audience refetch on the next 30s reconcile, wasting a
    // round-trip per page mount.
    if (this._cname() !== cname) {
      this.lastAudienceRevision = -1;
      this._cname.set(cname);
    }
  }

  private reconcileTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  /**
   * Self-rescheduling timeout, not a fixed-cadence interval() — the next
   * poll is armed only after the current one completes (success or
   * failure), so a slow or hung request can't pile up overlapping polls.
   * The previous interval(30_000) also kept ticking even while the
   * store had no cname (every early-return in reconcileAudience was a
   * wasted tick); this only runs while a cname is set.
   */
  private startReconciliation(): void {
    if (this.destroyed || this.reconcileTimer) return;
    this.reconcileTimer = setTimeout(() => {
      this.reconcileTimer = null;
      void this.reconcileAudience().finally(() => this.startReconciliation());
    }, AUDIENCE_RECONCILE_MS);
  }

  private async reconcileAudience(): Promise<void> {
    const cname = this.cname();
    const busiType = this.busiType();
    if (!cname) return;
    try {
      const result = await firstValueFrom(this.api.fetchAudienceReconcile(cname, busiType, this.lastAudienceRevision));
      this.lastAudienceRevision = result.revision;
      if (result.changed) this.updateAudienceUsers([...(result.list ?? [])]);
    } catch {
    }
  }

  constructor() {
    super();
    this.startReconciliation();
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      if (this.reconcileTimer) {
        clearTimeout(this.reconcileTimer);
        this.reconcileTimer = null;
      }
    });
    this.bffWs.event$('user_join').pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event.isBannedComment) return;
      if (this.stageStore.isOnStage(Number(event.userId))) return;
      const uid = Number(event.userId);
      this.addAudienceUser({
        userId: uid,
        isOnMic: false,
        isRaiseHand: false,
        isTurnOnMic: false,
        isTurnOnCam: false,
        role: 3,
        busiType: this.busiType(),
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
      if (!event.headUrl || !event.nationality) this.enrichQueue.queue(uid);
    });

    this.bffWs.event$('user_quit').pipe(takeUntilDestroyed()).subscribe((event) => {
      this.removeAudienceUser(Number(event.userId));
    });

    this.bffWs.event$('stage_raisehand').pipe(takeUntilDestroyed()).subscribe((event) => {
      this.setUserHandRaised(Number(event.userId), event.raisehandType === 1);
    });

    this.bffWs.event$('stage_join').pipe(takeUntilDestroyed()).subscribe((event) => {
      this.removeAudienceUser(Number(event.stageUser.userId));
    });

    this.bffWs.event$('room_kick').pipe(takeUntilDestroyed()).subscribe((event) => {
      this.removeAudienceUser(Number(event.userId));
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

  updateAudienceUsers(users: AudienceUser[]): void {
    this.setCollection(users);
  }

  addAudienceUser(user: AudienceUser): void {
    this.collection.update((list) => {
      if (list.some((u) => u.userId === user.userId)) return list;
      return [...list, user];
    });
  }

  removeAudienceUser(uid: number): void {
    this.collection.update((list) => list.filter((u) => u.userId !== uid));
  }

  setUserHandRaised(uid: number, raised: boolean): void {
    this.collection.update((list) =>
      list.map((u) => u.userId === uid ? { ...u, isRaiseHand: raised } : u),
    );
  }

  override reset(): void {
    super.reset();
    this._cname.set(null);
    this.lastAudienceRevision = -1;
    this.enrichQueue.dispose();
  }
}
