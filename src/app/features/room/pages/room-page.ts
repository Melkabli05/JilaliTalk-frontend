import { Component, ChangeDetectionStrategy, inject, input, effect, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { RoomStore } from '../store/room-store';
import { RoomRosterStore, ROSTER_READER, ROSTER_WRITER } from '../roster/roster-store';
import { CommentsStore, COMMENTS_READER, COMMENTS_WRITER } from '../comments/comments-store';
import { EventFeedStore } from '../comments/event-feed-store';
import { ModStore, MOD_READER, MOD_WRITER } from '../moderation/mod-store';
import { ManagersStore, MANAGERS_READER, MANAGERS_WRITER } from '../moderation/managers-store';
import { SigninPanelComponent } from '../signin/signin-panel';
import { InRoomRtmStore, IN_ROOM_RTM_READER, IN_ROOM_RTM_WRITER } from '../in-room-rtm/in-room-rtm-store';
import { VoiceRoomInfo } from '../models/room-model';
import { SendEvent } from '../comments/comment-input';
import { AGORA_APP_ID_VOICE } from '@core/tokens/agora-app-id.token';
import { RoomHeaderComponent } from '../room-header';
import { StageGridComponent } from '../stage/stage-grid';
import { AudienceListComponent } from '../audience/audience-list';
import { CommentsPanelComponent } from '../comments/comments-panel';
import { RoomApi } from '../api/room-api';
import { RoomConnectionService } from '@core/realtime/room-connection.service';
import { BffRoomSocketService } from '@core/realtime/bff-room-socket.service';
import { ToastService } from '@core/services/toast.service';
import { ActiveCallStore } from '@store/active-call.store';
import { RoomFacade } from '../facade/room-facade';
import { sendVoiceComment } from '../commands/send-comment.command';
import { toggleMic } from '../commands/toggle-mic.command';
import { leaveStage, joinStageAsModerator } from '../commands/toggle-stage-membership.command';
import { enterVoiceRoom } from '../commands/enter-room.command';
import { makeVoiceRoomVisible } from '../commands/make-room-visible.command';

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
    RoomRosterStore,
    { provide: ROSTER_READER, useExisting: RoomRosterStore },
    { provide: ROSTER_WRITER, useExisting: RoomRosterStore },
    EventFeedStore,
    CommentsStore,
    { provide: COMMENTS_READER, useExisting: CommentsStore },
    { provide: COMMENTS_WRITER, useExisting: CommentsStore },
    ModStore,
    { provide: MOD_READER, useExisting: ModStore },
    { provide: MOD_WRITER, useExisting: ModStore },
    InRoomRtmStore,
    { provide: IN_ROOM_RTM_READER, useExisting: InRoomRtmStore },
    { provide: IN_ROOM_RTM_WRITER, useExisting: InRoomRtmStore },
    ManagersStore,
    { provide: MANAGERS_READER, useExisting: ManagersStore },
    { provide: MANAGERS_WRITER, useExisting: ManagersStore },
    RoomFacade,
  ],
  templateUrl: './room-page.html',
  styleUrl: './room-page.scss',
})
export class RoomPageComponent {
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
  private readonly agoraAppId = inject(AGORA_APP_ID_VOICE);

  protected readonly rosterStore = inject(RoomRosterStore);
  protected readonly commentsStore = inject(CommentsStore);
  private readonly rtmStore = inject(InRoomRtmStore);
  protected readonly router = inject(Router);
  private readonly activeCallStore = inject(ActiveCallStore);
  private readonly api = inject(RoomApi);
  readonly rcs = inject(RoomConnectionService);
  readonly bffWs = inject(BffRoomSocketService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly facade = inject(RoomFacade);

  protected readonly leaveNavTarget = ['/rooms'];

  private entering = false;
  private hasConnectedOnce = false;

  constructor() {
    this.facade.init(this.busiType);

    // Voice-room counterpart of video-room-page.ts's identical effect: without this,
    // a voice room that gives up reconnecting (5 failed attempts) while the user is
    // actively in the room — not minimized, so resolveRoomEntry()'s gaveUp() check
    // never runs — left the user silently stuck with a dead socket and no further
    // chat/realtime updates, with only the small header status dot as any indication.
    effect(() => {
      if (this.facade.destroying()) return;
      const status = this.bffWs.wsStatus();
      if (this.hasConnectedOnce && status === 'disconnected') {
        this.toast.error('Connection lost — refresh to rejoin');
        void this.router.navigate(['/rooms']);
      }
      if (status === 'connected') this.hasConnectedOnce = true;
    });

    effect(() => {
      if (this.facade.destroying()) return;
      const cname = this.cname();
      const busiType = this.busiType();
      if (!cname) return;
      void this.enterRoom(cname, busiType);
    });
  }

  onRefreshRoom(): Promise<void> {
    return this.facade.refreshRoom(this.roomStore.cname() ?? '', (c) => this.doRefreshRoomCore(c));
  }

  onRefreshComments(): Promise<void> {
    return this.facade.refreshComments(this.commentsRefreshMode());
  }

  onToggleInvisible(): Promise<void> {
    return this.facade.toggleInvisible((c, bt) => this.makeVisible(c, bt));
  }

  async onLeave(): Promise<void> {
    try {
      await this.facade.leave();
    } finally {
      await this.router.navigate(this.leaveNavTarget);
    }
  }

  onMinimize(): void {
    this.facade.minimize();
    void this.router.navigate(this.leaveNavTarget);
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
    await enterVoiceRoom(cname, busiType, this.fresh(), this.visible(), {
      roomStore: this.roomStore,
      rosterStore: this.rosterStore,
      commentsStore: this.commentsStore,
      rtmStore: this.rtmStore,
      activeCallStore: this.activeCallStore,
      api: this.api,
      bffWs: this.bffWs,
      rcs: this.rcs,
      router: this.router,
      toast: this.toast,
      destroyRef: this.destroyRef,
      agoraAppId: this.agoraAppId,
      reqUserId: this.facade.reqUserId,
      leaveNavTarget: this.leaveNavTarget,
      resolveRoomEntry: (c) => this.facade.resolveRoomEntry(c),
      destroying: () => this.facade.destroying(),
    });
  }

  protected async makeVisible(cname: string, busiType: number): Promise<void> {
    await makeVoiceRoomVisible(cname, busiType, {
      roomStore: this.roomStore,
      rosterStore: this.rosterStore,
      api: this.api,
      bffWs: this.bffWs,
      toast: this.toast,
      activeCallStore: this.activeCallStore,
      syncVisibilityToUrl: (v) => this.facade.syncVisibilityToUrl(v),
      destroying: () => this.facade.destroying(),
    });
  }

  protected commentsRefreshMode(): 'merge' | 'replace' { return 'merge'; }

  protected async doRefreshRoomCore(cname: string): Promise<void> {
    const { voiceRoomInfo: voiceInfo, stageUsers: stage, audienceUsers: audience } = await firstValueFrom(
      this.api.fetchJoinBundle<VoiceRoomInfo>(cname, this.busiType()),
    );
    if (this.facade.destroying()) return;
    const ch = voiceInfo.channelInfo;
    this.roomStore.setRoomName(ch?.name?.trim() ?? '');
    this.roomStore.setRoomTopic(ch?.topic ?? '');
    this.roomStore.setRoomLevelInfo(voiceInfo.roomLevelInfo ?? null);
    this.rosterStore.updateStageUsers([...(stage?.list ?? [])]);
    this.rosterStore.updateAudienceUsers([...(audience?.list ?? [])]);
  }


  onMediaToggle(): void {
    if (!this.roomStore.isVisible()) {
      this.toast.info('You are invisible — rejoin visibly to speak');
      return;
    }
    if (this.facade.mediaToggleBusy()) return;
    this.facade.mediaToggleBusy.set(true);
    toggleMic(
      this.roomStore,
      this.rosterStore,
      this.rcs,
      this.api,
      this.agoraAppId,
      this.destroyRef,
      () => this.facade.destroying(),
      this.toast,
    ).finally(() => this.facade.mediaToggleBusy.set(false));
  }

  onToggleCamOrShare(): void {
    this.toast.info('Camera and screen share are not available yet');
  }


  onToggleHand(): void {
    const cname = this.roomStore.cname();
    const busiType = this.busiType();
    if (!cname) return;

    const uid = this.roomStore.userId();
    const onStage = this.rosterStore.isOnStage(uid);
    const isHost = this.roomStore.isHost();
    const isMod = this.roomStore.isModerator();

    if (isHost) {
      this.toast.info('The host cannot leave the stage');
      return;
    }

    if (onStage) {
      leaveStage(cname, busiType, uid, this.rosterStore, this.rcs, this.api, this.toast, this.facade.handToggleBusy, this.destroyRef);
      return;
    }

    if (isMod) {
      joinStageAsModerator(cname, busiType, uid, this.roomStore, this.rosterStore, this.rcs, this.api, this.toast, this.facade.handToggleBusy, this.destroyRef);
      return;
    }

    this.facade.raiseOrLowerHand(cname, busiType);
  }


  onSendComment(event: SendEvent): void {
    const cname = this.roomStore.cname();
    if (!cname) return;
    sendVoiceComment(event, cname, this.roomStore, this.commentsStore, this.api, this.destroyRef);
  }
}
