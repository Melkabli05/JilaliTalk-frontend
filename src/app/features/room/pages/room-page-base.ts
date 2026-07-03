import { Component, ChangeDetectionStrategy, inject, signal, input, effect, computed, DestroyRef, Injector, Type } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { Dialog } from '@angular/cdk/dialog';
import { EMPTY, firstValueFrom, forkJoin, interval, type Subscription } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StageStore } from '../state/stage-store';
import { AudienceStore } from '../state/audience-store';
import { CommentsStore } from '../feature/comments/comments-store';
import { ModStore, ModAction } from '../feature/moderation/mod-store';
import { GiftsStore } from '../feature/gifts/gifts-store';
import { InRoomRtmStore } from '../feature/in-room-rtm/in-room-rtm-store';
import { GoodieStore } from '../feature/goodie-bag/goodie-store';
import { ManagersStore } from '../feature/moderation/managers-store';
import { RoomApi } from '../data/room-api';
import { AudienceUser, StageUser } from '../data/room-model';
import { SendEvent } from '../feature/comments/comment-input';
import { ToastService } from '@core/services/toast.service';
import { RoomConnectionService } from '@core/realtime/room-connection.service';
import { BffRoomSocketService } from '@core/realtime/bff-room-socket.service';
import { UserInfoService } from '@core/services/user-info.service';
import { handleRealtimeEvent } from '@features/room/data/handle-realtime-event.util';
import { GhostAudienceInputs, fetchMissingGhostInfo, buildAudienceWithGhosts, buildGhostAudienceInputs } from '@features/room/data/ghost-audience.util';
import { buildModActionDefs } from '@features/room/data/mod-action-defs';
import { UserActionModalData } from '../feature/moderation/user-action-modal';
import { ManagersModalComponent } from '../feature/moderation/managers-modal';
import { UserActionModalComponent } from '../feature/moderation/user-action-modal';
import { ActiveCallStore } from '@store/active-call.store';

export abstract class RoomPageBase {

  protected abstract readonly roomStore: RoomStoreContract;

  protected abstract readonly cname: { (): string };

  protected abstract readonly busiType: { (): number };

  protected abstract readonly visible: { (): boolean };

  protected abstract readonly leaveNavTarget: string[];

  protected abstract commentsRefreshMode(): 'merge' | 'replace';


  protected readonly stageStore = inject(StageStore);
  protected readonly audienceStore = inject(AudienceStore);
  protected readonly commentsStore = inject(CommentsStore);
  protected readonly modStore = inject(ModStore);
  protected readonly rtmStore = inject(InRoomRtmStore);
  protected readonly giftsStore = inject(GiftsStore);
  protected readonly goodieStore = inject(GoodieStore);
  protected readonly managersStore = inject(ManagersStore);
  protected readonly router = inject(Router);
  protected readonly activeCallStore = inject(ActiveCallStore);
  protected readonly location = inject(Location);
  protected readonly api = inject(RoomApi);
  readonly rcs = inject(RoomConnectionService);
  readonly bffWs = inject(BffRoomSocketService);
  protected readonly userInfoService = inject(UserInfoService);
  protected readonly toast = inject(ToastService);
  protected readonly destroyRef = inject(DestroyRef);
  protected readonly dialog = inject(Dialog);
  protected readonly injector = inject(Injector);



  readonly showSignin = signal(false);
  readonly captionEnabled = signal(false);
  readonly refreshingRoom = signal(false);
  readonly refreshingComments = signal(false);
  protected readonly _destroying = signal(false);

  readonly selfSpeaking = computed(() =>
    this.rcs.speakingUids().includes(this.roomStore.userId()),
  );

  protected readonly reqUserId = signal(0);

  readonly mediaToggleBusy = signal(false);
  readonly handToggleBusy = signal(false);
  /** Prevents concurrent visibility toggle calls (double-click guard). */
  readonly togglingVisibility = signal(false);
  readonly inviteBusy = signal<number | null>(null);


  private readonly typingUsers = signal<ReadonlyMap<number, { name: string; ts: number }>>(new Map());
  private readonly typingTick = signal(0);
  readonly typingNames = computed<readonly string[]>(() => {
    this.typingTick();
    const now = Date.now();
    return [...this.typingUsers().entries()]
      .filter(([, info]) => now - info.ts <= 1000)
      .map(([, info]) => info.name);
  });


  protected ghostAudienceInputs(): GhostAudienceInputs {
    return buildGhostAudienceInputs(
      this.rcs,
      this.reqUserId(),
      this.roomStore as unknown as import('../state/room-store').RoomStore,
      this.stageStore,
      this.audienceStore,
    );
  }

  private readonly ghostFetchEffect = effect(() => {
    if (this._destroying()) return;
    fetchMissingGhostInfo(this.ghostAudienceInputs(), this.userInfoService);
  });

  readonly audienceWithGhosts = computed<readonly AudienceUser[]>(() =>
    buildAudienceWithGhosts(
      this.ghostAudienceInputs(),
      this.roomStore.busiType(),
      this.userInfoService,
      this.audienceStore.audienceUsers(),
    ),
  );


  private readonly bffEventEffect = effect(() => {
    if (this._destroying()) return;
    const event = this.bffWs.lastEvent();
    if (!event) return;

    // connection-state fires many times/sec during reconnect — skip it
    if (event.type === 'connection-state') return;

    // room_kick: self-redirect only — card display is handled by CommentsStore
    if (event.type === 'room_kick' && Number(event.userId) === this.roomStore.userId()) {
      this.toast.warning(`You were removed from the room by ${event.managerName}`);
      void this.onLeave();
      return;
    }

    void handleRealtimeEvent(
      event,
      this.api,
      this.toast,
      this.roomStore.cname() ?? '',
      this.busiType(),
      this.roomStore.userId(),
      this.roomStore.isHost(),
      (uid) => this.resolveNickname(uid),
    ).catch((err) => console.warn('[bffEventEffect]', err));
  });


  constructor() {
    this.destroyRef.onDestroy(() => {
      this._destroying.set(true);
      this.typingPruneSub?.unsubscribe();
      if (this.activeCallStore.cname() !== null && this.activeCallStore.cname() === this.roomStore.cname()) {
        return;
      }
      this.rcs.leave().catch(() => {}).finally(() =>
        this.roomStore.leaveRoom().finally(() => {
          this.stageStore.reset();
          this.audienceStore.reset();
          this.commentsStore.reset();
          this.rtmStore.reset();
          this.giftsStore.reset();
          this.modStore.reset();
          this.goodieStore.endGame();
        }),
      );
    });

    this.typingPruneSub = interval(1_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.typingTick.update((n) => n + 1));
  }

  protected typingPruneSub: Subscription | null = null;


  async onRefreshRoom(): Promise<void> {
    const cname = this.roomStore.cname();
    if (!cname || this.refreshingRoom()) return;
    this.refreshingRoom.set(true);
    try {
      await this.doRefreshRoomCore(cname);
    } finally {
      this.refreshingRoom.set(false);
    }
  }

  protected abstract doRefreshRoomCore(cname: string): Promise<void>;

  async onRefreshComments(): Promise<void> {
    if (this.refreshingComments()) return;
    this.refreshingComments.set(true);
    try {
      await this.commentsStore.refreshComments(
        this.roomStore.cname() ?? '',
        this.roomStore.busiType(),
        this.commentsRefreshMode(),
      );
    } finally {
      this.refreshingComments.set(false);
    }
  }

  onTyping(): void {
    const cname = this.roomStore.cname();
    if (!cname) return;
    this.rcs.sendRtmTyping(
      this.roomStore.userId(),
      cname,
      this.roomStore.nickname() || 'Anonymous',
    );
  }

  async onLoadCaptions(): Promise<void> {
    await this.commentsStore.loadCaptions(
      this.roomStore.cname() ?? '',
      this.roomStore.busiType(),
    );
  }

  async onToggleCaption(): Promise<void> {
    const cname = this.roomStore.cname();
    const busiType = this.roomStore.busiType();
    if (!cname) return;
    const next = !this.captionEnabled();
    try {
      await this.commentsStore.toggleCaption(cname, busiType, next);
      this.captionEnabled.set(next);
    } catch {
      this.toast.error('Failed to toggle captions');
    }
  }

  abstract onMediaToggle(): void;

  protected onToggleCamOrShare(): void {
    this.toast.info('Screen share is not available yet');
  }

  abstract onToggleHand(): void;

  onGift(): void {
    this.toast.info('Gifts are not available yet');
  }

  onPitch(): void {
    this.toast.info('Voice pitch is not available yet');
  }

  onManagers(): void {
    const cname = this.roomStore.cname();
    if (!cname) return;
    const hostId = this.roomStore.userId();
    const busiType = this.roomStore.busiType();
    this.dialog.open(ManagersModalComponent, {
      data: {
        cname,
        hostId,
        busiType,
        isHost: this.roomStore.isHost(),
      } as import('../feature/moderation/managers-modal').ManagersModalData,
      backdropClass: 'app-modal-backdrop',
      injector: this.injector,
    });
  }

  onReward(): void {
    this.showSignin.set(true);
  }

  async onToggleInvisible(): Promise<void> {}

  /**
   * Keeps the URL ?visible= query param in sync with the actual visibility state
   * after an in-app toggle, so that page refresh preserves the chosen state.
   */
  protected syncVisibilityToUrl(isVisible: boolean): void {
    this.router.navigate([], {
      queryParams: { visible: isVisible ? null : 'false' },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected onSendComment(event: SendEvent): void {}

  onStageUserClick(user: StageUser): void {
    this.openUserActions({
      userId: user.userId,
      nickname: user.nickname,
      headUrl: user.headUrl ?? null,
      role: user.role,
      isTurnOnMic: user.isTurnOnMic,
      isRaiseHand: false,
    });
  }

  onAudienceUserClick(user: AudienceUser): void {
    const nickname = user.base?.nickname;
    const headUrl = user.base?.headUrl;
    this.openUserActions({
      userId: user.userId,
      ...(nickname != null && { nickname }),
      ...(headUrl != null && { headUrl }),
      role: user.role,
      isTurnOnMic: user.isTurnOnMic,
      isRaiseHand: user.isRaiseHand,
      ...(user.isGhost && { isGhost: true }),
    });
  }

  protected openUserActions(user: UserActionModalData): void {
    if (user.userId) this.modStore.selectUser(user.userId);
    const ref = this.dialog.open<ModAction | undefined>(UserActionModalComponent, {
      data: user,
      backdropClass: 'app-modal-backdrop',
      ariaLabelledBy: 'user-action-title',
      injector: this.injector,
    });
    ref.closed
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((action) => { if (action) this.onUserAction(action); });
  }

  onInviteToStage(user: AudienceUser): void {
    const cname = this.roomStore.cname();
    const busiType = this.roomStore.busiType();
    if (!cname || this.inviteBusy() !== null) return;
    this.inviteBusy.set(user.userId);

    this.api.inviteToStage(cname, busiType, user.userId).pipe(
      takeUntilDestroyed(this.destroyRef),
      tap({
        next: () => this.toast.success(`Invited ${user.base?.nickname ?? 'user'} to stage`),
        error: () => this.toast.error('Failed to invite to stage'),
      }),
      catchError(() => EMPTY),
    ).subscribe({ complete: () => this.inviteBusy.set(null) });
  }

  onUserAction(action: ModAction): void {
    const uid = this.modStore.selectedUserId();
    if (!uid) return;

    const cname = this.roomStore.cname();
    const busiType = this.roomStore.busiType();
    if (!cname) return;

    const actionDefs = buildModActionDefs(this.api, cname, busiType, uid);
    const def = actionDefs[action];
    def.call().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => def.toast === 'success' ? this.toast.success(def.message) : this.toast.info(def.message),
      error: () => this.toast.error(`Failed to ${action.replace('_', ' ')}`),
    });
  }

  async onLeave(): Promise<void> {
    this._destroying.set(true);
    try {
      await this.rcs.leave();
      await this.roomStore.leaveRoom();
      this.bffWs.disconnect();
    } finally {
      await this.router.navigate(this.leaveNavTarget);
    }
  }

  onMinimize(): void {
    const cname = this.roomStore.cname();
    if (!cname) return;
    this.activeCallStore.minimize(cname, this.roomStore.busiType(), this.roomStore.name(), this.roomStore.isMicOn());
    if (typeof window !== 'undefined' && window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/rooms/voice']);
    }
  }


  protected resolveNickname(userId: number): string {
    const fromAudience = this.audienceStore.audienceUsers().find(
      (u) => u.userId === userId,
    )?.base?.nickname;
    if (fromAudience) return fromAudience;
    const fromStage = this.stageStore.stageUsers().find(
      (u) => u.userId === userId,
    )?.nickname;
    if (fromStage) return fromStage;
    return this.userInfoService.getUserInfo(userId)?.nickname ?? 'Someone';
  }
}

export interface RoomStoreContract {
  userId(): number;
  cname(): string | null;
  busiType(): number;
  nickname(): string | null;
  headUrl(): string | null;
  nationality(): string | null;
  myRole(): number;
  isHost(): boolean;
  isModerator(): boolean;
  isVisible(): boolean;
  isMicOn(): boolean;
  isCamOn(): boolean;
  isHandRaised(): boolean;
  name(): string;
  topic(): string;
  roomLevelInfo(): { level: number; levelIconV2?: string; levelIcon?: string } | null;
  rtcInfo(): { token?: string | null; appId?: string | null } | null;
  setUserId(v: number): void;
  setRole(v: number): void;
  setNickname(v: string): void;
  setHeadUrl(v: string): void;
  setNationality(v: string): void;
  setRoomName(v: string): void;
  setRoomTopic(v: string): void;
  setRtcInfo(v: unknown): void;
  setRoomLevelInfo(v: unknown): void;
  setHandRaised(v: boolean): void;
  setVisibility(v: boolean): void;
  setCamOn(v: boolean): void;
  setMicOn(v: boolean): void;
  setCname(v: string): void;
  joinRoom(cname: string, busiType: number, visible: boolean): Promise<void>;
  leaveRoom(): Promise<void>;
}
