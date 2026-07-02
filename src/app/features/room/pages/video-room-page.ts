import { Component, ChangeDetectionStrategy, inject, signal, input, effect, computed, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { EMPTY, firstValueFrom, forkJoin } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { VideoRoomStore } from '../state/video-room-store';
import { JoinCancelledError } from '../state/base-room-store';
import { StageStore } from '../state/stage-store';
import { AudienceStore } from '../state/audience-store';
import { CommentsStore } from '../feature/comments/comments-store';
import { ModStore, ModAction } from '../feature/moderation/mod-store';
import { ManagersStore } from '../feature/moderation/managers-store';
import { SigninPanelComponent } from '../feature/signin/signin-panel';
import { GiftsStore } from '../feature/gifts/gifts-store';
import { InRoomRtmStore } from '../feature/in-room-rtm/in-room-rtm-store';
import { GoodieStore } from '../feature/goodie-bag/goodie-store';
import { StageUser, AudienceUser, SendCommentPayload, LiveRoomInfo, StageUsersResponse, AudienceUsersResponse } from '../data/room-model';
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
              [isCamOn]="roomStore.isCamOn()"
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

      /* Mobile: comments hidden, single-column body. */
      @container video-room (max-width: 1023.98px) {
        .comments-section {
          display: none;
        }
        .room-body {
          grid-template-columns: 1fr;
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

  readonly roomStore = inject(VideoRoomStore) as unknown as RoomStoreContract;

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
    const visible = this.visible();
    this.audienceStore.setBusiType(busiType);
    try {
      await this.roomStore.joinRoom(cname, busiType, visible);
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

    let liveInfo: LiveRoomInfo;
    try {
      liveInfo = await firstValueFrom(this.api.fetchLiveRoomInfo(cname));
    } catch {
      await this.router.navigate(['/rooms']);
      this.toast.error('Room not found');
      return;
    }

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

    const isVisible = this.roomStore.isVisible();
    const heartbeatHostId = isVisible ? (liveInfo.hostInfo?.userId ?? 0) : 0;
    this.bffWs.connect(actualCname, heartbeatHostId, busiType);
    const uid = this.roomStore.userId();

    if (isVisible) this.audienceStore.setCname(actualCname);
    const { stage, audience, comments } = await firstValueFrom(
      forkJoin({
        stage: this.api.fetchStageUsers(actualCname, busiType),
        audience: this.api.fetchAudienceUsers(actualCname, busiType),
        comments: this.api.fetchComments(actualCname, busiType),
      }),
    );
    this.stageStore.updateStageUsers([...(stage?.list ?? [])]);
    this.audienceStore.updateAudienceUsers([...(audience?.list ?? [])]);
    this.commentsStore.updateComments([...(comments?.items ?? [])]);


    this.rtmStore.setCurrentUid(uid);

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

  override async onToggleInvisible(): Promise<void> {
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

  private async makeInvisible(cname: string, busiType: number): Promise<void> {
    await firstValueFrom(this.api.leaveRoom(cname, busiType));
    this.roomStore.setVisibility(false);
    this.syncVisibilityToUrl(false);
    this.stageStore.reset();
    await this.rcs.stopAudio();
    this.bffWs.connect(cname, 0, busiType);
    this.toast.info('You are now invisible');
  }

  private async makeVisible(cname: string, busiType: number): Promise<void> {
    let liveInfo: LiveRoomInfo;
    let stage: StageUsersResponse | undefined;
    let audience: AudienceUsersResponse | undefined;
    try {
      const bundle = await firstValueFrom(this.api.fetchJoinBundle<LiveRoomInfo>(cname, busiType));
      liveInfo = bundle.voiceRoomInfo;
      stage = bundle.stageUsers;
      audience = bundle.audienceUsers;
    } catch {
      this.toast.error('Failed to rejoin — room info unavailable');
      return;
    }

    try {
      await firstValueFrom(this.api.joinRoom(cname, busiType));
    } catch {
      this.toast.error('Failed to rejoin visibly');
      return;
    }

    this.roomStore.setVisibility(true);
    this.syncVisibilityToUrl(true);
    this.bffWs.connect(cname, liveInfo.hostInfo?.userId ?? 0, busiType);
    this.audienceStore.setCname(cname);
    this.stageStore.reset();
    this.stageStore.updateStageUsers([...(stage?.list ?? [])]);
    this.audienceStore.updateAudienceUsers([...(audience?.list ?? [])]);
    this.toast.success('You are now visible');
  }

  protected commentsRefreshMode(): 'merge' | 'replace' { return 'replace'; }

  protected async doRefreshRoomCore(cname: string): Promise<void> {
    const { voiceRoomInfo: liveInfo, stageUsers: stage, audienceUsers: audience } = await firstValueFrom(
      this.api.fetchJoinBundle<LiveRoomInfo>(cname, this.busiType()),
    );
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
    const isOn = this.roomStore.isCamOn();
    const uid = this.roomStore.userId();

    if (isOn) {
      await this.rcs.setCamEnabled(false);
      this.roomStore.setCamOn(false);
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
        this.roomStore.setCamOn(true);
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
    if (!this.roomStore.isVisible()) {
      this.toast.info('You are invisible — rejoin visibly to raise your hand');
      return;
    }
    if (this.handToggleBusy()) return;
    const cname = this.roomStore.cname();
    const busiType = this.busiType();
    if (!cname) return;

    const wasRaised = this.roomStore.isHandRaised();
    const raised = !wasRaised;
    this.roomStore.setHandRaised(raised);
    this.handToggleBusy.set(true);

    this.api.raiseHand(cname, busiType, raised ? 1 : 2).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => this.handToggleBusy.set(false),
      error: (err: unknown) => {
        console.error('[video-room] raiseHand failed', err);
        this.toast.error(httpErrorMessage(err, 'Failed to update hand'));
        this.roomStore.setHandRaised(wasRaised);
        this.handToggleBusy.set(false);
      },
    });
  }

  override onSendComment(event: SendEvent): void {
    const cname = this.roomStore.cname();
    if (!cname) return;
    const nickname = this.roomStore.nickname() || 'Anonymous';
    const headUrl = this.roomStore.headUrl() || null;
    const nationality = this.roomStore.nationality() || null;

    const payload: SendCommentPayload = {
      cname,
      busiType: this.roomStore.busiType(),
      nickname,
      headUrl,
      nationality,
      role: this.roomStore.myRole(),
      text: event.text,
      replyInfo: event.replyInfo
        ? {
            msgId: event.replyInfo.msgId,
            fromId: event.replyInfo.fromId,
            fromNickname: event.replyInfo.nickname,
            text: event.replyInfo.text,
            msgType: 'text',
          }
        : null,
    };

    this.api.sendComment(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: (err: unknown) => {
          console.warn('[video-room] sendComment failed', err);
          this.toast.error(httpErrorMessage(err, 'Failed to send message'));
        },
      });

    void this.rcs
      .sendRtmMessage(this.roomStore.userId(), cname, event.text, nickname, headUrl ?? '')
      .catch(() => {});
  }
}
