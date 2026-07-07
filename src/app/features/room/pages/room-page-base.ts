import { Component, ChangeDetectionStrategy, inject, signal, input, effect, computed, DestroyRef, Injector, Type } from '@angular/core';
import { Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { EMPTY, firstValueFrom, forkJoin } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StageStore } from '../stage/stage-store';
import { AudienceStore } from '../audience/audience-store';
import { CommentsStore } from '../comments/comments-store';
import { ModStore, ModAction } from '../moderation/mod-store';
import { GiftsStore } from '../gifts/gifts-store';
import { InRoomRtmStore } from '../in-room-rtm/in-room-rtm-store';
import { GoodieStore } from '../goodie-bag/goodie-store';
import { ManagersStore } from '../moderation/managers-store';
import { RoomApi } from '../data/room-api';
import { RoomStore } from '../store/room-store';
import { AudienceUser, StageUser } from '../data/room-model';
import { SendEvent } from '../comments/comment-input';
import { ToastService } from '@core/services/toast.service';
import { RoomConnectionService } from '@core/realtime/room-connection.service';
import { BffRoomSocketService } from '@core/realtime/bff-room-socket.service';
import { UserInfoService } from '@core/services/user-info.service';
import { handleRealtimeEvent } from '@features/room/data/handle-realtime-event.util';
import { buildKickedFromRoomOutcome, resolveManagerIdentity } from '@features/room/data/kicked-from-room.util';
import { GhostAudienceInputs, fetchMissingGhostInfo, buildAudienceWithGhosts, buildGhostAudienceInputs } from '@features/room/data/ghost-audience.util';
import { buildModActionDefs } from '@features/room/data/mod-action-defs';
import { buildSendCommentPayload } from '@features/room/data/send-comment-payload.util';
import { NOTIFICATION_REPORTER } from '@core/tokens/notification-reporter.token';
import { UserActionModalData } from '../moderation/user-action-modal';
import { ManagersModalComponent } from '../moderation/managers-modal';
import { UserActionModalComponent } from '../moderation/user-action-modal';
import { UserInfoModalComponent, UserInfoModalData } from '@shared/ui/user-info-modal/user-info-modal.component';
import { ActiveCallStore } from '@store/active-call.store';

/**
 * Generic over the concrete room store so voice and video pages both extend
 * this without a separate RoomStoreContract duck-type — both now inject the
 * same unified RoomStore (see store/room-store.ts), so the abstract property
 * can be typed directly against it instead of a structural interface.
 */
export abstract class RoomPageBase<TStore extends RoomStore = RoomStore> {

  protected abstract readonly roomStore: TStore;

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
  protected readonly api = inject(RoomApi);
  readonly rcs = inject(RoomConnectionService);
  readonly bffWs = inject(BffRoomSocketService);
  protected readonly userInfoService = inject(UserInfoService);
  protected readonly toast = inject(ToastService);
  protected readonly notifications = inject(NOTIFICATION_REPORTER);
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
  readonly typingNames = computed<readonly string[]>(() => {
    const now = Date.now();
    return [...this.typingUsers().entries()]
      .filter(([, info]) => now - info.ts <= 1000)
      .map(([, info]) => info.name);
  });

  private typingPruneTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Self-arming prune, not an unconditional interval. Runs only while
   * typingUsers has entries — schedules one setTimeout, prunes stale
   * entries when it fires, and re-arms only if entries remain. When
   * the map is empty (the common case — no one is typing), no timer
   * runs at all, unlike the previous interval(1_000) which ticked
   * forever for the entire lifetime of every room page.
   */
  private readonly typingPruneEffect = effect(() => {
    const map = this.typingUsers();
    if (this._destroying()) return;
    if (map.size === 0 || this.typingPruneTimer) return;
    this.typingPruneTimer = setTimeout(() => {
      this.typingPruneTimer = null;
      const now = Date.now();
      this.typingUsers.update((m) => {
        const next = new Map([...m].filter(([, info]) => now - info.ts <= 1000));
        return next.size === m.size ? m : next;
      });
    }, 1000);
  });


  /**
   * A computed, not a plain method: ghostFetchEffect and audienceWithGhosts both
   * read this, and buildGhostAudienceInputs allocates fresh stageUserIds/
   * audienceUserIds arrays on every call — as a plain method that meant two
   * independent array allocations per reactive cycle even when nothing the two
   * consumers care about had changed. computed() makes both read one cached value.
   */
  protected readonly ghostAudienceInputs = computed<GhostAudienceInputs>(() =>
    buildGhostAudienceInputs(
      this.rcs,
      this.reqUserId(),
      this.roomStore,
      this.stageStore,
      this.audienceStore,
    ),
  );

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


  /**
   * Subscribes only to the event types this page actually reacts to, instead of an
   * effect() reading bffWs.lastEvent() and switching on the full RoomRealtimeEvent
   * union (connection-state alone fires many times/sec during reconnect, so that
   * switch ran constantly for events this page ignores).
   */
  private readonly bffRoomKickSub = this.bffWs.event$('room_kick').pipe(takeUntilDestroyed()).subscribe((event) => {
    if (this._destroying()) return;
    // Stay in the room as an invisible ghost instead of leaving — card display is
    // handled by CommentsStore/EventFeedStore.
    if (Number(event.userId) !== this.roomStore.userId()) return;
    void this.handleKickedFromRoom(event.managerName);
  });

  /** The 4 event types handleRealtimeEvent actually switches on. */
  private readonly bffDelegatedEventTypes = ['stage_raisehand', 'stage_kick', 'stage_device_control', 'lucky_bag'] as const;

  private readonly bffDelegatedEventSubs = this.bffDelegatedEventTypes.map((type) =>
    this.bffWs.event$(type).pipe(takeUntilDestroyed()).subscribe((event) => {
      if (this._destroying()) return;
      void handleRealtimeEvent(
        event,
        this.api,
        this.toast,
        this.roomStore.cname() ?? '',
        this.busiType(),
        this.roomStore.userId(),
        this.roomStore.isHost(),
        (uid) => this.resolveNickname(uid),
      ).catch((err) => console.warn('[bffDelegatedEventSubs]', err));
    }),
  );


  constructor() {
    this.destroyRef.onDestroy(() => {
      this._destroying.set(true);
      if (this.typingPruneTimer) {
        clearTimeout(this.typingPruneTimer);
        this.typingPruneTimer = null;
      }
      // The room is still in the active-call snapshot, meaning the user clicked minimize
      // and the room page is being destroyed in response — keep state alive for the restore
      // path. (onLeave clears the snapshot before destroy fires, so a "real" leave doesn't
      // match here and falls through to the full cleanup.)
      // Compare against the ROUTED cname (this.cname()), not this.roomStore.cname():
      // roomStore.cname() is null/0 before enterRoom() resolves, so an early destroy
      // (e.g. fast navigation) would mis-fire the full teardown. The routed input is
      // always available and matches what the snapshot was captured against.
      if (this.activeCallStore.cname() === this.cname()) {
        return;
      }
      this.rcs.leave().catch(() => {}).finally(() =>
        this.roomStore.leaveRoom().finally(() => this.resetAllRoomStores()),
      );
    });
  }

  /**
   * Every store this page provides, reset in one named place. Kept here rather than
   * on BaseRoomStore itself — centralizing it onto the store would mean BaseRoomStore
   * has to inject every other room store, recreating exactly the kind of cross-store
   * coupling the CommentsStore/EventFeedStore split (see event-feed-store.ts) was
   * meant to break up. The page already injects all of these to orchestrate the room,
   * so it's the natural single place this belongs — this method just gives that
   * existing chain a name and one addition: managersStore.reset() was previously
   * missing entirely (harmless today, since managers-modal.ts always calls
   * setParams() fresh on open — but a real gap if that ever changes).
   */
  private resetAllRoomStores(): void {
    this.stageStore.reset();
    this.audienceStore.reset();
    this.commentsStore.reset();
    this.rtmStore.reset();
    this.giftsStore.reset();
    this.modStore.reset();
    this.managersStore.reset();
    this.goodieStore.endGame();
  }

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
      } as import('../moderation/managers-modal').ManagersModalData,
      backdropClass: 'app-modal-backdrop',
      injector: this.injector,
    });
  }

  onReward(): void {
    this.showSignin.set(true);
  }

  async onToggleInvisible(): Promise<void> {
    const cname = this.roomStore.cname();
    const busiType = this.busiType();
    if (!cname || this.togglingVisibility()) return;
    this.togglingVisibility.set(true);
    try {
      if (this.roomStore.isVisible()) {
        await this.makeInvisible(cname, busiType);
      } else {
        await this.makeVisible(cname, busiType);
      }
    } finally {
      this.togglingVisibility.set(false);
    }
  }

  /**
   * Default implementation for the "make visible" branch — voice and video
   * each override this because they call fetchJoinBundle with their own
   * info type. Kept abstract so the variants stay explicit at the call site.
   */
  protected abstract makeVisible(cname: string, busiType: number): Promise<void>;

  protected async makeInvisible(cname: string, busiType: number): Promise<void> {
    await firstValueFrom(this.api.leaveRoom(cname, busiType));
    await this.goInvisibleLocally(cname, busiType);
    this.toast.info('You are now invisible');
  }

  /**
   * Call at the top of doEnterRoom(), before roomStore.enterRoom(). Returns whether this
   * entry is a minimize→restore for `cname` (same room as the active-call snapshot).
   * If the snapshot instead points at a *different* room — the user minimized room A, then
   * navigated straight to room B instead of restoring — room A's RTC connection is still
   * open and its snapshot is stale, so this tears both down before B's entry proceeds.
   */
  protected async resolveRoomEntry(cname: string): Promise<boolean> {
    const snapshotMatch = this.activeCallStore.cname() === cname;
    const isRestore = snapshotMatch && this.activeCallStore.minimized();
    if (this.activeCallStore.minimized() && !isRestore) {
      await this.rcs.leave().catch(() => {});
      this.activeCallStore.clear();
    }
    // If the WS gave up while the user was minimized (5 reconnect attempts
    // failed), the restore path would otherwise skip bffWs.connect() and
    // leave the user in a "restored" room with a permanently dead socket.
    // Force a fresh full connect in that case by flipping isRestore=false;
    // doEnterRoom() then re-enters the WS + RTC + RTM branches.
    if (isRestore && this.bffWs.gaveUp(cname)) {
      this.bffWs.disconnect().catch(() => {});
      return false;
    }
    return isRestore;
  }

  /**
   * Shared "raise/lower hand" branch — handles the case where the user is a
   * regular audience member (not on stage, not a moderator). Voice's
   * onToggleHand calls this after handling its stage-leave / mod-join-stage
   * cases; video's onToggleHand is just this.
   */
  protected raiseOrLowerHand(cname: string, busiType: number): void {
    if (!this.roomStore.isVisible()) {
      this.toast.info('You are invisible — rejoin visibly to raise your hand');
      return;
    }
    if (this.handToggleBusy()) return;

    const wasRaised = this.roomStore.isHandRaised();
    const raised = !wasRaised;
    this.roomStore.setHandRaised(raised);
    this.handToggleBusy.set(true);

    this.api.raiseHand(cname, busiType, raised ? 1 : 2).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => this.handToggleBusy.set(false),
      error: (err: unknown) => {
        console.error('[room] raiseHand failed', err);
        this.toast.error(`Failed to update hand: ${err instanceof Error ? err.message : String(err)}`);
        this.roomStore.setHandRaised(wasRaised);
        this.handToggleBusy.set(false);
      },
    });
  }

  /** Builds the API payload for sendComment from current room store + event. */
  protected buildCommentPayload(event: SendEvent, clientNonce?: string): import('../data/room-model').SendCommentPayload {
    return buildSendCommentPayload(
      {
        cname: this.roomStore.cname(),
        busiType: this.roomStore.busiType(),
        nickname: this.roomStore.nickname(),
        headUrl: this.roomStore.headUrl(),
        nationality: this.roomStore.nationality(),
        role: this.roomStore.myRole(),
      },
      event,
      clientNonce,
    );
  }

  /**
   * Keeps the URL's `?visible=` query param in sync with the actual visibility state after
   * an in-session toggle, so a page refresh (or a room-card "Join" click on return) reads
   * back the same choice — the only durable record of visibility for anything that isn't
   * a minimize→restore round-trip (see BaseRoomStore.enterRoom's doc comment).
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

  /**
   * Hosts and moderators get the full moderation modal (mute/kick/ban etc.)
   * for real users; a plain viewer — or anyone clicking a ghost placeholder,
   * which has no confirmed identity to act on — gets the read-only profile
   * card (with follow) instead.
   */
  protected openUserActions(user: UserActionModalData): void {
    const canModerate = (this.roomStore.isHost() || this.roomStore.isModerator()) && !user.isGhost;
    if (!canModerate) {
      this.dialog.open(UserInfoModalComponent, {
        data: {
          userId: user.userId ?? 0,
          nickname: user.nickname ?? user.base?.nickname ?? null,
          headUrl: user.headUrl ?? user.base?.headUrl ?? null,
        } satisfies UserInfoModalData,
        backdropClass: 'app-modal-backdrop',
        injector: this.injector,
      });
      return;
    }

    if (user.userId) this.modStore.selectUser(user.userId);
    const ref = this.dialog.open<ModAction | undefined>(UserActionModalComponent, {
      data: user,
      backdropClass: 'app-modal-backdrop',
      ariaLabel: user.nickname ?? 'User',
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

  /** Local-only side effects of becoming invisible — no roster leave/join REST call. */
  protected async goInvisibleLocally(cname: string, busiType: number): Promise<void> {
    this.roomStore.setVisibility(false);
    this.syncVisibilityToUrl(false);
    this.activeCallStore.setInvisible(true);
    this.stageStore.reset();
    await this.rcs.stopAudio();
    this.bffWs.connect(cname, 0, busiType, null);
  }

  private async handleKickedFromRoom(managerName: string): Promise<void> {
    const outcome = buildKickedFromRoomOutcome(managerName, this.roomStore.name(), this.roomStore.isVisible());
    const identity = resolveManagerIdentity(managerName, this.stageStore.stageUsers(), this.audienceStore.audienceUsers());
    const cname = this.roomStore.cname();
    if (outcome.shouldGoInvisible && cname) {
      await this.goInvisibleLocally(cname, this.busiType());
    }
    this.toast.warning(outcome.toastMessage);
    if (identity) {
      this.notifications.notifyUserEvent({
        type: 'warning',
        title: outcome.notificationTitle,
        message: outcome.notificationMessage,
        userId: identity.userId,
        avatarUrl: identity.avatarUrl,
        nickname: managerName,
      });
    } else {
      this.notifications.notify('warning', outcome.notificationTitle, outcome.notificationMessage);
    }
  }

  async onLeave(): Promise<void> {
    this._destroying.set(true);
    try {
      await this.rcs.leave();
      await this.roomStore.leaveRoom();
      this.bffWs.disconnect();
      this.activeCallStore.clear();
      // Clear the OS-level "Call in progress" tile so iOS stops showing the
      // room name in Control Center / lock-screen. Set in room-page.ts on
      // successful rcs.connect(); clear is best-effort — the metadata will
      // also clear on page navigation away from the room anyway.
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.metadata = null;
          navigator.mediaSession.playbackState = 'none';
        } catch {
          // Safari < 14 throws on null assignment — fail silent.
        }
      }
    } finally {
      await this.router.navigate(this.leaveNavTarget);
    }
  }

  onMinimize(): void {
    const cname = this.roomStore.cname();
    if (!cname) return;
    this.activeCallStore.minimize(
      cname,
      this.busiType(),
      this.roomStore.name(),
      this.roomStore.isMicOn(),
      !this.roomStore.isVisible(),
    );
    // Clear the OS-level "Call in progress" tile so iOS stops showing the
    // room name in Control Center / lock-screen while the user is on a
    // different page. Same mediaSession clear as onLeave() — without this,
    // the iOS lock-screen tile lingers after minimize, and the bar UI's
    // "playing" state would never reset.
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
      } catch {
        // Safari < 14 throws on null assignment — fail silent.
      }
    }
    void this.router.navigate(this.leaveNavTarget);
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
