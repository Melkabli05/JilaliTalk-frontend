import { Injectable, computed, effect, inject, signal, DestroyRef } from '@angular/core';
import { interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { AudienceUser } from '../data/room-model';
import { CollectionStore, EnrichBatchQueue } from '@shared/utils';
import { BffRoomSocketService } from '@core/realtime/bff-room-socket.service';
import { UserInfoService } from '@core/services/user-info.service';
import { RoomApi } from '../data/room-api';
import { StageStore } from './stage-store';

const AUDIENCE_RECONCILE_MS = 30_000;

@Injectable()
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
    this.lastAudienceRevision = -1;
    this._cname.set(cname);
  }

  private startReconciliation(): void {
    interval(AUDIENCE_RECONCILE_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.reconcileAudience());
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
    effect(() => {
      const event = this.bffWs.lastEvent();
      if (!event) return;
      switch (event.type) {
        case 'user_join': {
          if (event.isBannedComment) break;
          if (this.stageStore.isOnStage(Number(event.userId))) break;
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
          break;
        }
        case 'user_quit':
          this.removeAudienceUser(Number(event.userId));
          break;
        case 'stage_raisehand':
          this.setUserHandRaised(Number(event.userId), event.raisehandType === 1);
          break;
        case 'stage_join':
          this.removeAudienceUser(Number(event.stageUser.userId));
          break;
        case 'stage_invite':
        case 'mod_invite':
          break;
        case 'gift':
          break;
        case 'room_kick':
          this.removeAudienceUser(Number(event.userId));
          break;
        case 'mod_accepted':
          this.collection.update((list) =>
            list.map((u) => u.userId === Number(event.userId) ? { ...u, role: 2 } : u),
          );
          break;
        case 'mod_removed':
          this.collection.update((list) =>
            list.map((u) => u.userId === Number(event.userId) ? { ...u, role: 3 } : u),
          );
          break;
        case 'follow':
        case 'whiteboard_activated':
        case 'whiteboard_deactivated':
        case 'raw':
          break;
        case 'error':
          break;
      }
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
