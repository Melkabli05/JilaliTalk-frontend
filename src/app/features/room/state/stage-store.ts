import { Injectable, computed, effect, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { StageUser } from '../data/room-model';
import { CollectionStore } from '@shared/utils/collection-store';
import { BffRoomSocketService } from '@core/realtime/bff-room-socket.service';
import { UserInfoService } from '@core/services/user-info.service';
import { RoomApi } from '../data/room-api';

const ENRICH_BATCH_DELAY_MS = 200;

@Injectable()
export class StageStore extends CollectionStore<StageUser> {
  private readonly bffWs = inject(BffRoomSocketService);
  private readonly userInfoService = inject(UserInfoService);
  private readonly api = inject(RoomApi);

  readonly stageUsers = this.items;
  readonly stageCount = computed(() => this.items().length);

  private pendingEnrichUids = new Set<number>();
  private enrichTimer: ReturnType<typeof setTimeout> | null = null;

  private queueEnrich(uid: number): void {
    if (this.pendingEnrichUids.has(uid)) return;
    this.pendingEnrichUids.add(uid);
    if (this.enrichTimer === null) {
      this.enrichTimer = setTimeout(() => this.flushEnrichBatch(), ENRICH_BATCH_DELAY_MS);
    }
  }

  private async flushEnrichBatch(): Promise<void> {
    if (this.enrichTimer !== null) {
      clearTimeout(this.enrichTimer);
      this.enrichTimer = null;
    }
    const uids = [...this.pendingEnrichUids];
    this.pendingEnrichUids.clear();
    if (uids.length === 0) return;
    try {
      const { profiles } = await firstValueFrom(this.api.enrichBatch(uids));
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
    } catch {
      // silently discard
    }
  }

  constructor() {
    super();
    effect(() => {
      const event = this.bffWs.lastEvent();
      if (!event) return;
      switch (event.type) {
        case 'user_quit':
          if (this.isOnStage(Number(event.userId))) {
            this.collection.update((list) =>
              list.map((u) => u.userId === Number(event.userId) ? { ...u, isAway: true } : u),
            );
          }
          break;
        case 'user_join':
          if (this.isOnStage(Number(event.userId))) {
            this.collection.update((list) =>
              list.map((u) => u.userId === Number(event.userId) ? { ...u, isAway: false } : u),
            );
          }
          break;
        case 'stage_join': {
          const uid = Number(event.stageUser.userId);
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
            this.queueEnrich(uid);
          }
          break;
        }
        case 'stage_quit':
          this.removeStageUser(Number(event.userId));
          break;
        case 'stage_device_control':
          if (event.deviceType === 1) {
            const muted = event.switchType === 1;
            this.updateUserMicStatus(Number(event.userId), !muted);
          }
          break;
        case 'mic_opened':
          this.updateUserMicStatus(Number(event.userId), true);
          break;
        case 'mic_closed':
          this.updateUserMicStatus(Number(event.userId), false);
          break;
        case 'stage_kick':
          this.removeStageUser(Number(event.userId));
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
      }
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
}
