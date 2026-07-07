import { Component, ChangeDetectionStrategy, inject, signal, input, effect, computed, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { EMPTY, firstValueFrom } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { VideoRoomStore } from '../state/video-room-store';
import { JoinCancelledError } from '../state/base-room-store';
import { StageStore } from '../state/stage-store';
import { AudienceStore } from '../state/audience-store';
import { CommentsStore } from '../feature/comments/comments-store';
import { EventFeedStore } from '../feature/comments/event-feed-store';
import { ModStore, ModAction } from '../feature/moderation/mod-store';
import { ManagersStore } from '../feature/moderation/managers-store';
import { SigninPanelComponent } from '../feature/signin/signin-panel';
import { GiftsStore } from '../feature/gifts/gifts-store';
import { InRoomRtmStore } from '../feature/in-room-rtm/in-room-rtm-store';
import { GoodieStore } from '../feature/goodie-bag/goodie-store';
import { StageUser, AudienceUser, LiveRoomInfo, StageUsersResponse, AudienceUsersResponse, CommentsResponse } from '../data/room-model';
import { SendEvent } from '../feature/comments/comment-input';
import { environment } from '@env/environment';
import { RoomHeaderComponent } from '../feature/room-header';
import { VideoStageGridComponent } from '../ui/video-stage-grid';
import { AudienceListComponent } from '../feature/audience/audience-list';
import { CommentsPanelComponent } from '../feature/comments/comments-panel';
import { ManagersModalComponent } from '../feature/moderation/managers-modal';
import { AvSettingsComponent } from '../feature/audio-settings/av-settings';
import { RoomConnectionService } from '@core/realtime/room-connection.service';
import { BffRoomSocketService } from '@core/realtime/bff-room-socket.service';
import { httpErrorMessage } from '@shared/utils/http-error-message.util';
import { RoomPageBase, RoomStoreContract } from './room-page-base';

@Component({
  selector: 'app-video-room-page',
  imports: [
    RoomHeaderComponent,
    VideoStageGridComponent,
    AudienceListComponent,
    CommentsPanelComponent,
    ManagersModalComponent,
    SigninPanelComponent,
    AvSettingsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    VideoRoomStore,
    StageStore,
    AudienceStore,
    EventFeedStore,
    CommentsStore,
    ModStore,
    GiftsStore,
    InRoomRtmStore,
    GoodieStore,
    ManagersStore,
    RoomConnectionService,
  ],
  template: `
    <div class="room-layout">
      <div class="room-body">
        <div class="left-column">
          <header class="room-header">
            <app-room-header
              [name]="roomStore.name()"
              [topic]="roomStore.topic()"
              [cname]="roomStore.cname() ?? ''"
              [isMicOn]="false"
              [isCamOn]="videoRoomStore.isCamOn()"
              [camBusy]="mediaToggleBusy()"
              [micSpeaking]="selfSpeaking()"
              [isHandRaised]="roomStore.isHandRaised()"
              [isOnStage]="stageStore.isOnStage(roomStore.userId())"
              [isModerator]="roomStore.isModerator()"
              [invisible]="!roomStore.isVisible()"
              [refreshing]="refreshingRoom()"
              [captionEnabled]="captionEnabled()"
              [wsStatus]="bffWs.wsStatus()"
              (toggleCam)="onMediaToggle()"
              (toggleCamOrShare)="onToggleCamOrShare()"
              (toggleHand)="onToggleHand()"
              (gift)="onGift()"
              (pitch)="onPitch()"
              (settings)="showSettings.set(true)"
              (managers)="onManagers()"
              (reward)="onReward()"
              (toggleCaption)="onToggleCaption()"
              (toggleInvisible)="onToggleInvisible()"
              (refresh)="onRefreshRoom()"
              (leave)="onLeave()"
            />
          </header>

          <section class="stage-section">
            <app-video-stage-grid
              [users]="stageStore.stageUsers()"
              [videoTracks]="remoteVideoTracks()"
              [speakingUids]="rcs.speakingUids()"
              (userClick)="onStageUserClick($event)"
            />
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
        </div>

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
    </div>

    @if (showSettings()) {
      <app-av-settings />
    }
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
  styles: [
    `
      /* Container queries: parent (.app-main) owns viewport height and
         bottom-nav padding. The room page must NOT compute its own vh.
         Layout adapts to the slot width via @container, not viewport. */
      :host {
        display: block;
        height: 100%;
        overflow: hidden;
        container-type: inline-size;
        container-name: video-room;
      }

      .room-layout {
        display: grid;
        grid-template-rows: 1fr;
        height: 100%;
        overflow: hidden;
      }

      .room-body {
        display: grid;
        grid-template-columns: minmax(0, 1fr) var(--comments-panel-width);
        overflow: hidden;
        min-height: 0;
      }

      .left-column {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: var(--room-header-height) minmax(0, 1fr) auto;
        overflow: hidden;
        min-height: 0;
      }

      .room-header {
        overflow: visible;
        position: relative;
        z-index: var(--z-overlay);
      }

      .stage-section {
        overflow: hidden;
        min-height: 0;
        display: grid;
        grid-template-rows: 1fr;
        border-radius: var(--radius-xl);
      }
      .stage-section app-video-stage-grid {
        height: 100%;
        overflow: hidden;
      }
      .audience-section {
        overflow: hidden;
        min-height: 0;
        min-width: 0;
        flex-shrink: 0;
      }
      .comments-section {
        height: 100%;
        overflow: hidden;
        min-height: 0;
      }

      /* Mobile: single-column body. Comments are visible (matches the voice
         room's mobile shape) so users can read and post on mobile. The
         comments section gets the remaining flex space; the stage and
         audience use their natural heights. */
      @container video-room (max-width: 1023.98px) {
        .room-body {
          grid-template-columns: 1fr;
          grid-template-rows: 1fr auto;
        }
        .comments-section {
          height: auto;
          min-height: 240px;
          max-height: 50%;
        }
      }
    `,
  ],
})
export class VideoRoomPageComponent extends RoomPageBase {
  readonly cname = input('', { transform: (v: string | undefined) => v ?? '' });
  readonly busiType = input(1, { transform: (v: string | number | undefined) => Number(v) || 1 });
  readonly visible = input(true, {
    transform: (v: string | boolean | undefined) => v !== 'false' && v !== false,
  });
  /** See RoomPageComponent.fresh for the rationale — same upstream race applies to live rooms. */
  readonly fresh = input(false, {
    transform: (v: string | boolean | undefined) => v === 'true' || v === true || v === '1',
  });

  readonly roomStore: RoomStoreContract = inject(VideoRoomStore);
  /** Same singleton as `roomStore` above, injected again with its concrete
   *  type for the camera-specific calls below — VideoRoomStore always
   *  implements isCamOn/setCamOn (unlike the shared RoomStoreContract,
   *  where they're optional because voice rooms have no camera). */
  protected readonly videoRoomStore = inject(VideoRoomStore);

  readonly showSettings = signal(false);

  protected readonly leaveNavTarget = ['/rooms/live'];

  private entering = false;
  private hasConnectedOnce = false;

  readonly remoteVideoTracks = computed<
    ReadonlyMap<number, import('../ui/video-stage-user').PlayableVideoTrack>
  >(() => {
    const map = new Map<number, import('../ui/video-stage-user').PlayableVideoTrack>();
    for (const u of this.rcs.remoteUsers) {
      if (u.videoTrack) {
        map.set(u.uid, u.videoTrack as import('../ui/video-stage-user').PlayableVideoTrack);
      }
    }
    return map;
  });

  constructor() {
    super();

    effect(() => {
      if (this._destroying()) return;
      const status = this.bffWs.wsStatus();
      if (this.hasConnectedOnce && status === 'disconnected') {
        this.toast.error('Connection lost — refresh to rejoin');
        void this.router.navigate(['/rooms/live']);
      }
      if (status === 'connected') this.hasConnectedOnce = true;
    });

    effect(() => {
      if (this._destroying()) return;
      if (!this.rcs.roomClosed) return;
      this.toast.error('Room connection was terminated');
      void this.router.navigate(['/rooms/live']);
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
      await this.roomStore.enterRoom(cname, busiType, this.visible());
    } catch (err) {
      if (err instanceof JoinCancelledError) {
        await this.router.navigate(['/rooms']);
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
    // Snapshot served its purpose for restore detection — and now becomes the
    // "I am currently in this room" live state that other consumers (e.g. the
    // UserInfoModal's "you're already in this room" check) can read. We update
    // the snapshot with the current room's cname + the user's visibility + mic
    // state. (The previous `clear()` made cname null while the user was in
    // a full-screen room, which broke the modal's "already in this room"
    // detection entirely.)
    this.activeCallStore.minimize(
      cname,
      busiType,
      this.roomStore.name(),
      this.roomStore.isMicOn(),
      !this.roomStore.isVisible(),
    );

    // For a fresh (just-created) room we only call liveRoomInfo; upstream's stage/list
    // + comment endpoints reliably 500 on a cname created moments earlier, requiring
    // live_room_info to have completed first. Realtime push events (user_join/stage_join/
    // comment) populate the rosters once the websocket connects. stage/audience/comments
    // intentionally stay undefined on the fresh path — code below guards on that.
    let liveInfo: LiveRoomInfo;
    let stage: StageUsersResponse | undefined;
    let audience: AudienceUsersResponse | undefined;
    let comments: CommentsResponse | undefined;
    try {
      if (this.fresh()) {
        liveInfo = await firstValueFrom(this.api.fetchLiveRoomInfo(cname));
      } else {
        const bundle = await firstValueFrom(this.api.fetchJoinBundle<LiveRoomInfo>(cname, busiType));
        liveInfo = bundle.voiceRoomInfo;
        stage = bundle.stageUsers;
        audience = bundle.audienceUsers;
        comments = bundle.comments;
      }
    } catch {
      await this.router.navigate(['/rooms']);
      this.toast.error('Room not found');
      return;
    }
    // Same race as above: bail if the page was destroyed while this fetch was in flight.
    if (this._destroying()) return;

    const ch = liveInfo.channelInfo;
    const actualCname = ch?.cname || cname;
    this.roomStore.setCname(actualCname);
    this.roomStore.setRoomName(ch?.name?.trim() ?? '');
    this.roomStore.setRoomTopic(ch?.topic ?? '');
    this.roomStore.setRtcInfo(ch?.rtcInfo ?? null);
    const reqUser = liveInfo.reqUserInfo;
    if (reqUser?.userId) {
      this.reqUserId.set(reqUser.userId);
      this.roomStore.setUserId(reqUser.userId);
      this.commentsStore.setCurrentUserId(reqUser.userId);
    }
    if (reqUser?.role) this.roomStore.setRole(reqUser.role);
    if (reqUser?.base?.nickname) this.roomStore.setNickname(reqUser.base.nickname);
    if (reqUser?.base?.headUrl) this.roomStore.setHeadUrl(reqUser.base.headUrl);
    if (reqUser?.base?.nationality) this.roomStore.setNationality(reqUser.base.nationality);

    if (isRestore) {
      this.roomStore.setMicOn(this.activeCallStore.isMicOn());
    }

    const isVisible = this.roomStore.isVisible();
    // On a minimize→restore, RTC + WebSocket stay connected from the min'd state.
    if (!isRestore) {
      const heartbeatHostId = isVisible ? (liveInfo.hostInfo?.userId ?? 0) : 0;
      this.bffWs.connect(actualCname, heartbeatHostId, busiType);
    }
    const uid = this.roomStore.userId();

    if (isVisible) this.audienceStore.setCname(actualCname);
    if (stage?.list) this.stageStore.updateStageUsers([...stage.list]);
    if (audience?.list) this.audienceStore.updateAudienceUsers([...audience.list]);
    if (comments?.items) this.commentsStore.updateComments([...comments.items]);

    this.rtmStore.setCurrentUid(uid);

    if (!isRestore) {
      try {
        const rtcInfo = this.roomStore.rtcInfo();
        const rtcToken = rtcInfo?.token ?? null;
        const appId = rtcInfo?.appId?.trim() ? rtcInfo.appId : environment.agoraAppIdVideo;
        await this.rcs.connect(actualCname, uid, rtcToken, appId, !isVisible);
      } catch {
        this.toast.error('Failed to connect to audio');
      }

      try {
        await this.rcs.connectRtm(uid);
        await this.rcs.subscribeRtmChannel(actualCname);
      } catch {
      }
    }
  }

  protected override async makeVisible(cname: string, busiType: number): Promise<void> {
    // joinRoom is the authoritative call — if it fails the user isn't
    // server-side joined, so we must NOT flip local state to visible
    // (would leave the user in an inconsistent "visible" state with
    // no upstream record). The bundle fetch is best-effort: if it
    // fails we still flip visible and connect WS, but the toast warns
    // and the stage/audience lists stay empty until the next reconcile.
    try {
      await firstValueFrom(this.api.joinRoom(cname, busiType));
    } catch {
      this.toast.error('Failed to rejoin visibly');
      return;
    }
    // The user may have left the room (or the page been destroyed) while this
    // request was in flight — don't reconnect WS/reset stores for a page no
    // longer showing.
    if (this._destroying()) return;

    let liveInfo: LiveRoomInfo | undefined;
    let stage: StageUsersResponse | undefined;
    let audience: AudienceUsersResponse | undefined;
    try {
      const bundle = await firstValueFrom(this.api.fetchJoinBundle<LiveRoomInfo>(cname, busiType));
      liveInfo = bundle.voiceRoomInfo;
      stage = bundle.stageUsers;
      audience = bundle.audienceUsers;
    } catch {
      this.toast.error('Failed to rejoin — room info unavailable');
    }
    if (this._destroying()) return;

    this.roomStore.setVisibility(true);
    this.syncVisibilityToUrl(true);
    this.bffWs.connect(cname, liveInfo?.hostInfo?.userId ?? 0, busiType);
    this.audienceStore.setCname(cname);
    this.stageStore.reset();
    if (stage?.list) this.stageStore.updateStageUsers([...stage.list]);
    if (audience?.list) this.audienceStore.updateAudienceUsers([...audience.list]);
    this.activeCallStore.setInvisible(false);
    this.toast.success('You are now visible');
  }

  protected commentsRefreshMode(): 'merge' | 'replace' { return 'replace'; }

  protected async doRefreshRoomCore(cname: string): Promise<void> {
    const { voiceRoomInfo: liveInfo, stageUsers: stage, audienceUsers: audience } = await firstValueFrom(
      this.api.fetchJoinBundle<LiveRoomInfo>(cname, this.busiType()),
    );
    if (this._destroying()) return;
    const ch = liveInfo.channelInfo;
    this.roomStore.setRoomName(ch?.name?.trim() ?? '');
    this.roomStore.setRoomTopic(ch?.topic ?? '');
    this.stageStore.updateStageUsers([...(stage?.list ?? [])]);
    this.audienceStore.updateAudienceUsers([...(audience?.list ?? [])]);
  }

  override onMediaToggle(): void {
    if (!this.roomStore.isVisible()) {
      this.toast.info('You are invisible — rejoin visibly to enable camera');
      return;
    }
    if (this.mediaToggleBusy()) return;
    this.mediaToggleBusy.set(true);
    this.doToggleCam().finally(() => this.mediaToggleBusy.set(false));
  }

  private async doToggleCam(): Promise<void> {
    const isOn = this.videoRoomStore.isCamOn();
    const uid = this.roomStore.userId();

    if (isOn) {
      await this.rcs.setCamEnabled(false);
      if (this._destroying()) return;
      this.videoRoomStore.setCamOn(false);
      this.stageStore.updateUserCamStatus(uid, false);
    } else {
      try {
        if (!this.rcs.localVideoTrack()) {
          const cname = this.roomStore.cname();
          const publisherToken = cname
            ? (await firstValueFrom(this.api.fetchPublisherToken(cname))).token
            : null;
          await this.rcs.startVideo(publisherToken);
        } else {
          await this.rcs.setCamEnabled(true);
        }
        if (this._destroying()) return;
        this.videoRoomStore.setCamOn(true);
        this.stageStore.updateUserCamStatus(uid, true);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        this.toast.error(`Failed to start camera: ${reason}`);
      }
    }
  }

  override onToggleCamOrShare(): void {
    this.toast.info('Screen share is not available yet');
  }

  override onToggleHand(): void {
    const cname = this.roomStore.cname();
    const busiType = this.busiType();
    if (!cname) return;
    this.raiseOrLowerHand(cname, busiType);
  }

  override onSendComment(event: SendEvent): void {
    const cname = this.roomStore.cname();
    if (!cname) return;
    const nickname = this.roomStore.nickname() || 'Anonymous';
    const headUrl = this.roomStore.headUrl() || null;

    const payload = this.buildCommentPayload(event);

    this.api.sendComment(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: (err: unknown) => {
          console.warn('[video-room] sendComment failed', err);
          this.toast.error(httpErrorMessage(err, 'Failed to send message'));
        },
      });
  }
}
