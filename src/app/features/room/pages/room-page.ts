import { Component, ChangeDetectionStrategy, inject, input, effect } from '@angular/core';
import { EMPTY, firstValueFrom } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RoomStore } from '../state/room-store';
import { JoinCancelledError } from '../state/base-room-store';
import { StageStore, STAGE_READER, STAGE_WRITER } from '../state/stage-store';
import { AudienceStore, AUDIENCE_READER, AUDIENCE_WRITER } from '../state/audience-store';
import { CommentsStore, COMMENTS_READER, COMMENTS_WRITER } from '../feature/comments/comments-store';
import { EventFeedStore } from '../feature/comments/event-feed-store';
import { ModStore, MOD_READER, MOD_WRITER } from '../feature/moderation/mod-store';
import { ManagersStore, MANAGERS_READER, MANAGERS_WRITER } from '../feature/moderation/managers-store';
import { SigninPanelComponent } from '../feature/signin/signin-panel';
import { GiftsStore, GIFTS_READER, GIFTS_WRITER } from '../feature/gifts/gifts-store';
import { InRoomRtmStore, IN_ROOM_RTM_READER, IN_ROOM_RTM_WRITER } from '../feature/in-room-rtm/in-room-rtm-store';
import { GoodieStore, GOODIE_READER, GOODIE_WRITER } from '../feature/goodie-bag/goodie-store';
import { StageUser, VoiceRoomInfo, StageUsersResponse, AudienceUsersResponse, CommentsResponse } from '../data/room-model';
import { UserRole } from '@core/models/user-role';
import { SendEvent } from '../feature/comments/comment-input';
import { environment } from '@env/environment';
import { RoomHeaderComponent } from '../feature/room-header';
import { StageGridComponent } from '../feature/stage/stage-grid';
import { AudienceListComponent } from '../feature/audience/audience-list';
import { CommentsPanelComponent } from '../feature/comments/comments-panel';
import { httpErrorMessage } from '@shared/utils/http-error-message.util';
import { RoomPageBase } from './room-page-base';

@Component({
  selector: 'app-room-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RoomHeaderComponent,
    StageGridComponent,
    AudienceListComponent,
    CommentsPanelComponent,
    SigninPanelComponent,
  ],
  providers: [
    RoomStore,
    StageStore,
    { provide: STAGE_READER, useExisting: StageStore },
    { provide: STAGE_WRITER, useExisting: StageStore },
    AudienceStore,
    { provide: AUDIENCE_READER, useExisting: AudienceStore },
    { provide: AUDIENCE_WRITER, useExisting: AudienceStore },
    EventFeedStore,
    CommentsStore,
    { provide: COMMENTS_READER, useExisting: CommentsStore },
    { provide: COMMENTS_WRITER, useExisting: CommentsStore },
    ModStore,
    { provide: MOD_READER, useExisting: ModStore },
    { provide: MOD_WRITER, useExisting: ModStore },
    GiftsStore,
    { provide: GIFTS_READER, useExisting: GiftsStore },
    { provide: GIFTS_WRITER, useExisting: GiftsStore },
    InRoomRtmStore,
    { provide: IN_ROOM_RTM_READER, useExisting: InRoomRtmStore },
    { provide: IN_ROOM_RTM_WRITER, useExisting: InRoomRtmStore },
    GoodieStore,
    { provide: GOODIE_READER, useExisting: GoodieStore },
    { provide: GOODIE_WRITER, useExisting: GoodieStore },
    ManagersStore,
    { provide: MANAGERS_READER, useExisting: ManagersStore },
    { provide: MANAGERS_WRITER, useExisting: ManagersStore },
  ],
  template: `
<div class="room-layout">
      <div class="room-header">
        <app-room-header
          [name]="roomStore.name()"
          [topic]="roomStore.topic()"
          [cname]="roomStore.cname() ?? ''"
          [isMicOn]="roomStore.isMicOn()"
          [micSpeaking]="selfSpeaking()"
          [micBusy]="mediaToggleBusy()"
          [isHandRaised]="roomStore.isHandRaised()"
          [isOnStage]="stageStore.isOnStage(roomStore.userId())"
          [isModerator]="roomStore.isModerator()"
          [invisible]="!roomStore.isVisible()"
          [refreshing]="refreshingRoom()"
          [captionEnabled]="captionEnabled()"
          [wsStatus]="bffWs.wsStatus()"
          (toggleMic)="onMediaToggle()"
          (toggleCamOrShare)="onToggleCamOrShare()"
          (toggleHand)="onToggleHand()"
          (gift)="onGift()"
          (pitch)="onPitch()"
          (managers)="onManagers()"
          (reward)="onReward()"
          (toggleCaption)="onToggleCaption()"
          (toggleInvisible)="onToggleInvisible()"
          (refresh)="onRefreshRoom()"
          (leave)="onLeave()"
          (minimize)="onMinimize()"
        />
      </div>

      <section class="stage-section">
        <app-stage-grid [users]="stageStore.stageUsers()" [speakingUids]="rcs.speakingUids()" (userClick)="onStageUserClick($event)" />
      </section>

      <section class="audience-section">
        <app-audience-list
          [users]="audienceWithGhosts()"
          [speakingUids]="rcs.speakingUids()"
          [currentUserId]="roomStore.userId()"
          [canInviteToStage]="roomStore.isHost()"
          [inviteBusy]="inviteBusy()"
          (userClick)="onAudienceUserClick($event)"
          (inviteToStage)="onInviteToStage($event)"
        />
      </section>

      <aside class="comments-section">
        <app-comments-panel
          [comments]="commentsStore.comments()"
          [captions]="commentsStore.captions()"
          [currentUserId]="roomStore.userId()"
          [refreshing]="refreshingComments()"
          [typingNames]="typingNames()"
          [disabled]="!roomStore.isVisible()"
          (sendComment)="onSendComment($event)"
          (typing)="onTyping()"
          (refresh)="onRefreshComments()"
          (loadCaptions)="onLoadCaptions()"
        />
      </aside>
    </div>

    @if (showSignin()) {
      <app-signin-panel
        [cname]="roomStore.cname() ?? ''"
        [hostId]="roomStore.userId()"
        [roomLevel]="roomStore.roomLevelInfo()?.level ?? 1"
        [roomLevelIcon]="roomStore.roomLevelInfo()?.levelIconV2 ?? roomStore.roomLevelInfo()?.levelIcon ?? null"
        (onClose)="showSignin.set(false)"
      />
    }
  `,
  styles: [`
    :host {
      display: block;
      box-sizing: border-box;
      height: 100%;
      overflow: hidden;
      container-type: size;
      container-name: room-page;
      /* The shell's .app-main padding provides the top + bottom insets in
         every viewport (mobile-immersive safe area, desktop-immersive
         app-header height, non-immersive standard chrome). See app.ts :host
         for the --shell-inset-top / --shell-inset-bottom contract. */
    }

    /* ── Mobile-first: flex column ──────────────────────────────────────────
       The header lives in normal document flow — no position:fixed hack.
       Stage caps at 45dvh with internal scroll for full 8-seat rooms.
       Audience auto-sizes (the component starts collapsed on mobile).
       Comments absorbs all remaining space via flex:1. */
    .room-layout {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    .room-header {
      flex-shrink: 0;
      position: relative;
      z-index: var(--z-overlay);
    }

    .stage-section {
      flex-shrink: 0;
      max-height: 45dvh;
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }

    .stage-section app-stage-grid {
      flex: 1 1 auto;
      min-height: 0;
    }

    .audience-section {
      flex-shrink: 0;
      overflow: hidden;
    }

    .comments-section {
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* ── Desktop: two-column sidebar layout ─────────────────────────────────
       Gate on both width AND height — landscape phones have enough width
       but not enough height for the sidebar to be useful (comments would
       be squished to ~82px). */
    @container room-page (min-width: 1024px) and (min-height: 500px) {
      .room-layout {
        display: grid;
        grid-template-areas:
          "header   comments"
          "stage    comments"
          "audience comments";
        grid-template-columns: minmax(0, 1fr) var(--comments-panel-width);
        grid-template-rows: auto auto minmax(22cqh, 1fr);
      }

      .room-header    { grid-area: header; max-height: none; }
      .stage-section  { grid-area: stage;  max-height: none; }
      .audience-section { grid-area: audience; }
      .comments-section { grid-area: comments; }
    }

  `]
})
export class RoomPageComponent extends RoomPageBase {
  readonly cname = input('', { transform: (v: string | undefined) => v ?? '' });
  readonly busiType = input(2, { transform: (v: string | number | undefined) => Number(v) || 2 });
  readonly visible = input(true, {
    transform: (v: string | boolean | undefined) => v !== 'false' && v !== false,
  });
  /** Set by the create-room flow to signal "skip join-bundle, we just created this cname."
   *  Upstream's stage/audience/comment read endpoints don't reliably serve a cname
   *  that was created moments earlier — a brand-new room 500s on join-bundle until
   *  upstream indexing catches up. Fresh-room entries must rely on realtime
   *  push events (user_join/stage_join/comment) to populate the lists, which they
   *  do anyway once the websocket is connected. */
  readonly fresh = input(false, {
    transform: (v: string | boolean | undefined) => v === 'true' || v === true || v === '1',
  });

  readonly roomStore = inject(RoomStore);

  protected readonly leaveNavTarget = ['/rooms'];

  private entering = false;
  private hasConnectedOnce = false;

  constructor() {
    super();

    // Voice-room counterpart of video-room-page.ts's identical effect: without this,
    // a voice room that gives up reconnecting (5 failed attempts) while the user is
    // actively in the room — not minimized, so resolveRoomEntry()'s gaveUp() check
    // never runs — left the user silently stuck with a dead socket and no further
    // chat/realtime updates, with only the small header status dot as any indication.
    effect(() => {
      if (this._destroying()) return;
      const status = this.bffWs.wsStatus();
      if (this.hasConnectedOnce && status === 'disconnected') {
        this.toast.error('Connection lost — refresh to rejoin');
        void this.router.navigate(['/rooms']);
      }
      if (status === 'connected') this.hasConnectedOnce = true;
    });

    effect(() => {
      if (this._destroying()) return;
      const cname = this.cname();
      const busiType = this.busiType();
      if (!cname) return;
      void this.enterRoom(cname, busiType);
    });
  }


  private async enterRoom(cname: string, busiType: number): Promise<void> {
    if (this.entering) return;
    this.entering = true;
    try {
      await this.doEnterRoom(cname, busiType);
    } finally {
      this.entering = false;
    }
  }

  private async doEnterRoom(cname: string, busiType: number): Promise<void> {
    const isRestore = await this.resolveRoomEntry(cname);
    this.audienceStore.setBusiType(busiType);
    try {
      const visibleOnFreshJoin = isRestore
        ? !this.activeCallStore.isInvisible()
        : this.visible();
      await this.roomStore.enterRoom(cname, busiType, visibleOnFreshJoin);
    } catch (err) {
      if (err instanceof JoinCancelledError) {
        await this.router.navigate(this.leaveNavTarget);
        await this.roomStore.leaveRoom();
        this.stageStore.reset();
        this.audienceStore.reset();
        return;
      }
      throw err;
    }
    // The user may have navigated away while enterRoom's join-roster request was
    // in flight — the page's destroyRef.onDestroy has already run rcs.leave() by
    // now, so continuing here would open a fresh WS/RTC connection nothing will
    // ever tear down. Bail before any further side effects.
    if (this._destroying()) return;
    this.activeCallStore.syncCurrentRoom(
      cname,
      busiType,
      this.roomStore.name(),
      this.roomStore.isMicOn(),
      !this.roomStore.isVisible(),
    );

    if (isRestore) {
      this.activeCallStore.restore();
    }

    let voiceInfo: VoiceRoomInfo;
    let stage: StageUsersResponse | undefined;
    let audience: AudienceUsersResponse | undefined;
    let comments: CommentsResponse | undefined;
    try {
      if (this.fresh()) {
        // Fresh room (just created via create-room-modal): upstream's stage/list + comment
        // endpoints reliably 500 on a cname created moments earlier — they require
        // voice_room_info to have completed for this room/session first. Only fetch
        // room info; let the realtime push events (user_join/stage_join/comment) populate
        // the lists once the websocket connects, which they will naturally as the first
        // audience member (us) and any other joiners/chat arrive. stage/audience/comments
        // intentionally stay undefined here — code below guards on that.
        voiceInfo = await firstValueFrom(
          this.api.fetchVoiceRoomInfo(cname).pipe(takeUntilDestroyed(this.destroyRef)),
        );
      } else {
        // Cancels the actual in-flight HTTP request (not just the continuation guarded
        // below) if the page is destroyed mid-fetch — the largest payload in the join
        // flow, so the one most worth not letting complete for nothing on the wire.
        const bundle = await firstValueFrom(
          this.api.fetchJoinBundle<VoiceRoomInfo>(cname, busiType).pipe(takeUntilDestroyed(this.destroyRef)),
        );
        voiceInfo = bundle.voiceRoomInfo;
        stage = bundle.stageUsers;
        audience = bundle.audienceUsers;
        comments = bundle.comments;
      }
    } catch {
      // Also reached when takeUntilDestroyed cancelled the request above (not just a
      // real fetch failure) — don't force-navigate a user who has already left this
      // page to somewhere else entirely.
      if (this._destroying()) return;
      await this.router.navigate(['/']);
      this.toast.error('Room not found. Please create a new one.');
      return;
    }
    // Same race as above: bail if the page was destroyed while this fetch was in flight.
    if (this._destroying()) return;

    const ch = voiceInfo.channelInfo;
    this.roomStore.setCname(cname);
    this.roomStore.setRoomName(ch?.name?.trim() ?? '');
    this.roomStore.setRoomTopic(ch?.topic ?? '');
    this.roomStore.setRtcInfo(ch?.rtcInfo ?? null);
    this.roomStore.setRoomLevelInfo(voiceInfo.roomLevelInfo ?? null);
    const reqUser = voiceInfo.reqUserInfo;
    if (reqUser?.userId) {
      this.reqUserId.set(reqUser.userId);
      this.roomStore.setUserId(reqUser.userId);
      this.commentsStore.setCurrentUserId(reqUser.userId);
    }
    if (reqUser?.role) this.roomStore.setRole(reqUser.role);
    if (reqUser?.base?.nickname) this.roomStore.setNickname(reqUser.base.nickname);
    if (reqUser?.base?.headUrl) this.roomStore.setHeadUrl(reqUser.base.headUrl);
    if (reqUser?.base?.nationality) this.roomStore.setNationality(reqUser.base.nationality);

    // Snapshot is read but no longer authoritative for _isVisible — enterRoom already
    // applied it before we got here. We only need the snapshot here to decide mic state
    // (mic is captured at minimize time, then re-applied on restore).
    if (isRestore) {
      this.roomStore.setMicOn(this.activeCallStore.isMicOn());
    }

    const isVisible = this.roomStore.isVisible();

    // On a minimize→restore, RTC + WebSocket + RTM stay connected from the min'd state;
    // opening them again would tear down and re-establish those sockets for nothing.
    if (!isRestore) {
      const heartbeatHostId = isVisible ? (voiceInfo.hostInfo?.userId ?? 0) : 0;
      this.bffWs.connect(cname, heartbeatHostId, busiType, voiceInfo.configInfo?.heartbeatSecond ?? null);
    }

    const uid = this.roomStore.userId();

    if (isVisible) this.audienceStore.setCname(cname);
    if (stage?.list) this.stageStore.updateStageUsers([...stage.list]);
    if (audience?.list) this.audienceStore.updateAudienceUsers([...audience.list]);
    if (comments?.items) this.commentsStore.updateComments([...comments.items]);

    this.rtmStore.setCurrentUid(uid);

    if (!isRestore) {
      try {
        const rtcInfo = this.roomStore.rtcInfo();
        const rtcToken = rtcInfo?.token ?? null;
        const appId = rtcInfo?.appId?.trim() ? rtcInfo.appId : environment.agoraAppIdVoice;
        await this.rcs.connect(cname, uid, rtcToken, appId, !isVisible);
        // Populate the OS-level "Call in progress" tile so iOS shows the
        // room name in Control Center / lock-screen instead of a generic
        // "JilaliTalk" line. Cleared in onLeave() (and destroyRef.onDestroy
        // covers the minimize→destroy path). Guarded by `'mediaSession' in
        // navigator` because Safari < 14 and some embedded webviews don't
        // expose it.
        if ('mediaSession' in navigator) {
          const hostName = voiceInfo.hostInfo?.base?.nickname?.trim() || 'Voice room';
          const roomTitle = (voiceInfo.channelInfo?.name?.trim()) || cname;
          try {
            navigator.mediaSession.metadata = new MediaMetadata({
              title: roomTitle,
              artist: hostName,
              album: 'JilaliTalk',
            });
            navigator.mediaSession.playbackState = 'playing';
          } catch {
            // Older Safari throws on MediaMetadata construction — fail silent.
          }
        }
      } catch {
        this.toast.error('Failed to connect to audio');
      }

      try {
        await this.rcs.connectRtm(uid);
        await this.rcs.subscribeRtmChannel(cname);
      } catch {
      }
    }
  }

  protected override async makeVisible(cname: string, busiType: number): Promise<void> {
    const [bundleResult, joinResult] = await Promise.allSettled([
      firstValueFrom(this.api.fetchJoinBundle<VoiceRoomInfo>(cname, busiType)),
      firstValueFrom(this.api.joinRoom(cname, busiType)),
    ]);

    if (joinResult.status === 'rejected') {
      this.toast.error('Failed to rejoin visibly');
      return;
    }
    // The user may have left the room (or the page been destroyed) while these
    // requests were in flight — don't reconnect WS/reset stores for a page no
    // longer showing.
    if (this._destroying()) return;

    const bundleOk = bundleResult.status === 'fulfilled' ? bundleResult.value : null;
    if (!bundleOk) {
      this.toast.error('Failed to rejoin — room info unavailable');
    }
    const voiceInfo = bundleOk?.voiceRoomInfo;
    const stage = bundleOk?.stageUsers;
    const audience = bundleOk?.audienceUsers;

    this.roomStore.setVisibility(true);
    this.syncVisibilityToUrl(true);
    this.bffWs.connect(
      cname,
      voiceInfo?.hostInfo?.userId ?? 0,
      busiType,
      voiceInfo?.configInfo?.heartbeatSecond ?? null,
    );
    this.audienceStore.setCname(cname);
    this.stageStore.reset();
    if (stage?.list) this.stageStore.updateStageUsers([...stage.list]);
    if (audience?.list) this.audienceStore.updateAudienceUsers([...audience.list]);
    // Snapshot is meaningless for a "go visible" toggle (only relevant to a restore).
    // Update it to match the new visible state so a future minimize→restore cycle
    // doesn't capture stale invisible=true.
    this.activeCallStore.setInvisible(false);
    this.toast.success('You are now visible');
  }

  protected commentsRefreshMode(): 'merge' | 'replace' { return 'merge'; }

  protected async doRefreshRoomCore(cname: string): Promise<void> {
    const { voiceRoomInfo: voiceInfo, stageUsers: stage, audienceUsers: audience } = await firstValueFrom(
      this.api.fetchJoinBundle<VoiceRoomInfo>(cname, this.busiType()),
    );
    if (this._destroying()) return;
    const ch = voiceInfo.channelInfo;
    this.roomStore.setRoomName(ch?.name?.trim() ?? '');
    this.roomStore.setRoomTopic(ch?.topic ?? '');
    this.roomStore.setRoomLevelInfo(voiceInfo.roomLevelInfo ?? null);
    this.stageStore.updateStageUsers([...(stage?.list ?? [])]);
    this.audienceStore.updateAudienceUsers([...(audience?.list ?? [])]);
  }


  override onMediaToggle(): void {
    if (!this.roomStore.isVisible()) {
      this.toast.info('You are invisible — rejoin visibly to speak');
      return;
    }
    if (this.mediaToggleBusy()) return;
    this.mediaToggleBusy.set(true);
    this.doToggleMic().finally(() => this.mediaToggleBusy.set(false));
  }

  private async doToggleMic(): Promise<void> {
    const isOn = this.roomStore.isMicOn();
    const uid = this.roomStore.userId();

    if (isOn) {
      await this.rcs.setMicEnabled(false);
      if (this._destroying()) return;
      this.roomStore.setMicOn(false);
      this.stageStore.updateUserMicStatus(uid, false);
      this.notifyStageMicState(uid, true);
    } else {
      try {
        await this.rcs.stopAudio();
        if (!this.rcs.localAudioTrack()) {
          if (this.stageStore.isOnStage(uid)) {
            const cname = this.roomStore.cname();
            const publisherToken = cname
              ? (await firstValueFrom(this.api.fetchPublisherToken(cname))).token
              : null;
            await this.rcs.startAudio(publisherToken);
          } else {
            await this.talkFromUnderstage();
          }
        } else {
          await this.rcs.setMicEnabled(true);
        }
        if (this._destroying()) return;
        this.roomStore.setMicOn(true);
        this.stageStore.updateUserMicStatus(uid, true);
        this.notifyStageMicState(uid, false);
      } catch {
        this.toast.error('Failed to start microphone');
      }
    }
  }

  private async talkFromUnderstage(): Promise<void> {
    const cname = this.roomStore.cname();
    if (!cname) throw new Error('No active room');
    const uid = this.roomStore.userId();
    const rtcInfo = this.roomStore.rtcInfo();
    const token = rtcInfo?.token ?? null;
    const appId = rtcInfo?.appId?.trim() ? rtcInfo.appId : environment.agoraAppIdVoice;
    await this.rcs.agora.disconnect();
    await this.rcs.agora.connect(cname, uid, token, appId, true);
    await this.rcs.setMicEnabled(true);
  }

  private notifyStageMicState(uid: number, mute: boolean): void {
    const cname = this.roomStore.cname();
    if (!cname || !this.stageStore.isOnStage(uid)) return;
    this.api.muteUser(cname, this.roomStore.busiType(), uid, mute).pipe(
      takeUntilDestroyed(this.destroyRef),
      tap({ error: (err: unknown) => console.warn('[RoomPage] notifyStageMicState failed', err) }),
      catchError(() => EMPTY),
    ).subscribe();
  }

  override onToggleCamOrShare(): void {
    this.toast.info('Camera and screen share are not available yet');
  }


  override onToggleHand(): void {
    const cname = this.roomStore.cname();
    const busiType = this.busiType();
    if (!cname) return;

    const uid = this.roomStore.userId();
    const onStage = this.stageStore.isOnStage(uid);
    const isHost = this.roomStore.isHost();
    const isMod = this.roomStore.isModerator();

    if (isHost) {
      this.toast.info('The host cannot leave the stage');
      return;
    }

    if (onStage) {
      void this.rcs.stopAudio().catch(() => {});
      const stagedUser = this.stageStore.getStageUser(uid);
      this.stageStore.removeStageUser(uid);
      this.handToggleBusy.set(true);
      this.api.leaveStage(cname, busiType).pipe(
        takeUntilDestroyed(this.destroyRef),
      ).subscribe({
        next: () => {
          this.toast.info('You left the stage');
          this.handToggleBusy.set(false);
        },
        error: (err: unknown) => {
          if (stagedUser) this.stageStore.revertRemoveStageUser(stagedUser);
          console.error('[room] leaveStage failed', err);
          this.toast.error(httpErrorMessage(err, 'Failed to leave stage'));
          this.handToggleBusy.set(false);
        },
      });
      return;
    }

    if (isMod) {
      const myUser: StageUser = {
        userId: uid,
        nickname: this.roomStore.nickname() || 'You',
        headUrl: this.roomStore.headUrl() || null,
        nationality: this.roomStore.nationality() || null,
        role: this.roomStore.myRole() as UserRole,
        isTurnOnMic: false,
        isTurnOnCam: false,
        isBannedComment: false,
        rippleId: 0,
        rippleUrl: null,
        rippleAnimalType: 0,
        rippleAnimalUrl: null,
        isAiUser: false,
      };
      this.stageStore.addStageUser(myUser);
      this.handToggleBusy.set(true);
      this.api.joinStage(cname, busiType).pipe(
        takeUntilDestroyed(this.destroyRef),
      ).subscribe({
        next: () => {
          this.toast.info('You joined the stage');
          void this.rcs.startAudio().catch(() => {});
          this.handToggleBusy.set(false);
        },
        error: (err: unknown) => {
          this.stageStore.removeStageUser(uid);
          console.error('[room] joinStage failed', err);
          this.toast.error(httpErrorMessage(err, 'Failed to join stage'));
          this.handToggleBusy.set(false);
        },
      });
      return;
    }

    this.raiseOrLowerHand(cname, busiType);
  }


  override onSendComment(event: SendEvent): void {
    const cname = this.roomStore.cname();
    if (!cname) return;
    const nickname = this.roomStore.nickname() || 'Anonymous';
    const headUrl = this.roomStore.headUrl() || null;
    const nationality = this.roomStore.nationality() || null;
    const role = this.roomStore.myRole();

    const clientNonce = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : `local-${this.roomStore.userId()}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const payload = this.buildCommentPayload(event, clientNonce);

    this.commentsStore.addComment({
      _id: `local-${this.roomStore.userId()}-${Date.now()}`,
      clientNonce,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      userId: this.roomStore.userId(),
      nickname,
      headUrl,
      nationality,
      role: role as UserRole,
      vipType: 0,
      msg: {
        text: { text: event.text },
        replyInfo: event.replyInfo
          ? { msgId: event.replyInfo.msgId, fromId: event.replyInfo.fromId, fromNickname: event.replyInfo.nickname, text: event.replyInfo.text, msgType: 'text' }
          : null,
      },
      dayRankLevel: 0,
      giftLevel: 0,
      fgLevel: 0,
      fgName: '',
      fgIsActive: false,
      bubbleId: 0,
      bubbleUrl: null,
      bubbleColor: '',
      hitBad: 0,
      bubbleAnimalType: 0,
      bubbleAnimalUrl: null,
    });

    this.api.sendComment(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: (err: unknown) => console.warn('[RoomPage] sendComment failed', err) });
  }
}
