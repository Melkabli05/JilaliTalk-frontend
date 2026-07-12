import { Component, ChangeDetectionStrategy, inject, signal, input, effect, computed, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { RoomStore } from '../../store/room-store';
import { RoomRosterStore, ROSTER_READER, ROSTER_WRITER } from '../../roster/roster-store';
import { CommentsStore, COMMENTS_READER, COMMENTS_WRITER } from '../../comments/comments-store';
import { EventFeedStore } from '../../comments/event-feed-store';
import { ModStore, MOD_READER, MOD_WRITER } from '../../moderation/mod-store';
import { ManagersStore, MANAGERS_READER, MANAGERS_WRITER } from '../../moderation/managers-store';
import { SigninPanelComponent } from '../../signin/signin-panel';
import { InRoomRtmStore, IN_ROOM_RTM_READER, IN_ROOM_RTM_WRITER } from '../../in-room-rtm/in-room-rtm-store';
import { LiveRoomInfo } from '../../models/room-model';
import { SendEvent } from '../../comments/comment-input';
import { AGORA_APP_ID_VIDEO } from '@core/tokens/agora-app-id.token';
import { RoomHeaderComponent } from '../../room-header';
import { VideoStageGridComponent } from '../../ui/video-stage-grid';
import { AudienceListComponent } from '../../audience/audience-list';
import { CommentsPanelComponent } from '../../comments/comments-panel';
import { ManagersModalComponent } from '../../moderation/managers-modal';
import { AvSettingsComponent } from '../../audio-settings/av-settings';
import { RoomConnectionService } from '@core/realtime/room-connection.service';
import { HtRoomConnectionService } from '@core/realtime/ht-room-connection.service';
import { ToastService } from '@core/services/toast.service';
import { RoomApi } from '../../api/room-api';
import { ActiveCallStore } from '@store/active-call.store';
import { RoomFacade } from '../../facade/room-facade';
import { sendVideoComment } from '../../commands/send-comment.command';
import { toggleCam } from '../../commands/toggle-cam.command';
import { enterVideoRoom } from '../../commands/enter-room.command';
import { makeVideoRoomVisible } from '../../commands/make-room-visible.command';

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
    RoomConnectionService,
    RoomFacade,
  ],
  templateUrl: './video-room-page.html',
  styleUrl: './video-room-page.scss',
})
export class VideoRoomPageComponent {
  readonly cname = input('', { transform: (v: string | undefined) => v ?? '' });
  readonly busiType = input(1, { transform: (v: string | number | undefined) => Number(v) || 1 });
  readonly visible = input(true, {
    transform: (v: string | boolean | undefined) => v !== 'false' && v !== false,
  });
  /** See RoomPageComponent.fresh for the rationale — same upstream race applies to live rooms. */
  readonly fresh = input(false, {
    transform: (v: string | boolean | undefined) => v === 'true' || v === true || v === '1',
  });

  readonly roomStore = inject(RoomStore);
  private readonly agoraAppId = inject(AGORA_APP_ID_VIDEO);

  protected readonly rosterStore = inject(RoomRosterStore);
  protected readonly commentsStore = inject(CommentsStore);
  private readonly rtmStore = inject(InRoomRtmStore);
  protected readonly router = inject(Router);
  private readonly activeCallStore = inject(ActiveCallStore);
  private readonly api = inject(RoomApi);
  readonly rcs = inject(RoomConnectionService);
  readonly bffWs = inject(HtRoomConnectionService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly facade = inject(RoomFacade);

  readonly showSettings = signal(false);

  protected readonly leaveNavTarget = ['/rooms/live'];

  private entering = false;
  private hasConnectedOnce = false;

  readonly remoteVideoTracks = computed<
    ReadonlyMap<number, import('../../ui/video-stage-user').PlayableVideoTrack>
  >(() => {
    const map = new Map<number, import('../../ui/video-stage-user').PlayableVideoTrack>();
    for (const u of this.rcs.remoteUsers) {
      if (u.videoTrack) {
        map.set(u.uid, u.videoTrack as import('../../ui/video-stage-user').PlayableVideoTrack);
      }
    }
    return map;
  });

  constructor() {
    this.facade.init(this.busiType);

    effect(() => {
      if (this.facade.destroying()) return;
      const status = this.bffWs.wsStatus();
      if (this.hasConnectedOnce && status === 'disconnected') {
        this.toast.error('Connection lost — refresh to rejoin');
        void this.router.navigate(['/rooms/live']);
      }
      if (status === 'connected') this.hasConnectedOnce = true;
    });

    effect(() => {
      if (this.facade.destroying()) return;
      if (!this.rcs.roomClosed) return;
      this.toast.error('Room connection was terminated');
      void this.router.navigate(['/rooms/live']);
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
    await enterVideoRoom(cname, busiType, this.fresh(), this.visible(), {
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
      resolveRoomEntry: (c) => this.facade.resolveRoomEntry(c),
      destroying: () => this.facade.destroying(),
    });
  }

  protected async makeVisible(cname: string, busiType: number): Promise<void> {
    await makeVideoRoomVisible(cname, busiType, {
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

  protected commentsRefreshMode(): 'merge' | 'replace' { return 'replace'; }

  protected async doRefreshRoomCore(cname: string): Promise<void> {
    const { voiceRoomInfo: liveInfo, stageUsers: stage, audienceUsers: audience } = await firstValueFrom(
      this.api.fetchJoinBundle<LiveRoomInfo>(cname, this.busiType()),
    );
    if (this.facade.destroying()) return;
    const ch = liveInfo.channelInfo;
    this.roomStore.setRoomName(ch?.name?.trim() ?? '');
    this.roomStore.setRoomTopic(ch?.topic ?? '');
    this.rosterStore.updateStageUsers([...(stage?.list ?? [])]);
    this.rosterStore.updateAudienceUsers([...(audience?.list ?? [])]);
  }

  onMediaToggle(): void {
    if (!this.roomStore.isVisible()) {
      this.toast.info('You are invisible — rejoin visibly to enable camera');
      return;
    }
    if (this.facade.mediaToggleBusy()) return;
    this.facade.mediaToggleBusy.set(true);
    toggleCam(this.roomStore, this.rosterStore, this.rcs, this.api, () => this.facade.destroying(), this.toast)
      .finally(() => this.facade.mediaToggleBusy.set(false));
  }

  onToggleCamOrShare(): void {
    this.toast.info('Screen share is not available yet');
  }

  onToggleHand(): void {
    const cname = this.roomStore.cname();
    const busiType = this.busiType();
    if (!cname) return;
    this.facade.raiseOrLowerHand(cname, busiType);
  }

  onSendComment(event: SendEvent): void {
    const cname = this.roomStore.cname();
    if (!cname) return;
    sendVideoComment(event, cname, this.roomStore, this.api, this.toast, this.destroyRef);
  }
}
