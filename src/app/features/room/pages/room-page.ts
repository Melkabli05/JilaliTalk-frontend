import { Component, inject, input, effect } from '@angular/core';
import { EMPTY, firstValueFrom } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RoomStore } from '../state/room-store';
import { JoinCancelledError } from '../state/base-room-store';
import { StageStore } from '../state/stage-store';
import { AudienceStore } from '../state/audience-store';
import { CommentsStore } from '../feature/comments/comments-store';
import { ModStore } from '../feature/moderation/mod-store';
import { ManagersStore } from '../feature/moderation/managers-store';
import { SigninPanelComponent } from '../feature/signin/signin-panel';
import { GiftsStore } from '../feature/gifts/gifts-store';
import { InRoomRtmStore } from '../feature/in-room-rtm/in-room-rtm-store';
import { GoodieStore } from '../feature/goodie-bag/goodie-store';
import { StageUser, VoiceRoomInfo, StageUsersResponse, AudienceUsersResponse, CommentsResponse } from '../data/room-model';
import { UserRole } from '@core/models/user-role';
import { SendEvent } from '../feature/comments/comment-input';
import { environment } from '@env/environment';
import { RoomHeaderComponent } from '../feature/room-header';
import { StageGridComponent } from '../feature/stage/stage-grid';
import { AudienceListComponent } from '../feature/audience/audience-list';
import { CommentsPanelComponent } from '../feature/comments/comments-panel';
import { httpErrorMessage } from '@shared/utils/http-error-message.util';
import { RoomPageBase, RoomStoreContract } from './room-page-base';

@Component({
  selector: 'app-room-page',
  imports: [
    RoomHeaderComponent,
    StageGridComponent,
    AudienceListComponent,
    CommentsPanelComponent,
    SigninPanelComponent,
  ],
  providers: [RoomStore, StageStore, AudienceStore, CommentsStore, ModStore, GiftsStore, InRoomRtmStore, GoodieStore, ManagersStore],
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

    .room-layout {
      display: grid;
      grid-template-areas: "header" "stage" "audience" "comments";
      grid-template-columns: 1fr;
      /* Audience uses fit-content(22cqh), not minmax(min-content, 22cqh):
         minmax's growth limit is a plain length, so CSS Grid's Maximize
         Tracks step spends available free space growing it straight to
         22cqh regardless of actual content — collapsed on mobile or a
         2-listener room still reserves a fixed 22% of the viewport as dead
         space. fit-content()'s growth limit is min(max-content, 22cqh), so
         the row only grows as far as its content actually needs, capped at
         22cqh for busy rooms. */
      grid-template-rows: auto minmax(0, 30cqh) fit-content(22cqh) minmax(0, 1fr);
      height: 100%;
      overflow: hidden;
    }

    .room-header {
      grid-area: header;
      position: relative;
      z-index: var(--z-overlay);
    }

    .stage-section {
      grid-area: stage;
      display: flex;
      flex-direction: column;
      min-height: 0;
      min-width: 0;
      overflow: hidden;
    }
    .stage-section app-stage-grid {
      flex: 1 1 auto;
      min-height: 0;
    }

    .audience-section {
      grid-area: audience;
      min-height: 0;
      min-width: 0;
      overflow: hidden;
    }

    .comments-section {
      grid-area: comments;
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }

    @container room-page (min-width: 480px) {
      .room-layout { grid-template-rows: auto minmax(0, 34cqh) fit-content(22cqh) minmax(0, 1fr); }
    }

    /* Two-column layout requires both enough width AND enough height —
       landscape phones (e.g. iPhone in landscape, ~844×390) have the
       width but not the height, and end up with the comments panel
       squished to ~82px. Gate the desktop layout on a min-height too. */
    @container room-page (min-width: 1024px) and (min-height: 500px) {
      .room-layout {
        grid-template-areas: "header comments" "stage comments" "audience comments";
        grid-template-columns: minmax(0, 1fr) var(--comments-panel-width);
        grid-template-rows: auto auto minmax(22cqh, 1fr);
      }
    }

    /* Mobile: the immersive route hides the global header and bottom-nav,
       so the entire viewport is available to the room. Pin the room-header
       to the top and let the comment input pin itself to the bottom (see
       comment-input.ts). .room-layout stays overflow:hidden — the middle
       content (stage / audience / comment list) each have their own
       internal scroll containers, so the room page itself is not
       scrollable. Header row is removed from the grid (it's position:fixed,
       outside flow) and the comments row absorbs whatever the audience
       doesn't take. */
    @container room-page (max-width: 1023.98px) {
      .room-layout {
        grid-template-areas: "stage" "audience" "comments";
        /* Stage cap raised from 30cqh → 45cqh, AND switched from
           minmax(0, 45cqh) to fit-content(45cqh). The minmax form
           spent all 45cqh on empty rooms (no speakers = ~220px of
           tile content + 154px of empty whitespace inside the grid
           cell). fit-content()'s growth limit is min(max-content,
           45cqh) — the row only grows as far as its content needs,
           capped at 45cqh for a full 8-seat room. Same pattern as the
           audience row below. Stage grid host's overflow-y: auto +
           overscroll-behavior: contain still kicks in when the room
           is busy and the row hits the 45cqh cap. */
        grid-template-rows: fit-content(45cqh) fit-content(22cqh) minmax(0, 1fr);
      }
      /* The fixed room-header sits visually above the stage section's
         grid row. Padding the stage by the header's height keeps the
         stage header strip ("Stage 8") and the first row of tiles from
         rendering behind the pinned toolbar. */
      .stage-section {
        padding-top: var(--room-header-height);
      }
      .room-header {
        position: fixed;
        top: var(--shell-inset-top);
        left: 0;
        right: 0;
        z-index: var(--z-shell-header);
        grid-area: auto;
      }
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

  readonly roomStore = inject(RoomStore) as unknown as RoomStoreContract;

  protected readonly leaveNavTarget = ['/rooms'];

  private entering = false;

  constructor() {
    super();

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
      // Single call: sets _isVisible from the active-call snapshot on a minimize→restore,
      // or from the routed ?visible= query param on any other entry, and posts upstream
      // join exactly when visible.
      await this.roomStore.enterRoom(cname, busiType, this.visible());
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
    // Snapshot served its purpose (either consumed by enterRoom on restore, or already
    // cleared above for a stale different-room snapshot); from here, enterRoom is the truth.
    this.activeCallStore.clear();

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
        voiceInfo = await firstValueFrom(this.api.fetchVoiceRoomInfo(cname));
      } else {
        const bundle = await firstValueFrom(this.api.fetchJoinBundle<VoiceRoomInfo>(cname, busiType));
        voiceInfo = bundle.voiceRoomInfo;
        stage = bundle.stageUsers;
        audience = bundle.audienceUsers;
        comments = bundle.comments;
      }
    } catch {
      await this.router.navigate(['/']);
      this.toast.error('Room not found. Please create a new one.');
      return;
    }

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
    // Only seed the rosters from the bundle when we actually have one. On the
    // fresh path there's no bundle and the lists stay undefined — passing an
    // empty array would still call setCollection([]) and wipe anything the
    // websocket already pushed between connect and HTTP response.
    if (stage) this.stageStore.updateStageUsers([...stage.list]);
    if (audience) this.audienceStore.updateAudienceUsers([...audience.list]);
    if (comments) this.commentsStore.updateComments([...(comments.items ?? [])]);

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

    if (bundleResult.status === 'rejected') {
      this.toast.error('Failed to rejoin — room info unavailable');
      return;
    }
    if (joinResult.status === 'rejected') {
      this.toast.error('Failed to rejoin visibly');
      return;
    }

    const { voiceRoomInfo: voiceInfo, stageUsers: stage, audienceUsers: audience } = bundleResult.value;

    this.roomStore.setVisibility(true);
    this.syncVisibilityToUrl(true);
    this.bffWs.connect(
      cname,
      voiceInfo.hostInfo?.userId ?? 0,
      busiType,
      voiceInfo.configInfo?.heartbeatSecond ?? null,
    );
    this.audienceStore.setCname(cname);
    this.stageStore.reset();
    this.stageStore.updateStageUsers([...(stage?.list ?? [])]);
    this.audienceStore.updateAudienceUsers([...(audience?.list ?? [])]);
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

    const payload = this.buildCommentPayload(event);

    this.commentsStore.addComment({
      _id: `local-${this.roomStore.userId()}-${Date.now()}`,
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

    void this.rcs.sendRtmMessage(this.roomStore.userId(), cname, event.text, nickname, headUrl ?? '').catch(() => {});
  }
}
