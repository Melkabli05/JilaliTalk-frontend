import { Component, ChangeDetectionStrategy, inject, signal, input, effect, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { EMPTY, firstValueFrom, forkJoin } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RoomStore } from '../state/room-store';
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
import { StageUser, SendCommentPayload, VoiceRoomInfo } from '../data/room-model';
import { UserRole } from '@core/models/user-role';
import { SendEvent } from '../feature/comments/comment-input';
import { environment } from '@env/environment';
import { RoomHeaderComponent } from '../feature/room-header';
import { StageGridComponent } from '../feature/stage/stage-grid';
import { AudienceListComponent } from '../feature/audience/audience-list';
import { CommentsPanelComponent } from '../feature/comments/comments-panel';
import { ManagersModalComponent } from '../feature/moderation/managers-modal';
import { AvSettingsComponent } from '../feature/audio-settings/av-settings';
import { RoomConnectionService } from '@core/realtime/room-connection.service';
import { BffRoomSocketService } from '@core/realtime/bff-room-socket.service';
import { httpErrorMessage } from '@shared/utils/http-error-message.util';
import { RoomPageBase, RoomStoreContract } from './room-page-base';

@Component({
  selector: 'app-room-page',
  imports: [
    RoomHeaderComponent,
    StageGridComponent,
    AudienceListComponent,
    CommentsPanelComponent,
    ManagersModalComponent,
    AvSettingsComponent,
    SigninPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [RoomStore, StageStore, AudienceStore, CommentsStore, ModStore, GiftsStore, InRoomRtmStore, GoodieStore, ManagersStore, RoomConnectionService],
  template: `
<div class="room-layout">
      <div class="room-body">
        <div class="left-column">
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
    /* Container queries: the page is loaded into .app-main, so the layout
       depends on the available width inside that slot, not the viewport.
       container-type lets children react to the same parent context. */
    :host {
      display: block;
      height: 100%;
      overflow: hidden;
      container-type: size;
      container-name: room-page;
    }

    .room-layout {
      display: grid;
      grid-template-rows: 1fr;
      height: 100%;
      overflow: hidden;
    }

    /* Mobile-first: column stack. .left-column takes the bulk of vertical
       space; audience-section grows inside it. */
    .room-body {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-height: 0;
    }

    .left-column {
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
      flex: 1 1 auto;
    }

    .room-header {
      flex-shrink: 0;
      overflow: visible;
      position: relative;
      z-index: var(--z-overlay);
    }

    .stage-section {
      display: flex;
      flex-direction: column;
      flex-shrink: 1;
      min-height: 0;
      min-width: 0;
      max-height: 30cqh;
      overflow: hidden;
    }
    .stage-section app-stage-grid {
      flex: 1 1 auto;
      min-height: 0;
    }
    .audience-section { flex: 1 1 0; min-height: 22cqh; min-width: 0; overflow: hidden; }
    .comments-section {
      display: flex;
      flex-direction: column;
      flex: 0 0 auto;
      min-height: 0;
      overflow: hidden;
      max-height: 50%;
    }

    /* Tablet-sized mobile: a touch more stage room. */
    @container room-page (min-width: 480px) {
      .stage-section { max-height: 34cqh; }
    }

    /* Desktop: two-column grid, comments becomes a sidebar. */
    @container room-page (min-width: 1024px) {
      .room-body {
        display: grid;
        grid-template-columns: minmax(0, 1fr) var(--comments-panel-width);
        overflow: hidden;
      }
      .left-column { height: 100%; flex: none; }
      .stage-section { max-height: none; height: auto; flex: none; }
      .comments-section { display: flex; height: 100%; max-height: none; flex: none; }
    }
  `]
})
export class RoomPageComponent extends RoomPageBase {
  readonly cname = input('', { transform: (v: string | undefined) => v ?? '' });
  readonly busiType = input(2, { transform: (v: string | number | undefined) => Number(v) || 2 });
  readonly visible = input(true, {
    transform: (v: string | boolean | undefined) => v !== 'false' && v !== false,
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
    const visible = this.visible();
    this.audienceStore.setBusiType(busiType);
    try {
      await this.roomStore.joinRoom(cname, busiType, visible);
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

    let voiceInfo: VoiceRoomInfo;
    try {
      voiceInfo = await firstValueFrom(this.api.fetchVoiceRoomInfo(cname));
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

    const isVisible = this.roomStore.isVisible();
    const heartbeatHostId = isVisible ? (voiceInfo.hostInfo?.userId ?? 0) : 0;
    this.bffWs.connect(cname, heartbeatHostId, busiType, voiceInfo.configInfo?.heartbeatSecond ?? null);
    const uid = this.roomStore.userId();

    if (isVisible) this.audienceStore.setCname(cname);
    const { stage, audience, comments } = await firstValueFrom(
      forkJoin({
        stage: this.api.fetchStageUsers(cname, busiType),
        audience: this.api.fetchAudienceUsers(cname, busiType),
        comments: this.api.fetchComments(cname, busiType),
      }),
    );
    this.stageStore.updateStageUsers([...(stage?.list ?? [])]);
    this.audienceStore.updateAudienceUsers([...(audience?.list ?? [])]);
    this.commentsStore.updateComments([...(comments?.items ?? [])]);


    this.rtmStore.setCurrentUid(uid);

    try {
      const rtcInfo = this.roomStore.rtcInfo();
      const rtcToken = rtcInfo?.token ?? null;
      const appId = rtcInfo?.appId?.trim() ? rtcInfo.appId : environment.agoraAppIdVoice;
      await this.rcs.connect(cname, uid, rtcToken, appId, !isVisible);
    } catch {
      this.toast.error('Failed to connect to audio');
    }

    try {
      await this.rcs.connectRtm(uid);
      await this.rcs.subscribeRtmChannel(cname);
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
    this.bffWs.connect(cname, 0, busiType, null);
    this.toast.info('You are now invisible');
  }

  private async makeVisible(cname: string, busiType: number): Promise<void> {
    const rtcInfo = this.roomStore.rtcInfo();
    let voiceInfo: VoiceRoomInfo | undefined = rtcInfo
      ? { channelInfo: {}, configInfo: { heartbeatSecond: null }, hostInfo: null } as unknown as VoiceRoomInfo
      : undefined;

    if (!voiceInfo) {
      try {
        const fetched = await firstValueFrom(this.api.fetchVoiceRoomInfo(cname));
        voiceInfo = fetched;
      } catch {
        this.toast.error('Failed to rejoin — room info unavailable');
        return;
      }
    }

    try {
      await firstValueFrom(this.api.joinRoom(cname, busiType));
    } catch {
      this.toast.error('Failed to rejoin visibly');
      return;
    }

    this.roomStore.setVisibility(true);
    this.syncVisibilityToUrl(true);
    this.bffWs.connect(
      cname,
      voiceInfo!.hostInfo?.userId ?? 0,
      busiType,
      voiceInfo!.configInfo?.heartbeatSecond ?? null,
    );
    this.audienceStore.setCname(cname);
    this.stageStore.reset();
    try {
      const { stage, audience } = await firstValueFrom(
        forkJoin({
          stage: this.api.fetchStageUsers(cname, busiType),
          audience: this.api.fetchAudienceUsers(cname, busiType),
        }),
      );
      this.stageStore.updateStageUsers([...(stage?.list ?? [])]);
      this.audienceStore.updateAudienceUsers([...(audience?.list ?? [])]);
    } catch { /* 30s reconciliation will catch up */ }
    this.toast.success('You are now visible');
  }

  protected commentsRefreshMode(): 'merge' | 'replace' { return 'merge'; }

  protected async doRefreshRoomCore(cname: string): Promise<void> {
    const { voiceInfo, stage, audience } = await firstValueFrom(
      forkJoin({
        voiceInfo: this.api.fetchVoiceRoomInfo(cname),
        stage: this.api.fetchStageUsers(cname, this.busiType()),
        audience: this.api.fetchAudienceUsers(cname, this.busiType()),
      }),
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
    if (!this.roomStore.isVisible()) {
      this.toast.info('You are invisible — rejoin visibly to raise your hand');
      return;
    }
    if (this.handToggleBusy()) return;
    const cname = this.roomStore.cname();
    const busiType = this.busiType();
    if (!cname) return;

    const uid = this.roomStore.userId();
    const onStage = this.stageStore.isOnStage(uid);
    const isHost = this.roomStore.isHost();
    const isMod = this.roomStore.isModerator();
    const wasRaised = this.roomStore.isHandRaised();
    this.handToggleBusy.set(true);

    if (isHost) {
      this.toast.info('The host cannot leave the stage');
      this.handToggleBusy.set(false);
      return;
    }

    if (onStage) {
      void this.rcs.stopAudio().catch(() => {});
      const stagedUser = this.stageStore.getStageUser(uid);
      this.stageStore.removeStageUser(uid);
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

    const raised = !wasRaised;
    this.roomStore.setHandRaised(raised);
    this.api.raiseHand(cname, busiType, raised ? 1 : 2).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => this.handToggleBusy.set(false),
      error: (err: unknown) => {
        console.error('[room] raiseHand failed', err);
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
      role: this.roomStore.myRole() as UserRole,
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

    const selfUid = this.roomStore.userId();
    this.commentsStore.addComment({
      _id: `local-${selfUid}-${Date.now()}`,
      createdAt: Date.now(),
      userId: selfUid,
      nickname,
      headUrl,
      nationality,
      role: this.roomStore.myRole() as UserRole,
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
