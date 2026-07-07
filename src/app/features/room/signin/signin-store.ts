import { Service, inject, signal, computed } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { map, of } from 'rxjs';
import { RoomApi } from '../api/room-api';
import {
  VoiceSignPanelResponse,
  RoomLevelRewardResponse,
  RoomLevelConfigResponse,
  VoiceTasksResponse,
} from '../models/room-model';

const EMPTY_SIGN_PANEL: VoiceSignPanelResponse = { signList: [], toDaySigned: false, consecutiveDays: 0 };
const EMPTY_REWARDS: RoomLevelRewardResponse = { items: [] };
const EMPTY_LEVEL_CONFIG: RoomLevelConfigResponse = { items: [] };
const EMPTY_TASKS: VoiceTasksResponse = { items: [] };

interface RewardsAndConfig {
  readonly rewards: RoomLevelRewardResponse;
  readonly config: RoomLevelConfigResponse;
}

interface RewardsParams {
  readonly cname: string;
  readonly hostId: number;
  readonly level: number;
}

@Service({ autoProvided: false })
export class SigninStore {
  private readonly api = inject(RoomApi);

  private readonly _cname = signal<string | null>(null);
  private readonly _hostId = signal<number | null>(null);
  private readonly _roomLevel = signal<number>(1);
  private readonly _rewardsTabActive = signal(false);
  private readonly _claimedRewardIds = signal<Set<number>>(new Set<number>());
  private readonly _claimedTaskIds = signal<Set<number>>(new Set<number>());
  private readonly _tasksTabActive = signal(false);

  readonly currentLevel = this._roomLevel.asReadonly();
  readonly claimedRewardIds = this._claimedRewardIds.asReadonly();
  readonly claimedTaskIds = this._claimedTaskIds.asReadonly();

  private readonly signPanelRef = rxResource<VoiceSignPanelResponse, string | undefined>({
    params: () => this._cname() ?? undefined,
    stream: ({ params }) => (params === undefined ? of(EMPTY_SIGN_PANEL) : this.api.fetchSignPanel(params)),
    defaultValue: EMPTY_SIGN_PANEL,
  });

  readonly signItems = computed(() => this.signPanelRef.value().signList ?? []);
  readonly toDaySigned = computed(() => this.signPanelRef.value().toDaySigned);
  readonly consecutiveDays = computed(() => this.signPanelRef.value().consecutiveDays);
  readonly signPanelLoading = this.signPanelRef.isLoading;
  readonly signPanelError = computed(() => (this.signPanelRef.error() ? 'Failed to load sign-in panel' : null));

  private readonly rewardsRef = rxResource<RewardsAndConfig, RewardsParams | undefined>({
    params: () => {
      if (!this._rewardsTabActive()) return undefined;
      const cname = this._cname();
      const hostId = this._hostId();
      if (cname === null || hostId === null) return undefined;
      return { cname, hostId, level: this._roomLevel() };
    },
    stream: ({ params }) =>
      params === undefined
        ? of({ rewards: EMPTY_REWARDS, config: EMPTY_LEVEL_CONFIG })
        : this.api
            .fetchRoomLevelBundle(params.cname, params.hostId, params.level)
            .pipe(map((bundle) => ({ rewards: bundle.reward, config: bundle.config }))),
    defaultValue: { rewards: EMPTY_REWARDS, config: EMPTY_LEVEL_CONFIG },
  });

  readonly rewardItems = computed(() => this.rewardsRef.value().rewards.items ?? []);
  readonly roomLevelConfig = computed(() => this.rewardsRef.value().config.items ?? []);
  readonly rewardsLoading = this.rewardsRef.isLoading;
  readonly rewardsError = computed(() => (this.rewardsRef.error() ? 'Failed to load rewards' : null));

  private readonly tasksRef = rxResource<VoiceTasksResponse, void>({
    stream: () => (this._tasksTabActive() ? this.api.fetchTasks() : of(EMPTY_TASKS)),
    defaultValue: EMPTY_TASKS,
  });

  readonly taskItems = computed(() => this.tasksRef.value().items ?? []);
  readonly tasksLoading = this.tasksRef.isLoading;
  readonly tasksError = computed(() => (this.tasksRef.error() ? 'Failed to load tasks' : null));

  readonly levelProgress = computed((): number => {
    const level = this._roomLevel();
    const config = this.roomLevelConfig();
    if (!config.length) return 0;
    const current = config.find((c) => c.roomLevel === level);
    const next = config.find((c) => c.roomLevel === level + 1);
    if (!current || !next) return 1;
    const prev = config.find((c) => c.roomLevel === level - 1);
    const prevExp = prev ? prev.experience : 0;
    const range = next.experience - prevExp;
    if (range === 0) return 1;
    return Math.min(1, Math.max(0, (current.experience - prevExp) / range));
  });

  readonly nextLevelExp = computed((): number | null => {
    const level = this._roomLevel();
    const config = this.roomLevelConfig();
    const next = config.find((c) => c.roomLevel === level + 1);
    return next ? next.experience : null;
  });

  isRewardClaimed(id: number): boolean {
    return this._claimedRewardIds().has(id);
  }

  isTaskClaimed(taskId: number): boolean {
    return this._claimedTaskIds().has(taskId);
  }

  setParams(cname: string, hostId: number, roomLevel: number): void {
    this._cname.set(cname);
    this._hostId.set(hostId);
    this._roomLevel.set(roomLevel);
  }

  activateRewardsTab(): void {
    this._rewardsTabActive.set(true);
  }

  activateTasksTab(): void {
    this._tasksTabActive.set(true);
  }

  markRewardClaimed(id: number): void {
    this._claimedRewardIds.update((ids) => new Set([...ids, id]));
  }

  markTaskClaimed(taskId: number): void {
    this._claimedTaskIds.update((ids) => new Set([...ids, taskId]));
  }

  reloadRewards(): void {
    this.rewardsRef.reload();
  }

  reloadTasks(): void {
    this.tasksRef.reload();
  }

  reloadSignPanel(): void {
    this.signPanelRef.reload();
  }
}
