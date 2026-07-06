import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { RoomHeaderComponent } from '../../feature/room-header';
import { StageGridComponent } from '../../feature/stage/stage-grid';
import { AudienceListComponent } from '../../feature/audience/audience-list';
import { CommentsPanelComponent } from '../../feature/comments/comments-panel';
import { SigninPanelComponent } from '../../feature/signin/signin-panel';
import { SendEvent } from '../../feature/comments/comment-input';
import { StageUser } from '../../data/room-model';
import { AudienceUser } from '../../data/room-model';
import { Comment } from '../../data/room-model';
import { CaptionEntry } from '../../data/room-model';

/**
 * Desktop variant of the voice room. Two-column layout: stage + audience on
 * the left, comments sidebar on the right. Hosts the existing
 * `app-room-header` (12-button toolbar) unchanged. The room-page shell
 * passes the same lifecycle signals through as inputs/outputs — this
 * component is purely presentational; all state, Agora, WS, RTM lifecycle
 * stays in `RoomPageComponent` / `RoomPageBase`.
 */
@Component({
  selector: 'app-room-desktop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RoomHeaderComponent,
    StageGridComponent,
    AudienceListComponent,
    CommentsPanelComponent,
    SigninPanelComponent,
  ],
  template: `
    <div class="room-layout">
      <div class="room-header">
        <app-room-header
          [name]="name()"
          [topic]="topic()"
          [cname]="cname()"
          [isMicOn]="isMicOn()"
          [micSpeaking]="micSpeaking()"
          [micBusy]="micBusy()"
          [isHandRaised]="isHandRaised()"
          [isOnStage]="isOnStage()"
          [isModerator]="isModerator()"
          [invisible]="invisible()"
          [refreshing]="refreshing()"
          [captionEnabled]="captionEnabled()"
          [wsStatus]="wsStatus()"
          (toggleMic)="toggleMic.emit()"
          (toggleCamOrShare)="toggleCamOrShare.emit()"
          (toggleHand)="toggleHand.emit()"
          (gift)="gift.emit()"
          (pitch)="pitch.emit()"
          (managers)="managers.emit()"
          (reward)="reward.emit()"
          (toggleCaption)="toggleCaption.emit()"
          (toggleInvisible)="toggleInvisible.emit()"
          (refresh)="refresh.emit()"
          (leave)="leave.emit()"
          (minimize)="minimize.emit()"
        />
      </div>

      <section class="stage-section">
        <app-stage-grid [users]="stageUsers()" [speakingUids]="speakingUids()" (userClick)="stageUserClick.emit($event)" />
      </section>

      <section class="audience-section">
        <app-audience-list
          [users]="audienceUsers()"
          [speakingUids]="speakingUids()"
          [currentUserId]="currentUserId()"
          [canInviteToStage]="canInviteToStage()"
          [inviteBusy]="inviteBusy()"
          (userClick)="audienceUserClick.emit($event)"
          (inviteToStage)="inviteToStage.emit($event)"
        />
      </section>

      <aside class="comments-section">
        <app-comments-panel
          [comments]="comments()"
          [captions]="captions()"
          [currentUserId]="currentUserId()"
          [refreshing]="refreshingComments()"
          [typingNames]="typingNames()"
          [disabled]="commentsDisabled()"
          (sendComment)="sendComment.emit($event)"
          (typing)="typing.emit()"
          (refresh)="refreshComments.emit()"
          (loadCaptions)="loadCaptions.emit()"
        />
      </aside>
    </div>

    @if (showSignin()) {
      <app-signin-panel
        [cname]="cname()"
        [hostId]="hostId()"
        [roomLevel]="roomLevel()"
        [roomLevelIcon]="roomLevelIcon()"
        (onClose)="signinClose.emit()"
      />
    }
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      overflow: hidden;
    }

    .room-layout {
      display: grid;
      grid-template-areas:
        "header   comments"
        "stage    comments"
        "audience comments";
      grid-template-columns: minmax(0, 1fr) var(--comments-panel-width);
      grid-template-rows: auto auto minmax(22cqh, 1fr);
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
    .stage-section app-stage-grid { flex: 1 1 auto; min-height: 0; }

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
  `],
})
export class RoomDesktopComponent {
  // Header / room meta
  readonly name = input<string>('');
  readonly topic = input<string>('');
  readonly cname = input<string>('');
  readonly invisible = input<boolean>(false);
  readonly refreshing = input<boolean>(false);
  readonly captionEnabled = input<boolean>(false);
  readonly wsStatus = input<'connecting' | 'connected' | 'reconnecting' | 'disconnected'>('disconnected');

  // Mic / hand / camera state
  readonly isMicOn = input<boolean>(false);
  readonly micSpeaking = input<boolean>(false);
  readonly micBusy = input<boolean>(false);
  readonly isHandRaised = input<boolean>(false);
  readonly isOnStage = input<boolean>(false);
  readonly isModerator = input<boolean>(false);

  // Stage / audience data
  readonly stageUsers = input<readonly StageUser[]>([]);
  readonly audienceUsers = input<readonly AudienceUser[]>([]);
  readonly speakingUids = input<readonly number[]>([]);
  readonly currentUserId = input<number>(0);
  readonly canInviteToStage = input<boolean>(false);
  readonly inviteBusy = input<number | null>(null);

  // Comments data
  readonly comments = input<readonly Comment[]>([]);
  readonly captions = input<readonly CaptionEntry[]>([]);
  readonly refreshingComments = input<boolean>(false);
  readonly typingNames = input<readonly string[]>([]);
  readonly commentsDisabled = input<boolean>(false);

  // Sign-in panel
  readonly showSignin = input<boolean>(false);
  readonly hostId = input<number>(0);
  readonly roomLevel = input<number>(1);
  readonly roomLevelIcon = input<string | null>(null);

  // Outputs — bubble up to RoomPageBase
  readonly toggleMic = output<void>();
  readonly toggleCamOrShare = output<void>();
  readonly toggleHand = output<void>();
  readonly gift = output<void>();
  readonly pitch = output<void>();
  readonly managers = output<void>();
  readonly reward = output<void>();
  readonly toggleCaption = output<void>();
  readonly toggleInvisible = output<void>();
  readonly refresh = output<void>();
  readonly leave = output<void>();
  readonly minimize = output<void>();
  readonly stageUserClick = output<StageUser>();
  readonly audienceUserClick = output<AudienceUser>();
  readonly inviteToStage = output<AudienceUser>();
  readonly sendComment = output<SendEvent>();
  readonly typing = output<void>();
  readonly refreshComments = output<void>();
  readonly loadCaptions = output<void>();
  readonly signinClose = output<void>();
}