import { Injectable, InjectionToken, Signal, computed, effect, inject } from '@angular/core';
import { StageUser } from '../data/room-model';
import { CollectionStore, EnrichBatchQueue } from '@shared/utils';
import { BffRoomSocketService } from '@core/realtime/bff-room-socket.service';
import { UserInfoService } from '@core/services/user-info.service';

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

  readonly stageUsers = this.items;
  readonly stageCount = computed(() => this.items().length);

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
            this.enrichQueue.queue(uid);
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
