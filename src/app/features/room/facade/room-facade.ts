import { Service, signal, effect, computed, inject, DestroyRef, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RoomRosterStore } from '../roster/roster-store';
import { CommentsStore } from '../comments/comments-store';
import { ModStore, ModAction } from '../moderation/mod-store';
import { InRoomRtmStore } from '../in-room-rtm/in-room-rtm-store';
import { ManagersStore } from '../moderation/managers-store';
import { RoomApi } from '../api/room-api';
import { RoomStore } from '../store/room-store';
import { AudienceUser, StageUser } from '../models/room-model';
import { ToastService } from '@core/services/toast.service';
import { RoomConnectionService } from '@core/realtime/room-connection.service';
import { HtRoomConnectionService } from '@core/realtime/ht-room-connection.service';
import { UserInfoService } from '@core/services/user-info.service';
import { handleRealtimeEvent } from '../utils/handle-realtime-event.util';
import { GhostAudienceInputs, fetchMissingGhostInfo, buildAudienceWithGhosts, buildGhostAudienceInputs } from '../utils/ghost-audience.util';
import { buildModActionDefs } from '../utils/mod-action-defs';
import { canModerateUser } from '../rules/permission.rules';
import { leaveRoom } from '../commands/leave-room.command';
import { goInvisibleLocally as goInvisibleLocallyCommand } from '../commands/go-invisible.command';
import { handleKickedFromRoom as handleKickedFromRoomCommand } from '../commands/handle-kicked-from-room.command';
import { resolveRoomEntry as resolveRoomEntryCommand } from '../commands/resolve-room-entry.command';
import { makeInvisible as makeInvisibleCommand } from '../commands/make-invisible.command';
import { raiseOrLowerHand as raiseOrLowerHandCommand } from '../commands/raise-or-lower-hand.command';
import { inviteToStage as inviteToStageCommand } from '../commands/invite-to-stage.command';
import { toggleSpeakFromAudience as toggleSpeakFromAudienceCommand } from '../commands/speak-from-audience.command';
import { minimizeRoom } from '../commands/minimize-room.command';
import { NOTIFICATION_REPORTER } from '@core/tokens/notification-reporter.token';
import { UserActionModalData } from '../moderation/user-action-modal';
import { ManagersModalComponent } from '../moderation/managers-modal';
import { UserActionModalComponent } from '../moderation/user-action-modal';
import { UserInfoModalComponent, UserInfoModalData } from '@shared/ui/user-info-modal/user-info-modal.component';
import { ActiveCallStore } from '@store/active-call.store';

/**
 * Page-scoped orchestrator both room pages inject (not extend) — replaces the former
 * RoomPageBase abstract class. Injected alongside the stores it wraps (RoomPageComponent /
 * VideoRoomPageComponent list it in the same `providers:` array), so it resolves the same
 * store/service instances the page component injects directly — composition, not inheritance.
 * Page-specific logic (routed inputs, doEnterRoom, makeVisible, onMediaToggle, onToggleHand,
 * onSendComment, leaveNavTarget) stays on the page component; this owns only what was
 * previously identical between both pages.
 */
@Service({ autoProvided: false })
export class RoomFacade {
  private readonly roomStore = inject(RoomStore);
  private readonly rosterStore = inject(RoomRosterStore);
  private readonly commentsStore = inject(CommentsStore);
  private readonly modStore = inject(ModStore);
  private readonly rtmStore = inject(InRoomRtmStore);
  private readonly managersStore = inject(ManagersStore);
  private readonly router = inject(Router);
  private readonly activeCallStore = inject(ActiveCallStore);
  private readonly api = inject(RoomApi);
  private readonly rcs = inject(RoomConnectionService);
  private readonly bffWs = inject(HtRoomConnectionService);
  private readonly userInfoService = inject(UserInfoService);
  private readonly toast = inject(ToastService);
  private readonly notifications = inject(NOTIFICATION_REPORTER);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(Dialog);
  private readonly injector = inject(Injector);

  private busiTypeSignal: (() => number) | null = null;

  /** Call as the first statement of the page component's constructor. */
  init(busiType: () => number): void {
    this.busiTypeSignal = busiType;
  }

  private busiType(): number {
    if (!this.busiTypeSignal) throw new Error('RoomFacade.init() must be called before use');
    return this.busiTypeSignal();
  }

  readonly showSignin = signal(false);
  readonly captionEnabled = signal(false);
  readonly refreshingRoom = signal(false);
  readonly refreshingComments = signal(false);
  readonly destroying = signal(false);

  readonly selfSpeaking = computed(() =>
    this.rcs.speakingUids().includes(this.roomStore.userId()),
  );

  /** Whether the local user is currently publishing audio (in either capacity — on-stage,
   *  visible understage, or invisible ghost). Mirrors AgoraRtcService.isPublishing. */
  readonly selfIsPublishing = computed(() => this.rcs.agora.isPublishing());

  /** Whether the local user is a candidate for the audience-row mic button:
   *  in the audience (not on stage), and either visible OR invisible-but-wanting-to-speak.
   *  Invisible users see a smaller "ghost mic" affordance — same code path, different UI. */
  readonly selfCanSpeakFromAudience = computed(() => {
    const uid = this.roomStore.userId();
    if (!uid) return false;
    if (this.rosterStore.isOnStage(uid)) return false;
    if (this.roomStore.isHost() || this.roomStore.isModerator()) return true;
    return true;
  });

  readonly reqUserId = signal(0);

  readonly mediaToggleBusy = signal(false);
  readonly handToggleBusy = signal(false);
  readonly speakFromAudienceBusy = signal(false);
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
    if (this.destroying()) return;
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
  private readonly ghostAudienceInputs = computed<GhostAudienceInputs>(() =>
    buildGhostAudienceInputs(
      this.rcs,
      this.reqUserId(),
      this.roomStore,
      this.rosterStore,
    ),
  );

  private readonly ghostFetchEffect = effect(() => {
    if (this.destroying()) return;
    fetchMissingGhostInfo(this.ghostAudienceInputs(), this.userInfoService);
  });

  readonly audienceWithGhosts = computed<readonly AudienceUser[]>(() =>
    buildAudienceWithGhosts(
      this.ghostAudienceInputs(),
      this.roomStore.busiType(),
      this.userInfoService,
      this.rosterStore.audienceUsers(),
    ),
  );


  /**
   * Subscribes only to the event types this page actually reacts to, instead of an
   * effect() reading bffWs.lastEvent() and switching on the full RoomRealtimeEvent
   * union (connection-state alone fires many times/sec during reconnect, so that
   * switch ran constantly for events this page ignores).
   */
  private readonly bffRoomKickSub = this.bffWs.event$('room_kick').pipe(takeUntilDestroyed()).subscribe((event) => {
    if (this.destroying()) return;
    // Stay in the room as an invisible ghost instead of leaving — card display is
    // handled by CommentsStore/EventFeedStore.
    if (Number(event.userId) !== this.roomStore.userId()) return;
    void this.handleKickedFromRoom(event.managerName);
  });

  /** The 4 event types handleRealtimeEvent actually switches on. */
  private readonly bffDelegatedEventTypes = ['stage_raisehand', 'stage_kick', 'stage_device_control', 'lucky_bag'] as const;

  private readonly bffDelegatedEventSubs = this.bffDelegatedEventTypes.map((type) =>
    this.bffWs.event$(type).pipe(takeUntilDestroyed()).subscribe((event) => {
      if (this.destroying()) return;
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
      this.destroying.set(true);
      if (this.typingPruneTimer) {
        clearTimeout(this.typingPruneTimer);
        this.typingPruneTimer = null;
      }
      // The room is still in the active-call snapshot, meaning the user clicked minimize
      // and the room page is being destroyed in response — keep state alive for the restore
      // path. (leave() clears the snapshot before destroy fires, so a "real" leave doesn't
      // match here and falls through to the full cleanup.)
      if (this.activeCallStore.cname() === (this.roomStore.cname() ?? '')) {
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
   * meant to break up.
   */
  private resetAllRoomStores(): void {
    this.rosterStore.reset();
    this.commentsStore.reset();
    this.rtmStore.reset();
    this.modStore.reset();
    this.managersStore.reset();
  }

  async refreshRoom(cname: string, doRefreshRoomCore: (cname: string) => Promise<void>): Promise<void> {
    if (!cname || this.refreshingRoom()) return;
    this.refreshingRoom.set(true);
    try {
      await doRefreshRoomCore(cname);
    } finally {
      this.refreshingRoom.set(false);
    }
  }

  async refreshComments(mode: 'merge' | 'replace'): Promise<void> {
    if (this.refreshingComments()) return;
    this.refreshingComments.set(true);
    try {
      await this.commentsStore.refreshComments(
        this.roomStore.cname() ?? '',
        this.roomStore.busiType(),
        mode,
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

  async toggleInvisible(makeVisible: (cname: string, busiType: number) => Promise<void>): Promise<void> {
    const cname = this.roomStore.cname();
    const busiType = this.busiType();
    if (!cname || this.togglingVisibility()) return;
    this.togglingVisibility.set(true);
    try {
      if (this.roomStore.isVisible()) {
        await this.makeInvisible(cname, busiType);
      } else {
        await makeVisible(cname, busiType);
      }
    } finally {
      this.togglingVisibility.set(false);
    }
  }

  private async makeInvisible(cname: string, busiType: number): Promise<void> {
    await makeInvisibleCommand(
      cname,
      busiType,
      this.api,
      this.toast,
      (c, bt) => this.goInvisibleLocally(c, bt),
    );
  }

  /**
   * Call at the top of doEnterRoom(), before roomStore.enterRoom(). Returns whether this
   * entry is a minimize→restore for `cname` (same room as the active-call snapshot).
   */
  async resolveRoomEntry(cname: string): Promise<boolean> {
    return resolveRoomEntryCommand(cname, this.rcs, this.bffWs, this.activeCallStore);
  }

  /**
   * Shared "raise/lower hand" branch — handles the case where the user is a
   * regular audience member (not on stage, not a moderator). Voice's
   * onToggleHand calls this after handling its stage-leave / mod-join-stage
   * cases; video's onToggleHand is just this.
   */
  raiseOrLowerHand(cname: string, busiType: number): void {
    raiseOrLowerHandCommand(
      cname,
      busiType,
      this.roomStore,
      this.api,
      this.toast,
      this.handToggleBusy,
      this.destroyRef,
    );
  }

  /**
   * Keeps the URL's `?visible=` query param in sync with the actual visibility state after
   * an in-session toggle, so a page refresh (or a room-card "Join" click on return) reads
   * back the same choice — the only durable record of visibility for anything that isn't
   * a minimize→restore round-trip (see BaseRoomStore.enterRoom's doc comment).
   */
  syncVisibilityToUrl(isVisible: boolean): void {
    this.router.navigate([], {
      queryParams: { visible: isVisible ? null : 'false' },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

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
  private openUserActions(user: UserActionModalData): void {
    const canModerate = canModerateUser(this.roomStore.isHost(), this.roomStore.isModerator(), !!user.isGhost);
    if (!canModerate) {
      const cname = this.roomStore.cname();
      this.dialog.open(UserInfoModalComponent, {
        data: {
          userId: user.userId ?? 0,
          nickname: user.nickname ?? user.base?.nickname ?? null,
          headUrl: user.headUrl ?? user.base?.headUrl ?? null,
          ...(cname && { roomContext: { cname, busiType: this.busiType() } }),
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
    inviteToStageCommand(
      user,
      this.roomStore.cname(),
      this.roomStore.busiType(),
      this.api,
      this.toast,
      this.inviteBusy,
      this.destroyRef,
    );
  }

  private onUserAction(action: ModAction): void {
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
  async goInvisibleLocally(cname: string, busiType: number): Promise<void> {
    await goInvisibleLocallyCommand(
      cname,
      busiType,
      this.roomStore,
      this.rosterStore,
      this.rcs,
      this.bffWs,
      this.activeCallStore,
      (isVisible) => this.syncVisibilityToUrl(isVisible),
    );
  }

  private async handleKickedFromRoom(managerName: string): Promise<void> {
    await handleKickedFromRoomCommand(
      managerName,
      this.roomStore.cname(),
      this.busiType(),
      this.roomStore,
      this.rosterStore,
      this.toast,
      this.notifications,
      (cname, busiType) => this.goInvisibleLocally(cname, busiType),
    );
  }

  /** Sets `destroying`, tears down RTC/WS/snapshot. Navigation is the page's responsibility. */
  async leave(): Promise<void> {
    this.destroying.set(true);
    await leaveRoom(this.rcs, this.roomStore, this.bffWs, this.activeCallStore);
  }

  /** Toggle publishing for the local user when they're sitting in the audience — visible
   *  understage or invisible ghost. Used by the mic button rendered on the local user's
   *  own audience-list row. */
  async toggleSpeakFromAudience(): Promise<void> {
    await toggleSpeakFromAudienceCommand(
      {
        roomStore: this.roomStore,
        rosterStore: this.rosterStore,
        rcs: this.rcs,
        api: this.api,
        toast: this.toast,
        destroyRef: this.destroyRef,
        destroying: () => this.destroying(),
        speakBusy: this.speakFromAudienceBusy,
      },
    );
  }

  minimize(): void {
    minimizeRoom(this.roomStore, this.activeCallStore, this.busiType());
  }

  private resolveNickname(userId: number): string {
    const fromAudience = this.rosterStore.audienceUsers().find(
      (u) => u.userId === userId,
    )?.base?.nickname;
    if (fromAudience) return fromAudience;
    const fromStage = this.rosterStore.stageUsers().find(
      (u) => u.userId === userId,
    )?.nickname;
    if (fromStage) return fromStage;
    return this.userInfoService.getUserInfo(userId)?.nickname ?? 'Someone';
  }
}
